import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

// GET /api/swarms - List all swarms for the user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch swarms with their agents
    const { data: swarms, error } = await (supabase as any)
      .from("swarms")
      .select(`
        *,
        agents:swarm_agents(*)
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching swarms:", error);
      return NextResponse.json({ error: "Failed to fetch swarms" }, { status: 500 });
    }

    // Transform data for frontend
    const transformedSwarms = (swarms as any[])?.map((swarm: any) => ({
      id: swarm.id,
      name: swarm.name,
      description: swarm.description,
      status: swarm.status || "paused",
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
    })) || [];

    return NextResponse.json({ swarms: transformedSwarms });
  } catch (error) {
    console.error("Error in GET /api/swarms:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/swarms - Create a new swarm
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Create the swarm
    const { data: swarm, error } = await (supabase as any)
      .from("swarms")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        status: "paused",
        tasks_completed: 0,
        total_tasks: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating swarm:", error);
      return NextResponse.json({ error: "Failed to create swarm" }, { status: 500 });
    }

    return NextResponse.json({
      swarm: {
        id: swarm.id,
        name: swarm.name,
        description: swarm.description,
        status: swarm.status,
        createdAt: swarm.created_at,
        tasksCompleted: 0,
        totalTasks: 0,
        agents: [],
      },
    });
  } catch (error) {
    console.error("Error in POST /api/swarms:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
