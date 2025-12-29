import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bottleneck Bots - AI-Powered Workflow Automation Platform",
  description:
    "Automate repetitive tasks with intelligent bots. Monitor websites, sync data, send notifications, and scrape web pages - all without writing code. Start free today.",
  keywords: [
    "workflow automation",
    "bot automation",
    "no-code automation",
    "website monitoring",
    "web scraping",
    "slack notifications",
    "discord bots",
    "API integration",
    "task automation",
    "business automation",
  ],
  openGraph: {
    title: "Bottleneck Bots - AI-Powered Workflow Automation",
    description:
      "Automate repetitive tasks with intelligent bots. No code required.",
    type: "website",
    url: "https://bottleneckbots.com",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Bottleneck Bots - Workflow Automation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bottleneck Bots - AI-Powered Workflow Automation",
    description: "Automate repetitive tasks with intelligent bots.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: "https://bottleneckbots.com",
  },
};

const features = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Lightning Fast Execution",
    description: "Bots execute in milliseconds with real-time monitoring and instant notifications.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Smart Scheduling",
    description: "Run bots on custom schedules - every minute, hourly, daily, or with cron expressions.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    title: "Browser Automation",
    description: "Scrape JavaScript-heavy websites with real browser rendering powered by Browserbase.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    title: "Multi-Channel Alerts",
    description: "Send notifications to Slack, Discord, Email, or custom webhooks simultaneously.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Enterprise Security",
    description: "Row-level security with Supabase, encrypted credentials, and audit logging.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    title: "Template Library",
    description: "Start fast with 18+ pre-built templates for common automation use cases.",
  },
];

const useCases = [
  {
    title: "Website Monitoring",
    description: "Check if your sites are up and get instant alerts when they go down.",
    href: "/use-cases/monitoring",
  },
  {
    title: "Data Synchronization",
    description: "Keep your systems in sync with automated API-to-API data transfers.",
    href: "/use-cases/data-sync",
  },
  {
    title: "Price Tracking",
    description: "Monitor product prices and get alerts when they drop below your target.",
    href: "/use-cases/price-tracking",
  },
  {
    title: "Lead Notifications",
    description: "Instantly notify your sales team when new leads come in.",
    href: "/use-cases/notifications",
  },
];

const testimonials = [
  {
    quote: "Bottleneck Bots saved us hours every week. Our monitoring is now completely automated.",
    author: "Sarah Chen",
    role: "DevOps Lead",
    company: "TechStartup Inc",
  },
  {
    quote: "The browser scraping feature is incredible. We can now monitor competitor prices automatically.",
    author: "Marcus Johnson",
    role: "E-commerce Manager",
    company: "RetailCo",
  },
  {
    quote: "Setting up multi-channel alerts took minutes, not days. Our response time improved 10x.",
    author: "Emily Rodriguez",
    role: "Customer Success",
    company: "SaaS Platform",
  },
];

