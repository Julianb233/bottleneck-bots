import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Integrations - Bottleneck Bots | Connect Your Tools",
  description:
    "Connect Bottleneck Bots with Slack, Discord, Email, webhooks, REST APIs, and more. Automate workflows across all your tools.",
  keywords: [
    "slack integration",
    "discord bot integration",
    "email automation",
    "webhook integration",
    "api integration",
    "workflow integrations",
  ],
  openGraph: {
    title: "Integrations - Bottleneck Bots",
    description: "Connect your tools and automate workflows seamlessly.",
    url: "https://bottleneckbots.com/integrations",
  },
};

const featuredIntegrations = [
  {
    name: "Slack",
    description: "Send messages to channels, create rich notifications with Block Kit, and respond to events.",
    icon: (
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
      </svg>
    ),
    features: ["Incoming webhooks", "Rich message formatting", "Channel overrides", "Thread replies"],
    color: "text-[#4A154B]",
    bgColor: "bg-[#4A154B]/10",
  },
  {
    name: "Discord",
    description: "Post to channels with rich embeds, mention roles, and automate your community notifications.",
    icon: (
      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
    features: ["Webhook messages", "Rich embeds", "Custom avatars", "Mention support"],
    color: "text-[#5865F2]",
    bgColor: "bg-[#5865F2]/10",
  },
  {
    name: "Email (Resend)",
    description: "Send transactional emails with beautiful templates, tracking, and high deliverability.",
    icon: (
      <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    features: ["HTML templates", "Plain text fallback", "Delivery tracking", "Custom from address"],
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    name: "Browserbase",
    description: "Cloud browser automation for scraping JavaScript-heavy websites with full rendering.",
    icon: (
      <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    features: ["Full JS rendering", "Screenshots", "Form automation", "Stealth mode"],
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
];

const otherIntegrations = [
  {
    name: "REST APIs",
    description: "Call any HTTP endpoint with custom headers, authentication, and request bodies.",
    icon: "🔌",
  },
  {
    name: "Webhooks",
    description: "Receive webhooks from any service and trigger your automation workflows.",
    icon: "🔗",
  },
  {
    name: "Supabase",
    description: "Built on Supabase for authentication, database, and real-time capabilities.",
    icon: "⚡",
  },
  {
    name: "Cron Jobs",
    description: "Schedule bots with flexible cron expressions for any timing need.",
    icon: "⏰",
  },
];

export default function IntegrationsPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-20 pb-16 sm:pt-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-white">
              Connect Your
              <span className="block mt-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Favorite Tools
              </span>
            </h1>
            <p className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto">
              Bottleneck Bots integrates with the tools you already use.
              Send notifications, sync data, and automate workflows seamlessly.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Integrations */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-12">Featured Integrations</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {featuredIntegrations.map((integration, idx) => (
              <div
                key={idx}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start gap-6">
                  <div className={`${integration.bgColor} ${integration.color} p-4 rounded-xl`}>
                    {integration.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2">{integration.name}</h3>
                    <p className="text-zinc-400 mb-4">{integration.description}</p>
                    <ul className="space-y-2">
                      {integration.features.map((feature, i) => (
                        <li key={i} className="flex items-center text-sm text-zinc-500">
                          <svg className="h-4 w-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Other Integrations */}
      <section className="py-16 sm:py-24 bg-zinc-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white mb-12">More Capabilities</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {otherIntegrations.map((integration, idx) => (
              <div
                key={idx}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6"
              >
                <span className="text-4xl mb-4 block">{integration.icon}</span>
                <h3 className="text-lg font-semibold text-white mb-2">{integration.name}</h3>
                <p className="text-sm text-zinc-400">{integration.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to Connect */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-white">Easy Setup</h2>
            <p className="mt-2 text-zinc-400">Connect your tools in minutes</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "1",
                title: "Choose Integration",
                description: "Select from our library of integrations or use the generic HTTP action.",
              },
              {
                step: "2",
                title: "Add Credentials",
                description: "Securely store your API keys, webhooks, and authentication tokens.",
              },
              {
                step: "3",
                title: "Start Automating",
                description: "Use the integration in your bot actions and start automating.",
              },
            ].map((step, idx) => (
              <div key={idx} className="text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-xl font-bold text-white mb-4">
                  {step.step}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-zinc-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Request Integration */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              Need a Different Integration?
            </h2>
            <p className="text-zinc-400 mb-8 max-w-xl mx-auto">
              Don&apos;t see the tool you need? Our HTTP action works with any REST API,
              or let us know what you&apos;d like to see next.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-3.5 font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Request Integration
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center rounded-full border border-zinc-700 px-8 py-3.5 font-medium text-white hover:bg-zinc-800 transition-colors"
              >
                View API Docs
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
