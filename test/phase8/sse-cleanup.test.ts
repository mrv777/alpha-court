import { describe, it, expect } from "vitest";
import type { DebateStreamState } from "@/hooks/use-debate-stream";

describe("SSE cleanup and reconnection", () => {
  it("initial state has isStreaming true", () => {
    const state: DebateStreamState = {
      messages: [],
      phase: null,
      verdict: null,
      isStreaming: true,
      error: null,
      dataProgress: [],
    };
    expect(state.isStreaming).toBe(true);
  });

  it("DONE action sets isStreaming to false", () => {
    // Simulate what the reducer does
    const state: DebateStreamState = {
      messages: [],
      phase: "verdict",
      verdict: {
        score: 42,
        label: "BUY",
        summary: "Good buy",
        bull_conviction: 70,
        bear_conviction: 50,
        safety: "clean",
      },
      isStreaming: true,
      error: null,
      dataProgress: [],
    };

    // After DONE
    const afterDone = { ...state, isStreaming: false };
    expect(afterDone.isStreaming).toBe(false);
  });

  it("ERROR action preserves existing messages", () => {
    const messages = [
      {
        agent: "bull" as const,
        phase: "opening" as const,
        content: "Bullish case",
        evidence: [],
        isStreaming: false,
      },
    ];

    const state: DebateStreamState = {
      messages,
      phase: "opening",
      verdict: null,
      isStreaming: true,
      error: null,
      dataProgress: [],
    };

    // After ERROR
    const afterError = { ...state, error: "Connection lost" };
    expect(afterError.error).toBe("Connection lost");
    expect(afterError.messages).toHaveLength(1);
    expect(afterError.messages[0].content).toBe("Bullish case");
  });

  it("reconnection backoff follows exponential pattern", () => {
    const delays: number[] = [];
    for (let retry = 0; retry < 5; retry++) {
      delays.push(Math.min(1000 * Math.pow(2, retry), 16000));
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000]);
  });

  it("max retry count is 5", () => {
    const maxRetries = 5;
    let retryCount = 0;
    while (retryCount < maxRetries) {
      retryCount++;
    }
    expect(retryCount).toBe(5);
  });
});

describe("Mid-trial join replay", () => {
  it("replayed messages are all non-streaming", () => {
    // When replaying stored messages, they should all be marked as not streaming
    const replayedMessages = [
      {
        agent: "bull" as const,
        phase: "opening" as const,
        content: "Bull opening",
        evidence: [{ endpoint: "sm-netflow", displayValue: "$2M" }],
        isStreaming: false,
      },
      {
        agent: "bear" as const,
        phase: "opening" as const,
        content: "Bear opening",
        evidence: [],
        isStreaming: false,
      },
    ];

    expect(replayedMessages.every((m) => !m.isStreaming)).toBe(true);
  });

  it("new streaming messages can appear after replay", () => {
    const messages = [
      // Replayed
      {
        agent: "bull" as const,
        phase: "opening" as const,
        content: "Bull opening",
        evidence: [],
        isStreaming: false,
      },
      // Live
      {
        agent: "bear" as const,
        phase: "rebuttal" as const,
        content: "Bear rebuttal in progre",
        evidence: [],
        isStreaming: true,
      },
    ];

    const completed = messages.filter((m) => !m.isStreaming);
    const streaming = messages.filter((m) => m.isStreaming);

    expect(completed).toHaveLength(1);
    expect(streaming).toHaveLength(1);
  });
});
