import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing - Bottleneck Bots | Simple, Transparent Pricing",
  description:
    "Simple pricing for Bottleneck Bots. Start free, scale as you grow. No hidden fees, no surprises.",
  keywords: [
    "bottleneck bots pricing",
    "workflow automation pricing",
    "bot automation cost",
    "automation platform pricing",
  ],
  openGraph: {
    title: "Pricing - Bottleneck Bots",
    description: "Simple, transparent pricing. Start free, scale as you grow.",
    url: "https://bottleneckbots.com/pricing",
  },
};

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for getting started with automation",
    features: [
      "3 active bots",
      "1,000 executions/month",
      "5 minute minimum schedule",
      "Email notifications",
      "7 day execution history",
      "Community support",
    ],
    cta: "Get Started",
    ctaLink: "/auth/signup",
    popular: false,
    gradient: "from-zinc-500 to-zinc-600",
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For teams and growing businesses",
    features: [
      "Unlimited bots",
      "50,000 executions/month",
      "1 minute minimum schedule",
      "Slack + Discord + Email",
      "Browser automation",
      "30 day execution history",
      "Priority support",
      "API access",
    ],
    cta: "Start Free Trial",
    ctaLink: "/auth/signup?plan=pro",
    popular: true,
    gradient: "from-blue-500 to-purple-600",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large-scale automation needs",
    features: [
      "Everything in Pro",
      "Unlimited executions",
      "Custom schedules",
      "SSO / SAML",
      "Dedicated support",
      "SLA guarantee",
      "Custom integrations",
      "On-premise option",
    ],
    cta: "Contact Sales",
    ctaLink: "/contact",
    popular: false,
    gradient: "from-purple-500 to-pink-600",
  },
];

const faqs = [
  {
    question: "What counts as an execution?",
    answer: "Each time a bot runs, regardless of how many actions it contains, counts as one execution. Failed runs due to configuration errors don't count.",
  },
  {
    question: "Can I change plans anytime?",
    answer: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any charges.",
  },
  {
    question: "Is there a free trial?",
    answer: "The Free plan is free forever. For Pro features, you get a 14-day free trial with no credit card required.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, debit cards, and PayPal. Enterprise customers can pay via invoice.",
  },
  {
    question: "Do unused executions roll over?",
    answer: "Executions reset at the start of each billing cycle and don't roll over. We recommend the Pro plan if you need consistent high volume.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.",
  },
];

