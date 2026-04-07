"use client";

import { useEffect } from "react";
import { Scale, RefreshCw } from "lucide-react";

export default function RootError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[Alpha Court] Root error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-court-bg flex flex-col items-center justify-center px-4">
      <Scale className="size-12 text-bear/50 mb-4" />
      <h1 className="text-2xl font-bold text-court-text mb-2">
        Something Went Wrong
      </h1>
      <p className="text-sm text-court-text-muted mb-6 text-center max-w-sm">
        An unexpected error occurred. This has been logged.
      </p>
      <button
        onClick={() => unstable_retry()}
        className="inline-flex items-center gap-2 rounded-lg bg-judge/10 border border-judge/20 px-4 py-2 text-sm font-medium text-judge hover:bg-judge/20 transition-colors"
      >
        <RefreshCw className="size-4" />
        Try Again
      </button>
    </main>
  );
}
