"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function VerdictError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[Alpha Court] Verdict error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-court-bg flex flex-col items-center justify-center px-4">
      <AlertCircle className="size-12 text-bear/50 mb-4" />
      <h1 className="text-xl font-bold text-court-text mb-2">
        Verdict Unavailable
      </h1>
      <p className="text-sm text-court-text-muted mb-6 text-center max-w-sm">
        Something went wrong loading this verdict.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => unstable_retry()}
          className="inline-flex items-center gap-2 rounded-lg bg-judge/10 border border-judge/20 px-4 py-2 text-sm font-medium text-judge hover:bg-judge/20 transition-colors"
        >
          <RefreshCw className="size-4" />
          Retry
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-court-surface border border-court-border px-4 py-2 text-sm font-medium text-court-text-muted hover:bg-court-border/50 transition-colors"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
