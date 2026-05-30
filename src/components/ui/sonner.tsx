"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

/**
 * App-wide toast notifications — WordingsAI style.
 *
 * Design: Linear/Vercel-style subtle cards. Neutral popover bg, left-border
 * accent per type, colored icon, clean compact typography. Never full-bleed
 * colored pills. Works correctly in both light and dark themes.
 *
 * Sizing: 22rem wide, compact 3.25rem min-height, 10px gap between toasts.
 * Position: top-right, 20px from edge, max 4 visible.
 *
 * Usage:
 *   toast.success("Saved");
 *   toast.error("Upload failed", { description: err.message });
 *   toast.warning("Rate limit approaching");
 *   toast.info("Background job started");
 *   toast("Heads up", { description: "…" });
 *
 * Icon colors are from Tailwind's palette — these are intentional and work
 * at full opacity as decorative icons (not text), so no dark: variant needed.
 * The text (title/description) uses semantic tokens for proper theming.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      offset={20}
      gap={10}
      duration={4500}
      visibleToasts={4}
      closeButton
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon
            className="size-4 text-emerald-500"
            strokeWidth={2.25}
          />
        ),
        info: <InfoIcon className="size-4 text-sky-500" strokeWidth={2.25} />,
        warning: (
          <TriangleAlertIcon
            className="size-4 text-amber-500"
            strokeWidth={2.25}
          />
        ),
        error: (
          <OctagonXIcon className="size-4 text-rose-500" strokeWidth={2.25} />
        ),
        loading: (
          <Loader2Icon
            className="size-4 text-on-surface-variant animate-spin"
            strokeWidth={2.25}
          />
        ),
      }}
      style={
        {
          // These CSS variables feed sonner's own internal defaults so the
          // "normal" (untyped) toast also matches the app theme.
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--outline-variant)",
          "--border-radius": "0.5rem",
        } as React.CSSProperties
      }
      toastOptions={{
        unstyled: false,
        classNames: {
          // Card shell: neutral bg, visible border, subtle shadow.
          // border-outline-variant is a solid token (not a 10% alpha) so it
          // shows up in dark mode. The left-border accent per type overrides
          // just the left side.
          toast:
            "group/toast !rounded-lg !border !border-outline-variant !bg-popover !text-popover-foreground !shadow-lg !shadow-black/10 dark:!shadow-black/40 !p-3.5 !pr-9 !min-h-[3.25rem] !w-[22rem]",
          // Icon: align to first line of text
          icon: "!m-0 !mr-2.5 !self-start !mt-[2px] shrink-0",
          // Text block
          content: "!gap-0.5 !flex-1",
          title:
            "!text-[13px] !font-semibold !leading-tight !text-on-surface",
          description:
            "!text-[12px] !leading-snug !text-on-surface-variant !mt-0.5",
          // Inline action button (e.g. toast.success("…", { action: { label: "View", … } }))
          actionButton:
            "!ml-2 !h-7 !px-2.5 !rounded-md !bg-primary !text-primary-foreground !text-[11px] !font-medium hover:!opacity-90 transition-opacity",
          cancelButton:
            "!ml-1 !h-7 !px-2.5 !rounded-md !bg-transparent !text-on-surface-variant !text-[11px] !font-medium hover:!bg-surface-container transition-colors",
          // Close ×: top-right corner
          closeButton:
            "!left-auto !right-2 !top-2 !size-5 !rounded-md !border-0 !bg-transparent !text-on-surface-variant hover:!bg-surface-container hover:!text-on-surface transition-colors",
          // Per-type left-border accent (4px, fully opaque color strip)
          success: "!border-l-[3px] !border-l-emerald-500",
          info: "!border-l-[3px] !border-l-sky-500",
          warning: "!border-l-[3px] !border-l-amber-500",
          error: "!border-l-[3px] !border-l-rose-500",
          loading: "!border-l-[3px] !border-l-on-surface-variant/50",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
