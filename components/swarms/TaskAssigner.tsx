"use client";

import { useState } from "react";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "active" | "idle" | "completed" | "failed";
  capabilities: string[];
}

interface TaskAssignerProps {
  swarmId: string;
  agents: Agent[];
  onAssignTask: (task: {
    title: string;
    description: string;
    assignedTo: string[];
    priority: "low" | "medium" | "high" | "critical";
    capabilities: string[];
  }) => Promise<void>;
  onClose?: () => void;
}

const priorityConfig = {
  low: {
    color: "from-zinc-500 to-zinc-400",
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
  },
  medium: {
    color: "from-blue-500 to-cyan-500",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
  },
  high: {
    color: "from-amber-500 to-orange-500",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
  },
  critical: {
    color: "from-red-500 to-rose-500",
    bg: "bg-red-500/10",
    text: "text-red-400",
  },
};

const taskTemplates = [
  {
    id: "scrape",
    title: "Scrape Website",
    description: "Extract data from a website",
    icon: "🌐",
    capabilities: ["browser_automation", "data_extraction"],
  },
  {
    id: "monitor",
    title: "Monitor Page",
    description: "Watch for changes on a webpage",
    icon: "👁️",
    capabilities: ["monitoring", "browser_automation"],
  },
  {
    id: "research",
    title: "Research Topic",
    description: "Gather information about a topic",
    icon: "🔍",
    capabilities: ["web_search", "data_analysis"],
  },
  {
    id: "generate",
    title: "Generate Content",
    description: "Create text or report",
    icon: "✍️",
    capabilities: ["content_generation"],
  },
  {
    id: "custom",
    title: "Custom Task",
    description: "Define your own task",
    icon: "⚙️",
    capabilities: [],
  },
];

export default function TaskAssigner({ swarmId, agents, onAssignTask, onClose }: TaskAssignerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [isAssigning, setIsAssigning] = useState(false);

  const availableAgents = agents.filter((a) => a.status === "active" || a.status === "idle");

  const handleTemplateSelect = (templateId: string) => {
    const template = taskTemplates.find((t) => t.id === templateId);
    if (template && template.id !== "custom") {
      setSelectedTemplate(templateId);
      setTitle(template.title);
      setDescription(template.description);

      // Auto-select agents with matching capabilities
      const matchingAgents = availableAgents.filter((agent) =>
        template.capabilities.some((cap) => agent.capabilities.includes(cap))
      );
      setSelectedAgents(matchingAgents.slice(0, 3).map((a) => a.id));
    } else {
      setSelectedTemplate("custom");
      setTitle("");
      setDescription("");
      setSelectedAgents([]);
    }
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
    );
  };

  const handleAssign = async () => {
    if (!title.trim() || selectedAgents.length === 0) return;

    setIsAssigning(true);
    try {
      const template = taskTemplates.find((t) => t.id === selectedTemplate);
      await onAssignTask({
        title: title.trim(),
        description: description.trim(),
        assignedTo: selectedAgents,
        priority,
        capabilities: template?.capabilities || [],
      });
      // Reset form
      setSelectedTemplate(null);
      setTitle("");
      setDescription("");
      setSelectedAgents([]);
      setPriority("medium");
      onClose?.();
    } catch (error) {
      console.error("Failed to assign task:", error);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">Assign New Task</h3>
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

      {/* Task Templates */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-300 mb-3">Task Type</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {taskTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template.id)}
              className={`p-4 rounded-xl text-center transition-all ${
                selectedTemplate === template.id
                  ? "glass-button border-2 border-blue-500/50 shadow-lg shadow-blue-500/20"
                  : "glass hover:bg-white/5"
              }`}
            >
              <span className="text-2xl mb-2 block">{template.icon}</span>
              <span className="font-medium text-white text-sm block">{template.title}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedTemplate && (
        <>
          {/* Task Details */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Task Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title..."
                className="w-full px-4 py-3 glass rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what the agents should do..."
                rows={3}
                className="w-full px-4 py-3 glass rounded-xl text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Priority Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-3">Priority</label>
            <div className="flex gap-2">
              {(["low", "medium", "high", "critical"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                    priority === p
                      ? `bg-gradient-to-r ${priorityConfig[p].color} text-white`
                      : `${priorityConfig[p].bg} ${priorityConfig[p].text} hover:opacity-80`
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Agent Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-300 mb-3">
              Assign to Agents ({selectedAgents.length} selected)
            </label>
            {availableAgents.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availableAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className={`p-3 rounded-xl text-left transition-all ${
                      selectedAgents.includes(agent.id)
                        ? "glass-button border-2 border-green-500/50"
                        : "glass hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          selectedAgents.includes(agent.id)
                            ? "bg-green-500/20"
                            : "bg-zinc-700"
                        }`}
                      >
                        {selectedAgents.includes(agent.id) ? (
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span className="text-sm">🤖</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{agent.name}</p>
                        <p className="text-xs text-zinc-400 capitalize">{agent.role}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 glass rounded-xl">
                <p className="text-zinc-400">No available agents</p>
                <p className="text-xs text-zinc-500 mt-1">All agents are busy or inactive</p>
              </div>
            )}
          </div>

          {/* Assign Button */}
          <button
            onClick={handleAssign}
            disabled={!title.trim() || selectedAgents.length === 0 || isAssigning}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/25"
          >
            {isAssigning ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Assigning Task...
              </span>
            ) : (
              <>
                📋 Assign Task to {selectedAgents.length} Agent{selectedAgents.length !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}
