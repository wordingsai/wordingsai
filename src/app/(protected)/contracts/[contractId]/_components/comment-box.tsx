"use client";

/**
 * CommentBox — internal review note editor for a rule result.
 * Extracted from page.tsx.
 */

import { useState, useEffect } from "react";
import { MessageSquare, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CommentBox({
  initialValue,
  onSave,
  isLoading,
}: {
  initialValue: string;
  onSave: (val: string) => void;
  isLoading?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  if (!isEditing && !initialValue) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-xs font-medium uppercase tracking-wider text-on-surface-variant hover:text-primary mt-6"
        onClick={() => setIsEditing(true)}
      >
        <Plus className="w-3 h-3 mr-1" /> Add Internal Note
      </Button>
    );
  }

  if (!isEditing) {
    return (
      <div className="mt-8 p-6 bg-surface-container border border-outline-variant/30 rounded-lg group relative text-left">
        <div className="flex justify-between items-start mb-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
            <MessageSquare className="w-3 h-3 text-primary" /> Internal Review
            Discussion
          </h4>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity size-8 rounded-xl hover:bg-primary/10"
            onClick={() => setIsEditing(true)}
          >
            <Plus className="w-4 h-4 text-primary rotate-45" />
          </Button>
        </div>
        <p className="text-sm font-medium text-on-surface leading-relaxed">
          {initialValue}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 text-left">
      <h4 className="text-xs font-medium uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
        <MessageSquare className="w-3 h-3 text-primary" /> Edit Review
        Discussion
      </h4>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="bg-background border-outline-variant rounded-2xl text-sm min-h-[120px] focus:ring-2 focus:ring-primary/20 p-5 font-medium leading-relaxed"
        placeholder="Add professional context or internal notes..."
      />
      <div className="flex gap-3">
        <Button
          size="sm"
          className="bg-primary text-primary-foreground text-xs font-medium uppercase tracking-wider rounded-xl px-6 h-10 shadow-lg shadow-primary/20"
          onClick={() => {
            onSave(value);
            setIsEditing(false);
          }}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
          Commit Change
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs font-medium uppercase tracking-wider rounded-xl px-6 h-10 border-outline-variant"
          onClick={() => {
            setValue(initialValue);
            setIsEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
