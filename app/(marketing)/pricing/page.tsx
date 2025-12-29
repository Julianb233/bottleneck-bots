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
    <>
      {/* Hero */}
      <section className="pt-20 pb-16 sm:pt-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-white">
              Simple, Transparent Pricing
            </h1>
            <p className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto">
              Start free, scale as you grow. No hidden fees, no surprises.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, idx) => (
              <div
                key={idx}
                className={`relative rounded-2xl ${
                  plan.popular
                    ? "bg-gradient-to-b from-blue-600/20 to-purple-600/20 border-2 border-blue-500"
                    : "bg-zinc-900 border border-zinc-800"
                } p-8`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm font-medium px-4 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="ml-1 text-zinc-400">{plan.period}</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">{plan.description}</p>
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
                  className={`w-full inline-flex items-center justify-center rounded-full px-6 py-3 font-medium transition-colors ${
                    plan.popular
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90"
                      : "bg-zinc-800 text-white hover:bg-zinc-700"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison */}
      <section className="py-16 sm:py-24 bg-zinc-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white text-center mb-12">
            Compare Plans
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full max-w-4xl mx-auto">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-4 text-zinc-400 font-medium">Feature</th>
                  <th className="text-center py-4 text-zinc-400 font-medium">Free</th>
                  <th className="text-center py-4 text-zinc-400 font-medium">Pro</th>
                  <th className="text-center py-4 text-zinc-400 font-medium">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
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
                  <tr key={idx}>
                    <td className="py-4 text-sm text-zinc-300">{row.feature}</td>
                    <td className="py-4 text-center">
                      {typeof row.free === "boolean" ? (
                        row.free ? (
                          <svg className="h-5 w-5 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-zinc-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )
                      ) : (
                        <span className="text-sm text-zinc-400">{row.free}</span>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      {typeof row.pro === "boolean" ? (
                        row.pro ? (
                          <svg className="h-5 w-5 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-zinc-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )
                      ) : (
                        <span className="text-sm text-zinc-400">{row.pro}</span>
                      )}
                    </td>
                    <td className="py-4 text-center">
                      {typeof row.enterprise === "boolean" ? (
                        row.enterprise ? (
                          <svg className="h-5 w-5 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="h-5 w-5 text-zinc-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
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
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-white text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2">{faq.question}</h3>
                <p className="text-zinc-400">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Still have questions?
          </h2>
          <p className="text-lg text-zinc-400 mb-8">
            Our team is here to help you find the right plan.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-800 px-8 py-3.5 font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Contact Sales
          </Link>
        </div>
      </section>
    </>
  );
}
