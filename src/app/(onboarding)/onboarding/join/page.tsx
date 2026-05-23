"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useTransitionRouter } from "next-view-transitions";
import { ArrowRight, ArrowLeft, Key } from "lucide-react";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { toast } from "sonner";

const OnBoardingJoinPage = () => {
  const transitionRouter = useTransitionRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Forward animation when entering Dashboard (same as your original Nav)
  const forwardAnimation = () => {
    document.documentElement.animate(
      [
        { opacity: 1, scale: 1, transform: "translateY(0)" },
        { opacity: 0, scale: 0.95, transform: "translateY(-50px)" },
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
        { transform: "translateY(100%)", opacity: 0 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      {
        duration: 400,
        easing: "cubic-bezier(0.76, 0, 0.24, 1)",
        fill: "forwards",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  };

  const backAnimation = () => {
    try {
      document.documentElement.animate(
        [
          { transform: "translateY(0)", opacity: 1 },
          { transform: "translateY(100%)", opacity: 0 },
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
          { transform: "translateY(-50px)", opacity: 0 },
          { transform: "translateY(0)", opacity: 1 },
        ],
        {
          duration: 400,
          easing: "cubic-bezier(0.76, 0, 0.24, 1)",
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    } catch (e) {
      console.warn("Animation failed:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      setError("Invite code is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const cleanCode = inviteCode.replace(/-/g, "").toUpperCase();

      const res = await fetch("/api/organization/join-by-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: cleanCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid invite code");
      }

      // ✅ Success → show success message and redirect
      setError("");
      toast.success(data.message || "Join request sent successfully");

      if (data.joined) {
        transitionRouter.push("/dashboard", {
          onTransitionReady: forwardAnimation,
        });
      } else {
        transitionRouter.push("/onboarding", {
          onTransitionReady: forwardAnimation,
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background">
      <main className="min-h-screen w-full flex items-center justify-center px-4">
        <div className="w-full max-w-120 flex flex-col items-center">
          <div className="mb-12 flex flex-col items-center gap-3">
            <div className="absolute inset-0 bg-grid-pattern opacity-[0.04] dark:opacity-20 pointer-events-none" />
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-150 h-100 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
            <Link
              href="/"
              className="flex items-center gap-2.5 hover:opacity-90 transition-opacity mb-2"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shadow-sm">
                <Image
                  alt="WordingsAI Logo"
                  height={28}
                  width={28}
                  priority
                  src="/logo.png"
                  style={{ width: "auto", height: "auto" }}
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold tracking-tight">
                WordingsAI
              </span>
            </Link>
          </div>

          <div className="w-full bg-surface-container/50 backdrop-blur-md border border-outline-variant p-8 rounded-xl shadow-2xl">
            <header className="mb-8 text-center md:text-left">
              <h2 className="text-[24px] font-bold text-white mb-2 leading-tight">
                Join an organization
              </h2>
              <p className="text-[14px] text-on-surface-variant leading-relaxed">
                Enter the unique invite code provided by your organization
                administrator.
              </p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              <div className="space-y-2">
                <label
                  className="text-[12px] font-medium tracking-wider uppercase text-on-surface-variant"
                  htmlFor="invite-code"
                >
                  Invite Code
                </label>

                <div className="relative mt-2">
                  <input
                    id="invite-code"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => {
                      const rawValue = e.target.value
                        .replace(/[^A-Za-z0-9]/g, "")
                        .toUpperCase();
                      const formatted =
                        rawValue.match(/.{1,3}/g)?.join("-") || "";
                      if (formatted.length <= 11) {
                        setInviteCode(formatted);
                      }
                    }}
                    placeholder="e.g. ABC-123-XYZ"
                    className="w-full bg-surface-container-low border border-outline-variant text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-slate-600 outline-none"
                  />

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600">
                    <Key className="w-5 h-5" />
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}
              </div>

              <HoverBorderGradient
                containerClassName="rounded-full w-full mt-8"
                as="button"
                type="submit"
                disabled={loading}
                className="bg-primary dark:bg-primary w-full items-center justify-center border border-primary/20 text-white hover:bg-primary/90 transition-all flex space-x-2 px-6 py-3.5"
              >
                <span className="font-semibold text-sm">
                  {loading ? "Joining..." : "Join Organization"}
                </span>
                {!loading && (
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                )}
              </HoverBorderGradient>

              <div className="text-center">
                <p className="text-[14px] text-on-surface-variant">
                  Don&apos;t have a code?{" "}
                  <span className="text-primary font-medium">
                    Contact your admin.
                  </span>
                </p>
              </div>
            </form>
          </div>

          <div className="mt-8">
            <Link
              href="/onboarding"
              onClick={(e) => {
                if (isTransitioning) return;
                e.preventDefault();
                setIsTransitioning(true);
                transitionRouter.push("/onboarding", {
                  onTransitionReady: backAnimation,
                });
              }}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-[14px] font-medium group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to onboarding
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OnBoardingJoinPage;
