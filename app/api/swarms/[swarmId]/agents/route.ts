import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

// GET /api/swarms/[swarmId]/agents - Get all agents in a swarm
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

    // Fetch agents
    const { data: agents, error } = await (supabase as any)
      .from("swarm_agents")
      .select("*")
      .eq("swarm_id", swarmId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching agents:", error);
      return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
    }

    return NextResponse.json({
      agents: (agents as any[])?.map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        status: agent.status || "idle",
        currentTask: agent.current_task,
        tasksCompleted: agent.tasks_completed || 0,
        hasBrowser: agent.has_browser || false,
        capabilities: agent.capabilities || [],
        systemPrompt: agent.system_prompt,
        integrationExpertise: agent.integration_expertise || [],
        knowledgeSources: agent.knowledge_sources || [],
        lastActivity: agent.last_activity,
        browserSessionId: agent.browser_session_id,
      })) || [],
    });
  } catch (error) {
    console.error("Error in GET /api/swarms/[swarmId]/agents:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/swarms/[swarmId]/agents - Spawn a new agent
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
      .select("id")
      .eq("id", swarmId)
      .eq("user_id", user.id)
      .single();

    if (!swarm) {
      return NextResponse.json({ error: "Swarm not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, role, capabilities, useBrowser, systemPrompt, integrationExpertise, knowledgeSources } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!role || typeof role !== "string") {
      return NextResponse.json({ error: "Role is required" }, { status: 400 });
    }

    // Create the agent with all configuration
    const { data: agent, error } = await (supabase as any)
      .from("swarm_agents")
      .insert({
        swarm_id: swarmId,
        name: name.trim(),
        role: role,
        capabilities: capabilities || [],
        has_browser: useBrowser || false,
        system_prompt: systemPrompt || null,
        integration_expertise: integrationExpertise || [],
        knowledge_sources: knowledgeSources || [],
        status: "idle",
        tasks_completed: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating agent:", error);
      return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
    }

    // If browser is enabled, we would initialize a Browserbase session here
    // For now, we just mark it as available
    let browserSessionId = null;
    if (useBrowser) {
      // TODO: Initialize Browserbase session with Stagehand
      // const session = await createBrowserbaseSession();
      // browserSessionId = session.id;
    }

    const agentData = agent as any;
    return NextResponse.json({
      agent: {
        id: agentData.id,
        name: agentData.name,
        role: agentData.role,
        status: agentData.status,
        currentTask: null,
        tasksCompleted: 0,
        hasBrowser: agentData.has_browser,
        capabilities: agentData.capabilities,
        systemPrompt: agentData.system_prompt,
        integrationExpertise: agentData.integration_expertise || [],
        knowledgeSources: agentData.knowledge_sources || [],
        lastActivity: null,
        browserSessionId,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/swarms/[swarmId]/agents:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/swarms/[swarmId]/agents - Kill an agent
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

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json({ error: "Agent ID is required" }, { status: 400 });
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

    // Delete the agent
    const { error } = await (supabase as any)
      .from("swarm_agents")
      .delete()
      .eq("id", agentId)
      .eq("swarm_id", swarmId);

    if (error) {
      console.error("Error deleting agent:", error);
      return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/swarms/[swarmId]/agents:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
