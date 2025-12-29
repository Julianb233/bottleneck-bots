"use client";

import { useState } from "react";

interface IntegrationExpertiseSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

// Integration definitions with capabilities
const INTEGRATIONS = {
  stagehand: {
    name: "Stagehand",
    icon: "🎭",
    description: "AI-powered web automation",
    category: "Browser",
    capabilities: [
      "Natural language web control",
      "Data extraction",
      "Form automation",
      "Screenshot capture",
    ],
    color: "purple",
  },
  browserbase: {
    name: "Browserbase",
    icon: "🌐",
    description: "Cloud browser infrastructure",
    category: "Browser",
    capabilities: [
      "Cloud browser sessions",
      "Proxy rotation",
      "Session persistence",
      "Playwright automation",
    ],
    color: "blue",
  },
  gohighlevel: {
    name: "GoHighLevel",
    icon: "🚀",
    description: "Marketing & CRM platform",
    category: "CRM",
    capabilities: [
      "Contact management",
      "Pipeline tracking",
      "SMS/Email messaging",
      "Calendar booking",
    ],
    color: "green",
  },
  hubspot: {
    name: "HubSpot",
    icon: "🧡",
    description: "Comprehensive CRM suite",
    category: "CRM",
    capabilities: [
      "Contact & company mgmt",
      "Deal tracking",
      "Workflow automation",
      "Email logging",
    ],
    color: "orange",
  },
  clickup: {
    name: "ClickUp",
    icon: "✅",
    description: "Project management",
    category: "Productivity",
    capabilities: [
      "Task management",
      "Time tracking",
      "Space organization",
      "Comments & docs",
    ],
    color: "pink",
  },
  salesforce: {
    name: "Salesforce",
    icon: "☁️",
    description: "Enterprise CRM",
    category: "CRM",
    capabilities: [
      "Lead management",
      "SOQL queries",
      "Opportunity tracking",
      "Custom objects",
    ],
    color: "cyan",
  },
  zapier: {
    name: "Zapier",
    icon: "⚡",
    description: "App integration & automation",
    category: "Automation",
    capabilities: [
      "Webhook integration",
      "Multi-app workflows",
      "Data transformation",
      "Event triggering",
    ],
    color: "yellow",
  },
};

const CATEGORIES = ["Browser", "CRM", "Productivity", "Automation"];

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
  purple: {
    bg: "bg-purple-500/20",
    border: "border-purple-500/50",
    text: "text-purple-300",
  },
  blue: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/50",
    text: "text-blue-300",
  },
  green: {
    bg: "bg-green-500/20",
    border: "border-green-500/50",
    text: "text-green-300",
  },
  orange: {
    bg: "bg-orange-500/20",
    border: "border-orange-500/50",
    text: "text-orange-300",
  },
  pink: {
    bg: "bg-pink-500/20",
    border: "border-pink-500/50",
    text: "text-pink-300",
  },
  cyan: {
    bg: "bg-cyan-500/20",
    border: "border-cyan-500/50",
    text: "text-cyan-300",
  },
  yellow: {
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/50",
    text: "text-yellow-300",
  },
};

export default function IntegrationExpertiseSelector({
  selected,
  onChange,
}: IntegrationExpertiseSelectorProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showCapabilities, setShowCapabilities] = useState<string | null>(null);

  const toggleIntegration = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter((s) => s !== key));
    } else {
      onChange([...selected, key]);
    }
  };

  const selectCategory = (category: string) => {
    const categoryIntegrations = Object.entries(INTEGRATIONS)
      .filter(([_, int]) => int.category === category)
      .map(([key]) => key);

    const allSelected = categoryIntegrations.every((k) => selected.includes(k));

    if (allSelected) {
      onChange(selected.filter((s) => !categoryIntegrations.includes(s)));
    } else {
      const newSelected = [...selected];
      for (const key of categoryIntegrations) {
        if (!newSelected.includes(key)) {
          newSelected.push(key);
        }
      }
      onChange(newSelected);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <label className="text-sm text-zinc-400">Integration Expertise</label>
        <span className="text-xs text-zinc-500">
          {selected.length} selected
        </span>
      </div>

      {/* Category Quick Select */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((category) => {
          const categoryIntegrations = Object.entries(INTEGRATIONS)
            .filter(([_, int]) => int.category === category)
            .map(([key]) => key);
          const selectedCount = categoryIntegrations.filter((k) =>
            selected.includes(k)
          ).length;
          const allSelected = selectedCount === categoryIntegrations.length;

          return (
            <button
              key={category}
              onClick={() => selectCategory(category)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                allSelected
                  ? "bg-purple-500/30 text-purple-200 border border-purple-500/50"
                  : selectedCount > 0
                  ? "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                  : "bg-zinc-800/50 text-zinc-400 border border-white/10 hover:border-white/20"
              }`}
            >
              {category}{" "}
              {selectedCount > 0 && (
                <span className="ml-1 opacity-70">
                  ({selectedCount}/{categoryIntegrations.length})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Object.entries(INTEGRATIONS).map(([key, integration]) => {
          const isSelected = selected.includes(key);
          const colors = colorClasses[integration.color];

          return (
            <div
              key={key}
              className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? `${colors.bg} ${colors.border}`
                  : "bg-zinc-900/50 border-white/10 hover:border-white/20"
              }`}
              onClick={() => toggleIntegration(key)}
              onMouseEnter={() => setShowCapabilities(key)}
              onMouseLeave={() => setShowCapabilities(null)}
            >
              {/* Checkbox */}
              <div className="absolute top-3 right-3">
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? `${colors.bg} ${colors.border}`
                      : "border-zinc-600"
                  }`}
                >
                  {isSelected && (
                    <svg
                      className={`w-3 h-3 ${colors.text}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex items-start gap-3">
                <span className="text-2xl">{integration.icon}</span>
                <div className="flex-1 min-w-0">
                  <div
                    className={`font-medium ${
                      isSelected ? colors.text : "text-white"
                    }`}
                  >
                    {integration.name}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {integration.description}
                  </div>
                  <div className="mt-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        isSelected
                          ? `${colors.bg} ${colors.text}`
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {integration.category}
                    </span>
                  </div>
                </div>
              </div>

              {/* Capabilities Tooltip */}
              {showCapabilities === key && (
                <div className="absolute z-10 left-0 right-0 -bottom-2 transform translate-y-full">
                  <div className="bg-zinc-800 border border-white/10 rounded-lg p-3 shadow-xl">
                    <div className="text-xs text-zinc-400 mb-2">
                      Capabilities:
                    </div>
                    <ul className="space-y-1">
                      {integration.capabilities.map((cap, i) => (
                        <li
                          key={i}
                          className={`text-xs flex items-center gap-2 ${colors.text}`}
                        >
                          <span className="w-1 h-1 rounded-full bg-current" />
                          {cap}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Summary */}
      {selected.length > 0 && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <div className="text-xs text-purple-300 mb-2">
            Agent will have expertise in:
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.map((key) => {
              const integration = INTEGRATIONS[key as keyof typeof INTEGRATIONS];
              if (!integration) return null;
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-200 rounded text-xs"
                >
                  {integration.icon} {integration.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleIntegration(key);
                    }}
                    className="ml-1 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
