import { Scale } from "lucide-react";

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-court-border/60 ${className ?? ""}`}
    />
  );
}

export default function VerdictLoading() {
  return (
    <div className="min-h-screen bg-court-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-court-border px-6 py-4 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale className="size-5 text-judge/30" />
            <SkeletonPulse className="h-4 w-24" />
          </div>
          <SkeletonPulse className="h-3 w-32" />
        </div>
      </header>

      {/* Verdict skeleton */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="rounded-xl border border-court-border bg-court-surface p-6 flex flex-col items-center gap-5">
            {/* Gauge skeleton */}
            <div className="w-[200px] h-[110px] flex items-center justify-center">
              <SkeletonPulse className="w-[180px] h-[90px] rounded-t-full" />
            </div>

            {/* Label skeleton */}
            <div className="text-center space-y-2">
              <SkeletonPulse className="h-7 w-40 mx-auto" />
              <SkeletonPulse className="h-3 w-24 mx-auto" />
            </div>

            {/* Summary skeleton */}
            <div className="w-full max-w-md space-y-2">
              <SkeletonPulse className="h-3 w-full" />
              <SkeletonPulse className="h-3 w-4/5 mx-auto" />
              <SkeletonPulse className="h-3 w-3/5 mx-auto" />
            </div>

            {/* Conviction meters skeleton */}
            <div className="w-full max-w-sm flex gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex justify-between">
                  <SkeletonPulse className="h-3 w-8" />
                  <SkeletonPulse className="h-3 w-6" />
                </div>
                <SkeletonPulse className="h-2 w-full rounded-full" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between">
                  <SkeletonPulse className="h-3 w-8" />
                  <SkeletonPulse className="h-3 w-6" />
                </div>
                <SkeletonPulse className="h-2 w-full rounded-full" />
              </div>
            </div>

            {/* Safety badge skeleton */}
            <SkeletonPulse className="h-6 w-20 rounded-full" />
          </div>

          {/* Share button skeleton */}
          <div className="mt-6 flex justify-center">
            <SkeletonPulse className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      </main>
    </div>
  );
}
