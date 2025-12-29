"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SwarmCard from "@/components/swarms/SwarmCard";
import AgentSpawner from "@/components/swarms/AgentSpawner";

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

export default function SwarmsPage() {
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSwarmName, setNewSwarmName] = useState("");
  const [newSwarmDescription, setNewSwarmDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchSwarms();
  }, []);

  const fetchSwarms = async () => {
    try {
      const response = await fetch("/api/swarms");
      if (response.ok) {
        const data = await response.json();
        setSwarms(data.swarms || []);
      }
    } catch (error) {
      console.error("Failed to fetch swarms:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSwarm = async () => {
    if (!newSwarmName.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch("/api/swarms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSwarmName.trim(),
          description: newSwarmDescription.trim() || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSwarms((prev) => [data.swarm, ...prev]);
        setNewSwarmName("");
        setNewSwarmDescription("");
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error("Failed to create swarm:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePauseSwarm = async (swarmId: string) => {
    try {
      const response = await fetch(`/api/swarms/${swarmId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused" }),
      });

      if (response.ok) {
        setSwarms((prev) =>
          prev.map((s) => (s.id === swarmId ? { ...s, status: "paused" as const } : s))
        );
      }
    } catch (error) {
      console.error("Failed to pause swarm:", error);
    }
  };

  const handleResumeSwarm = async (swarmId: string) => {
    try {
      const response = await fetch(`/api/swarms/${swarmId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "running" }),
      });

      if (response.ok) {
        setSwarms((prev) =>
          prev.map((s) => (s.id === swarmId ? { ...s, status: "running" as const } : s))
        );
      }
    } catch (error) {
      console.error("Failed to resume swarm:", error);
    }
  };

  const handleDeleteSwarm = async (swarmId: string) => {
    if (!confirm("Are you sure you want to delete this swarm and all its agents?")) return;

    try {
      const response = await fetch(`/api/swarms/${swarmId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSwarms((prev) => prev.filter((s) => s.id !== swarmId));
      }
    } catch (error) {
      console.error("Failed to delete swarm:", error);
    }
  };

  const activeAgents = swarms.reduce(
    (acc, s) => acc + s.agents.filter((a) => a.status === "active").length,
    0
  );
  const totalAgents = swarms.reduce((acc, s) => acc + s.agents.length, 0);
  const runningSwarms = swarms.filter((s) => s.status === "running").length;

  return (
    <div className="relative min-h-screen">
      {/* Background effects */}
      <div className="absolute inset-0 mesh-gradient opacity-50" />
      <div className="absolute inset-0 noise-overlay" />

      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl float" />
        <div className="absolute top-60 right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl float-delayed" />
        <div className="absolute bottom-40 left-1/3 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl float" />
      </div>

      <div className="relative z-10 p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Agent Swarms</h1>
            <p className="text-zinc-400">
              Manage your AI agent swarms and automate complex tasks
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Swarm
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="glass-card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{swarms.length}</p>
                <p className="text-sm text-zinc-400">Total Swarms</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {activeAgents} <span className="text-sm text-zinc-400 font-normal">/ {totalAgents}</span>
                </p>
                <p className="text-sm text-zinc-400">Active Agents</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{runningSwarms}</p>
                <p className="text-sm text-zinc-400">Running Swarms</p>
              </div>
            </div>
          </div>
        </div>

        {/* Swarms Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-6 animate-pulse">
                <div className="h-6 bg-zinc-700 rounded w-3/4 mb-4" />
                <div className="h-4 bg-zinc-700 rounded w-1/2 mb-6" />
                <div className="flex gap-2 mb-4">
                  <div className="w-8 h-8 bg-zinc-700 rounded-full" />
                  <div className="w-8 h-8 bg-zinc-700 rounded-full" />
                  <div className="w-8 h-8 bg-zinc-700 rounded-full" />
                </div>
                <div className="h-2 bg-zinc-700 rounded mb-4" />
                <div className="h-10 bg-zinc-700 rounded" />
              </div>
            ))}
          </div>
        ) : swarms.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No Swarms Yet</h2>
            <p className="text-zinc-400 mb-6 max-w-md mx-auto">
              Create your first agent swarm to start automating complex tasks with multiple AI agents working together.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Swarm
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {swarms.map((swarm) => (
              <SwarmCard
                key={swarm.id}
                swarm={swarm}
                onPause={handlePauseSwarm}
                onResume={handleResumeSwarm}
                onDelete={handleDeleteSwarm}
              />
            ))}
          </div>
        )}

        {/* Create Swarm Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowCreateModal(false)}
            />
            <div className="relative glass-card p-6 w-full max-w-md">
              <h2 className="text-xl font-bold text-white mb-6">Create New Swarm</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Swarm Name
                  </label>
                  <input
                    type="text"
                    value={newSwarmName}
                    onChange={(e) => setNewSwarmName(e.target.value)}
                    placeholder="e.g., Research Team"
                    className="w-full px-4 py-3 glass rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={newSwarmDescription}
                    onChange={(e) => setNewSwarmDescription(e.target.value)}
                    placeholder="What will this swarm do?"
                    rows={3}
                    className="w-full px-4 py-3 glass rounded-xl text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 glass rounded-xl text-zinc-300 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSwarm}
                  disabled={!newSwarmName.trim() || isCreating}
                  className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isCreating ? "Creating..." : "Create Swarm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
