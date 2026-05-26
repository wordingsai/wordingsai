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
 * App-wide toast notifications.
 *
 * Style direction: industry-standard subtle cards (Linear / Stripe / Vercel style),
 * not full-bleed colored pills. Neutral popover background, colored icon left,
 * compact typography with title + optional description, subtle border + shadow,
 * action and close button right-aligned.
 *
 * Usage in app code:
 *   toast.success("Saved", { description: "Your changes are live." });
 *   toast.error("Upload failed", { description: err.message });
 *   toast("Heads up", { description: "Background job started." });
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
          <CircleCheckIcon className="size-4 text-emerald-500" strokeWidth={2.25} />
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
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "0.625rem",
        } as React.CSSProperties
      }
      toastOptions={{
        unstyled: false,
        classNames: {
          // Card shell — subtle elevation, never colored bg
          toast:
            "group/toast !rounded-lg !border !border-outline-variant/60 !bg-popover !text-popover-foreground !shadow-md !shadow-black/5 !p-3.5 !pr-9 !min-h-[3.25rem] !w-[22rem] backdrop-blur-sm",
          // Icon column
          icon: "!m-0 !mr-2.5 !self-start !mt-0.5 shrink-0",
          // Text column
          content: "!gap-0.5 !flex-1",
          title:
            "!text-[13px] !font-semibold !leading-tight !tracking-tight !text-on-surface",
          description:
            "!text-[12px] !leading-snug !text-on-surface-variant !mt-0.5",
          // Action / cancel buttons (when caller provides one)
          actionButton:
            "!ml-2 !h-7 !px-2.5 !rounded-md !bg-primary !text-primary-foreground !text-[11px] !font-medium hover:!bg-primary/90 transition-colors",
          cancelButton:
            "!ml-1 !h-7 !px-2.5 !rounded-md !bg-transparent !text-on-surface-variant !text-[11px] !font-medium hover:!bg-surface-container",
          // Close (×) button — appears top-right
          closeButton:
            "!left-auto !right-2 !top-2 !size-5 !rounded-md !border-0 !bg-transparent !text-on-surface-variant/60 hover:!bg-surface-container hover:!text-on-surface transition-colors",
          // Per-type accents — left border, not full bg
          success: "!border-l-2 !border-l-emerald-500",
          info: "!border-l-2 !border-l-sky-500",
          warning: "!border-l-2 !border-l-amber-500",
          error: "!border-l-2 !border-l-rose-500",
          loading: "!border-l-2 !border-l-on-surface-variant/40",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
