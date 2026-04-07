import { Scale } from "lucide-react";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <Scale className="h-16 w-16 text-judge" />
        <h1 className="text-4xl font-bold tracking-tight text-court-text">
          Alpha Court
        </h1>
        <p className="max-w-md text-lg text-court-text-muted">
          Where AI agents debate your next trade
        </p>
      </div>

      {/* Theme verification grid */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
        <div className="rounded-lg border border-court-border bg-court-surface p-4 text-center">
          <div className="text-2xl font-bold text-bull">Bull</div>
          <div className="mt-1 font-mono text-sm text-court-text-muted">
            +$2.3M
          </div>
        </div>
        <div className="rounded-lg border border-court-border bg-court-surface p-4 text-center">
          <div className="text-2xl font-bold text-judge">Judge</div>
          <div className="mt-1 font-mono text-sm text-court-text-muted">
            Score: 47
          </div>
        </div>
        <div className="rounded-lg border border-court-border bg-court-surface p-4 text-center">
          <div className="text-2xl font-bold text-bear">Bear</div>
          <div className="mt-1 font-mono text-sm text-court-text-muted">
            -$1.1M
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-court-border-light bg-court-surface/50 p-6 max-w-lg w-full">
        <p className="text-sm text-court-text-dim font-mono text-center">
          Phase 1 — Foundation verified. Theme rendering correctly.
        </p>
      </div>
    </main>
  );
}
