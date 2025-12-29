"use client";

import { useState } from "react";

interface ClientIntakeFormProps {
  onComplete: (context: ClientContext) => void;
  onCancel?: () => void;
  initialData?: Partial<ClientContext>;
}

export interface ClientContext {
  organizationName: string;
  industry: string;
  useCase: string;
  teamSize?: string;
  currentTools?: string[];
  painPoints?: string[];
  goals?: string[];
  customInstructions?: string;
  preferences?: Record<string, string>;
}

const INDUSTRIES = [
  { id: "ecommerce", name: "E-Commerce", icon: "🛒" },
  { id: "saas", name: "SaaS / Software", icon: "💻" },
  { id: "finance", name: "Finance / Fintech", icon: "💰" },
  { id: "healthcare", name: "Healthcare", icon: "🏥" },
  { id: "marketing", name: "Marketing / Agency", icon: "📢" },
  { id: "real_estate", name: "Real Estate", icon: "🏠" },
  { id: "education", name: "Education", icon: "📚" },
  { id: "consulting", name: "Consulting", icon: "💼" },
  { id: "manufacturing", name: "Manufacturing", icon: "🏭" },
  { id: "other", name: "Other", icon: "🔧" },
];

const TEAM_SIZES = [
  { id: "solo", label: "Solo / Freelancer" },
  { id: "small", label: "2-10 employees" },
  { id: "medium", label: "11-50 employees" },
  { id: "large", label: "51-200 employees" },
  { id: "enterprise", label: "200+ employees" },
];

const COMMON_TOOLS = [
  { id: "gohighlevel", name: "GoHighLevel", icon: "🚀" },
  { id: "hubspot", name: "HubSpot", icon: "🧡" },
  { id: "salesforce", name: "Salesforce", icon: "☁️" },
  { id: "clickup", name: "ClickUp", icon: "✅" },
  { id: "notion", name: "Notion", icon: "📝" },
  { id: "slack", name: "Slack", icon: "💬" },
  { id: "zapier", name: "Zapier", icon: "⚡" },
  { id: "shopify", name: "Shopify", icon: "🛍️" },
  { id: "stripe", name: "Stripe", icon: "💳" },
  { id: "google_workspace", name: "Google Workspace", icon: "📧" },
];

const COMMON_PAIN_POINTS = [
  "Manual data entry across systems",
  "Lead follow-up is inconsistent",
  "Hard to track customer journey",
  "Too much time on repetitive tasks",
  "CRM data is messy or outdated",
  "Can't scale operations efficiently",
  "Poor visibility into sales pipeline",
  "Difficulty onboarding new clients",
];

