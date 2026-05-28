/**
 * /admin/announcements
 *
 * Placeholder for the platform-wide announcements feature. Needs an
 * `announcements` table (title, body, audience, scheduled_at, sent_at) plus
 * a publish flow that writes a notification to every user's notifications
 * row. Not implemented in v1.
 */
import { Megaphone } from "lucide-react";

export default function AdminAnnouncementsPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
          Announcements
        </h1>
        <p className="text-sm text-on-surface-variant">
          Broadcast platform-wide messages to every user.
        </p>
      </header>

      <div className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-12 flex flex-col items-center text-center gap-3">
        <div className="size-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Megaphone className="size-5" />
        </div>
        <h2 className="text-base font-semibold tracking-tight">
          Coming soon
        </h2>
        <p className="text-sm text-on-surface-variant max-w-md">
          The announcements feature is on the build list. Once it ships you'll
          be able to draft, schedule, and send platform-wide notices from
          here.
        </p>
      </div>
    </div>
  );
}
