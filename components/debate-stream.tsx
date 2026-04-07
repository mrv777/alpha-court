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
}

export function DebateStream({
  messages,
  phase,
  isStreaming,
  error,
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
      // Use rAF to batch scroll with render
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
  const phases = new Set<DebatePhase>();
  const renderedPhases = new Set<DebatePhase>();

  for (const msg of messages) {
    phases.add(msg.phase);
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-1"
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
              evidence={msg.evidence}
              isStreaming={msg.isStreaming}
            />
          </div>
        );
      })}

      {/* Error in stream */}
      {error && (
        <div className="border-l-3 border-l-bear pl-4 py-3">
          <p className="text-sm text-bear">{error}</p>
        </div>
      )}

      {/* Streaming indicator */}
      {isStreaming && messages.length > 0 && !messages.some((m) => m.isStreaming) && (
        <div className="flex items-center gap-2 py-2 pl-4">
          <div className="flex gap-1">
            <span className="size-1.5 rounded-full bg-court-text-dim animate-pulse" />
            <span className="size-1.5 rounded-full bg-court-text-dim animate-pulse [animation-delay:150ms]" />
            <span className="size-1.5 rounded-full bg-court-text-dim animate-pulse [animation-delay:300ms]" />
          </div>
          <span className="text-xs text-court-text-dim">
            {phase ? `${PHASE_LABELS[phase]}...` : "Preparing..."}
          </span>
        </div>
      )}
    </div>
  );
}

function PhaseDivider({ phase }: { phase: DebatePhase }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <div className="flex-1 h-px bg-court-border-light" />
      <span className="text-xs font-semibold uppercase tracking-wider text-court-text-dim">
        {PHASE_LABELS[phase]}
      </span>
      <div className="flex-1 h-px bg-court-border-light" />
    </div>
  );
}
