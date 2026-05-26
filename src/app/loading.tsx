import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
          <Loader2 className="h-12 w-12 animate-spin text-primary relative" />
        </div>
        <div className="space-y-1 text-center">
          <h2 className="text-sm font-semibold tracking-tight text-on-surface">
            Loading
          </h2>
          <p className="text-xs text-on-surface-variant animate-pulse">
            Initializing engine…
          </p>
        </div>
      </div>
    </div>
  );
}
