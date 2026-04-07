import { Scale } from "lucide-react";

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-court-border/60 ${className ?? ""}`}
    />
  );
}

export default function TrialLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Top bar skeleton */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-court-border bg-court-bg shrink-0">
        <SkeletonPulse className="size-4" />
        <SkeletonPulse className="h-4 w-20" />
      </div>

      {/* Courtroom skeleton */}
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-court-border px-4 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <Scale className="size-5 text-judge/30" />
            <SkeletonPulse className="h-4 w-32" />
          </div>
          <SkeletonPulse className="h-4 w-24" />
        </header>

        {/* Data progress skeleton (3-column grid) */}
        <div className="px-4 py-6 border-b border-court-border shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {["bull", "bear", "judge"].map((agent) => (
              <div
                key={agent}
                className="rounded-lg border border-court-border bg-court-surface p-3"
              >
                <SkeletonPulse className="h-3 w-16 mb-3" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <SkeletonPulse className="size-3.5 rounded-full" />
                      <SkeletonPulse className="h-3 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center area - preparing state */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Scale className="size-8 text-judge/20 mx-auto mb-3 animate-pulse" />
            <p className="text-sm text-court-text-dim">Loading trial...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
