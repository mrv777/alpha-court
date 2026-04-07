"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Scale } from "lucide-react";
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
  chain: string;
  state: DebateStreamState;
}

export function Courtroom({
  trialId,
  tokenName,
  tokenSymbol,
  chain,
  state,
}: CourtroomProps) {
  const { messages, phase, verdict, isStreaming, error, dataProgress } = state;

  // Collect evidence per agent from completed messages
  const evidenceByAgent = useMemo(() => {
    const bull: Array<{ endpoint: string; displayValue: string }> = [];
    const bear: Array<{ endpoint: string; displayValue: string }> = [];
    const judge: Array<{ endpoint: string; displayValue: string }> = [];
    const seen = { bull: new Set<string>(), bear: new Set<string>(), judge: new Set<string>() };

    for (const msg of messages) {
      if (msg.isStreaming) continue;
      const target = msg.agent === "bull" ? bull : msg.agent === "bear" ? bear : judge;
      const seenSet = seen[msg.agent];
      for (const e of msg.evidence) {
        const key = `${e.endpoint}:${e.displayValue}`;
        if (!seenSet.has(key)) {
          seenSet.add(key);
          target.push(e);
        }
      }
    }
    return { bull, bear, judge };
  }, [messages]);

  const displayName = tokenSymbol ? `$${tokenSymbol}` : tokenName;
  const showGathering = phase === "gathering" || (dataProgress.length > 0 && messages.length === 0);
  const showPreparing = !phase && isStreaming && dataProgress.length === 0 && messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-court-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Scale className="size-5 text-judge" />
          <div>
            <h1 className="text-sm font-bold text-court-text">
              {displayName}
              <span className="text-court-text-dim font-normal"> on {chain}</span>
            </h1>
          </div>
        </div>

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
      </header>

      {/* Preparing state */}
      {showPreparing && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Scale className="size-8 text-judge/50 mx-auto mb-3 animate-pulse" />
            <p className="text-sm text-court-text-muted">Preparing trial...</p>
            <p className="text-xs text-court-text-dim mt-1">
              {displayName} on {chain}
            </p>
          </div>
        </div>
      )}

      {/* Data gathering phase */}
      {showGathering && (
        <div className="px-4 py-6 border-b border-court-border shrink-0">
          <DataProgressGrid items={dataProgress} />
        </div>
      )}

      {/* Main courtroom content — only show once we have messages or are past gathering */}
      {(messages.length > 0 || (phase && phase !== "gathering")) && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Mobile: compact agent cards */}
          <div className="lg:hidden flex gap-2 px-4 pt-3 shrink-0 overflow-x-auto">
            <AgentPanelCompact
              agent="bull"
              evidence={evidenceByAgent.bull}
              verdict={verdict}
            />
            <AgentPanelCompact
              agent="bear"
              evidence={evidenceByAgent.bear}
              verdict={verdict}
            />
          </div>

          {/* Desktop 3-column + Mobile center stream */}
          <div className="flex-1 min-h-0 flex">
            {/* Bull panel — desktop only */}
            <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 p-4">
              <AgentPanel
                agent="bull"
                evidence={evidenceByAgent.bull}
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
                evidence={evidenceByAgent.bear}
                verdict={verdict}
                className="w-full"
              />
            </aside>
          </div>

          {/* Judge bar — visible when judge has spoken */}
          {evidenceByAgent.judge.length > 0 && !verdict && (
            <div className="shrink-0 border-t border-judge/20 bg-judge/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-base">⚖️</span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-judge">The Judge</span>
                  {evidenceByAgent.judge.length > 0 && (
                    <p className="text-xs text-court-text-dim truncate font-mono">
                      {evidenceByAgent.judge[0].displayValue}
                      {evidenceByAgent.judge.length > 1 &&
                        ` +${evidenceByAgent.judge.length - 1} more`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Verdict display — the climactic reveal */}
          {verdict && (
            <div className="shrink-0 border-t border-judge/20 bg-judge/5 px-4 py-6">
              <div className="max-w-lg mx-auto flex flex-col items-center gap-4">
                <VerdictDisplay
                  verdict={verdict}
                  tokenName={displayName}
                />
                <ShareButton trialId={trialId} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
