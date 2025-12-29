"use client";

import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "active" | "idle" | "completed" | "failed";
}

interface Swarm {
  id: string;
  name: string;
  description?: string;
  agents: Agent[];
  createdAt: string;
  status: "running" | "paused" | "completed";
  tasksCompleted: number;
  totalTasks: number;
}

interface SwarmCardProps {
  swarm: Swarm;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const statusColors = {
  running: "from-green-500 to-emerald-500",
  paused: "from-amber-500 to-orange-500",
  completed: "from-blue-500 to-cyan-500",
};

const agentStatusColors = {
  active: "bg-green-500",
  idle: "bg-amber-500",
  completed: "bg-blue-500",
  failed: "bg-red-500",
};

export default function SwarmCard({ swarm, onPause, onResume, onDelete }: SwarmCardProps) {
  const activeAgents = swarm.agents.filter((a) => a.status === "active").length;
  const progress = swarm.totalTasks > 0 ? (swarm.tasksCompleted / swarm.totalTasks) * 100 : 0;

  return (
    <div className="glass-card hover-lift group relative overflow-hidden">
      {/* Status indicator glow */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${statusColors[swarm.status]}`}
      />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white group-hover:gradient-text transition-all">
              {swarm.name}
            </h3>
            {swarm.description && (
              <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{swarm.description}</p>
            )}
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${statusColors[swarm.status]} text-white`}
          >
            {swarm.status}
          </span>
        </div>

        {/* Agent avatars */}
        <div className="flex items-center mb-4">
          <div className="flex -space-x-2">
            {swarm.agents.slice(0, 5).map((agent) => (
              <div
                key={agent.id}
                className="relative w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center"
                title={`${agent.name} - ${agent.status}`}
              >
                <span className="text-xs font-medium text-white">
                  {agent.name.charAt(0).toUpperCase()}
                </span>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${agentStatusColors[agent.status]} border-2 border-zinc-900`}
                />
              </div>
            ))}
            {swarm.agents.length > 5 && (
              <div className="w-8 h-8 rounded-full bg-zinc-700 border-2 border-zinc-900 flex items-center justify-center">
                <span className="text-xs font-medium text-zinc-300">
                  +{swarm.agents.length - 5}
                </span>
              </div>
            )}
          </div>
          <span className="ml-3 text-sm text-zinc-400">
            {activeAgents} active / {swarm.agents.length} total
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-zinc-400">Progress</span>
            <span className="text-zinc-300">
              {swarm.tasksCompleted} / {swarm.totalTasks} tasks
            </span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${statusColors[swarm.status]} transition-all duration-500`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/swarms/${swarm.id}`}
            className="flex-1 glass-button px-4 py-2 rounded-lg text-sm text-white text-center font-medium hover:scale-105 transition-transform"
          >
            View Details
          </Link>
          {swarm.status === "running" ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPause?.(swarm.id);
              }}
              className="p-2 glass rounded-lg hover:bg-amber-500/20 transition-colors"
              title="Pause Swarm"
            >
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          ) : swarm.status === "paused" ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onResume?.(swarm.id);
              }}
              className="p-2 glass rounded-lg hover:bg-green-500/20 transition-colors"
              title="Resume Swarm"
            >
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          ) : null}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(swarm.id);
            }}
            className="p-2 glass rounded-lg hover:bg-red-500/20 transition-colors"
            title="Delete Swarm"
          >
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
