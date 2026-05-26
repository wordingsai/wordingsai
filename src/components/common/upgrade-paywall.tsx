"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Lock,
  CheckCircle2,
  ArrowRight,
  Zap,
  Globe,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface UpgradePaywallProps {
  title: string;
  description: string;
  featureName: string;
}

export function UpgradePaywall({
  title,
  description,
  featureName,
}: UpgradePaywallProps) {
  const plusFeatures = [
    "Customizable Neural Rules",
    "Comprehensive Clause Library",
    "Advanced Risk Vector Analysis",
    "Infinite Organization Scalability",
    "Priority AI Processing",
    "Full Compliance Exports",
  ];

  return (
    <div className="flex-1 p-6 lg:p-10 bg-background flex items-center justify-center min-h-[85vh]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-5 gap-10 items-center"
      >
        {/* Left Side: Illustration & Core Message */}
        <div className="lg:col-span-3 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px] font-medium uppercase tracking-wider">
              <Lock className="w-3 h-3" /> Premium feature
            </div>
            <h1 className="text-2xl lg:text-3xl font-semibold text-on-surface tracking-tight leading-tight">
              Unleash the power of{" "}
              <span className="text-primary">Intelligence Plus</span>
            </h1>
            <p className="text-base text-on-surface-variant max-w-lg leading-relaxed">
              {description} Access to{" "}
              <span className="text-on-surface font-bold underline decoration-primary/30 decoration-4 underline-offset-4">
                {featureName}
              </span>{" "}
              is reserved for our PLUS partners.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plusFeatures.map((feature, i) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className="flex items-center gap-3"
              >
                <div className="p-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-on-surface-variant">
                  {feature}
                </span>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
            <Link href="/upgrade" className="w-full sm:w-auto">
              <Button size="lg" className="w-full gap-2">
                Upgrade now <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button
                variant="ghost"
                size="lg"
                className="w-full text-on-surface-variant"
              >
                Return to dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Right Side: Feature Visualizer Card */}
        <div className="lg:col-span-2">
          <div className="relative group">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/30 to-secondary/30 rounded-xl blur-2xl opacity-50 group-hover:opacity-80 transition-opacity duration-500" />
            <div className="relative bg-surface-container-low border border-outline-variant rounded-xl p-8 shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Sparkles className="w-32 h-32 text-primary" />
              </div>

              <div className="space-y-6">
                <div className="size-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20">
                  {featureName.includes("Rules") ? (
                    <Zap className="w-8 h-8" />
                  ) : (
                    <Database className="w-8 h-8" />
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-on-surface tracking-tight leading-none">
                    {featureName}
                  </h3>
                  <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                    Elevate your legal architecture with neural
                    contextualization and automated clause categorization.
                  </p>
                </div>

                <div className="space-y-3 pt-4">
                  <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "75%" }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        repeatType: "reverse",
                      }}
                      className="h-full bg-primary"
                    />
                  </div>
                  <div className="flex justify-between text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                    <span>Performance</span>
                    <span className="text-primary">+150% Advantage</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