export default function ClientIntakeForm({
  onComplete,
  onCancel,
  initialData,
}: ClientIntakeFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<ClientContext>>({
    organizationName: "",
    industry: "",
    useCase: "",
    teamSize: "",
    currentTools: [],
    painPoints: [],
    goals: [],
    customInstructions: "",
    ...initialData,
  });

  const totalSteps = 4;

  const updateField = <K extends keyof ClientContext>(
    field: K,
    value: ClientContext[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: "currentTools" | "painPoints" | "goals", item: string) => {
    const current = formData[field] || [];
    if (current.includes(item)) {
      updateField(field, current.filter((i) => i !== item));
    } else {
      updateField(field, [...current, item]);
    }
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return !!(formData.organizationName?.trim() && formData.industry);
      case 2:
        return !!formData.useCase?.trim();
      case 3:
        return true; // Optional step
      case 4:
        return true; // Optional step
      default:
        return true;
    }
  };

  const handleComplete = () => {
    onComplete(formData as ClientContext);
  };

  return (
    <div className="glass-card p-6 max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-white">Client Context Setup</h3>
          <span className="text-sm text-zinc-500">
            Step {step} of {totalSteps}
          </span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1: Organization & Industry */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h4 className="text-white font-medium mb-4">Tell us about your organization</h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={formData.organizationName || ""}
                  onChange={(e) => updateField("organizationName", e.target.value)}
                  placeholder="Enter your company name"
                  className="w-full px-4 py-3 glass rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-3">Industry</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {INDUSTRIES.map((industry) => (
                    <button
                      key={industry.id}
                      onClick={() => updateField("industry", industry.id)}
                      className={`p-3 rounded-xl text-left transition-all ${
                        formData.industry === industry.id
                          ? "bg-purple-500/20 border-2 border-purple-500/50"
                          : "glass hover:bg-white/5"
                      }`}
                    >
                      <span className="text-xl mr-2">{industry.icon}</span>
                      <span className="text-sm text-white">{industry.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Team Size</label>
                <div className="flex flex-wrap gap-2">
                  {TEAM_SIZES.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => updateField("teamSize", size.id)}
                      className={`px-4 py-2 rounded-lg text-sm transition-all ${
                        formData.teamSize === size.id
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/50"
                          : "glass text-zinc-300 hover:bg-white/5"
                      }`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Use Case */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h4 className="text-white font-medium mb-4">What do you want to accomplish?</h4>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Describe your main use case
                </label>
                <textarea
                  value={formData.useCase || ""}
                  onChange={(e) => updateField("useCase", e.target.value)}
                  placeholder="Example: I need agents to scrape competitor pricing daily, update our CRM, and send alerts when prices change significantly..."
                  rows={4}
                  className="w-full px-4 py-3 glass rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-3">
                  What are your main pain points? (Select all that apply)
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_PAIN_POINTS.map((point) => (
                    <button
                      key={point}
                      onClick={() => toggleArrayItem("painPoints", point)}
                      className={`px-3 py-2 rounded-lg text-sm transition-all ${
                        formData.painPoints?.includes(point)
                          ? "bg-red-500/20 text-red-300 border border-red-500/50"
                          : "glass text-zinc-300 hover:bg-white/5"
                      }`}
                    >
                      {point}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Current Tools */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h4 className="text-white font-medium mb-4">What tools do you currently use?</h4>
            <p className="text-sm text-zinc-400 mb-4">
              Select the platforms your agents should be experts in:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {COMMON_TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => toggleArrayItem("currentTools", tool.id)}
                  className={`p-4 rounded-xl text-left transition-all ${
                    formData.currentTools?.includes(tool.id)
                      ? "bg-cyan-500/20 border-2 border-cyan-500/50"
                      : "glass hover:bg-white/5"
                  }`}
                >
                  <span className="text-2xl block mb-1">{tool.icon}</span>
                  <span className="text-sm text-white">{tool.name}</span>
                </button>
              ))}
            </div>

            {formData.currentTools && formData.currentTools.length > 0 && (
              <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                <p className="text-sm text-cyan-300">
                  Selected: {formData.currentTools.map((id) =>
                    COMMON_TOOLS.find((t) => t.id === id)?.name
                  ).join(", ")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Custom Instructions */}
      {step === 4 && (
        <div className="space-y-6">
          <div>
            <h4 className="text-white font-medium mb-4">Any specific instructions?</h4>
            <p className="text-sm text-zinc-400 mb-4">
              Add any custom guidelines, terminology, or preferences for your agents:
            </p>

            <div className="space-y-4">
              <textarea
                value={formData.customInstructions || ""}
                onChange={(e) => updateField("customInstructions", e.target.value)}
                placeholder={`Examples:
- Always refer to customers as "members"
- Use Australian date format (DD/MM/YYYY)
- Never share pricing publicly
- Escalate HIPAA-related requests to human review`}
                rows={6}
                className="w-full px-4 py-3 glass rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none font-mono text-sm"
              />

              {/* Summary */}
              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                <h5 className="text-sm font-medium text-purple-300 mb-3">Context Summary</h5>
                <div className="space-y-2 text-xs text-purple-200/70">
                  <p>
                    <span className="text-purple-300">Organization:</span>{" "}
                    {formData.organizationName || "Not set"}
                  </p>
                  <p>
                    <span className="text-purple-300">Industry:</span>{" "}
                    {INDUSTRIES.find((i) => i.id === formData.industry)?.name || "Not set"}
                  </p>
                  <p>
                    <span className="text-purple-300">Team Size:</span>{" "}
                    {TEAM_SIZES.find((s) => s.id === formData.teamSize)?.label || "Not set"}
                  </p>
                  {formData.currentTools && formData.currentTools.length > 0 && (
                    <p>
                      <span className="text-purple-300">Tools:</span>{" "}
                      {formData.currentTools.length} selected
                    </p>
                  )}
                  {formData.painPoints && formData.painPoints.length > 0 && (
                    <p>
                      <span className="text-purple-300">Pain Points:</span>{" "}
                      {formData.painPoints.length} identified
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-6 border-t border-white/10">
        <div>
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-6 py-2 glass rounded-lg text-zinc-300 hover:bg-white/5 transition-all"
            >
              Back
            </button>
          ) : onCancel ? (
            <button
              onClick={onCancel}
              className="px-6 py-2 glass rounded-lg text-zinc-300 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
          ) : null}
        </div>

        <div className="flex gap-3">
          {step < totalSteps && (
            <button
              onClick={() => setStep(step + 1)}
              className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
            >
              Skip
            </button>
          )}

          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="px-6 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-6 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 transition-all"
            >
              Complete Setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
