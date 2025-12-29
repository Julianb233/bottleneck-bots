import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

// GET /api/swarms/[swarmId]/tasks - Get all tasks in a swarm
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ swarmId: string }> }
) {
  try {
    const { swarmId } = await params;
    const supabase = await createServerComponentClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify swarm ownership
    const { data: swarm } = await (supabase as any)
      .from("swarms")
      .select("id")
      .eq("id", swarmId)
      .eq("user_id", user.id)
      .single();

    if (!swarm) {
      return NextResponse.json({ error: "Swarm not found" }, { status: 404 });
    }

    // Fetch tasks
    const { data: tasks, error } = await (supabase as any)
      .from("swarm_tasks")
      .select("*")
      .eq("swarm_id", swarmId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks:", error);
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }

    return NextResponse.json({
      tasks: (tasks as any[])?.map((task: any) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status || "pending",
        priority: task.priority || "medium",
        assignedTo: task.assigned_to || [],
        capabilities: task.capabilities || [],
        result: task.result,
        error: task.error,
        createdAt: task.created_at,
        startedAt: task.started_at,
        completedAt: task.completed_at,
      })) || [],
    });
  } catch (error) {
    console.error("Error in GET /api/swarms/[swarmId]/tasks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/swarms/[swarmId]/tasks - Create and assign a new task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ swarmId: string }> }
) {
  try {
    const { swarmId } = await params;
    const supabase = await createServerComponentClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify swarm ownership
    const { data: swarm } = await (supabase as any)
      .from("swarms")
      .select("id, total_tasks")
      .eq("id", swarmId)
      .eq("user_id", user.id)
      .single();

    if (!swarm) {
      return NextResponse.json({ error: "Swarm not found" }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, assignedTo, priority, capabilities } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!assignedTo || !Array.isArray(assignedTo) || assignedTo.length === 0) {
      return NextResponse.json({ error: "At least one agent must be assigned" }, { status: 400 });
    }

    // Validate priority
    const validPriorities = ["low", "medium", "high", "critical"];
    const taskPriority = priority && validPriorities.includes(priority) ? priority : "medium";

    // Create the task
    const { data: task, error } = await (supabase as any)
      .from("swarm_tasks")
      .insert({
        swarm_id: swarmId,
        title: title.trim(),
        description: description?.trim() || null,
        assigned_to: assignedTo,
        priority: taskPriority,
        capabilities: capabilities || [],
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating task:", error);
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }

    // Update swarm total tasks
    await (supabase as any)
      .from("swarms")
      .update({ total_tasks: (swarm.total_tasks || 0) + 1 })
      .eq("id", swarmId);

    // Update assigned agents' current task
    for (const agentId of assignedTo) {
      await (supabase as any)
        .from("swarm_agents")
        .update({
          status: "active",
          current_task: title.substring(0, 100),
        })
        .eq("id", agentId)
        .eq("swarm_id", swarmId);
    }

    // Add a system message about the task
    await (supabase as any)
      .from("swarm_messages")
      .insert({
        swarm_id: swarmId,
        role: "system",
        content: `New task assigned: "${title}" to ${assignedTo.length} agent(s)`,
        type: "task",
      });

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignedTo: task.assigned_to,
        capabilities: task.capabilities,
        createdAt: task.created_at,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/swarms/[swarmId]/tasks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/swarms/[swarmId]/tasks - Update a task status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ swarmId: string }> }
) {
  try {
    const { swarmId } = await params;
    const supabase = await createServerComponentClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify swarm ownership
    const { data: swarm } = await (supabase as any)
      .from("swarms")
      .select("id, tasks_completed")
      .eq("id", swarmId)
      .eq("user_id", user.id)
      .single();

    if (!swarm) {
      return NextResponse.json({ error: "Swarm not found" }, { status: 404 });
    }

    const body = await request.json();
    const { taskId, status, result, error: taskError } = body;

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    // Validate status
    const validStatuses = ["pending", "in_progress", "completed", "failed"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (result !== undefined) updates.result = result;
    if (taskError !== undefined) updates.error = taskError;

    if (status === "in_progress") {
      updates.started_at = new Date().toISOString();
    }
    if (status === "completed" || status === "failed") {
      updates.completed_at = new Date().toISOString();
    }

    // Update the task
    const { data: task, error: updateError } = await (supabase as any)
      .from("swarm_tasks")
      .update(updates)
      .eq("id", taskId)
      .eq("swarm_id", swarmId)
      .select()
      .single();

    if (updateError || !task) {
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    // If task completed, update swarm stats and agent status
    if (status === "completed") {
      await (supabase as any)
        .from("swarms")
        .update({ tasks_completed: (swarm.tasks_completed || 0) + 1 })
        .eq("id", swarmId);

      // Reset assigned agents to idle
      for (const agentId of task.assigned_to || []) {
        const { data: agent } = await (supabase as any)
          .from("swarm_agents")
          .select("tasks_completed")
          .eq("id", agentId)
          .single();

        await (supabase as any)
          .from("swarm_agents")
          .update({
            status: "idle",
            current_task: null,
            last_activity: new Date().toISOString(),
            tasks_completed: (agent?.tasks_completed || 0) + 1,
          })
          .eq("id", agentId);
      }
    }

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignedTo: task.assigned_to,
        result: task.result,
        error: task.error,
        createdAt: task.created_at,
        startedAt: task.started_at,
        completedAt: task.completed_at,
      },
    });
  } catch (error) {
    console.error("Error in PUT /api/swarms/[swarmId]/tasks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