export default function HomePage() {
  return (
    <div className="mesh-gradient min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden particles">
        {/* Animated orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/30 rounded-full blur-[100px] float" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-[120px] float-delayed" />
        <div className="absolute bottom-20 left-1/3 w-64 h-64 bg-cyan-500/20 rounded-full blur-[80px] float" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-32 sm:pb-32">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 glass-button rounded-full px-5 py-2 text-sm text-blue-300 mb-8 shimmer">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Now with Browser Automation
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight">
              <span className="block">Automate Your Workflows</span>
              <span className="block mt-2 gradient-text-animate">
                Without Writing Code
              </span>
            </h1>

            <p className="mt-8 max-w-2xl mx-auto text-lg sm:text-xl text-zinc-400">
              Build intelligent bots that monitor websites, sync data, send notifications,
              and scrape web pages. Set up in minutes, not days.
            </p>

            {/* CTA Buttons */}
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/signup"
                className="group relative w-full sm:w-auto inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-semibold text-white overflow-hidden"
              >
                <div className="absolute inset-0 gradient-animate rounded-full" />
                <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 glow-gradient" />
                <span className="relative flex items-center">
                  Start Free Trial
                  <svg className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
              <Link
                href="/docs"
                className="w-full sm:w-auto glass-button inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-medium text-white hover-glow"
              >
                View Documentation
              </Link>
            </div>

            <p className="mt-6 text-sm text-zinc-500">
              No credit card required &bull; Free tier available &bull; Setup in 2 minutes
            </p>
          </div>

          {/* Floating 3D Cards Preview */}
          <div className="mt-20 perspective-1000">
            <div className="relative max-w-4xl mx-auto">
              <div className="glass-card p-8 card-3d">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-3 w-3 rounded-full bg-red-500" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500" />
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                  <span className="text-sm text-zinc-500 ml-4">bottleneck-bots dashboard</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="glass rounded-xl p-4 shimmer">
                      <div className="h-4 w-20 bg-zinc-700 rounded mb-2" />
                      <div className="h-8 w-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="glass border-y border-zinc-800/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-sm text-zinc-500 mb-6">Trusted by teams at</p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-60">
            {["TechCorp", "StartupXYZ", "AgencyPro", "DevStudio", "CloudOps"].map((company) => (
              <span key={company} className="text-lg font-semibold text-zinc-400 hover:text-white transition-colors">
                {company}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 sm:py-32 relative" id="features">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Everything You Need to <span className="gradient-text">Automate</span>
            </h2>
            <p className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto">
              Powerful features that make workflow automation simple and reliable.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="group glass-card p-8 hover-lift glow-border"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-400 mb-6 group-hover:scale-110 transition-transform pulse-glow">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-[150px]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              How It <span className="gradient-text">Works</span>
            </h2>
            <p className="mt-4 text-lg text-zinc-400">
              Get started in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Choose a Template",
                description: "Pick from our library of pre-built bot templates or start from scratch.",
              },
              {
                step: "2",
                title: "Configure Your Bot",
                description: "Set up triggers, actions, and notifications with our intuitive interface.",
              },
              {
                step: "3",
                title: "Deploy & Monitor",
                description: "Activate your bot and watch it work. Track every execution in real-time.",
              },
            ].map((item, idx) => (
              <div key={idx} className="relative text-center group">
                {/* Connector line */}
                {idx < 2 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-blue-500/50 to-transparent" />
                )}
                <div className="relative inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-animate text-2xl font-bold text-white mb-6 float-3d glow-gradient">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Built for <span className="gradient-text">Every Use Case</span>
            </h2>
            <p className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto">
              From website monitoring to data synchronization, automate any workflow.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {useCases.map((useCase, idx) => (
              <Link
                key={idx}
                href={useCase.href}
                className="group glass-card flex items-start gap-6 p-8 hover-lift"
              >
                <div className="flex-shrink-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                    {useCase.title}
                  </h3>
                  <p className="text-zinc-400">{useCase.description}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/use-cases"
              className="inline-flex items-center text-blue-400 hover:text-blue-300 font-medium group"
            >
              View all use cases
              <svg className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 sm:py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-950/10 to-transparent pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Loved by <span className="gradient-text">Teams Everywhere</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <div
                key={idx}
                className="glass-card p-8 hover-lift"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <blockquote className="text-zinc-300 mb-6 leading-relaxed">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <div>
                  <p className="font-semibold text-white">{testimonial.author}</p>
                  <p className="text-sm text-zinc-500">{testimonial.role}, {testimonial.company}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 gradient-animate opacity-90" />
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />

            {/* Floating orbs */}
            <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl float" />
            <div className="absolute bottom-10 right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl float-delayed" />

            <div className="relative p-12 sm:p-16 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 text-glow">
                Ready to Automate Your Workflow?
              </h2>
              <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
                Join thousands of teams saving time with intelligent automation.
                Start your free trial today.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/auth/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-base font-semibold text-blue-600 hover:bg-blue-50 transition-colors hover:scale-105 transform"
                >
                  Start Free Trial
                </Link>
                <Link
                  href="/pricing"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border-2 border-white/30 px-8 py-4 text-base font-medium text-white hover:bg-white/10 transition-colors"
                >
                  View Pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Bottleneck Bots",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: "AI-powered workflow automation platform for monitoring, notifications, and data synchronization.",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: "4.9",
              ratingCount: "150",
            },
          }),
        }}
      />
    </div>
  );
}
