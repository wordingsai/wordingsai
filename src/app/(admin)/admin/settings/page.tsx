/**
 * /admin/settings
 *
 * Platform-level configuration. v1 shows read-only key facts about the
 * environment: which DB, which AI provider, which Inngest env, plus links
 * to the relevant dashboards. Write controls (e.g. rotate keys, change
 * default plans) come later once we have a use case.
 */
import { Database, Sparkles, Server, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  const cells: Array<{
    icon: React.ElementType;
    label: string;
    value: string;
    href?: string;
  }> = [
    {
      icon: Database,
      label: "Database",
      value: process.env.DATABASE_URL?.includes("neon.tech")
        ? "Neon (US East 1, pooled)"
        : "Custom Postgres",
      href: "https://console.neon.tech/",
    },
    {
      icon: Sparkles,
      label: "AI provider",
      value: process.env.GEMINI_API_KEY
        ? "Gemini 2.5 Flash (Google AI Studio)"
        : "Not configured",
      href: "https://aistudio.google.com/",
    },
    {
      icon: Server,
      label: "Background jobs",
      value: process.env.INNGEST_EVENT_KEY
        ? "Inngest (production env)"
        : "Not configured",
      href: "https://app.inngest.com/env/production",
    },
    {
      icon: Shield,
      label: "Storage",
      value: "Supabase Storage (contracts bucket)",
      href: "https://supabase.com/dashboard",
    },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <header className="space-y-1.5">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
          Platform settings
        </h1>
        <p className="text-sm text-on-surface-variant">
          Read-only overview of the infrastructure powering WordingsAI.
          Write controls come in a later release.
        </p>
      </header>

      <div className="rounded-xl border border-outline-variant bg-surface-container-low divide-y divide-outline-variant/40 overflow-hidden">
        {cells.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="flex items-center gap-4 px-5 py-4">
              <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">
                  {c.label}
                </div>
                <div className="text-sm text-on-surface mt-0.5">{c.value}</div>
              </div>
              {c.href ? (
                <a
                  href={c.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  Open dashboard →
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
