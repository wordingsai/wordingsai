"use client";

/**
 * DocumentMapPanel — the "Document Map" tab content.
 * Extracted from the 2105-line page.tsx.
 */

import { FileText } from "lucide-react";
import { DocumentStructure } from "@/components/contracts/document-structure";
import type { StructuredContract } from "@/lib/structured-contract";

interface DocumentMapPanelProps {
  structuredContent: StructuredContract | null | undefined;
  analysisStructuredContent: StructuredContract | null | undefined;
  contractId: string;
  highlightText: string | null;
  onParagraphClick: (text: string) => void;
}

export function DocumentMapPanel({
  structuredContent,
  analysisStructuredContent,
  contractId,
  highlightText,
  onParagraphClick,
}: DocumentMapPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between ml-2">
        <h3 className="text-lg font-semibold text-on-surface uppercase tracking-tight flex items-center gap-3">
          <FileText className="size-7 text-primary" />
          Document Map
        </h3>
        <div className="flex items-center gap-2">
          <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
            Verified Mapping
          </span>
        </div>
      </div>
      <DocumentStructure
        data={structuredContent || analysisStructuredContent || null}
        contractId={contractId}
        highlightText={highlightText}
        onParagraphClick={onParagraphClick}
      />
    </div>
  );
}
