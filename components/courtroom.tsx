"use client";

import { useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { DebateStream } from "@/components/debate-stream";
import { DebateMessage } from "@/components/debate-message";
import { DataProgressGrid } from "@/components/data-progress";
import { VerdictDisplay } from "@/components/verdict-display";
import { ShareButton } from "@/components/share-button";
import type { DebateStreamState } from "@/hooks/use-debate-stream";
import type { DebatePhase } from "@/lib/agents/types";

const PHASE_LABELS: Record<DebatePhase, string> = {
  gathering: "Gathering Data",
  opening: "Opening Statements",
  rebuttal: "Rebuttals",
  cross_exam: "Cross-Examination",
  verdict: "Verdict",
};

/** Format a USD value compactly: $1.2M, $45K, $0.0034 */
function fmtUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  // Small prices: show significant digits
  return `$${value.toPrecision(3)}`;
}

interface CourtroomProps {
  trialId: string;
  tokenName: string;
  tokenSymbol: string | null;
  tokenAddress: string;
  tokenIconUrl?: string | null;
  chain: string;
  priceUsd?: number | null;
  mcapUsd?: number | null;
  liquidityUsd?: number | null;
  state: DebateStreamState;
}

export function Courtroom({
  trialId,
  tokenName,
  tokenSymbol,
  tokenAddress,
  tokenIconUrl,
  chain,
  priceUsd,
  mcapUsd,
  liquidityUsd,
  state,
}: CourtroomProps) {
  const { messages, phase, verdict, isStreaming, error, dataProgress } = state;

  const displayName = tokenSymbol ? `$${tokenSymbol}` : tokenName;
  const showGathering = phase === "gathering" || (dataProgress.length > 0 && messages.length === 0);
  const showPreparing = !phase && isStreaming && dataProgress.length === 0 && messages.length === 0;

  // Split messages: debate stream vs verdict panel (only judge verdict phase)
  const debateMessages = useMemo(
    () => messages.filter((m) => !(m.agent === "judge" && m.phase === "verdict")),
    [messages]
  );
  const verdictMessage = useMemo(
    () => messages.find((m) => m.agent === "judge" && m.phase === "verdict") ?? null,
    [messages]
  );

  const hasVerdictPanel = verdictMessage || verdict;
  const hasDebate = debateMessages.length > 0 || (phase && phase !== "gathering");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-court-border px-4 py-3 shrink-0 gap-4">
        {/* Token identity */}
        <div className="flex items-center gap-3 shrink-0">
          <Image
            src={tokenIconUrl || "/logo.png"}
            alt={tokenIconUrl ? displayName ?? "Token" : "Alpha Court"}
            width={24}
            height={24}
            className={cn("shrink-0", tokenIconUrl ? "rounded-full" : "rounded")}
          />
          <h1 className="text-sm font-bold text-court-text">
            {displayName}
            <span className="text-court-text-dim font-normal"> on {chain}</span>
          </h1>
        </div>

        {/* Token stats + links */}
        <div className="flex items-center gap-4">
          {/* Market stats */}
          {priceUsd != null && (
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-court-text-muted">
              <span>
                <span className="text-court-text-dim">Price </span>
                {fmtUsd(priceUsd)}
              </span>
              {mcapUsd != null && (
                <span>
                  <span className="text-court-text-dim">MCap </span>
                  {fmtUsd(mcapUsd)}
                </span>
              )}
              {liquidityUsd != null && (
                <span>
                  <span className="text-court-text-dim">Liq </span>
                  {fmtUsd(liquidityUsd)}
                </span>
              )}
            </div>
          )}

          {/* Trade links */}
          <div className="flex items-center gap-2">
            {/* DexScreener — works for all chains */}
            <a
              href={`https://dexscreener.com/${chain}/${tokenAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-court-border text-court-text-muted hover:text-court-text hover:border-court-border-light transition-colors"
            >
              Chart
            </a>
            {/* Jupiter swap — Solana only */}
            {chain === "solana" && (
              <a
                href={`https://jup.ag/swap/SOL-${tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-bull/30 text-bull hover:bg-bull/10 transition-colors"
              >
                Trade
              </a>
            )}
          </div>

          {/* Streaming indicator */}
          {isStreaming && phase && (
            <span className="size-2 rounded-full bg-bull animate-pulse shrink-0" />
          )}
        </div>
      </header>

      {/* Preparing state */}
      {showPreparing && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Image
              src="/logo.png"
              alt="Alpha Court"
              width={40}
              height={40}
              className="rounded-lg mx-auto mb-3 animate-pulse opacity-50"
            />
            <p className="text-sm text-court-text-muted">Preparing trial...</p>
            <p className="text-xs text-court-text-dim mt-1">
              {displayName} on {chain}
            </p>
          </div>
        </div>
      )}

      {/* Data gathering phase */}
      <AnimatePresence>
        {showGathering && (
          <motion.div
            className="px-4 py-8 border-b border-court-border shrink-0"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          >
            <DataProgressGrid items={dataProgress} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content area */}
      {hasDebate && (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Debate stream (bull/bear + cross-exam) */}
          <DebateStream
            messages={debateMessages}
            phase={phase}
            isStreaming={isStreaming && !hasVerdictPanel}
            error={error}
            className={cn(hasVerdictPanel && "lg:border-r lg:border-court-border")}
          />

          {/* Verdict panel — appears when verdict is ready */}
          {hasVerdictPanel && (
            <aside className="lg:w-[400px] xl:w-[440px] shrink-0 overflow-y-auto border-t lg:border-t-0 border-court-border">
              <div className="p-5 space-y-5">
                {/* Verdict scores */}
                {verdict && (
                  <>
                    <VerdictDisplay
                      verdict={verdict}
                      tokenName={displayName}
                    />
                    <div className="flex justify-center">
                      <ShareButton trialId={trialId} />
                    </div>
                  </>
                )}

                {/* Judge verdict text */}
                {verdictMessage && (
                  <DebateMessage
                    agent={verdictMessage.agent}
                    phase={verdictMessage.phase}
                    content={verdictMessage.content}
                    isStreaming={verdictMessage.isStreaming}
                  />
                )}
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
