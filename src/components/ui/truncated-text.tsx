"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

export function TruncatedText({
  text,
  maxLines = 4,
  className,
  emptyLabel = "No text available.",
}: {
  text?: string | null;
  maxLines?: 3 | 4 | 6 | 8 | 12;
  className?: string;
  emptyLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const content = text?.trim() || "";

  if (!content) {
    return (
      <p className={cn("text-sm text-on-surface-variant/50 italic", className)}>
        {emptyLabel}
      </p>
    );
  }

  const lineClamp =
    maxLines === 3
      ? "line-clamp-3"
      : maxLines === 4
        ? "line-clamp-4"
        : maxLines === 6
          ? "line-clamp-6"
          : maxLines === 8
            ? "line-clamp-8"
            : "line-clamp-[12]";

  const showToggle = content.length > 280;

  return (
    <div className="space-y-2 min-w-0">
      <p
        className={cn(
          "text-sm leading-relaxed text-on-surface break-words whitespace-pre-wrap",
          !expanded && showToggle && lineClamp,
          className,
        )}
      >
        {content}
      </p>
      {showToggle && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[9px] font-semibold uppercase tracking-widest text-primary"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              <ChevronUp className="size-3 mr-1" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="size-3 mr-1" /> Show full text
            </>
          )}
        </Button>
      )}
    </div>
  );
}
