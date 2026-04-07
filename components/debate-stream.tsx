"use client";

import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DebateMessage } from "@/components/debate-message";
import type { DebateMessage as DebateMessageType } from "@/hooks/use-debate-stream";
import type { DebatePhase } from "@/lib/agents/types";

const PHASE_LABELS: Record<DebatePhase, string> = {
  gathering: "Data Gathering",
  opening: "Opening Statements",
  rebuttal: "Rebuttals",
  cross_exam: "Cross-Examination",
  verdict: "Verdict",
};

interface DebateStreamProps {
  messages: DebateMessageType[];
  phase: DebatePhase | null;
  isStreaming: boolean;
  error: string | null;
  className?: string;
}

export function DebateStream({
  messages,
  phase,
  isStreaming,
  error,
  className,
}: DebateStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const lastMessageCountRef = useRef(0);

  // Track if user is near the bottom of the scroll container
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 100;
    isNearBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // Smart auto-scroll: only if user hasn't scrolled up
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (isNearBottomRef.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages, phase]);

  // For completed trials, auto-scroll to bottom on initial load
  useEffect(() => {
    if (!isStreaming && messages.length > 0 && lastMessageCountRef.current === 0) {
      const el = containerRef.current;
      if (el) {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      }
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length, isStreaming]);

  // Group messages by phase to insert dividers
  const renderedPhases = new Set<DebatePhase>();

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn("flex-1 overflow-y-auto min-h-0 px-5 py-6 space-y-4", className)}
    >
      {messages.length === 0 && !isStreaming && !error && (
        <div className="flex items-center justify-center h-full text-court-text-dim text-sm">
          No debate messages yet
        </div>
      )}

      {messages.map((msg, i) => {
        const showDivider = !renderedPhases.has(msg.phase);
        if (showDivider) renderedPhases.add(msg.phase);

        return (
          <div key={`${msg.agent}-${msg.phase}-${i}`}>
            {showDivider && (
              <PhaseDivider phase={msg.phase} />
            )}
            <DebateMessage
              agent={msg.agent}
              phase={msg.phase}
              content={msg.content}
              isStreaming={msg.isStreaming}
            />
          </div>
        );
      })}

      {/* Error in stream */}
      {error && (
        <div className="border border-bear/20 bg-bear/[0.06] p-4">
          <p className="text-sm text-bear">{error}</p>
        </div>
      )}

      {/* Streaming indicator */}
      {isStreaming && messages.length > 0 && !messages.some((m) => m.isStreaming) && (
        <div className="flex items-center gap-2 py-3 pl-4">
          <div className="flex gap-1">
            <span className="size-1.5 rounded-full bg-judge animate-pulse" />
            <span className="size-1.5 rounded-full bg-judge animate-pulse [animation-delay:200ms]" />
            <span className="size-1.5 rounded-full bg-judge animate-pulse [animation-delay:400ms]" />
          </div>
          <span className="text-xs font-medium text-court-text-dim">
            {phase ? `${PHASE_LABELS[phase]}...` : "Preparing..."}
          </span>
        </div>
      )}
    </div>
  );
}

function PhaseDivider({ phase }: { phase: DebatePhase }) {
  return (
    <div className="flex items-center gap-3 py-4 my-1">
      <span className="text-[11px] font-transcript font-bold uppercase tracking-[0.2em] text-judge/60 shrink-0">
        {PHASE_LABELS[phase]}
      </span>
      <div className="flex-1 h-px bg-court-border" />
    </div>
  );
}
