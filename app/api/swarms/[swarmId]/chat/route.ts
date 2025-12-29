import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

// GET /api/swarms/[swarmId]/chat - Get chat history
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

    // Fetch chat messages
    const { data: messages, error } = await (supabase as any)
      .from("swarm_messages")
      .select(`
        *,
        agent:swarm_agents(id, name)
      `)
      .eq("swarm_id", swarmId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error("Error fetching messages:", error);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    return NextResponse.json({
      messages: (messages as any[])?.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        agentId: msg.agent_id,
        agentName: msg.agent?.name,
        timestamp: msg.created_at,
        type: msg.type || "text",
      })) || [],
    });
  } catch (error) {
    console.error("Error in GET /api/swarms/[swarmId]/chat:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/swarms/[swarmId]/chat - Send a message to the swarm
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
      .select("id, status")
      .eq("id", swarmId)
      .eq("user_id", user.id)
      .single();

    if (!swarm) {
      return NextResponse.json({ error: "Swarm not found" }, { status: 404 });
    }

    const body = await request.json();
    const { message, targetAgentId } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Save user message
    const { data: userMessage, error: msgError } = await (supabase as any)
      .from("swarm_messages")
      .insert({
        swarm_id: swarmId,
        role: "user",
        content: message.trim(),
        type: "text",
      })
      .select()
      .single();

    if (msgError) {
      console.error("Error saving user message:", msgError);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    // Get available agents
    const { data: agents } = await (supabase as any)
      .from("swarm_agents")
      .select("*")
      .eq("swarm_id", swarmId)
      .in("status", ["active", "idle"]);

    // If targeting a specific agent, filter to that agent
    const targetAgents = targetAgentId
      ? (agents as any[])?.filter((a: any) => a.id === targetAgentId)
      : agents;

    if (!targetAgents || targetAgents.length === 0) {
      // No agents available, return system message
      const { data: systemMessage } = await (supabase as any)
        .from("swarm_messages")
        .insert({
          swarm_id: swarmId,
          role: "system",
          content: "No agents are currently available to process your request. Please spawn an agent first.",
          type: "text",
        })
        .select()
        .single();

      return NextResponse.json({
        userMessage: {
          id: userMessage.id,
          role: "user",
          content: userMessage.content,
          timestamp: userMessage.created_at,
          type: "text",
        },
        agentResponse: systemMessage ? {
          id: systemMessage.id,
          role: "system",
          content: systemMessage.content,
          timestamp: systemMessage.created_at,
          type: "text",
        } : null,
      });
    }

    // For now, simulate an agent response
    const respondingAgent = targetAgents[0];

    // Update agent status to active
    await (supabase as any)
      .from("swarm_agents")
      .update({ status: "active", current_task: message.substring(0, 100) })
      .eq("id", respondingAgent.id);

    // Simulate agent processing
    const agentResponse = generateAgentResponse(message, respondingAgent);

    // Save agent response
    const { data: agentMessage, error: agentMsgError } = await (supabase as any)
      .from("swarm_messages")
      .insert({
        swarm_id: swarmId,
        role: "agent",
        content: agentResponse.content,
        agent_id: respondingAgent.id,
        type: agentResponse.type,
      })
      .select()
      .single();

    if (agentMsgError) {
      console.error("Error saving agent message:", agentMsgError);
    }

    // Update agent status back to idle
    await (supabase as any)
      .from("swarm_agents")
      .update({
        status: "idle",
        current_task: null,
        last_activity: new Date().toISOString(),
        tasks_completed: respondingAgent.tasks_completed + 1,
      })
      .eq("id", respondingAgent.id);

    return NextResponse.json({
      userMessage: {
        id: userMessage.id,
        role: "user",
        content: userMessage.content,
        timestamp: userMessage.created_at,
        type: "text",
      },
      agentResponse: agentMessage ? {
        id: agentMessage.id,
        role: "agent",
        content: agentMessage.content,
        agentId: respondingAgent.id,
        agentName: respondingAgent.name,
        timestamp: agentMessage.created_at,
        type: agentMessage.type,
      } : null,
    });
  } catch (error) {
    console.error("Error in POST /api/swarms/[swarmId]/chat:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Helper function to generate agent responses
function generateAgentResponse(
  message: string,
  agent: { name: string; role: string; capabilities: string[] }
): { content: string; type: string } {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("scrape") || lowerMessage.includes("extract")) {
    return {
      content: `I'll help you extract data from that source. As a ${agent.role}, I can use my browser capabilities to navigate and scrape the content. Let me initialize a Browserbase session and get started...`,
      type: "task",
    };
  }

  if (lowerMessage.includes("monitor") || lowerMessage.includes("watch")) {
    return {
      content: `Setting up monitoring for your specified target. I'll check at regular intervals and alert you when changes are detected.`,
      type: "task",
    };
  }

  if (lowerMessage.includes("search") || lowerMessage.includes("find") || lowerMessage.includes("research")) {
    return {
      content: `I'm researching that topic now. I'll gather relevant information from multiple sources and compile a summary for you.`,
      type: "task",
    };
  }

  return {
    content: `Understood! I'm ${agent.name}, your ${agent.role} agent. I've received your message and I'm ready to help. What specific task would you like me to work on?`,
    type: "text",
  };
}
