"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CitationChip } from "@/components/citation-chip";
import { parseCitationStream } from "@/lib/citations";
import type { AgentRole, DebatePhase } from "@/lib/agents/types";

const AGENT_STYLE: Record<
  AgentRole,
  { label: string; border: string; labelColor: string; icon: string }
> = {
  bull: {
    label: "The Bull",
    border: "border-l-bull",
    labelColor: "text-bull",
    icon: "🟢",
  },
  bear: {
    label: "The Bear",
    border: "border-l-bear",
    labelColor: "text-bear",
    icon: "🔴",
  },
  judge: {
    label: "The Judge",
    border: "border-l-judge",
    labelColor: "text-judge",
    icon: "⚖️",
  },
};

const PHASE_LABELS: Record<DebatePhase, string> = {
  gathering: "Data Gathering",
  opening: "Opening Statement",
  rebuttal: "Rebuttal",
  cross_exam: "Cross-Examination",
  verdict: "Verdict",
};

interface DebateMessageProps {
  agent: AgentRole;
  phase: DebatePhase;
  content: string;
  evidence?: Array<{ endpoint: string; displayValue: string }>;
  isStreaming?: boolean;
}

export function DebateMessage({
  agent,
  phase,
  content,
  evidence,
  isStreaming,
}: DebateMessageProps) {
  const style = AGENT_STYLE[agent];

  // Build a map of endpoint → displayValue from evidence for raw data lookup
  const evidenceMap = useMemo(() => {
    const map = new Map<string, string>();
    if (evidence) {
      for (const e of evidence) {
        map.set(e.endpoint, e.displayValue);
      }
    }
    return map;
  }, [evidence]);

  // Parse content into text + citation segments
  const segments = useMemo(() => {
    const result = parseCitationStream(content, "");
    return result.segments;
  }, [content]);

  return (
    <div
      className={cn(
        "border-l-3 pl-4 py-3",
        style.border
      )}
    >
      {/* Agent label + phase */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm">{style.icon}</span>
        <span className={cn("text-xs font-semibold uppercase tracking-wider", style.labelColor)}>
          {style.label}
        </span>
        <span className="text-xs text-court-text-dim">
          — {PHASE_LABELS[phase]}
        </span>
      </div>

      {/* Message content with inline citations */}
      <div className="text-sm text-court-text leading-relaxed">
        {segments.map((seg, i) =>
          seg.type === "text" ? (
            <span key={i}>{seg.content}</span>
          ) : (
            <CitationChip
              key={i}
              endpoint={seg.endpoint}
              displayValue={seg.displayValue}
              rawData={evidenceMap.get(seg.endpoint) || null}
            />
          )
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-court-text-muted/60 ml-0.5 animate-pulse rounded-sm align-text-bottom" />
        )}
      </div>
    </div>
  );
}
