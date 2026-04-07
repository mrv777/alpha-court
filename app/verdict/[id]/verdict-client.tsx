"use client";

import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";
import { VerdictDisplay } from "@/components/verdict-display";
import { ShareButton } from "@/components/share-button";
import type { Verdict } from "@/hooks/use-debate-stream";

interface VerdictClientProps {
  trialId: string;
  displayName: string;
  chain: string;
  verdict: Verdict;
  safetyDetails: string[] | null;
}

export function VerdictClient({
  trialId,
  displayName,
  chain,
  verdict,
  safetyDetails,
}: VerdictClientProps) {
  return (
    <div className="min-h-screen bg-court-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-court-border px-6 py-4 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale className="size-5 text-judge" />
            <span className="text-sm font-bold text-judge tracking-wide">
              ALPHA COURT
            </span>
          </div>
          <span className="text-xs text-court-text-dim font-mono">
            {displayName} on {chain}
          </span>
        </div>
      </header>

      {/* Verdict */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <VerdictDisplay
            verdict={verdict}
            tokenName={displayName}
            safetyDetails={safetyDetails}
          />

          {/* Actions */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <ShareButton trialId={trialId} />
          </div>

          <div className="mt-8 text-center">
            <Link
              href={`/trial/${trialId}`}
              className="inline-flex items-center gap-2 text-sm text-court-text-muted hover:text-court-text transition-colors"
            >
              View Full Trial
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
