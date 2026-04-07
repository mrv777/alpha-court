"use client";

import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useDebateStream } from "@/hooks/use-debate-stream";
import { Courtroom } from "@/components/courtroom";

interface TrialData {
  id: string;
  token_address: string;
  chain: string;
  token_name: string | null;
  token_symbol: string | null;
  status: string;
  error_message: string | null;
}

interface TrialClientProps {
  trial: TrialData;
}

export function TrialClient({ trial }: TrialClientProps) {
  const state = useDebateStream(trial.id);

  const tokenName = trial.token_name ?? trial.token_symbol ?? trial.token_address;

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-court-border bg-court-bg shrink-0">
        <Link
          href="/"
          className="text-court-text-dim hover:text-court-text transition-colors"
          aria-label="Back to Alpha Court"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <span className="text-xs text-court-text-dim font-mono">
          Trial {trial.id}
        </span>

        {/* Non-recoverable error from DB (not from stream) */}
        {trial.status === "error" && !state.error && (
          <div className="flex items-center gap-1.5 ml-auto">
            <AlertCircle className="size-3.5 text-bear" />
            <span className="text-xs text-bear">
              {trial.error_message ?? "Trial failed"}
            </span>
          </div>
        )}
      </div>

      {/* Courtroom */}
      <div className="flex-1 min-h-0">
        <Courtroom
          trialId={trial.id}
          tokenName={tokenName}
          tokenSymbol={trial.token_symbol}
          chain={trial.chain}
          state={state}
        />
      </div>
    </div>
  );
}
