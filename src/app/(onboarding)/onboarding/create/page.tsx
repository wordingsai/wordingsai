"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowRight, ArrowLeft, Loader2, Copy, X } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const OnBoardingCreatePage = () => {
  const transitionRouter = useTransitionRouter();

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedInviteCodes, setGeneratedInviteCodes] = useState<
    string[] | null
  >(null);

  const [organizationName, setOrganizationName] = useState("");
  const [industry, setIndustry] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [emails, setEmails] = useState<string[]>([""]);

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

  const isStep1Valid = organizationName.trim() && industry && teamSize;

  const addEmailField = () => {
    if (emails.length < 5) setEmails((prev) => [...prev, ""]);
  };

  const removeEmailField = (index: number) => {
    setEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStep1Valid) return;
    setError(null);
    setStep(2);
  };

  const handleFinish = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    const validEmails = emails.map((e) => e.trim()).filter(Boolean);

    try {
      const res = await fetch("/api/organization/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: organizationName.trim(),
          industry,
          teamSize,
          emails: validEmails, // ← now sent here
        }),
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to create organization");

      setGeneratedInviteCodes(
        data.inviteCodes?.length ? data.inviteCodes : null,
      );
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success("Invite code copied to clipboard!");
  };

  const goToDashboard = () => {
    transitionRouter.push("/onboarding/choose-plan", {
      onTransitionReady: forwardAnimation,
    });
  };

  return (
    <div className="bg-background">
      <main className="min-h-screen w-full flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-120 flex flex-col items-center">
          {/* Background + Logo (same as Join page) */}
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.04] dark:opacity-20 pointer-events-none" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-150 h-100 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="mb-12 flex flex-col items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
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

          <div className="w-full space-y-8">
            {/* Progress */}
            <div className="space-y-3">
              <div className="flex justify-between text-[12px] font-medium tracking-wider uppercase text-on-surface-variant">
                <span>Step {step} of 2</span>
                <span>{step === 1 ? "Organization Setup" : "Invite Team"}</span>
              </div>
              <Progress value={step === 1 ? 50 : 100} className="h-1" />
            </div>

            {/* STEP 1 */}
            {step === 1 && (
              <>
                <div className="text-center space-y-2">
                  <h1 className="text-[30px] font-black text-on-surface">
                    Create a new organization
                  </h1>
                  <p className="text-[14px] text-on-surface-variant">
                    Set up your workspace and invite your legal team.
                  </p>
                </div>
                <div className="bg-surface-container/50 p-8 rounded-xl border border-outline-variant">
                  <form className="space-y-6" onSubmit={handleContinue}>
                    <input
                      className="w-full bg-slate-900/50 border border-outline-variant rounded-lg px-4 py-3 text-sm text-on-surface outline-none"
                      placeholder="Organization name"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                    />

                    <Select
                      value={industry}
                      onValueChange={(val) => setIndustry(val || "")}
                    >
                      <SelectTrigger className="bg-slate-900/50">
                        <SelectValue placeholder="Industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="legal">Legal</SelectItem>
                        <SelectItem value="fintech">Fintech</SelectItem>
                        <SelectItem value="tech">Technology</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={teamSize}
                      onValueChange={(val) => setTeamSize(val || "")}
                    >
                      <SelectTrigger className="bg-slate-900/50">
                        <SelectValue placeholder="Team size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Only me</SelectItem>
                        <SelectItem value="2-10">2-10</SelectItem>
                        <SelectItem value="11-50">11-50</SelectItem>
                        <SelectItem value="51-100">51-100</SelectItem>
                        <SelectItem value="101+">101+</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      disabled={!isStep1Valid}
                      className="w-full bg-primary text-white py-3 rounded-full flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      Continue <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* STEP 2 - Invite Form OR Success Screen */}
            {step === 2 && (
              <div className="bg-surface-container/50 p-8 rounded-xl border border-outline-variant space-y-6">
                {!isSuccess ? (
                  <>
                    <div className="text-center space-y-2">
                      <h1 className="text-[28px] font-black text-on-surface">
                        Invite your team
                      </h1>
                      <p className="text-sm text-on-surface-variant">
                        Add teammates (optional - max 5)
                      </p>
                    </div>

                    <div className="space-y-3">
                      {emails.map((email, index) => (
                        <div
                          key={index}
                          className="relative group transition-all duration-300"
                        >
                          <input
                            type="email"
                            className="w-full bg-slate-900/50 border border-outline-variant rounded-lg px-4 py-3 text-sm text-on-surface outline-none pr-12"
                            placeholder="teammate@company.com"
                            value={email}
                            onChange={(e) => updateEmail(index, e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => removeEmailField(index)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      {emails.length < 5 && (
                        <button
                          type="button"
                          onClick={addEmailField}
                          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg border border-dashed border-primary/30 transition-all hover:border-primary/50"
                        >
                          <span className="text-xl leading-none">+</span> Add
                          another email
                        </button>
                      )}
                    </div>

                    {error && (
                      <p className="text-red-500 text-sm text-center font-medium">
                        {error}
                      </p>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => setStep(1)}
                        className="flex-1 border border-outline-variant py-3 rounded-full flex items-center justify-center gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" /> Back
                      </button>
                      <button
                        onClick={handleFinish}
                        disabled={isSubmitting}
                        className="flex-1 bg-primary text-white py-3 rounded-full flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />{" "}
                            Creating...
                          </>
                        ) : (
                          <>
                            Finish &amp; Create{" "}
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  /* SUCCESS SCREEN */
                  <div className="text-center space-y-6 py-4">
                    <div className="mx-auto w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                      <ArrowRight className="w-8 h-8" />
                    </div>

                    <div>
                      <h1 className="text-[28px] font-black text-on-surface">
                        Organization Created!
                      </h1>
                      <p className="text-sm text-on-surface-variant mt-2">
                        {generatedInviteCodes && generatedInviteCodes.length > 0
                          ? `Invitation email${generatedInviteCodes.length > 1 ? "s" : ""} sent to your team`
                          : "Your workspace is ready"}
                      </p>
                    </div>

                    {generatedInviteCodes &&
                      generatedInviteCodes.length > 0 && (
                        <div className="space-y-6">
                          {generatedInviteCodes.map((code, index) => (
                            <div
                              key={index}
                              className="bg-surface-container-low p-6 rounded-xl border border-outline-variant"
                            >
                              <p className="text-xs uppercase tracking-wider text-on-surface-variant mb-2">
                                Invite Code
                              </p>
                              <div className="flex items-center justify-between bg-black/30 px-6 py-4 rounded-lg text-2xl font-mono tracking-[4px]">
                                {code}
                                <button
                                  onClick={() => copyCode(code)}
                                  className="text-primary hover:text-primary/80"
                                >
                                  <Copy className="w-5 h-5" />
                                </button>
                              </div>
                              <p className="text-[12px] text-on-surface-variant mt-3">
                                We already sent this code via email
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                    <button
                      onClick={goToDashboard}
                      className="w-full bg-primary text-white py-3.5 rounded-full flex items-center justify-center gap-2 text-lg font-semibold"
                    >
                      Choose Plan <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Back to onboarding */}
            <button
              className="w-full text-sm text-on-surface-variant flex justify-center items-center gap-2"
              onClick={() => {
                if (isTransitioning) return;
                setIsTransitioning(true);
                transitionRouter.push("/onboarding", {
                  onTransitionReady: backAnimation,
                });
              }}
            >
              <ArrowLeft className="w-4 h-4" /> Back to onboarding
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OnBoardingCreatePage;
