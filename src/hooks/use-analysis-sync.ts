"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Contract, AnalysisEvent } from "@/types/analysis";
import { getAuditStatus, getStatusFromData } from "@/lib/analysis-utils";

export function useAnalysisSync(contractId: string) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [checklistEvents, setChecklistEvents] = useState<AnalysisEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auditStatus = getAuditStatus(contract);
  const isProcessing = auditStatus === "reviewing";
  const isRulesProcessing =
    (contract as { analysisStage?: string } | null)?.analysisStage === "deep" &&
    isProcessing === false &&
    (contract?.totalRules ?? 0) > 0 &&
    (contract?.currentRuleCount ?? 0) < (contract?.totalRules ?? 0);

  const analysisStartTimeRef = useRef<number | null>(null);
  const autoRetryCountRef = useRef(0);
  const lastBackendSnapshotRef = useRef<{
    progress: number;
    status: string;
    updatedAt: string;
  } | null>(null);

  const fetchData = useCallback(
    async (isPolling = false) => {
      if (!contractId || contractId === "[contractId]") return;

      try {
        const contractRes = await fetch(
          `/api/contracts/${contractId}${isPolling ? "?polling=true" : ""}`,
        );

        let checklistRes: Response | null = null;
        if (!isPolling) {
          checklistRes = await fetch(`/api/contracts/${contractId}/checklist`);
        }

        if (contractRes.ok) {
          const data: Contract = await contractRes.json();

          // Update local contract state
          setContract((prev) => {
            if (!prev) return data;

            // If polling, only update progress and status related fields to avoid jumping
            if (isPolling) {
              // But we also need the analysisResults for real-time hydration
              return {
                ...prev,
                ...data,
                analysisProgress: data.analysisProgress,
                analysisStatus: data.analysisStatus,
                analysis: data.analysis || prev.analysis,
                analysisResults: data.analysisResults || prev.analysisResults,
              };
            }
            return data;
          });

          // Check for completion/failure to clear interval in calling component if needed
          // but here we manage it in useEffect
        } else if (!isPolling) {
          const body = await contractRes.json().catch(() => ({}));
          setError(body.error || "Failed to load contract information");
        }

        if (checklistRes?.ok) {
          const events: AnalysisEvent[] = await checklistRes.json();
          setChecklistEvents(events);
        }
      } catch (err) {
        const error = err as Error;
        console.error("Sync error:", error);
        if (!isPolling)
          setError(error.message || "An unexpected error occurred");
      } finally {
        if (!isPolling) setLoading(false);
      }
    },
    [contractId],
  );

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const runRulesEvaluation = useCallback(async () => {
    setAnalysisLoading(true);
    analysisStartTimeRef.current = Date.now();
    setContract((prev) =>
      prev
        ? {
            ...prev,
            contractStatus: "reviewing",
            analysisStatus: "[5/5] Rules: Running neural rule evaluation...",
            analysisProgress: 85,
          }
        : null,
    );
    try {
      const res = await fetch(`/api/contracts/${contractId}/evaluate-rules`, {
        method: "POST",
      });
      if (res.ok) {
        toast.info("Rule evaluation started. Results will update live.", {
          duration: 8000,
        });
      } else {
        toast.error("Failed to start rule evaluation.");
      }
    } catch {
      toast.error("Network error while starting rule evaluation.");
    } finally {
      setAnalysisLoading(false);
    }
  }, [contractId, setContract]);

  const runAnalysis = useCallback(
    async (force = false, mode: "fast" | "full" = "full") => {
      if (!contract) return;

      setAnalysisLoading(true);
      analysisStartTimeRef.current = Date.now();

      // Optimistic UI update - preserve existing analysis data (especially summary)
      setContract((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          contractStatus: "reviewing", // CRITICAL: Forces isProcessing to true immediately
          analysisProgress: 0,
          analysisStatus: "Initializing Neural Engine...",
        };
      });

      try {
        const res = await fetch(`/api/contracts/${contractId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "run-analysis", force, mode }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.status === "completed") {
            toast.success("AI Analysis complete!");
            fetchData(); // Final refresh
          } else {
            toast.info(
              "Evaluation in progress. Results will appear in real-time.",
              { duration: 8000 },
            );
          }
        } else {
          toast.error("Could not start the analysis. Please try again.");
        }
      } catch (error) {
        toast.error("Network error. Please check your connection.");
      } finally {
        setAnalysisLoading(false);
      }
    },
    [contractId, contract, fetchData],
  );

  useEffect(() => {
    if (!isProcessing) {
      analysisStartTimeRef.current = null;
      autoRetryCountRef.current = 0; // Reset retries when not processing
      return;
    }

    if (!analysisStartTimeRef.current) {
      analysisStartTimeRef.current = Date.now();
    }

    const pollMs = contract?.analysisStage === "deep" ? 8000 : 5000;
    const intervalId = setInterval(async () => {
      await fetchData(true);
    }, pollMs);

    return () => clearInterval(intervalId);
  }, [contract?.id, contract?.analysisStage, isProcessing, fetchData]);

  // Final fetch when processing finishes to ensure everything is synced
  useEffect(() => {
    if (!isProcessing && !loading) {
      fetchData();
    }
  }, [isProcessing, loading, fetchData]);

  // Reset stall watchdog when the server reports real progress
  useEffect(() => {
    if (!contract || getAuditStatus(contract) !== "reviewing") return;

    const progress = contract.analysisProgress ?? 0;
    const status = contract.analysisStatus || contract.analysis?.status || "";
    const updatedAt = String(contract.updatedAt ?? "");

    const prev = lastBackendSnapshotRef.current;
    if (
      !prev ||
      prev.progress !== progress ||
      prev.status !== status ||
      prev.updatedAt !== updatedAt
    ) {
      lastBackendSnapshotRef.current = { progress, status, updatedAt };
      analysisStartTimeRef.current = Date.now();
    }
  }, [
    contract?.analysisProgress,
    contract?.analysis?.status,
    contract?.updatedAt,
  ]);

  // Watchdog timeout check
  useEffect(() => {
    if (!isProcessing) return;

    const timeoutCheck = setInterval(() => {
      if (
        analysisStartTimeRef.current &&
        Date.now() - analysisStartTimeRef.current >
          ((contract?.analysisProgress ?? 0) < 60 ? 180000 : 300000)
      ) {
        if (autoRetryCountRef.current < 2) {
          console.log("[Analysis Sync] Watchdog triggered. Auto-retrying...");
          autoRetryCountRef.current += 1;
          analysisStartTimeRef.current = Date.now();
          toast.info("Analysis stalled. Resuming automatically...", {
            icon: "🔄",
          });
          runAnalysis(true);
        } else {
          toast.error("Analysis timed out. Please try again manually.");
          setContract((prev) =>
            prev
              ? {
                  ...prev,
                  analysisStatus: "Analysis timed out",
                }
              : null,
          );
          analysisStartTimeRef.current = null;
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(timeoutCheck);
  }, [isProcessing, runAnalysis, contract?.analysisProgress]);

  const [displayProgress, setDisplayProgress] = useState(0);

  // Smooth Progress Logic - Follow backend progress closely without "creep"
  useEffect(() => {
    const target = contract?.analysisProgress || 0;

    if (!isProcessing) {
      setDisplayProgress(target);
      return;
    }

    // Smooth transition to target
    const timer = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev < target) {
          // Move 1% at a time for smoothness
          return prev + 1;
        }
        if (prev > target) {
          // Sync immediately if backend somehow reports lower progress
          return target;
        }
        return prev;
      });
    }, 100); // 100ms for smooth 1% increments

    return () => clearInterval(timer);
  }, [contract?.analysisProgress, isProcessing]);

  return {
    contract,
    checklistEvents,
    loading,
    analysisLoading,
    error,
    runAnalysis,
    runRulesEvaluation,
    isProcessing,
    progress: displayProgress,
    hasFastAnalysis:
      getStatusFromData(contract || ({} as Contract)) === "completed" &&
      Boolean(
        contract?.analysis?.summary ||
        contract?.analysisStage === "fast_complete" ||
        contract?.structuredContent,
      ),
    hasAnalysis:
      (contract?.analysisResults?.length || 0) > 0 ||
      (getStatusFromData(contract || ({} as Contract)) === "completed" &&
        Boolean(contract?.analysis?.summary)),
    hasRuleResults: (contract?.analysisResults?.length || 0) > 0,
    isRulesProcessing,
    setContract, // Allow manual updates for comments/keywords
    refresh: () => fetchData(),
  };
}
