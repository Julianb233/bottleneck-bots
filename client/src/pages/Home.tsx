import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Bot,
  Zap,
  Shield,
  Clock,
  ArrowRight,
  CheckCircle,
  Star,
  Globe,
  Workflow,
  FileStack,
} from "lucide-react";

/**
 * Landing page for Bottleneck Bots
 * Converts visitors to signups with clear value proposition and CTAs
 */
export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8 rounded-lg" />
              <span className="font-bold text-xl tracking-tight text-slate-900">
                Bottleneck Bots
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href={getLoginUrl()}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Sign In
              </a>
              <Button
                onClick={() => window.location.href = getLoginUrl()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Start Free Trial
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-blue-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              AI-Powered Virtual Employees for Marketing Agencies
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6">
              Automate Your
              <span className="block text-emerald-600">Agency Operations</span>
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              Deploy AI agents that manage your GoHighLevel CRM, follow up with leads,
              run campaigns, and handle repetitive tasks -- so you can focus on growing your agency.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button
                size="lg"
                onClick={() => window.location.href = getLoginUrl()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-lg px-8 py-6 shadow-lg shadow-emerald-600/20"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-lg px-8 py-6"
              >
                See How It Works
              </Button>
            </div>
            <p className="text-sm text-slate-500 mt-4">
              No credit card required. 200 free executions included.
            </p>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 bg-slate-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "50+", label: "Agency Tasks Automated" },
              { value: "10x", label: "Faster Lead Follow-Up" },
              { value: "24/7", label: "Always Working" },
              { value: "99.9%", label: "Uptime SLA" },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
                <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Everything You Need to Scale
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              From lead management to campaign execution, our AI agents handle
              the work that slows your agency down.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Bot,
                title: "AI Browser Agents",
                description:
                  "Agents that navigate GoHighLevel, fill forms, manage contacts, and execute tasks in real-time with live browser preview.",
              },
              {
                icon: Globe,
                title: "GoHighLevel Integration",
                description:
                  "Native OAuth connection to GHL. Manage contacts, pipelines, campaigns, workflows, and appointments automatically.",
              },
              {
                icon: Workflow,
                title: "Workflow Automation",
                description:
                  "Build custom workflows and train agents on your agency's specific SOPs. Upload documents and let AI learn your process.",
              },
              {
                icon: FileStack,
                title: "Task Templates",
                description:
                  "Pre-built templates for common agency tasks: lead enrichment, pipeline management, campaign launches, and reporting.",
              },
              {
                icon: Clock,
                title: "Scheduled Execution",
                description:
                  "Set up recurring tasks with cron scheduling. Daily follow-ups, weekly reports, monthly audits -- all on autopilot.",
              },
              {
                icon: Shield,
                title: "Enterprise Security",
                description:
                  "AES-256 encrypted credential storage, OAuth 2.0 with PKCE, role-based access controls, and full audit logging.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-xl border border-gray-200 bg-white hover:shadow-lg hover:border-emerald-200 transition-all group"
              >
                <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center mb-4 group-hover:bg-emerald-200 transition-colors">
                  <feature.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Get Started in Minutes
            </h2>
            <p className="text-lg text-slate-600">
              Three simple steps to automate your agency.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "1",
                title: "Connect GoHighLevel",
                description:
                  "Link your GHL account with one-click OAuth. We support all locations and sub-accounts.",
              },
              {
                step: "2",
                title: "Train Your Agent",
                description:
                  "Upload SOPs, define workflows, and configure which skills and tools your agent can use.",
              },
              {
                step: "3",
                title: "Deploy & Monitor",
                description:
                  "Launch tasks from templates or custom instructions. Watch agents work in real-time with live browser preview.",
              },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-slate-600">
              Plans that scale with your agency. Start with a free trial.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              { name: "Starter", price: "$997", agents: "5 agents", executions: "200/mo", highlight: false },
              { name: "Growth", price: "$1,697", agents: "10 agents", executions: "500/mo", highlight: true },
              { name: "Professional", price: "$3,197", agents: "25 agents", executions: "1,250/mo", highlight: false },
              { name: "Enterprise", price: "$4,997", agents: "50 agents", executions: "3,000/mo", highlight: false },
            ].map((plan, i) => (
              <div
                key={i}
                className={`p-6 rounded-xl border ${
                  plan.highlight
                    ? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-500/20"
                    : "border-gray-200 bg-white"
                }`}
              >
                {plan.highlight && (
                  <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold mb-3">
                    <Star className="w-3 h-3 fill-current" />
                    MOST POPULAR
                  </div>
                )}
                <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-slate-500">/mo</span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    {plan.agents}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    {plan.executions} executions
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    GHL integration
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button
              size="lg"
              onClick={() => window.location.href = getLoginUrl()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Start Your Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Built for Marketing Agencies
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              We understand the daily grind of managing multiple GHL accounts,
              following up with leads, and running campaigns. Let AI handle the busywork.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: "Our agents handle lead follow-up across 15 GHL locations. What used to take 3 VAs now runs on autopilot.",
                author: "Agency Owner",
                role: "Digital Marketing Agency",
              },
              {
                quote: "The task templates are a game-changer. We deploy the same automation across every client account in minutes.",
                author: "Operations Manager",
                role: "Growth Agency",
              },
              {
                quote: "Being able to watch the AI work in real-time with the browser preview gives us confidence to let it run autonomously.",
                author: "Founder",
                role: "Lead Generation Agency",
              },
            ].map((testimonial, i) => (
              <div key={i} className="p-6 rounded-xl bg-slate-800 border border-slate-700">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                  "{testimonial.quote}"
                </p>
                <div>
                  <p className="font-semibold text-white text-sm">{testimonial.author}</p>
                  <p className="text-slate-500 text-xs">{testimonial.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-emerald-600 to-emerald-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Eliminate Your Bottlenecks?
          </h2>
          <p className="text-lg text-emerald-100 mb-8 max-w-2xl mx-auto">
            Join agencies using AI agents to automate their GoHighLevel workflows.
            Start your free trial today.
          </p>
          <Button
            size="lg"
            onClick={() => window.location.href = getLoginUrl()}
            className="bg-white text-emerald-700 hover:bg-emerald-50 text-lg px-8 py-6 shadow-lg"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-950 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src={APP_LOGO} alt={APP_TITLE} className="h-6 w-6 rounded" />
              <span className="font-semibold text-white">Bottleneck Bots</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="/features" className="hover:text-white transition-colors">Features</a>
            </div>
            <p className="text-sm">2026 Bottleneck Bots. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