export default function PricingPage() {
  return (
    <div className="relative">
      {/* Background effects */}
      <div className="absolute inset-0 mesh-gradient" />
      <div className="absolute inset-0 noise-overlay" />

      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl float" />
        <div className="absolute top-60 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl float-delayed" />
        <div className="absolute bottom-40 left-1/2 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl float" />
      </div>

      <div className="relative z-10">
        {/* Hero */}
        <section className="pt-20 pb-16 sm:pt-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white">
                Simple, <span className="gradient-text-animate">Transparent</span> Pricing
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto">
                Start free, scale as you grow. No hidden fees, no surprises.
              </p>

              {/* Toggle (visual only for now) */}
              <div className="mt-8 inline-flex items-center gap-3 glass px-2 py-1 rounded-full">
                <span className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium">
                  Monthly
                </span>
                <span className="px-4 py-2 text-zinc-400 text-sm">
                  Yearly (Save 20%)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="pb-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto perspective-1000">
              {plans.map((plan, idx) => (
                <div
                  key={idx}
                  className={`relative glass-card p-8 ${
                    plan.popular
                      ? "glow-gradient md:scale-105 md:-my-4"
                      : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium px-4 py-1.5 rounded-full shadow-lg">
                        Most Popular
                      </span>
                    </div>
                  )}

                  {/* Plan icon */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-4`}>
                    {plan.name === "Free" && (
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                    {plan.name === "Pro" && (
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                    )}
                    {plan.name === "Enterprise" && (
                      <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    )}
                  </div>

                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                    <div className="mt-4 flex items-baseline">
                      <span className={`text-5xl font-bold ${plan.popular ? "gradient-text" : "text-white"}`}>
                        {plan.price}
                      </span>
                      <span className="ml-2 text-zinc-400">{plan.period}</span>
                    </div>
                    <p className="mt-3 text-sm text-zinc-400">{plan.description}</p>
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start">
                        <svg
                          className={`h-5 w-5 ${plan.popular ? "text-blue-400" : "text-green-500"} mr-3 flex-shrink-0 mt-0.5`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm text-zinc-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.ctaLink}
                    className={`w-full inline-flex items-center justify-center rounded-full px-6 py-3.5 font-semibold transition-all duration-300 ${
                      plan.popular
                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg hover:shadow-blue-500/25 hover:scale-105"
                        : "glass-button text-white hover:scale-105"
                    }`}
                  >
                    {plan.cta}
                    <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Feature Comparison */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-12">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
              <h2 className="text-2xl font-bold text-white">Compare Plans</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
            </div>

            <div className="glass rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-5 px-6 text-zinc-400 font-medium">Feature</th>
                      <th className="text-center py-5 px-6 text-zinc-400 font-medium">Free</th>
                      <th className="text-center py-5 px-6 text-blue-400 font-medium bg-blue-500/5">Pro</th>
                      <th className="text-center py-5 px-6 text-zinc-400 font-medium">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[
                      { feature: "Active Bots", free: "3", pro: "Unlimited", enterprise: "Unlimited" },
                      { feature: "Monthly Executions", free: "1,000", pro: "50,000", enterprise: "Unlimited" },
                      { feature: "Minimum Schedule", free: "5 min", pro: "1 min", enterprise: "Custom" },
                      { feature: "Browser Automation", free: false, pro: true, enterprise: true },
                      { feature: "Slack Integration", free: false, pro: true, enterprise: true },
                      { feature: "Discord Integration", free: false, pro: true, enterprise: true },
                      { feature: "API Access", free: false, pro: true, enterprise: true },
                      { feature: "Priority Support", free: false, pro: true, enterprise: true },
                      { feature: "SSO / SAML", free: false, pro: false, enterprise: true },
                      { feature: "SLA Guarantee", free: false, pro: false, enterprise: true },
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6 text-sm text-zinc-300">{row.feature}</td>
                        <td className="py-4 px-6 text-center">
                          {typeof row.free === "boolean" ? (
                            row.free ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10">
                                <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-500/10">
                                <svg className="h-4 w-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </span>
                            )
                          ) : (
                            <span className="text-sm text-zinc-400">{row.free}</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center bg-blue-500/5">
                          {typeof row.pro === "boolean" ? (
                            row.pro ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10">
                                <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-500/10">
                                <svg className="h-4 w-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </span>
                            )
                          ) : (
                            <span className="text-sm font-medium text-blue-400">{row.pro}</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {typeof row.enterprise === "boolean" ? (
                            row.enterprise ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10">
                                <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-500/10">
                                <svg className="h-4 w-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </span>
                            )
                          ) : (
                            <span className="text-sm text-zinc-400">{row.enterprise}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-12">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
              <h2 className="text-2xl font-bold text-white">FAQs</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
            </div>

            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="glass rounded-2xl p-6 hover:glow-blue transition-all duration-300">
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mr-3 flex-shrink-0">
                      <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    {faq.question}
                  </h3>
                  <p className="text-zinc-400 ml-11">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <div className="glass-card p-12 max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-white mb-4">
                Still have questions?
              </h2>
              <p className="text-lg text-zinc-400 mb-8">
                Our team is here to help you find the right plan.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center rounded-full glass-button px-8 py-4 font-semibold text-white hover:scale-105 transition-transform"
              >
                Contact Sales
                <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
