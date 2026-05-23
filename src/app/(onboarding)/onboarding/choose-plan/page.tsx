"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentPlan } from "@/hooks/use-current-plan";

export default function OnboardingChoosePlanPage() {
  const { plan: currentPlan, isPending } = useCurrentPlan();
  const [loading, setLoading] = useState<"basic" | "plus" | null>(null);

  const goToDashboard = () => {
    window.location.href = "/dashboard";
  };

  const handleSelectPlan = async (planId: string) => {
    // Stub implementation for now
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <Link href="/onboarding">
            <Button variant="ghost" className="rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <Button
            onClick={goToDashboard}
            variant="outline"
            className="rounded-xl"
          >
            Continue with current plan
          </Button>
        </div>

        <div className="text-center space-y-3">
          <h1 className="text-4xl font-black tracking-tight">
            Choose your plan
          </h1>
          <p className="text-on-surface-variant">
            Start with Intelligence or unlock Plus for rules and global clause
            library.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {PLAN_DEFINITIONS.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            return (
              <div
                key={plan.id}
                className={cn(
                  "rounded-[2rem] border-2 p-8 bg-surface-container-low",
                  plan.highlight
                    ? "border-primary/30 shadow-xl shadow-primary/10"
                    : "border-outline-variant",
                )}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <Badge className="mb-3 bg-primary/10 text-primary border-none">
                      {plan.name}
                    </Badge>
                    {plan.highlight && (
                      <div className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-primary">
                        <Sparkles className="w-3 h-3" />
                        Most Popular
                      </div>
                    )}
                  </div>
                  {isCurrent && (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-none">
                      Current
                    </Badge>
                  )}
                </div>

                <p className="text-on-surface-variant mb-4">
                  {plan.description}
                </p>
                <div className="text-4xl font-black mb-6">
                  {plan.priceLabel}
                  <span className="text-sm text-on-surface-variant ml-2">
                    /{plan.intervalLabel}
                  </span>
                </div>

                <div className="space-y-2 mb-8">
                  {plan.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      {feature}
                    </div>
                  ))}
                </div>

                {plan.id === "fast" ? (
                  <Button
                    onClick={goToDashboard}
                    className="w-full h-12 rounded-xl font-black uppercase"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={loading !== null}
                  >
                    Continue with Fast
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleSelectPlan(plan.id)}
                    className={cn(
                      "w-full h-12 rounded-xl font-black uppercase",
                      plan.id === "plus"
                        ? "bg-primary text-primary-foreground"
                        : "",
                    )}
                    variant={isCurrent ? "outline" : "default"}
                    disabled={loading !== null}
                  >
                    {loading === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Select {plan.name}
                        {plan.id === "plus" && (
                          <ArrowRight className="w-4 h-4 ml-2" />
                        )}
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
