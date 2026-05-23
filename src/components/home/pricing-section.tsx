import { HoverBorderGradient } from "../ui/hover-border-gradient";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const PricingSection = () => {
  return (
    <section className="py-24 bg-white dark:bg-background" id="pricing">
      <div className="max-w-6xl mx-auto px-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest mb-6">
            🚀 Soft Launch — Trial Access
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
            Transparent Pricing
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            During our soft launch, all packages are available on a trial basis.
            Choose the plan that fits your needs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-stretch">
          {PLAN_DEFINITIONS.map((plan) => {
            const isEnterprise = plan.id === "enterprise";

            return (
              <div
                key={plan.id}
                className={cn(
                  "p-10 rounded-3xl border flex flex-col h-full relative",
                  plan.highlight
                    ? "border-2 border-primary bg-white dark:bg-zinc-900"
                    : "border-slate-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50",
                )}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                    Most Popular
                  </div>
                )}

                <div className="mb-8">
                  {/* Fixed height for name so all cards align */}
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2 min-h-[3.5rem] flex items-start">
                    {plan.name}
                  </h4>
                  <div className="flex items-baseline gap-1">
                    {isEnterprise ? (
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        Custom
                      </span>
                    ) : (
                      <span className="text-2xl font-black text-primary">
                        Trial
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {plan.description}
                  </p>
                </div>

                <ul className="space-y-4 mb-10 flex-1">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400"
                    >
                      <span className="material-symbols-outlined text-primary text-lg">
                        check_circle
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={
                    isEnterprise
                      ? "mailto:wordings.ai.uk@gmail.com?subject=Enterprise%20Plan%20Inquiry"
                      : "/signup"
                  }
                  className="w-full"
                >
                  <HoverBorderGradient
                    containerClassName="rounded-full w-full"
                    as="button"
                    className={cn(
                      "w-full py-3 px-4 transition-all flex items-center justify-center space-x-2 text-sm font-bold",
                      plan.highlight
                        ? "bg-primary text-white hover:bg-primary/80"
                        : "bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10",
                    )}
                  >
                    <span>{isEnterprise ? "Contact Us" : "Get Started"}</span>
                  </HoverBorderGradient>
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-24 overflow-x-auto">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Compare Plans
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Detailed feature comparison to help you choose.
            </p>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="py-4 px-6 text-sm font-bold text-slate-900 dark:text-white">
                  Feature
                </th>
                <th className="py-4 px-6 text-sm font-bold text-slate-900 dark:text-white text-center">
                  Fast
                </th>
                <th className="py-4 px-6 text-sm font-bold text-slate-900 dark:text-white text-center">
                  Intelligence
                </th>
                <th className="py-4 px-6 text-sm font-bold text-slate-900 dark:text-white text-center">
                  Plus
                </th>
                <th className="py-4 px-6 text-sm font-bold text-slate-900 dark:text-white text-center">
                  Enterprise
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Core Features */}
              <tr className="border-b border-slate-200 dark:border-white/10">
                <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-white">
                  Upload Contract
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-white">
                  Clause Library
                </td>
                <td className="py-4 px-6 text-sm text-center text-slate-600 dark:text-slate-400">
                  Read-only
                </td>
                <td className="py-4 px-6 text-sm text-center text-slate-600 dark:text-slate-400">
                  Full Access
                </td>
                <td className="py-4 px-6 text-sm text-center text-slate-600 dark:text-slate-400">
                  Full Access
                </td>
                <td className="py-4 px-6 text-sm text-center text-slate-600 dark:text-slate-400">
                  Full Access
                </td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-white">
                  Analytics
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
              </tr>
              {/* Advanced Features */}
              <tr className="border-b border-slate-200 dark:border-white/10">
                <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-white">
                  Custom Rules
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-white">
                  Workspace Creation
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
              </tr>
              {/* Enterprise Features */}
              <tr className="border-b border-slate-200 dark:border-white/10">
                <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-white">
                  Enterprise Billing
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-white">
                  Custom Integrations
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
              </tr>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-white">
                  Dedicated Support
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-slate-300 dark:text-slate-700">
                    remove
                  </span>
                </td>
                <td className="py-4 px-6 text-center">
                  <span className="material-symbols-outlined text-primary">
                    check
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
