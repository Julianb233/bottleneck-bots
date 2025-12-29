"use client";

import { useState } from "react";

interface AgentSpawnerProps {
  swarmId?: string;
  onSpawn: (agent: {
    name: string;
    role: string;
    capabilities: string[];
    useBrowser: boolean;
  }) => Promise<void>;
  onClose?: () => void;
}

const predefinedRoles = [
  {
    id: "researcher",
    name: "Researcher",
    description: "Gathers information and analyzes data",
    icon: "🔍",
    capabilities: ["web_search", "data_analysis", "summarization"],
  },
  {
    id: "scraper",
    name: "Web Scraper",
    description: "Extracts data from websites using Browserbase",
    icon: "🌐",
    capabilities: ["browser_automation", "data_extraction", "screenshot"],
    requiresBrowser: true,
  },
  {
    id: "writer",
    name: "Content Writer",
    description: "Creates and edits content",
    icon: "✍️",
    capabilities: ["content_generation", "editing", "formatting"],
  },
  {
    id: "monitor",
    name: "Monitor",
    description: "Watches for changes and sends alerts",
    icon: "👁️",
    capabilities: ["monitoring", "alerting", "comparison"],
  },
  {
    id: "analyst",
    name: "Data Analyst",
    description: "Processes and visualizes data",
    icon: "📊",
    capabilities: ["data_processing", "visualization", "reporting"],
  },
  {
    id: "custom",
    name: "Custom Agent",
    description: "Define your own agent capabilities",
    icon: "⚙️",
    capabilities: [],
  },
];

const allCapabilities = [
  { id: "web_search", label: "Web Search", icon: "🔍" },
  { id: "browser_automation", label: "Browser Automation", icon: "🌐" },
  { id: "data_extraction", label: "Data Extraction", icon: "📥" },
  { id: "data_analysis", label: "Data Analysis", icon: "📊" },
  { id: "content_generation", label: "Content Generation", icon: "✍️" },
  { id: "monitoring", label: "Monitoring", icon: "👁️" },
  { id: "alerting", label: "Alerting", icon: "🔔" },
  { id: "screenshot", label: "Screenshots", icon: "📸" },
  { id: "api_calls", label: "API Calls", icon: "🔗" },
  { id: "file_operations", label: "File Operations", icon: "📁" },
];

export default function AgentSpawner({ swarmId, onSpawn, onClose }: AgentSpawnerProps) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [useBrowser, setUseBrowser] = useState(false);
  const [isSpawning, setIsSpawning] = useState(false);

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    const role = predefinedRoles.find((r) => r.id === roleId);
    if (role && role.id !== "custom") {
      setSelectedCapabilities(role.capabilities);
      setUseBrowser(role.requiresBrowser || false);
      if (!agentName) {
        setAgentName(`${role.name} Agent`);
      }
    }
  };

  const toggleCapability = (capId: string) => {
    setSelectedCapabilities((prev) =>
      prev.includes(capId) ? prev.filter((c) => c !== capId) : [...prev, capId]
    );
  };

  const handleSpawn = async () => {
    if (!selectedRole || !agentName.trim()) return;

    setIsSpawning(true);
    try {
      await onSpawn({
        name: agentName.trim(),
        role: selectedRole,
        capabilities: selectedCapabilities,
        useBrowser,
      });
      // Reset form
      setSelectedRole(null);
      setAgentName("");
      setSelectedCapabilities([]);
      setUseBrowser(false);
    } catch (error) {
      console.error("Failed to spawn agent:", error);
    } finally {
      setIsSpawning(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">Spawn New Agent</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 glass rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Role Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-300 mb-3">Select Agent Role</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {predefinedRoles.map((role) => (
            <button
              key={role.id}
              onClick={() => handleRoleSelect(role.id)}
              className={`p-4 rounded-xl text-left transition-all ${
                selectedRole === role.id
                  ? "glass-button border-2 border-blue-500/50 shadow-lg shadow-blue-500/20"
                  : "glass hover:bg-white/5"
              }`}
            >
              <span className="text-2xl mb-2 block">{role.icon}</span>
              <span className="font-medium text-white block">{role.name}</span>
              <span className="text-xs text-zinc-400 line-clamp-2">{role.description}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedRole && (
        <>
          {/* Agent Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-2">Agent Name</label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Enter agent name..."
              className="w-full px-4 py-3 glass rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {/* Capabilities (for custom role) */}
          {selectedRole === "custom" && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-300 mb-3">Capabilities</label>
              <div className="flex flex-wrap gap-2">
                {allCapabilities.map((cap) => (
                  <button
                    key={cap.id}
                    onClick={() => toggleCapability(cap.id)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      selectedCapabilities.includes(cap.id)
                        ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                        : "glass text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <span className="mr-1">{cap.icon}</span>
                    {cap.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Browser Toggle */}
          <div className="mb-6">
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={useBrowser}
                  onChange={(e) => setUseBrowser(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-14 h-8 rounded-full transition-colors ${
                    useBrowser ? "bg-gradient-to-r from-blue-500 to-cyan-500" : "bg-zinc-700"
                  }`}
                />
                <div
                  className={`absolute left-1 top-1 w-6 h-6 rounded-full bg-white transition-transform ${
                    useBrowser ? "translate-x-6" : ""
                  }`}
                />
              </div>
              <div className="ml-3">
                <span className="text-sm font-medium text-white">Enable Browser (Browserbase)</span>
                <p className="text-xs text-zinc-400">Allow agent to control a real browser via Stagehand</p>
              </div>
            </label>
          </div>

          {/* Spawn Button */}
          <button
            onClick={handleSpawn}
            disabled={!agentName.trim() || isSpawning}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/25"
          >
            {isSpawning ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Spawning Agent...
              </span>
            ) : (
              <>
                🚀 Spawn Agent
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
