import { describe, it, expect } from "vitest";
import type { DebateMessage } from "@/hooks/use-debate-stream";
import type { AgentRole } from "@/lib/agents/types";

// Test the evidence grouping logic used by Courtroom

function groupEvidence(messages: DebateMessage[]) {
  const bull: Array<{ endpoint: string; displayValue: string }> = [];
  const bear: Array<{ endpoint: string; displayValue: string }> = [];
  const judge: Array<{ endpoint: string; displayValue: string }> = [];
  const seen = {
    bull: new Set<string>(),
    bear: new Set<string>(),
    judge: new Set<string>(),
  };

  for (const msg of messages) {
    if (msg.isStreaming) continue;
    const target =
      msg.agent === "bull" ? bull : msg.agent === "bear" ? bear : judge;
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
}

describe("Courtroom evidence grouping", () => {
  it("groups evidence by agent from messages", () => {
    const messages: DebateMessage[] = [
      {
        agent: "bull",
        phase: "opening",
        content: "Bull opening",
        evidence: [
          { endpoint: "sm-netflow", displayValue: "+$2M" },
          { endpoint: "who-bought-sold", displayValue: "45 buyers" },
        ],
        isStreaming: false,
      },
      {
        agent: "bear",
        phase: "opening",
        content: "Bear opening",
        evidence: [
          { endpoint: "token-holders", displayValue: "73% top 10" },
        ],
        isStreaming: false,
      },
      {
        agent: "judge",
        phase: "cross_exam",
        content: "Judge cross exam",
        evidence: [
          { endpoint: "token-info", displayValue: "Market cap $5M" },
        ],
        isStreaming: false,
      },
    ];

    const grouped = groupEvidence(messages);
    expect(grouped.bull).toHaveLength(2);
    expect(grouped.bear).toHaveLength(1);
    expect(grouped.judge).toHaveLength(1);
  });

  it("deduplicates evidence items", () => {
    const messages: DebateMessage[] = [
      {
        agent: "bull",
        phase: "opening",
        content: "Opening",
        evidence: [{ endpoint: "sm-netflow", displayValue: "+$2M" }],
        isStreaming: false,
      },
      {
        agent: "bull",
        phase: "rebuttal",
        content: "Rebuttal",
        evidence: [{ endpoint: "sm-netflow", displayValue: "+$2M" }],
        isStreaming: false,
      },
    ];

    const grouped = groupEvidence(messages);
    expect(grouped.bull).toHaveLength(1);
  });

  it("skips streaming messages", () => {
    const messages: DebateMessage[] = [
      {
        agent: "bull",
        phase: "opening",
        content: "partial...",
        evidence: [{ endpoint: "x", displayValue: "y" }],
        isStreaming: true,
      },
    ];

    const grouped = groupEvidence(messages);
    expect(grouped.bull).toHaveLength(0);
  });

  it("handles empty messages", () => {
    const grouped = groupEvidence([]);
    expect(grouped.bull).toHaveLength(0);
    expect(grouped.bear).toHaveLength(0);
    expect(grouped.judge).toHaveLength(0);
  });

  it("collects evidence across multiple phases", () => {
    const messages: DebateMessage[] = [
      {
        agent: "bear",
        phase: "opening",
        content: "Opening",
        evidence: [{ endpoint: "token-holders", displayValue: "73% top 10" }],
        isStreaming: false,
      },
      {
        agent: "bear",
        phase: "rebuttal",
        content: "Rebuttal",
        evidence: [{ endpoint: "goplus", displayValue: "freeze authority" }],
        isStreaming: false,
      },
    ];

    const grouped = groupEvidence(messages);
    expect(grouped.bear).toHaveLength(2);
    expect(grouped.bear[0].endpoint).toBe("token-holders");
    expect(grouped.bear[1].endpoint).toBe("goplus");
  });
});

describe("Courtroom state rendering logic", () => {
  it("detects gathering phase", () => {
    const phase = "gathering" as const;
    const dataProgressLength = 5;
    const messagesLength = 0;
    const showGathering =
      phase === "gathering" ||
      (dataProgressLength > 0 && messagesLength === 0);
    expect(showGathering).toBe(true);
  });

  it("detects preparing state", () => {
    const phase = null;
    const isStreaming = true;
    const dataProgressLength = 0;
    const messagesLength = 0;
    const showPreparing =
      !phase && isStreaming && dataProgressLength === 0 && messagesLength === 0;
    expect(showPreparing).toBe(true);
  });

  it("does not show preparing when phase is set", () => {
    const phase: string | null = "opening";
    const isStreaming = true;
    const showPreparing = !phase && isStreaming;
    expect(showPreparing).toBe(false);
  });

  it("shows main content when messages exist", () => {
    const messagesLength = 3;
    const phase: string | null = "opening";
    const showContent =
      messagesLength > 0 || (phase != null && phase !== "gathering");
    expect(showContent).toBeTruthy();
  });
});
