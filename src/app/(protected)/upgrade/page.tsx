"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  ChevronLeft,
  Sparkles,
  ArrowRight,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { useCurrentPlan } from "@/hooks/use-current-plan";
import { authClient } from "@/lib/auth-client";

export default function PricingPage() {
  const {
    plan: currentPlan,
    isPending: isPlanLoading,
    refresh,
  } = useCurrentPlan();
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success") {
      refresh();
    }
  }, [refresh]);

  /**
   * Soft-launch trial: directly assign the plan without Stripe.
   * The PSA controls access manually.
   */
  const handleSelectPlan = async (planId: string) => {
    if (planId === currentPlan) return;
    if (planId === "enterprise") {
      window.location.href =
        "mailto:wordings.ai.uk@gmail.com?subject=Enterprise%20Plan%20Inquiry";
      return;
    }

    setLoading(planId);
    try {
      const res = await fetch("/api/subscription/select-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to select plan");
        return;
      }

      toast.success(`Plan updated to ${planId}`, {
        description: "Your trial plan has been activated.",
      });

      // Refresh plan state then navigate to dashboard
      await refresh();
      window.location.href = "/dashboard?status=success";
    } catch (err) {
      toast.error("An unexpected error occurred");
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  if (isPlanLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-background via-background to-background/95 py-20 px-4 md:px-8 lg:px-12">
      <div className="max-w-[1600px] mx-auto mb-16 px-4 md:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-3 px-0 py-2 text-sm font-bold text-on-surface-variant hover:text-primary transition-all duration-300 group"
        >
          <div className="p-2.5 rounded-xl bg-surface-container-high group-hover:bg-primary group-hover:text-primary-foreground transition-all shadow-sm">
            <ChevronLeft className="w-4 h-4" />
          </div>
          Back to Dashboard
        </Link>
      </div>

      {/* Soft-launch banner */}
      <div className="max-w-[1700px] mx-auto px-8 mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-widest">
          <Rocket className="w-3.5 h-3.5" />
          Soft Launch — All Plans Available as Trial
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mt-6 mb-4 text-on-surface">
          Select Your Plan
        </h1>
        <p className="text-on-surface-variant font-medium max-w-2xl mx-auto">
          During our soft launch, all packages are available on a free trial
          basis. Select the plan that matches your team&apos;s workflow — no
          payment required.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-[1700px] mx-auto px-8 w-full"
      >
        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-6 items-stretch">
          {PLAN_DEFINITIONS.map((plan, index) => {
            const isCurrent = currentPlan === plan.id;
            const isEnterprise = plan.id === "enterprise";
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="h-full"
              >
                <Card
                  className={cn(
                    "relative h-full flex flex-col justify-between overflow-hidden rounded-xl border-2 transition-all duration-500",
                    plan.highlight
                      ? "bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground border-primary/20 shadow-2xl"
                      : "bg-surface-container-low border-outline-variant hover:border-primary/40 shadow-xl",
                    isCurrent && "ring-4 ring-primary ring-offset-2",
                  )}
                >
                  {plan.highlight && (
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                  )}

                  <CardHeader className="relative z-10 px-10 pt-10 pb-8 space-y-6 border-b border-white/10">
                    <div className="flex items-start justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-col gap-2">
                          <Badge
                            className={cn(
                              "w-fit px-4 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider border-0",
                              plan.highlight
                                ? "bg-white text-primary"
                                : "bg-primary/10 text-primary",
                            )}
                          >
                            {plan.name}
                          </Badge>
                          {plan.highlight && (
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-white/90 uppercase tracking-widest">
                              <Sparkles className="w-3 h-3" />
                              Most Popular
                            </div>
                          )}
                        </div>
                        <p
                          className={cn(
                            "text-sm font-bold leading-relaxed max-w-xs",
                            plan.highlight
                              ? "text-white/80"
                              : "text-on-surface-variant",
                          )}
                        >
                          {plan.description}
                        </p>
                      </div>

                      {isCurrent && (
                        <div
                          className={cn(
                            "ml-2 flex flex-shrink-0 items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide",
                            plan.highlight
                              ? "bg-white/20 text-white"
                              : "bg-emerald-500/10 text-emerald-600",
                          )}
                        >
                          <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                          Active
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-semibold tracking-tight">
                          {isEnterprise ? "Custom" : "Trial"}
                        </span>
                        {!isEnterprise && (
                          <span
                            className={cn(
                              "text-xs font-semibold uppercase tracking-widest opacity-60 hidden",
                            )}
                          ></span>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {/* Features */}
                  <CardContent className="relative z-10 flex-1 px-10 py-8 flex flex-col justify-between">
                    <div className="space-y-4 mb-8">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-3">
                          <div
                            className={cn(
                              "p-1.5 rounded-full flex-shrink-0",
                              plan.highlight
                                ? "bg-white/20 text-white"
                                : "bg-emerald-500/10 text-emerald-600",
                            )}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span
                            className={cn(
                              "text-sm font-bold tracking-tight",
                              plan.highlight
                                ? "text-white/90"
                                : "text-on-surface",
                            )}
                          >
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* CTA Button */}
                    <Button
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isCurrent || loading !== null}
                      className={cn(
                        "w-full h-16 px-8 rounded-lg font-semibold uppercase tracking-[0.15em] text-sm transition-all duration-500 shadow-xl",
                        plan.highlight
                          ? "bg-white text-primary hover:bg-white/95 shadow-white/40 disabled:shadow-none"
                          : "bg-primary text-primary-foreground hover:bg-primary/95 shadow-primary/30",
                        isCurrent &&
                          "opacity-50 cursor-default grayscale scale-100 shadow-none border-4 border-current bg-transparent",
                      )}
                    >
                      {loading === plan.id ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : isCurrent ? (
                        "CURRENT PLAN"
                      ) : isEnterprise ? (
                        <span className="flex items-center justify-center gap-2">
                          Contact Us
                          <ArrowRight className="w-5 h-5" />
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          Select
                          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </span>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
