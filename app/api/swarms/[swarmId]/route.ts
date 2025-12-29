import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

// GET /api/swarms/[swarmId] - Get a single swarm with details
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

    // Fetch swarm with agents and recent tasks
    const { data: swarm, error } = await (supabase as any)
      .from("swarms")
      .select(`
        *,
        agents:swarm_agents(*),
        tasks:swarm_tasks(*)
      `)
      .eq("id", swarmId)
      .eq("user_id", user.id)
      .single();

    if (error || !swarm) {
      return NextResponse.json({ error: "Swarm not found" }, { status: 404 });
    }

    return NextResponse.json({
      swarm: {
        id: swarm.id,
        name: swarm.name,
        description: swarm.description,
        status: swarm.status,
        createdAt: swarm.created_at,
        tasksCompleted: swarm.tasks_completed || 0,
        totalTasks: swarm.total_tasks || 0,
        agents: swarm.agents?.map((agent: any) => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          status: agent.status || "idle",
          currentTask: agent.current_task,
          tasksCompleted: agent.tasks_completed || 0,
          hasBrowser: agent.has_browser || false,
          capabilities: agent.capabilities || [],
          lastActivity: agent.last_activity,
        })) || [],
        tasks: swarm.tasks?.map((task: any) => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          assignedTo: task.assigned_to || [],
          createdAt: task.created_at,
          completedAt: task.completed_at,
        })) || [],
      },
    });
  } catch (error) {
    console.error("Error in GET /api/swarms/[swarmId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/swarms/[swarmId] - Update a swarm
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

    const body = await request.json();
    const { name, description, status } = body;

    // Validate status if provided
    const validStatuses = ["running", "paused", "completed"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (status !== undefined) updates.status = status;

    // Update the swarm
    const { data: swarm, error } = await (supabase as any)
      .from("swarms")
      .update(updates)
      .eq("id", swarmId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !swarm) {
      return NextResponse.json({ error: "Failed to update swarm" }, { status: 500 });
    }

    return NextResponse.json({
      swarm: {
        id: swarm.id,
        name: swarm.name,
        description: swarm.description,
        status: swarm.status,
        createdAt: swarm.created_at,
        tasksCompleted: swarm.tasks_completed || 0,
        totalTasks: swarm.total_tasks || 0,
      },
    });
  } catch (error) {
    console.error("Error in PUT /api/swarms/[swarmId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/swarms/[swarmId] - Delete a swarm
export async function DELETE(
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

    // Delete the swarm (cascade will delete agents and tasks)
    const { error } = await (supabase as any)
      .from("swarms")
      .delete()
      .eq("id", swarmId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting swarm:", error);
      return NextResponse.json({ error: "Failed to delete swarm" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/swarms/[swarmId]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
