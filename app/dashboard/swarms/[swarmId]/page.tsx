"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import AgentSpawner from "@/components/swarms/AgentSpawner";
import AgentStatusGrid from "@/components/swarms/AgentStatusGrid";
import SwarmChat from "@/components/swarms/SwarmChat";
import BrowserSessionViewer from "@/components/swarms/BrowserSessionViewer";
import TaskAssigner from "@/components/swarms/TaskAssigner";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "active" | "idle" | "completed" | "failed";
  currentTask?: string;
  tasksCompleted: number;
  hasBrowser: boolean;
  capabilities: string[];
  lastActivity?: string;
  browserSessionId?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  priority: "low" | "medium" | "high" | "critical";
  assignedTo: string[];
  createdAt: string;
  completedAt?: string;
}

interface Message {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  agentName?: string;
  agentId?: string;
  timestamp: string;
  type?: "text" | "task" | "result" | "error";
}

interface BrowserSession {
  id: string;
  agentId: string;
  agentName: string;
  url: string;
  status: "active" | "completed" | "error";
  screenshot?: string;
  startedAt: string;
  lastActivity?: string;
}

interface Swarm {
  id: string;
  name: string;
  description?: string;
  status: "running" | "paused" | "completed";
  createdAt: string;
  tasksCompleted: number;
  totalTasks: number;
  agents: Agent[];
  tasks: Task[];
}

