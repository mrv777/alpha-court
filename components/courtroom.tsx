"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AgentPanel, AgentPanelCompact } from "@/components/agent-panel";
import { DebateStream } from "@/components/debate-stream";
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

interface CourtroomProps {
  trialId: string;
  tokenName: string;
  tokenSymbol: string | null;
  tokenIconUrl?: string | null;
  chain: string;
  state: DebateStreamState;
}

export function Courtroom({
  trialId,
  tokenName,
  tokenSymbol,
  tokenIconUrl,
  chain,
  state,
}: CourtroomProps) {
  const { messages, phase, verdict, isStreaming, error, dataProgress } = state;
  const [showVerdict, setShowVerdict] = useState(true);

  const displayName = tokenSymbol ? `$${tokenSymbol}` : tokenName;
  const showGathering = phase === "gathering" || (dataProgress.length > 0 && messages.length === 0);
  const showPreparing = !phase && isStreaming && dataProgress.length === 0 && messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-court-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Image
            src={tokenIconUrl || "/logo.png"}
            alt={tokenIconUrl ? displayName ?? "Token" : "Alpha Court"}
            width={24}
            height={24}
            className={cn("shrink-0", tokenIconUrl ? "rounded-full" : "rounded")}
          />
          <div>
            <h1 className="text-sm font-bold text-court-text">
              {displayName}
              <span className="text-court-text-dim font-normal"> on {chain}</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Phase indicator */}
          {phase && (
            <div className="flex items-center gap-2">
              {isStreaming && (
                <span className="size-2 rounded-full bg-bull animate-pulse" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-court-text-muted">
                {PHASE_LABELS[phase]}
              </span>
            </div>
          )}

          {/* Show verdict button when verdict exists but modal is closed */}
          {verdict && !showVerdict && (
            <button
              onClick={() => setShowVerdict(true)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold",
                "border border-judge/30 bg-judge/[0.1] text-judge",
                "hover:bg-judge/[0.2] transition-colors"
              )}
            >
              <span className="size-1.5 rounded-full bg-judge" />
              View Verdict
            </button>
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

      {/* Main courtroom content — only show once we have messages or are past gathering */}
      {(messages.length > 0 || (phase && phase !== "gathering")) && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Mobile: compact agent cards */}
          <div className="lg:hidden flex gap-2 px-4 pt-3 shrink-0 overflow-x-auto scrollbar-none">
            <AgentPanelCompact
              agent="bull"
              verdict={verdict}
            />
            <AgentPanelCompact
              agent="bear"
              verdict={verdict}
            />
          </div>

          {/* Desktop 3-column + Mobile center stream */}
          <div className="flex-1 min-h-0 flex">
            {/* Bull panel — desktop only */}
            <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 p-4">
              <AgentPanel
                agent="bull"
                verdict={verdict}
                className="w-full"
              />
            </aside>

            {/* Center debate stream */}
            <main className="flex-1 min-w-0 flex flex-col border-x border-court-border">
              <DebateStream
                messages={messages}
                phase={phase}
                isStreaming={isStreaming}
                error={error}
              />
            </main>

            {/* Bear panel — desktop only */}
            <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 p-4">
              <AgentPanel
                agent="bear"
                verdict={verdict}
                className="w-full"
              />
            </aside>
          </div>

        </div>
      )}

      {/* ── Verdict Modal Overlay ────────────────────────────────────── */}
      {verdict && showVerdict && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowVerdict(false);
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-court-bg/80 backdrop-blur-sm" />

          {/* Modal content */}
          <div className="relative z-10 w-full max-w-lg animate-in fade-in zoom-in-95 duration-300">
            {/* Close button */}
            <button
              onClick={() => setShowVerdict(false)}
              className="absolute -top-3 -right-3 z-20 size-8 rounded-full border border-court-border bg-court-surface flex items-center justify-center text-court-text-dim hover:text-court-text hover:bg-court-border transition-colors"
              aria-label="Close verdict"
            >
              <X className="size-4" />
            </button>

            {/* Ceremonial header */}
            <div className="flex items-center gap-3 justify-center mb-5">
              <div className="flex-1 max-w-16 h-px bg-gradient-to-r from-transparent to-judge/30" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-judge/70">
                The Court Has Ruled
              </span>
              <div className="flex-1 max-w-16 h-px bg-gradient-to-l from-transparent to-judge/30" />
            </div>

            <VerdictDisplay
              verdict={verdict}
              tokenName={displayName}
            />

            <div className="mt-6 flex justify-center">
              <ShareButton trialId={trialId} />
            </div>

            {/* Dismiss hint */}
            <p className="mt-4 text-center text-[11px] text-court-text-dim">
              Click outside or press X to read the full transcript
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
