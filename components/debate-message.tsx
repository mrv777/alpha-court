"use client";

import { memo, useMemo, type ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { CitationChip } from "@/components/citation-chip";
import { parseCitationStream } from "@/lib/citations";
import type { AgentRole, DebatePhase } from "@/lib/agents/types";

const AGENT_STYLE: Record<
  AgentRole,
  { label: string; border: string; labelColor: string; avatar: string }
> = {
  bull: {
    label: "The Bull",
    border: "border-l-bull",
    labelColor: "text-bull",
    avatar: "/bull-avatar.png",
  },
  bear: {
    label: "The Bear",
    border: "border-l-bear",
    labelColor: "text-bear",
    avatar: "/bear-avatar.png",
  },
  judge: {
    label: "The Judge",
    border: "border-l-judge",
    labelColor: "text-judge",
    avatar: "/judge-avatar.png",
  },
};

const PHASE_LABELS: Record<DebatePhase, string> = {
  gathering: "Data Gathering",
  opening: "Opening Statement",
  rebuttal: "Rebuttal",
  cross_exam: "Cross-Examination",
  verdict: "Verdict",
};

/**
 * Render inline markdown within a text string.
 * Handles: **bold**, *italic*, `code`, and ##/### headings at line start.
 * Splits on newlines to handle line-level patterns.
 */
function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith("**") && part.endsWith("**")) {
      nodes.push(
        <strong key={i} className="font-semibold text-court-text">
          {part.slice(2, -2)}
        </strong>
      );
    } else {
      // Handle numbered lists: lines starting with "1. ", "2. " etc
      const lines = part.split("\n");
      for (let j = 0; j < lines.length; j++) {
        const line = lines[j];
        if (j > 0) nodes.push(<br key={`br-${i}-${j}`} />);

        // Heading lines (###, ##)
        if (line.match(/^#{2,3}\s+/)) {
          nodes.push(
            <span key={`h-${i}-${j}`} className="font-semibold text-court-text">
              {line.replace(/^#{2,3}\s+/, "")}
            </span>
          );
        }
        // Numbered list items
        else if (line.match(/^\d+\.\s/)) {
          nodes.push(
            <span key={`li-${i}-${j}`} className="block pl-1 mt-1.5">
              {line}
            </span>
          );
        } else {
          nodes.push(line);
        }
      }
    }
  }
  return nodes;
}

interface DebateMessageProps {
  agent: AgentRole;
  phase: DebatePhase;
  content: string;
  evidence?: Array<{ endpoint: string; displayValue: string }>;
  isStreaming?: boolean;
}

export const DebateMessage = memo(function DebateMessage({
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
        "rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 border-l-3",
        style.border
      )}
    >
      {/* Agent label + phase */}
      <div className="flex items-center gap-2.5 mb-3">
        <Image
          src={style.avatar}
          alt={style.label}
          width={24}
          height={24}
          className="rounded shrink-0"
        />
        <span className={cn("text-xs font-bold uppercase tracking-wider", style.labelColor)}>
          {style.label}
        </span>
        <span className="text-[11px] text-court-text-dim">
          {PHASE_LABELS[phase]}
        </span>
      </div>

      {/* Message content with inline citations + markdown */}
      <div className="text-[15px] text-court-text/90 leading-[1.7]">
        {segments.map((seg, i) =>
          seg.type === "text" ? (
            <span key={i}>{renderInlineMarkdown(seg.content)}</span>
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
});
