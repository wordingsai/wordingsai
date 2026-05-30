"use client";

/**
 * EditableKeywords — inline keyword tag editor.
 * Extracted from page.tsx.
 */

import { useState, useEffect } from "react";
import { Plus, Fingerprint } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function EditableKeywords({
  initialKeywords,
  onSave,
  title = "Key Terms Identified",
}: {
  initialKeywords: string[];
  onSave: (val: string[]) => void;
  title?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [keywords, setKeywords] = useState<string[]>(initialKeywords || []);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    setKeywords(initialKeywords || []);
  }, [initialKeywords]);

  const handleAddKeyword = (
    e:
      | React.KeyboardEvent<HTMLInputElement>
      | React.FocusEvent<HTMLInputElement>,
  ) => {
    if (e.type === "keydown" && (e as React.KeyboardEvent).key !== "Enter")
      return;
    e.preventDefault();
    const val = inputValue.trim();
    if (val && !keywords.includes(val)) {
      setKeywords([...keywords, val]);
    }
    setInputValue("");
  };

  const handleRemoveKeyword = (indexToRemove: number) => {
    setKeywords(keywords.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpdateKeyword = (index: number, newValue: string) => {
    const nextKeywords = [...keywords];
    nextKeywords[index] = newValue;
    setKeywords(nextKeywords);
  };

  if (!isEditing) {
    return (
      <div
        className="space-y-3 group relative cursor-pointer"
        onClick={() => setIsEditing(true)}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant block">
            {title}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity size-6 rounded-md hover:bg-primary/10"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            <Plus className="w-3 h-3 text-primary" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {keywords.length > 0 ? (
            keywords.map((term) => (
              <Badge
                key={term}
                variant="secondary"
                className="bg-primary/10 text-primary border-none text-[9px] font-semibold py-1 px-3 rounded-lg uppercase"
              >
                <Fingerprint className="w-3 h-3 mr-1" /> {term}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-on-surface-variant italic">
              No keywords yet. Click to add.
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 bg-surface-container/50 p-4 rounded-xl border border-outline-variant/30 animate-in fade-in duration-300">
      <span className="text-xs font-medium uppercase tracking-wider text-primary block">
        Editing {title}
      </span>
      <div className="flex flex-wrap gap-2 mb-3">
        {keywords.map((term, index) => (
          <div
            key={index}
            className="flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20 transition-colors rounded-lg pr-1"
          >
            <input
              type="text"
              value={term}
              onChange={(e) => handleUpdateKeyword(index, e.target.value)}
              className="bg-transparent text-[9px] font-semibold uppercase border-none focus:outline-none focus:ring-1 focus:ring-primary/50 px-2 flex-1 rounded py-1 min-w-[60px]"
              style={{ width: `${Math.max(term.length + 2, 8)}ch` }}
            />
            <button
              onClick={() => handleRemoveKeyword(index)}
              className="opacity-60 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive w-5 h-5 flex items-center justify-center rounded-full transition-colors"
              title="Remove keyword"
            >
              <Plus className="w-3 h-3 rotate-45" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleAddKeyword}
          onBlur={handleAddKeyword}
          className="flex-1 bg-background border border-outline-variant rounded-xl h-9 px-3 text-xs focus:outline-none focus:border-primary/50 text-foreground shadow-inner"
          placeholder="Type and press Enter to add..."
        />
        <Button
          size="sm"
          className="bg-primary text-primary-foreground h-9 px-4 rounded-xl text-[10px] uppercase font-semibold"
          onClick={() => {
            onSave(keywords);
            setIsEditing(false);
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
