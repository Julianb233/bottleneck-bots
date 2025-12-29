"use client";

import { useState } from "react";
import SystemPromptEditor from "./SystemPromptEditor";
import IntegrationExpertiseSelector from "./IntegrationExpertiseSelector";

interface AgentSpawnerProps {
  swarmId?: string;
  onSpawn: (agent: {
    name: string;
    role: string;
    capabilities: string[];
    useBrowser: boolean;
    systemPrompt?: string;
    integrationExpertise?: string[];
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
    defaultPrompt: "You are a thorough research agent. Always verify information from multiple sources and cite your findings.",
  },
  {
    id: "scraper",
    name: "Web Scraper",
    description: "Extracts data from websites using Browserbase",
    icon: "🌐",
    capabilities: ["browser_automation", "data_extraction", "screenshot"],
    requiresBrowser: true,
    defaultPrompt: "You are a precise web scraping agent. Extract data in structured formats and handle pagination gracefully.",
  },
  {
    id: "writer",
    name: "Content Writer",
    description: "Creates and edits content",
    icon: "✍️",
    capabilities: ["content_generation", "editing", "formatting"],
    defaultPrompt: "You are a creative content writer. Produce engaging, well-structured content tailored to the audience.",
  },
  {
    id: "monitor",
    name: "Monitor",
    description: "Watches for changes and sends alerts",
    icon: "👁️",
    capabilities: ["monitoring", "alerting", "comparison"],
    defaultPrompt: "You are a vigilant monitoring agent. Check targets at intervals, compare states, and alert on significant changes.",
  },
  {
    id: "analyst",
    name: "Data Analyst",
    description: "Processes and visualizes data",
    icon: "📊",
    capabilities: ["data_processing", "visualization", "reporting"],
    defaultPrompt: "You are an analytical agent. Look for patterns, trends, and anomalies. Provide actionable insights.",
  },
  {
    id: "custom",
    name: "Custom Agent",
    description: "Define your own agent capabilities",
    icon: "⚙️",
    capabilities: [],
    defaultPrompt: "",
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

  // New advanced configuration states
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [integrationExpertise, setIntegrationExpertise] = useState<string[]>([]);

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    const role = predefinedRoles.find((r) => r.id === roleId);
    if (role && role.id !== "custom") {
      setSelectedCapabilities(role.capabilities);
      setUseBrowser(role.requiresBrowser || false);
      setSystemPrompt(role.defaultPrompt || "");
      if (!agentName) {
        setAgentName(`${role.name} Agent`);
      }
    } else {
      setSystemPrompt("");
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
        systemPrompt: systemPrompt.trim() || undefined,
        integrationExpertise: integrationExpertise.length > 0 ? integrationExpertise : undefined,
      });
      // Reset form
      setSelectedRole(null);
      setAgentName("");
      setSelectedCapabilities([]);
      setUseBrowser(false);
      setSystemPrompt("");
      setIntegrationExpertise([]);
      setShowAdvanced(false);
    } catch (error) {
      console.error("Failed to spawn agent:", error);
    } finally {
      setIsSpawning(false);
    }
  };

  const currentRole = predefinedRoles.find((r) => r.id === selectedRole);

  return (
    <div className="glass-card p-6 max-h-[80vh] overflow-y-auto">
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

          {/* Advanced Configuration Toggle */}
          <div className="mb-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Advanced Configuration
              {(systemPrompt || integrationExpertise.length > 0) && (
                <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs">
                  Configured
                </span>
              )}
            </button>
          </div>

          {/* Advanced Configuration Panel */}
          {showAdvanced && (
            <div className="space-y-6 mb-6 p-4 bg-zinc-900/50 border border-white/10 rounded-xl">
              {/* System Prompt Editor */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">📝</span>
                  <h4 className="text-md font-medium text-white">System Prompt</h4>
                </div>
                <SystemPromptEditor
                  value={systemPrompt}
                  onChange={setSystemPrompt}
                  agentName={agentName}
                  agentRole={currentRole?.name || selectedRole}
                />
              </div>

              <hr className="border-white/10" />

              {/* Integration Expertise */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🔌</span>
                  <h4 className="text-md font-medium text-white">Integration Expertise</h4>
                </div>
                <p className="text-sm text-zinc-400 mb-4">
                  Select platforms this agent should be an expert in. Knowledge will be injected into the agent&apos;s context.
                </p>
                <IntegrationExpertiseSelector
                  selected={integrationExpertise}
                  onChange={setIntegrationExpertise}
                />
              </div>
            </div>
          )}

          {/* Configuration Summary */}
          {(systemPrompt || integrationExpertise.length > 0) && (
            <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="text-sm text-blue-300 font-medium mb-2">Configuration Summary</div>
              <ul className="text-xs text-blue-200/70 space-y-1">
                {systemPrompt && (
                  <li>• Custom system prompt ({Math.ceil(systemPrompt.length / 4)} tokens)</li>
                )}
                {integrationExpertise.length > 0 && (
                  <li>• Expert in: {integrationExpertise.join(", ")}</li>
                )}
                {useBrowser && <li>• Browser automation enabled</li>}
              </ul>
            </div>
          )}

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
