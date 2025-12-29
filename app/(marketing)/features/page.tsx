import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Features - Bottleneck Bots | Powerful Workflow Automation",
  description:
    "Explore all the powerful features of Bottleneck Bots: smart scheduling, browser automation, multi-channel notifications, webhook integrations, and more.",
  keywords: [
    "workflow automation features",
    "bot scheduling",
    "browser automation",
    "web scraping",
    "notification automation",
    "webhook integration",
    "API automation",
  ],
  openGraph: {
    title: "Features - Bottleneck Bots",
    description: "Discover all the powerful features for workflow automation.",
    url: "https://bottleneckbots.com/features",
  },
};

const coreFeatures = [
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Smart Scheduling",
    description: "Schedule bots with flexible cron expressions. Run every minute, hourly, daily, or create complex schedules.",
    details: [
      "Cron expression support",
      "One-time execution",
      "Timezone aware",
      "Schedule previews",
    ],
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    title: "Browser Automation",
    description: "Scrape JavaScript-rendered websites with real browser sessions powered by Browserbase.",
    details: [
      "Full JS rendering",
      "Screenshot capture",
      "Form filling",
      "Element interaction",
    ],
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    title: "Multi-Channel Notifications",
    description: "Send alerts to Slack, Discord, Email, or any webhook endpoint simultaneously.",
    details: [
      "Slack webhooks",
      "Discord rich embeds",
      "Email via Resend",
      "Custom webhooks",
    ],
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: "HTTP Actions",
    description: "Make API calls to any endpoint with full control over headers, body, and authentication.",
    details: [
      "All HTTP methods",
      "Custom headers",
      "JSON/Form body",
      "Response parsing",
    ],
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    title: "Webhook Triggers",
    description: "Trigger bots from external events. Each bot gets a unique webhook URL.",
    details: [
      "Unique webhook URLs",
      "Payload validation",
      "Event filtering",
      "Request logging",
    ],
  },
  {
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    title: "Action Chaining",
    description: "Chain multiple actions together. Pass data between steps with variable interpolation.",
    details: [
      "Sequential execution",
      "Data passing",
      "Conditional logic",
      "Error handling",
    ],
  },
];

const advancedFeatures = [
  {
    title: "Template Library",
    description: "Start fast with 18+ pre-built templates for common automation tasks.",
    icon: "📚",
  },
  {
    title: "Real-time Monitoring",
    description: "Watch your bots execute in real-time with detailed logging.",
    icon: "📊",
  },
  {
    title: "Execution History",
    description: "Full audit trail of every bot run with inputs and outputs.",
    icon: "📋",
  },
  {
    title: "Error Retries",
    description: "Automatic retry with exponential backoff for failed actions.",
    icon: "🔄",
  },
  {
    title: "Variable System",
    description: "Use {{variables}} to inject dynamic data into any field.",
    icon: "🔧",
  },
  {
    title: "Team Collaboration",
    description: "Share bots across your team with role-based access control.",
    icon: "👥",
  },
  {
    title: "API Access",
    description: "Full REST API to manage bots programmatically.",
    icon: "🔌",
  },
  {
    title: "Secure Storage",
    description: "Encrypted credential storage with Supabase Vault.",
    icon: "🔐",
  },
];

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-20 pb-16 sm:pt-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-white">
              Powerful Features for
              <span className="block mt-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Every Automation Need
              </span>
            </h1>
            <p className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto">
              Everything you need to automate workflows, monitor systems, and connect services.
              No coding required.
            </p>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-12">Core Features</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {coreFeatures.map((feature, idx) => (
              <div
                key={idx}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 hover:border-zinc-700 transition-colors"
              >
                <div className="text-blue-400 mb-6">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-zinc-400 mb-6">{feature.description}</p>
                <ul className="space-y-2">
                  {feature.details.map((detail, i) => (
                    <li key={i} className="flex items-center text-sm text-zinc-500">
                      <svg className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Advanced Features Grid */}
      <section className="py-16 sm:py-24 bg-zinc-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-12">Advanced Capabilities</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {advancedFeatures.map((feature, idx) => (
              <div
                key={idx}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
              >
                <span className="text-3xl mb-4 block">{feature.icon}</span>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Action Types */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white">9 Built-in Action Types</h2>
            <p className="mt-2 text-zinc-400">Chain actions together to build powerful workflows</p>
          </div>

          <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { name: "HTTP Request", icon: "🌐" },
              { name: "Email", icon: "📧" },
              { name: "Slack", icon: "💬" },
              { name: "Discord", icon: "🎮" },
              { name: "Browser Scrape", icon: "🕷️" },
              { name: "Webhook", icon: "🔗" },
              { name: "Delay", icon: "⏱️" },
              { name: "Filter", icon: "🔍" },
              { name: "Transform", icon: "🔄" },
            ].map((action, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4"
              >
                <span className="text-2xl">{action.icon}</span>
                <span className="text-sm font-medium text-white">{action.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-3xl p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-blue-100 mb-8 max-w-xl mx-auto">
              Create your first bot in minutes. No credit card required.
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center rounded-full bg-white px-8 py-3.5 font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