export default function SwarmDetailPage({
  params,
}: {
  params: Promise<{ swarmId: string }>;
}) {
  const { swarmId } = use(params);
  const [swarm, setSwarm] = useState<Swarm | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [browserSessions, setBrowserSessions] = useState<BrowserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAgentSpawner, setShowAgentSpawner] = useState(false);
  const [showTaskAssigner, setShowTaskAssigner] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "agents" | "tasks" | "browser">("chat");
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => {
    fetchSwarmData();
    fetchMessages();
  }, [swarmId]);

  const fetchSwarmData = async () => {
    try {
      const response = await fetch(`/api/swarms/${swarmId}`);
      if (response.ok) {
        const data = await response.json();
        setSwarm(data.swarm);

        // Generate browser sessions from agents with browser
        const sessions = data.swarm.agents
          .filter((a: Agent) => a.hasBrowser && a.browserSessionId)
          .map((a: Agent) => ({
            id: a.browserSessionId,
            agentId: a.id,
            agentName: a.name,
            url: "https://example.com",
            status: a.status === "active" ? "active" : "completed",
            startedAt: new Date().toISOString(),
          }));
        setBrowserSessions(sessions);
      }
    } catch (error) {
      console.error("Failed to fetch swarm:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`/api/swarms/${swarmId}/chat`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  };

  const handleSpawnAgent = async (agentData: {
    name: string;
    role: string;
    capabilities: string[];
    useBrowser: boolean;
  }) => {
    try {
      const response = await fetch(`/api/swarms/${swarmId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentData),
      });

      if (response.ok) {
        const data = await response.json();
        setSwarm((prev) =>
          prev ? { ...prev, agents: [...prev.agents, data.agent] } : null
        );
        setShowAgentSpawner(false);
      }
    } catch (error) {
      console.error("Failed to spawn agent:", error);
    }
  };

  const handleKillAgent = async (agentId: string) => {
    if (!confirm("Are you sure you want to stop this agent?")) return;

    try {
      const response = await fetch(`/api/swarms/${swarmId}/agents?agentId=${agentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSwarm((prev) =>
          prev
            ? { ...prev, agents: prev.agents.filter((a) => a.id !== agentId) }
            : null
        );
      }
    } catch (error) {
      console.error("Failed to kill agent:", error);
    }
  };

  const handleSendMessage = async (message: string, targetAgentId?: string) => {
    setIsChatLoading(true);
    try {
      const response = await fetch(`/api/swarms/${swarmId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, targetAgentId }),
      });

      if (response.ok) {
        const data = await response.json();
        const newMessages: Message[] = [];
        if (data.userMessage) newMessages.push(data.userMessage);
        if (data.agentResponse) newMessages.push(data.agentResponse);
        setMessages((prev) => [...prev, ...newMessages]);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleAssignTask = async (taskData: {
    title: string;
    description: string;
    assignedTo: string[];
    priority: "low" | "medium" | "high" | "critical";
    capabilities: string[];
  }) => {
    try {
      const response = await fetch(`/api/swarms/${swarmId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskData),
      });

      if (response.ok) {
        const data = await response.json();
        setSwarm((prev) =>
          prev
            ? {
                ...prev,
                tasks: [data.task, ...(prev.tasks || [])],
                totalTasks: prev.totalTasks + 1,
              }
            : null
        );
        setShowTaskAssigner(false);
        // Refresh messages to see the system message
        fetchMessages();
      }
    } catch (error) {
      console.error("Failed to assign task:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute inset-0 mesh-gradient opacity-50" />
        <div className="relative z-10 p-6 lg:p-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-zinc-700 rounded w-1/4" />
            <div className="h-4 bg-zinc-700 rounded w-1/3" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-zinc-700 rounded-xl" />
              ))}
            </div>
            <div className="h-96 bg-zinc-700 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!swarm) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div className="absolute inset-0 mesh-gradient opacity-50" />
        <div className="relative z-10 glass-card p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Swarm Not Found</h2>
          <p className="text-zinc-400 mb-4">This swarm doesn't exist or you don't have access to it.</p>
          <Link
            href="/dashboard/swarms"
            className="inline-flex items-center gap-2 px-4 py-2 glass-button rounded-lg text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Swarms
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Background effects */}
      <div className="absolute inset-0 mesh-gradient opacity-50" />
      <div className="absolute inset-0 noise-overlay" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl float" />
        <div className="absolute bottom-40 right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl float-delayed" />
      </div>

      <div className="relative z-10 p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/dashboard/swarms"
                className="p-2 glass rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-white">{swarm.name}</h1>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  swarm.status === "running"
                    ? "bg-green-500/20 text-green-400"
                    : swarm.status === "paused"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {swarm.status}
              </span>
            </div>
            {swarm.description && <p className="text-zinc-400">{swarm.description}</p>}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowAgentSpawner(true)}
              className="inline-flex items-center gap-2 px-4 py-2 glass-button rounded-xl text-white hover:scale-105 transition-transform"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Spawn Agent
            </button>
            <button
              onClick={() => setShowTaskAssigner(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Assign Task
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="glass p-4 rounded-xl">
            <p className="text-sm text-zinc-400">Agents</p>
            <p className="text-2xl font-bold text-white">{swarm.agents.length}</p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-sm text-zinc-400">Active</p>
            <p className="text-2xl font-bold text-green-400">
              {swarm.agents.filter((a) => a.status === "active").length}
            </p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-sm text-zinc-400">Tasks</p>
            <p className="text-2xl font-bold text-white">
              {swarm.tasksCompleted}/{swarm.totalTasks}
            </p>
          </div>
          <div className="glass p-4 rounded-xl">
            <p className="text-sm text-zinc-400">Browser Sessions</p>
            <p className="text-2xl font-bold text-cyan-400">
              {swarm.agents.filter((a) => a.hasBrowser).length}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {(["chat", "agents", "tasks", "browser"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
                activeTab === tab
                  ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                  : "glass text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab === "browser" ? "Browser Sessions" : tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-6">
          {activeTab === "chat" && (
            <SwarmChat
              swarmId={swarmId}
              messages={messages}
              onSendMessage={handleSendMessage}
              agents={swarm.agents.map((a) => ({
                id: a.id,
                name: a.name,
                status: a.status,
              }))}
              isLoading={isChatLoading}
            />
          )}

          {activeTab === "agents" && (
            <AgentStatusGrid
              agents={swarm.agents}
              onKillAgent={handleKillAgent}
              onRestartAgent={async (agentId) => {
                // Restart logic would go here
                console.log("Restart agent:", agentId);
              }}
            />
          )}

          {activeTab === "tasks" && (
            <div className="space-y-4">
              {(swarm.tasks || []).length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <div className="text-4xl mb-4">📋</div>
                  <h3 className="text-lg font-medium text-white mb-2">No Tasks Yet</h3>
                  <p className="text-zinc-400 mb-4">Assign your first task to get your agents working</p>
                  <button
                    onClick={() => setShowTaskAssigner(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 glass-button rounded-lg text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Assign Task
                  </button>
                </div>
              ) : (
                (swarm.tasks || []).map((task) => (
                  <div key={task.id} className="glass-card p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-white">{task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-zinc-400 mt-1">{task.description}</p>
                        )}
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          task.status === "completed"
                            ? "bg-green-500/20 text-green-400"
                            : task.status === "in_progress"
                            ? "bg-blue-500/20 text-blue-400"
                            : task.status === "failed"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-zinc-500/20 text-zinc-400"
                        }`}
                      >
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "browser" && (
            <BrowserSessionViewer
              sessions={browserSessions}
              onRefreshSession={async (sessionId) => {
                // Refresh session logic
                console.log("Refresh session:", sessionId);
              }}
              onEndSession={async (sessionId) => {
                // End session logic
                console.log("End session:", sessionId);
              }}
            />
          )}
        </div>

        {/* Agent Spawner Modal */}
        {showAgentSpawner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAgentSpawner(false)}
            />
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <AgentSpawner
                swarmId={swarmId}
                onSpawn={handleSpawnAgent}
                onClose={() => setShowAgentSpawner(false)}
              />
            </div>
          </div>
        )}

        {/* Task Assigner Modal */}
        {showTaskAssigner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowTaskAssigner(false)}
            />
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <TaskAssigner
                swarmId={swarmId}
                agents={swarm.agents}
                onAssignTask={handleAssignTask}
                onClose={() => setShowTaskAssigner(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
