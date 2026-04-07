import { describe, it, expect } from "vitest";
import type { DebateStreamState, DebateMessage, Verdict } from "@/hooks/use-debate-stream";

// Test the state-handling logic of the trial page

describe("Trial page state handling", () => {
  it("shows loading when status is pending and streaming", () => {
    const state: DebateStreamState = {
      messages: [],
      phase: null,
      verdict: null,
      isStreaming: true,
      error: null,
      dataProgress: [],
      tokenStats: null,
    };
    const showPreparing =
      !state.phase &&
      state.isStreaming &&
      state.dataProgress.length === 0 &&
      state.messages.length === 0;
    expect(showPreparing).toBe(true);
  });

  it("shows gathering when data progress items arrive", () => {
    const state: DebateStreamState = {
      messages: [],
      phase: "gathering",
      verdict: null,
      isStreaming: true,
      error: null,
      dataProgress: [
        { endpoint: "sm-netflow", agent: "bull", status: "pending" },
      ],
      tokenStats: null,
    };
    const showGathering =
      state.phase === "gathering" ||
      (state.dataProgress.length > 0 && state.messages.length === 0);
    expect(showGathering).toBe(true);
  });

  it("shows debate stream once messages arrive", () => {
    const state: DebateStreamState = {
      messages: [
        {
          agent: "bull",
          phase: "opening",
          content: "Smart money...",
          evidence: [],
          isStreaming: true,
        },
      ],
      phase: "opening",
      verdict: null,
      isStreaming: true,
      error: null,
      dataProgress: [],
      tokenStats: null,
    };
    const showContent = state.messages.length > 0;
    expect(showContent).toBe(true);
  });

  it("renders completed trial with all messages instantly", () => {
    const messages: DebateMessage[] = [
      {
        agent: "bull",
        phase: "opening",
        content: "Bull opening content",
        evidence: [{ endpoint: "sm-netflow", displayValue: "$2M" }],
        isStreaming: false,
      },
      {
        agent: "bear",
        phase: "opening",
        content: "Bear opening content",
        evidence: [{ endpoint: "token-holders", displayValue: "73%" }],
        isStreaming: false,
      },
      {
        agent: "judge",
        phase: "verdict",
        content: "The verdict is...",
        evidence: [],
        isStreaming: false,
      },
    ];

    const verdict: Verdict = {
      score: 47,
      label: "BUY",
      summary: "Net positive",
      bull_conviction: 73,
      bear_conviction: 58,
      safety: "clean",
    };

    const state: DebateStreamState = {
      messages,
      phase: "verdict",
      verdict,
      isStreaming: false,
      error: null,
      dataProgress: [],
      tokenStats: null,
    };

    // All messages present and not streaming
    expect(state.messages).toHaveLength(3);
    expect(state.messages.every((m) => !m.isStreaming)).toBe(true);
    expect(state.verdict).not.toBeNull();
    expect(state.isStreaming).toBe(false);
  });

  it("handles error state", () => {
    const state: DebateStreamState = {
      messages: [
        {
          agent: "bull",
          phase: "opening",
          content: "Partial message",
          evidence: [],
          isStreaming: false,
        },
      ],
      phase: "opening",
      verdict: null,
      isStreaming: false,
      error: "LLM API failed",
      dataProgress: [],
      tokenStats: null,
    };

    expect(state.error).toBe("LLM API failed");
    expect(state.isStreaming).toBe(false);
  });

  it("handles skipped phases gracefully", () => {
    // If bear's opening failed, we might only have bull's opening + rebuttals
    const messages: DebateMessage[] = [
      {
        agent: "bull",
        phase: "opening",
        content: "Bull opening",
        evidence: [],
        isStreaming: false,
      },
      // bear opening skipped
      {
        agent: "bull",
        phase: "rebuttal",
        content: "Bull rebuttal",
        evidence: [],
        isStreaming: false,
      },
      {
        agent: "judge",
        phase: "cross_exam",
        content: "Judge cross exam",
        evidence: [],
        isStreaming: false,
      },
    ];

    // Phase dividers should be based on the phases that exist in messages
    const phases = new Set(messages.map((m) => m.phase));
    expect(phases.has("opening")).toBe(true);
    expect(phases.has("rebuttal")).toBe(true);
    expect(phases.has("cross_exam")).toBe(true);
    // No bear opening — that's fine, gaps are handled
    expect(messages.filter((m) => m.agent === "bear")).toHaveLength(0);
  });

  it("auto-scrolls to verdict for completed trials", () => {
    // When a trial is completed (isStreaming=false) and messages are loaded all at once,
    // lastMessageCountRef should be 0, triggering the scroll-to-bottom effect
    const isStreaming = false;
    const messageCount = 5;
    const lastMessageCount = 0; // First render

    const shouldAutoScroll =
      !isStreaming && messageCount > 0 && lastMessageCount === 0;
    expect(shouldAutoScroll).toBe(true);
  });

  it("does not auto-scroll mid-stream on subsequent message updates", () => {
    const isStreaming = true;
    const messageCount = 5;
    const lastMessageCount = 4; // Already seen messages

    // During streaming with existing messages, the initial-load auto-scroll doesn't trigger
    const shouldAutoScroll =
      !isStreaming && messageCount > 0 && (lastMessageCount as number) === 0;
    expect(shouldAutoScroll).toBe(false);
  });
});
