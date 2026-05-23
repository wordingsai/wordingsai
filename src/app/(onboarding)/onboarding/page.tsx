"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Users, ArrowRight } from "lucide-react";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { useTransitionRouter } from "next-view-transitions";

const OnBoardingPage = (props: {
  params: Promise<any>;
  searchParams: Promise<any>;
}) => {
  const router = useTransitionRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const pageAnimation = () => {
    try {
      document.documentElement.animate(
        [
          {
            opacity: 1,
            scale: 1,
            transform: "translateY(0)",
          },
          {
            opacity: 0,
            scale: 1,
            transform: "translateY(-50px)",
          },
        ],
        {
          duration: 400,
          easing: "cubic-bezier(0.76, 0, 0.24, 1)",
          fill: "forwards",
          pseudoElement: "::view-transition-old(root)",
        },
      );

      document.documentElement.animate(
        [
          {
            transform: "translateY(100%)",
          },
          {
            transform: "translateY(0)",
          },
        ],
        {
          duration: 800,
          easing: "cubic-bezier(0.76, 0, 0.24, 1)",
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    } catch (e) {
      console.warn("Animation failed:", e);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-20 bg-background">
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.04] dark:opacity-20 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-150 h-100 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl text-center space-y-12">
        <section className="space-y-4 flex flex-col items-center">
          <h1 className="text-[30px] font-black tracking-[-0.025em] text-foreground">
            Welcome
          </h1>

          <p className="text-muted-foreground text-[14px] max-w-md leading-relaxed">
            Get started by creating or joining an organization to begin your
            collaborative journey with WordingsAI.
          </p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Organization Card - with view transition */}
          <Link
            href="/onboarding/create"
            className="group"
            onClick={(e) => {
              if (isTransitioning) return;
              e.preventDefault();
              setIsTransitioning(true);
              router.push("/onboarding/create", {
                onTransitionReady: pageAnimation,
              });
            }}
          >
            <div className="h-full flex flex-col justify-between rounded-2xl border bg-surface-container/40 border-border p-8 transition-all duration-300 hover:shadow-xl hover:border-primary/40">
              <div>
                <div className="mb-6 flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mx-auto">
                  <Building2 className="w-6 h-6" />
                </div>

                <h3 className="text-[18px] font-bold text-foreground mb-3 text-center">
                  Create Organization
                </h3>

                <p className="text-muted-foreground text-[14px] leading-relaxed min-h-15 text-center">
                  Start a new workspace and invite your team to manage content
                  collectively.
                </p>
              </div>

              <HoverBorderGradient
                containerClassName="rounded-full w-fit mx-auto mt-8"
                as="button"
                className="bg-primary dark:bg-primary items-center justify-center border border-slate-200 dark:border-white/10 text-white dark:text-white hover:bg-primary/80 dark:hover:bg-primary/80 transition-all flex space-x-2 px-6 py-3"
              >
                <span>Create</span>
                <ArrowRight className="w-4 h-4" />
              </HoverBorderGradient>
            </div>
          </Link>

          {/* Join Organization Card - with view transition */}
          <Link
            href="/onboarding/join"
            className="group"
            onClick={(e) => {
              if (isTransitioning) return;
              e.preventDefault();
              setIsTransitioning(true);
              router.push("/onboarding/join", {
                onTransitionReady: pageAnimation,
              });
            }}
          >
            <div className="h-full flex flex-col justify-between rounded-2xl border bg-surface-container/40 border-border p-8 transition-all duration-300 hover:shadow-xl hover:border-primary/40">
              <div>
                <div className="mb-6 flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mx-auto">
                  <Users className="w-6 h-6" />
                </div>

                <h3 className="text-[18px] font-bold text-foreground mb-3 text-center">
                  Join Organization
                </h3>

                <p className="text-muted-foreground text-[14px] leading-relaxed min-h-15 text-center">
                  Enter an invite code or accept an invitation from an existing
                  workspace member.
                </p>
              </div>

              <HoverBorderGradient
                containerClassName="rounded-full w-fit mx-auto mt-8"
                as="button"
                className="bg-slate-100 items-center justify-center dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex space-x-2 px-6 py-3"
              >
                <span>Join</span>
                <ArrowRight className="w-4 h-4" />
              </HoverBorderGradient>
            </div>
          </Link>
        </div>

        <p className="text-[12px] text-muted-foreground tracking-wider uppercase opacity-60">
          You must leave your current organization to join or create a new one.
        </p>
      </div>
    </main>
  );
};

export default OnBoardingPage;
