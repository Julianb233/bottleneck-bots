"use client";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "active" | "idle" | "completed" | "failed";
  currentTask?: string;
  tasksCompleted: number;
  hasBrowser: boolean;
  lastActivity?: string;
}

interface AgentStatusGridProps {
  agents: Agent[];
  onAgentClick?: (agent: Agent) => void;
  onKillAgent?: (agentId: string) => void;
  onRestartAgent?: (agentId: string) => void;
}

const statusConfig = {
  active: {
    color: "from-green-500 to-emerald-500",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-500",
    pulse: true,
  },
  idle: {
    color: "from-amber-500 to-orange-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-500",
    pulse: false,
  },
  completed: {
    color: "from-blue-500 to-cyan-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-500",
    pulse: false,
  },
  failed: {
    color: "from-red-500 to-rose-500",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-500",
    pulse: false,
  },
};

const roleIcons: Record<string, string> = {
  researcher: "🔍",
  scraper: "🌐",
  writer: "✍️",
  monitor: "👁️",
  analyst: "📊",
  custom: "⚙️",
};

export default function AgentStatusGrid({
  agents,
  onAgentClick,
  onKillAgent,
  onRestartAgent,
}: AgentStatusGridProps) {
  if (agents.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="text-4xl mb-4">🤖</div>
        <h3 className="text-lg font-medium text-white mb-2">No Agents Yet</h3>
        <p className="text-zinc-400">Spawn your first agent to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map((agent) => {
        const config = statusConfig[agent.status];

        return (
          <div
            key={agent.id}
            onClick={() => onAgentClick?.(agent)}
            className={`glass-card hover-lift cursor-pointer relative overflow-hidden border ${config.border} transition-all`}
          >
            {/* Status indicator bar */}
            <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${config.color}`} />

            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center text-xl`}>
                    {roleIcons[agent.role] || "🤖"}
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{agent.name}</h4>
                    <p className="text-xs text-zinc-400 capitalize">{agent.role}</p>
                  </div>
                </div>

                {/* Status badge */}
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${config.bg}`}>
                  <span
                    className={`w-2 h-2 rounded-full bg-gradient-to-r ${config.color} ${
                      config.pulse ? "animate-pulse" : ""
                    }`}
                  />
                  <span className={`text-xs font-medium ${config.text} capitalize`}>{agent.status}</span>
                </div>
              </div>

              {/* Current task */}
              {agent.currentTask && agent.status === "active" && (
                <div className="mb-4 p-3 glass rounded-lg">
                  <p className="text-xs text-zinc-400 mb-1">Current Task</p>
                  <p className="text-sm text-white line-clamp-2">{agent.currentTask}</p>
                </div>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className="text-sm text-zinc-300">{agent.tasksCompleted} tasks</span>
                </div>

                {agent.hasBrowser && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span className="text-sm text-cyan-400">Browser</span>
                  </div>
                )}
              </div>

              {/* Last activity */}
              {agent.lastActivity && (
                <p className="text-xs text-zinc-500 mb-4">Last active: {agent.lastActivity}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {agent.status === "failed" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestartAgent?.(agent.id);
                    }}
                    className="flex-1 py-2 glass rounded-lg text-sm text-green-400 hover:bg-green-500/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Restart
                  </button>
                )}
                {(agent.status === "active" || agent.status === "idle") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onKillAgent?.(agent.id);
                    }}
                    className="flex-1 py-2 glass rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                    </svg>
                    Stop
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
