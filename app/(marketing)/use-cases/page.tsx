import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Use Cases - Bottleneck Bots | Automation Solutions",
  description:
    "Discover how teams use Bottleneck Bots for website monitoring, data synchronization, lead notifications, price tracking, and more.",
  keywords: [
    "workflow automation use cases",
    "website monitoring automation",
    "data sync automation",
    "lead notification bot",
    "price tracking bot",
    "web scraping automation",
  ],
  openGraph: {
    title: "Use Cases - Bottleneck Bots",
    description: "Discover automation solutions for every business need.",
    url: "https://bottleneckbots.com/use-cases",
  },
};

const useCases = [
  {
    slug: "monitoring",
    title: "Website & API Monitoring",
    description: "Keep your services running smoothly with automated uptime checks and instant alerts.",
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    benefits: [
      "Check endpoint availability every minute",
      "Get Slack/Discord alerts when services go down",
      "Track response times and performance",
      "Monitor SSL certificate expiration",
    ],
    example: "A DevOps team uses Bottleneck Bots to monitor 50+ microservices. When any endpoint returns a non-200 status, the team gets instant Slack alerts with response details.",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    slug: "notifications",
    title: "Alert & Notification Automation",
    description: "Never miss critical events with multi-channel notification workflows.",
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    benefits: [
      "Send alerts to Slack, Discord, and Email simultaneously",
      "Customize message formatting per channel",
      "Set up escalation workflows",
      "Include rich data from webhook payloads",
    ],
    example: "An e-commerce business routes order notifications to their sales Slack channel, sends customer confirmations via email, and posts daily summaries to Discord.",
    gradient: "from-amber-500 to-orange-500",
  },
  {
    slug: "data-sync",
    title: "Data Synchronization",
    description: "Keep your systems in sync with automated API-to-API data transfers.",
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    benefits: [
      "Sync data between CRM and marketing tools",
      "Automate database backups to cloud storage",
      "Keep inventory levels updated across platforms",
      "Transform data formats between systems",
    ],
    example: "A marketing agency syncs leads from their website forms to HubSpot CRM every 15 minutes, automatically enriching contact data along the way.",
    gradient: "from-green-500 to-emerald-500",
  },
  {
    slug: "web-scraping",
    title: "Web Scraping & Data Extraction",
    description: "Extract data from any website, including JavaScript-heavy SPAs.",
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    benefits: [
      "Scrape JavaScript-rendered content with real browsers",
      "Extract specific elements with CSS selectors",
      "Capture screenshots for visual monitoring",
      "Handle authentication and form submission",
    ],
    example: "A research firm scrapes competitor pricing pages daily, comparing changes over time and alerting the team when significant price changes occur.",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    slug: "price-tracking",
    title: "Price & Inventory Monitoring",
    description: "Track product prices and stock levels across e-commerce sites.",
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    benefits: [
      "Monitor competitor pricing in real-time",
      "Get alerts when prices drop below targets",
      "Track stock availability",
      "Build historical price databases",
    ],
    example: "An e-commerce manager tracks prices on 100+ competitor products. When any price drops 10% or more, they get instant alerts to adjust their own pricing strategy.",
    gradient: "from-indigo-500 to-purple-500",
  },
  {
    slug: "workflow",
    title: "Business Process Automation",
    description: "Automate repetitive business tasks and workflows.",
    icon: (
      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    benefits: [
      "Send daily standup reminders to your team",
      "Generate weekly reports automatically",
      "Process form submissions and route to the right team",
      "Automate employee onboarding tasks",
    ],
    example: "A startup automates their entire standup process: reminders go out at 9 AM, team members submit updates via a form, and a summary is posted to Slack at 10 AM.",
    gradient: "from-rose-500 to-pink-500",
  },
];

export default function UseCasesPage() {
  return (
    <div className="relative">
      {/* Background effects */}
      <div className="absolute inset-0 mesh-gradient" />
      <div className="absolute inset-0 noise-overlay" />

      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-40 left-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl float" />
        <div className="absolute top-80 right-20 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl float-delayed" />
        <div className="absolute bottom-60 left-1/3 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl float" />
      </div>

      <div className="relative z-10">
        {/* Hero */}
        <section className="pt-20 pb-16 sm:pt-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white">
                Automation for
                <span className="block mt-2 gradient-text-animate">
                  Every Business Need
                </span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto">
                See how teams use Bottleneck Bots to save time, reduce errors, and focus on what matters.
              </p>

              {/* Use case count */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                {["Monitoring", "Notifications", "Data Sync", "Scraping", "Price Tracking", "Workflows"].map((tag, i) => (
                  <span key={i} className="glass px-4 py-2 rounded-full text-sm text-zinc-300">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases Grid */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="space-y-24">
              {useCases.map((useCase, idx) => (
                <div
                  key={idx}
                  className={`grid lg:grid-cols-2 gap-12 items-center ${
                    idx % 2 === 1 ? "lg:grid-flow-dense" : ""
                  }`}
                >
                  <div className={idx % 2 === 1 ? "lg:col-start-2" : ""}>
                    {/* Icon */}
                    <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${useCase.gradient} mb-6 text-white shadow-lg`}>
                      {useCase.icon}
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                      {useCase.title}
                    </h2>
                    <p className="text-lg text-zinc-400 mb-6">{useCase.description}</p>

                    <ul className="space-y-3 mb-8">
                      {useCase.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-start">
                          <span className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                            <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                          <span className="text-zinc-300">{benefit}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={`/dashboard/templates?category=${useCase.slug}`}
                      className="inline-flex items-center glass-button px-6 py-3 rounded-full text-white font-medium hover:scale-105 transition-transform"
                    >
                      View templates
                      <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  </div>

                  {/* Example card */}
                  <div className={`glass-card p-8 ${idx % 2 === 1 ? "lg:col-start-1" : ""}`}>
                    <div className="flex items-center gap-3 mb-6">
                      <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${useCase.gradient} flex items-center justify-center`}>
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                      <span className="text-sm font-medium text-zinc-400">Real-world example</span>
                    </div>
                    <p className="text-zinc-300 leading-relaxed text-lg">{useCase.example}</p>

                    {/* Decorative gradient line */}
                    <div className={`mt-6 h-1 rounded-full bg-gradient-to-r ${useCase.gradient} opacity-50`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl">
              {/* Gradient background */}
              <div className="absolute inset-0 gradient-animate opacity-90" />

              {/* Glass overlay */}
              <div className="relative glass p-12 text-center border-0">
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  Have a Different Use Case?
                </h2>
                <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
                  Bottleneck Bots is flexible enough to handle almost any automation need.
                  Start with a template or build from scratch.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/auth/signup"
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-white px-8 py-4 font-semibold text-blue-600 hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    Start Building
                    <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                  <Link
                    href="/contact"
                    className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-white/30 px-8 py-4 font-medium text-white hover:bg-white/10 transition-colors"
                  >
                    Talk to Us
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
