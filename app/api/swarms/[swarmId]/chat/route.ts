import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase-server";
import { executeAgent, type AgentConfig, type AgentMessage } from "@/lib/agent-engine";
import { expandCapabilities } from "@/lib/agent-tools";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60 seconds for LLM processing

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

    // Select responding agent
    const respondingAgent = targetAgents[0];

    // Update agent status to active
    await (supabase as any)
      .from("swarm_agents")
      .update({ status: "active", current_task: message.substring(0, 100) })
      .eq("id", respondingAgent.id);

    // Fetch recent conversation history for context
    const { data: history } = await (supabase as any)
      .from("swarm_messages")
      .select("role, content, agent_id")
      .eq("swarm_id", swarmId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Build conversation messages for LLM
    const conversationMessages: AgentMessage[] = (history || [])
      .reverse()
      .filter((msg: any) => msg.role === "user" || (msg.role === "agent" && msg.agent_id === respondingAgent.id))
      .map((msg: any) => ({
        role: msg.role === "user" ? "user" as const : "assistant" as const,
        content: msg.content,
      }));

    // Add current message
    conversationMessages.push({
      role: "user",
      content: message,
    });

    // Build agent configuration for real LLM execution
    const agentConfig: AgentConfig = {
      id: respondingAgent.id,
      name: respondingAgent.name,
      role: respondingAgent.role,
      systemPrompt: respondingAgent.system_prompt || undefined,
      capabilities: expandCapabilities(respondingAgent.capabilities || []),
      integrationExpertise: respondingAgent.integration_expertise || [],
      knowledgeSources: respondingAgent.knowledge_sources || undefined,
      maxIterations: 5,
      temperature: 0.7,
    };

    let agentResponseContent = "";
    let responseType = "text";
    let toolsUsed: any[] = [];

    try {
      // Execute agent with real LLM
      const llmResponse = await executeAgent(
        agentConfig,
        conversationMessages,
        (toolCall) => {
          toolsUsed.push({
            name: toolCall.name,
            input: toolCall.input,
          });
        }
      );

      agentResponseContent = llmResponse.content;

      // Determine response type based on tool usage
      if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        responseType = "task";
      }

      // Save tool executions if any
      if (llmResponse.toolCalls && llmResponse.toolResults) {
        for (let i = 0; i < llmResponse.toolCalls.length; i++) {
          const toolCall = llmResponse.toolCalls[i];
          const toolResult = llmResponse.toolResults[i];

          await (supabase as any)
            .from("swarm_tool_executions")
            .insert({
              swarm_id: swarmId,
              agent_id: respondingAgent.id,
              tool_name: toolCall.name,
              input: toolCall.input,
              output: toolResult?.result || null,
              error: toolResult?.error || null,
              duration_ms: 0, // Would need to track timing
            });
        }
      }

    } catch (llmError) {
      console.error("LLM execution error:", llmError);
      // Fallback to simulated response if LLM fails
      agentResponseContent = `I apologize, but I encountered an issue processing your request. Error: ${llmError instanceof Error ? llmError.message : "Unknown error"}. Please try again or check the API configuration.`;
      responseType = "error";
    }

    // Save agent response
    const { data: agentMessage, error: agentMsgError } = await (supabase as any)
      .from("swarm_messages")
      .insert({
        swarm_id: swarmId,
        role: "agent",
        content: agentResponseContent,
        agent_id: respondingAgent.id,
        type: responseType,
        metadata: toolsUsed.length > 0 ? { tools: toolsUsed } : null,
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
        toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
      } : null,
    });
  } catch (error) {
    console.error("Error in POST /api/swarms/[swarmId]/chat:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
