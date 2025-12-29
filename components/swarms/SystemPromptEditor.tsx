"use client";

import { useState } from "react";

interface SystemPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  agentName?: string;
  agentRole?: string;
}

// Pre-built prompt templates
const PROMPT_TEMPLATES = {
  researcher: {
    name: "Research Agent",
    prompt: `You are a thorough research agent. Your approach:

1. Always verify information from multiple sources
2. Cite your sources when providing information
3. Distinguish between facts and opinions
4. Highlight key findings and summarize clearly
5. Ask clarifying questions if the research scope is unclear

When researching:
- Start with broad searches, then narrow down
- Look for primary sources when possible
- Cross-reference data points
- Note any conflicting information`,
  },
  scraper: {
    name: "Web Scraper",
    prompt: `You are a precise web scraping agent. Your approach:

1. Navigate carefully and wait for pages to load
2. Extract data in structured formats (JSON when possible)
3. Handle pagination and infinite scroll
4. Respect rate limits and site terms
5. Capture screenshots for verification

When scraping:
- Verify element selectors before extracting
- Handle missing data gracefully
- Log all actions for audit trail
- Save extracted data incrementally`,
  },
  analyst: {
    name: "Data Analyst",
    prompt: `You are an analytical agent focused on insights. Your approach:

1. Understand the data structure first
2. Look for patterns, trends, and anomalies
3. Provide quantitative analysis when possible
4. Visualize findings when helpful
5. Give actionable recommendations

When analyzing:
- Start with summary statistics
- Identify outliers and investigate them
- Compare against benchmarks if available
- Present findings in order of importance`,
  },
  assistant: {
    name: "General Assistant",
    prompt: `You are a helpful assistant agent. Your approach:

1. Be clear and concise in responses
2. Ask for clarification when needed
3. Break down complex tasks into steps
4. Provide examples when explaining
5. Summarize actions taken

When assisting:
- Confirm understanding before acting
- Provide progress updates
- Handle errors gracefully
- Suggest next steps proactively`,
  },
  monitor: {
    name: "Monitoring Agent",
    prompt: `You are a vigilant monitoring agent. Your approach:

1. Check targets at specified intervals
2. Compare current state to previous state
3. Alert on significant changes
4. Log all observations with timestamps
5. Provide clear status reports

When monitoring:
- Define what constitutes a "change"
- Set appropriate thresholds
- Avoid false positives
- Include context in alerts`,
  },
};

// Prompt building blocks
const PROMPT_BLOCKS = [
  {
    id: "one_tool",
    name: "One Tool Per Message",
    content:
      "Execute only one tool action per response. This ensures clarity and allows for proper error handling.",
  },
  {
    id: "transparency",
    name: "Transparent Actions",
    content:
      "Always explain what you're doing and why before taking action. Keep the user informed of your reasoning.",
  },
  {
    id: "error_handling",
    name: "Error Handling",
    content:
      "If an action fails, explain what went wrong, why it might have happened, and suggest alternatives.",
  },
  {
    id: "verification",
    name: "Verify Before Acting",
    content:
      "Before making changes or taking irreversible actions, verify the current state and confirm with the user if uncertain.",
  },
  {
    id: "progress_tracking",
    name: "Progress Updates",
    content:
      "Provide regular progress updates. If a task has multiple steps, indicate which step you're on and what remains.",
  },
  {
    id: "data_safety",
    name: "Data Safety",
    content:
      "Never expose sensitive data like API keys, passwords, or personal information in logs or responses.",
  },
];

export default function SystemPromptEditor({
  value,
  onChange,
  agentName = "Agent",
  agentRole = "assistant",
}: SystemPromptEditorProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "templates" | "blocks">(
    "edit"
  );
  const [showPreview, setShowPreview] = useState(false);

  // Estimate token count (rough approximation)
  const estimatedTokens = Math.ceil(value.length / 4);

  const applyTemplate = (templateKey: keyof typeof PROMPT_TEMPLATES) => {
    const template = PROMPT_TEMPLATES[templateKey];
    onChange(template.prompt);
  };

  const addBlock = (blockId: string) => {
    const block = PROMPT_BLOCKS.find((b) => b.id === blockId);
    if (block) {
      onChange(value + (value ? "\n\n" : "") + block.content);
    }
  };

  const generatePreview = () => {
    return `You are ${agentName}, a ${agentRole} agent.

${value}

## Your Capabilities
[Capabilities will be added based on agent configuration]

## Integration Expertise
[Integration knowledge will be added based on selected platforms]`;
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab("edit")}
          className={`px-4 py-2 rounded-lg text-sm transition-all ${
            activeTab === "edit"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-2 rounded-lg text-sm transition-all ${
            activeTab === "templates"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Templates
        </button>
        <button
          onClick={() => setActiveTab("blocks")}
          className={`px-4 py-2 rounded-lg text-sm transition-all ${
            activeTab === "blocks"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
              : "text-zinc-400 hover:text-white hover:bg-white/5"
          }`}
        >
          Building Blocks
        </button>
      </div>

      {/* Edit Tab */}
      {activeTab === "edit" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-sm text-zinc-400">
              System Prompt Instructions
            </label>
            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-500">
                ~{estimatedTokens} tokens
              </span>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                {showPreview ? "Hide Preview" : "Show Preview"}
              </button>
            </div>
          </div>

          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter custom instructions for this agent...

Example:
- You are an expert at extracting product data from e-commerce websites
- Always verify prices before reporting
- Format output as structured JSON"
            className="w-full h-48 px-4 py-3 bg-zinc-900/50 border border-white/10 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 resize-none font-mono text-sm"
          />

          {showPreview && (
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">
                Full System Prompt Preview
              </label>
              <div className="p-4 bg-zinc-900/80 border border-white/10 rounded-xl overflow-auto max-h-64">
                <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono">
                  {generatePreview()}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(PROMPT_TEMPLATES).map(([key, template]) => (
            <button
              key={key}
              onClick={() => applyTemplate(key as keyof typeof PROMPT_TEMPLATES)}
              className="p-4 text-left bg-zinc-900/50 border border-white/10 rounded-xl hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group"
            >
              <div className="font-medium text-white group-hover:text-purple-300 mb-1">
                {template.name}
              </div>
              <div className="text-xs text-zinc-500 line-clamp-2">
                {template.prompt.substring(0, 100)}...
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Building Blocks Tab */}
      {activeTab === "blocks" && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-400 mb-4">
            Click to add behavior guidelines to your prompt:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PROMPT_BLOCKS.map((block) => (
              <button
                key={block.id}
                onClick={() => addBlock(block.id)}
                className="p-3 text-left bg-zinc-900/50 border border-white/10 rounded-lg hover:border-purple-500/30 hover:bg-purple-500/5 transition-all"
              >
                <div className="text-sm font-medium text-white mb-1">
                  {block.name}
                </div>
                <div className="text-xs text-zinc-500 line-clamp-2">
                  {block.content.substring(0, 80)}...
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Variable Interpolation Help */}
      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="text-sm text-blue-300 font-medium mb-1">
          💡 Variable Interpolation
        </div>
        <div className="text-xs text-blue-200/70">
          Use variables like{" "}
          <code className="bg-blue-500/20 px-1 rounded">
            {"{{client_name}}"}
          </code>
          ,{" "}
          <code className="bg-blue-500/20 px-1 rounded">{"{{industry}}"}</code>,
          or{" "}
          <code className="bg-blue-500/20 px-1 rounded">{"{{use_case}}"}</code>{" "}
          to personalize prompts based on client context.
        </div>
      </div>
    </div>
  );
}
