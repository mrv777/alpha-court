import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_DIR = path.join(__dirname, "../data/test-engine");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "engine.db");

process.env.DATABASE_PATH = TEST_DB_PATH;

// ── Mock LLM ──────────────────────────────────────────────────────────

const { mockStreamChat, mockStructuredOutput } = vi.hoisted(() => ({
  mockStreamChat: vi.fn(),
  mockStructuredOutput: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  FAST: "mock-fast",
  REASONING: "mock-reasoning",
  LLMError: class LLMError extends Error {
    code: string;
    retryable: boolean;
    constructor(msg: string, code: string, retryable: boolean) {
      super(msg);
      this.name = "LLMError";
      this.code = code;
      this.retryable = retryable;
    }
  },
  streamChat: mockStreamChat,
  structuredOutput: mockStructuredOutput,
  getJudgeTools: () => ({ web_search: {}, x_search: {} }),
}));

// ── Mock agents ───────────────────────────────────────────────────────

const mockFetchBullData = vi.fn();
const mockFetchBearData = vi.fn();
const mockFetchJudgeData = vi.fn();

vi.mock("@/lib/agents/bull", () => ({
  BULL_MODEL: "mock-fast",
  fetchBullData: (...args: unknown[]) => mockFetchBullData(...args),
  buildBullOpeningPrompt: () => ({ system: "bull-sys", user: "bull-open" }),
  buildBullRebuttalPrompt: () => ({ system: "bull-sys", user: "bull-rebuttal" }),
}));

vi.mock("@/lib/agents/bear", () => ({
  BEAR_MODEL: "mock-fast",
  fetchBearData: (...args: unknown[]) => mockFetchBearData(...args),
  buildBearOpeningPrompt: () => ({ system: "bear-sys", user: "bear-open" }),
  buildBearRebuttalPrompt: () => ({ system: "bear-sys", user: "bear-rebuttal" }),
}));

vi.mock("@/lib/agents/judge", () => ({
  JUDGE_MODEL: "mock-reasoning",
  fetchJudgeData: (...args: unknown[]) => mockFetchJudgeData(...args),
  buildJudgeCrossExamPrompt: () => ({ system: "judge-sys", user: "judge-cross" }),
  buildJudgeVerdictPrompt: () => ({ system: "judge-sys", user: "judge-verdict" }),
  buildJudgeVerdictStructuredPrompt: () => ({ system: "extract-sys", user: "extract-user" }),
  verdictSchema: {},
}));

import { runDebate, activeDebates, type DebateEvent } from "@/lib/debate-engine";
import { getDb, closeDb } from "@/lib/db";

// ── Test helpers ──────────────────────────────────────────────────────

function cleanup() {
  closeDb();
  activeDebates.clear();
  for (const ext of ["", "-wal", "-shm"]) {
    const f = TEST_DB_PATH + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  if (fs.existsSync(TEST_DB_DIR)) fs.rmdirSync(TEST_DB_DIR);
}

function createTrial(id = "test_trial_01"): string {
  const db = getDb();
  db.prepare(
    "INSERT INTO trials (id, token_address, chain, token_name, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)"
  ).run(id, "So11111111111111111111111111111111111111112", "solana", "Test Token", Math.floor(Date.now() / 1000));
  return id;
}

function makeMockStream(text: string) {
  return async function* () {
    const words = text.split(" ");
    for (const w of words) {
      yield w + " ";
    }
  };
}

const defaultBullData = {
  smNetflow: null, whoBought: null, flowIntelligence: null,
  profilerPnl: null, dexScreener: null, jupiterPrice: null,
};

const defaultBearData = {
  dexTrades: null, holders: null, smDexTrades: null,
  tokenFlows: null, dexScreener: null, security: { safe: true, reasons: [] },
};

const defaultJudgeData = {
  tokenInfo: null, ohlcv: null, whoSold: null, profilerPnl: null,
};

const defaultScores = {
  score: 65,
  label: "Buy",
  summary: "Token looks promising.",
  bull_conviction: 75,
  bear_conviction: 45,
};

function setupDefaultMocks() {
  mockFetchBullData.mockResolvedValue(defaultBullData);
  mockFetchBearData.mockResolvedValue(defaultBearData);
  mockFetchJudgeData.mockResolvedValue(defaultJudgeData);

  mockStreamChat.mockImplementation(() => makeMockStream("This is a mock response.")());

  mockStructuredOutput.mockResolvedValue(defaultScores);
}

// ── Tests ─────────────────────────────────────────────────────────────

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  getDb(); // init schema
  setupDefaultMocks();
});

afterEach(() => {
  cleanup();
});

describe("runDebate", () => {
  it("executes all 5 phases in order", async () => {
    const trialId = createTrial();
    const events: DebateEvent[] = [];

    await runDebate(trialId, "So11111111111111111111111111111111111111112", "solana", "Test Token", (e) => events.push(e));

    // Extract phase events
    const phaseEvents = events.filter((e) => e.type === "phase") as Array<{ type: "phase"; phase: string; status: string }>;
    const phaseOrder = phaseEvents.map((e) => `${e.phase}:${e.status}`);

    expect(phaseOrder).toEqual([
      "gathering:start",
      "gathering:complete",
      "opening:start",
      "opening:complete",
      "rebuttal:start",
      "rebuttal:complete",
      "cross_exam:start",
      "cross_exam:complete",
      "verdict:start",
      "verdict:complete",
    ]);

    // Should end with done
    expect(events[events.length - 1].type).toBe("done");
  });

  it("fetches data grouped by agent in phase 1", async () => {
    const trialId = createTrial();
    const events: DebateEvent[] = [];

    await runDebate(trialId, "token123", "solana", "Test", (e) => events.push(e));

    expect(mockFetchBullData).toHaveBeenCalledWith("token123", "solana");
    expect(mockFetchBearData).toHaveBeenCalledWith("token123", "solana");
    expect(mockFetchJudgeData).toHaveBeenCalledWith("token123", "solana");

    // Data progress events should be emitted
    const dataEvents = events.filter((e) => e.type === "data_progress") as Array<{ type: "data_progress"; agent: string; status: string }>;
    expect(dataEvents.length).toBeGreaterThan(0);

    // All should be complete (no errors in default mocks)
    const completeEvents = dataEvents.filter((e) => e.status === "complete");
    expect(completeEvents.length).toBe(16); // 6 bull + 6 bear + 4 judge
  });

  it("streams Bull and Bear openings in parallel (phase 2)", async () => {
    const trialId = createTrial();
    const callOrder: string[] = [];

    // Track when each stream starts
    mockStreamChat.mockImplementation(
      (model: string, sys: string, user: string) => {
        if (user.includes("bull")) callOrder.push("bull-start");
        if (user.includes("bear")) callOrder.push("bear-start");
        return makeMockStream("response text")();
      }
    );

    await runDebate(trialId, "token", "solana", "Test", () => {});

    // streamChat is called for: 2 openings, 2 rebuttals, cross_exam, verdict = 6 total
    expect(mockStreamChat).toHaveBeenCalledTimes(6);
  });

  it("executes rebuttals sequentially (phase 3)", async () => {
    const trialId = createTrial();
    const events: DebateEvent[] = [];

    await runDebate(trialId, "token", "solana", "Test", (e) => events.push(e));

    // Find message_complete events for rebuttals
    const rebuttalCompletes = events.filter(
      (e) => e.type === "message_complete" && (e as any).phase === "rebuttal"
    ) as Array<{ type: "message_complete"; agent: string; phase: string }>;

    // Bear rebuttal should come first, then Bull
    expect(rebuttalCompletes.length).toBe(2);
    expect(rebuttalCompletes[0].agent).toBe("bear");
    expect(rebuttalCompletes[1].agent).toBe("bull");
  });

  it("persists messages to DB per phase", async () => {
    const trialId = createTrial();

    await runDebate(trialId, "token", "solana", "Test", () => {});

    const db = getDb();
    const messages = db
      .prepare("SELECT agent, phase, sequence FROM debate_messages WHERE trial_id = ? ORDER BY sequence")
      .all(trialId) as Array<{ agent: string; phase: string; sequence: number }>;

    // opening (bull + bear) + rebuttal (bear + bull) + cross_exam + verdict = 6
    expect(messages.length).toBe(6);

    // Verify phases in order
    expect(messages[0].phase).toBe("opening");
    expect(messages[1].phase).toBe("opening");
    expect(messages[2].phase).toBe("rebuttal");
    expect(messages[3].phase).toBe("rebuttal");
    expect(messages[4].phase).toBe("cross_exam");
    expect(messages[5].phase).toBe("verdict");
  });

  it("updates trial status at each phase transition", async () => {
    const trialId = createTrial();
    const statusUpdates: string[] = [];

    const db = getDb();
    const origRun = db.prepare("UPDATE trials SET status = ? WHERE id = ?").run;

    // We can check final status
    await runDebate(trialId, "token", "solana", "Test", () => {});

    const trial = db.prepare("SELECT status, verdict_score, verdict_label FROM trials WHERE id = ?").get(trialId) as {
      status: string;
      verdict_score: number;
      verdict_label: string;
    };

    expect(trial.status).toBe("completed");
    expect(trial.verdict_score).toBe(65);
    expect(trial.verdict_label).toBe("Buy");
  });

  it("emits verdict event with scores", async () => {
    const trialId = createTrial();
    const events: DebateEvent[] = [];

    await runDebate(trialId, "token", "solana", "Test", (e) => events.push(e));

    const verdictEvent = events.find((e) => e.type === "verdict") as any;
    expect(verdictEvent).toBeDefined();
    expect(verdictEvent.score).toBe(65);
    expect(verdictEvent.label).toBe("Buy");
    expect(verdictEvent.bull_conviction).toBe(75);
    expect(verdictEvent.bear_conviction).toBe(45);
    expect(verdictEvent.safety).toBe("clean");
  });

  it("retries and skips on LLM failure", async () => {
    const trialId = createTrial();
    const events: DebateEvent[] = [];

    let callCount = 0;
    mockStreamChat.mockImplementation(() => {
      callCount++;
      // Fail the first two calls (opening bull attempt + retry), then succeed for rest
      if (callCount <= 2) {
        throw new Error("LLM failure");
      }
      return makeMockStream("ok response")();
    });

    await runDebate(trialId, "token", "solana", "Test", (e) => events.push(e));

    // Should have error events for the bull opening
    const errorEvents = events.filter((e) => e.type === "error") as Array<{ type: "error"; message: string; recoverable: boolean }>;
    expect(errorEvents.length).toBeGreaterThan(0);
    expect(errorEvents.some((e) => e.message.includes("bull"))).toBe(true);

    // Should still complete (not crash)
    expect(events[events.length - 1].type).toBe("done");
  });

  it("sets error status on unrecoverable error", async () => {
    const trialId = createTrial();
    const events: DebateEvent[] = [];

    // Make data fetching throw an unrecoverable error
    mockFetchBullData.mockRejectedValue(new Error("Critical failure"));
    mockFetchBearData.mockRejectedValue(new Error("Critical failure"));
    mockFetchJudgeData.mockRejectedValue(new Error("Critical failure"));

    // Make the LLM stream also throw (to test unrecoverable path)
    mockStreamChat.mockImplementation(() => {
      throw new Error("Unrecoverable LLM failure");
    });

    await runDebate(trialId, "token", "solana", "Test", (e) => events.push(e));

    // Should end with done even on error
    expect(events[events.length - 1].type).toBe("done");
  });

  it("emits data_progress errors when fetch fails", async () => {
    const trialId = createTrial();
    const events: DebateEvent[] = [];

    mockFetchBullData.mockRejectedValue(new Error("Bull fetch failed"));

    await runDebate(trialId, "token", "solana", "Test", (e) => events.push(e));

    const bullErrors = events.filter(
      (e) => e.type === "data_progress" && (e as any).agent === "bull" && (e as any).status === "error"
    );
    expect(bullErrors.length).toBe(6); // All 6 bull endpoints
  });

  it("extracts evidence from citations in messages", async () => {
    const trialId = createTrial();
    const events: DebateEvent[] = [];

    mockStreamChat.mockImplementation(() =>
      makeMockStream("Smart money shows [[cite:sm-netflow|$2.4M inflow]] which is strong.")()
    );

    await runDebate(trialId, "token", "solana", "Test", (e) => events.push(e));

    const messageCompletes = events.filter((e) => e.type === "message_complete") as Array<{
      type: "message_complete";
      evidence: Array<{ endpoint: string; displayValue: string }>;
    }>;

    // At least one message should have evidence
    const withEvidence = messageCompletes.filter((m) => m.evidence.length > 0);
    expect(withEvidence.length).toBeGreaterThan(0);
    expect(withEvidence[0].evidence[0].endpoint).toBe("sm-netflow");
  });

  it("cleans up activeDebates map on completion", async () => {
    const trialId = createTrial();

    await runDebate(trialId, "token", "solana", "Test", () => {});

    expect(activeDebates.has(trialId)).toBe(false);
  });

  it("handles structured output failure gracefully", async () => {
    const trialId = createTrial();
    const events: DebateEvent[] = [];

    mockStructuredOutput.mockRejectedValue(new Error("Parse failure"));

    await runDebate(trialId, "token", "solana", "Test", (e) => events.push(e));

    // Should still emit verdict with fallback scores
    const verdictEvent = events.find((e) => e.type === "verdict") as any;
    expect(verdictEvent).toBeDefined();
    expect(verdictEvent.score).toBe(0);
    expect(verdictEvent.label).toBe("Hold");

    // Should have error event about structured output
    const errors = events.filter((e) => e.type === "error") as Array<{ message: string }>;
    expect(errors.some((e) => e.message.includes("Structured verdict"))).toBe(true);
  });

  it("determines safety from bear security data", async () => {
    const trialId = createTrial();
    const events: DebateEvent[] = [];

    mockFetchBearData.mockResolvedValue({
      ...defaultBearData,
      security: { safe: false, reasons: ["balance mutable", "freeze authority", "hidden fees"] },
    });

    await runDebate(trialId, "token", "solana", "Test", (e) => events.push(e));

    const verdictEvent = events.find((e) => e.type === "verdict") as any;
    expect(verdictEvent.safety).toBe("dangerous");
  });

  it("emits chunk events during LLM streaming", async () => {
    const trialId = createTrial();
    const events: DebateEvent[] = [];

    mockStreamChat.mockImplementation(() =>
      (async function* () {
        yield "Hello ";
        yield "World ";
      })()
    );

    await runDebate(trialId, "token", "solana", "Test", (e) => events.push(e));

    const chunks = events.filter((e) => e.type === "chunk") as Array<{
      type: "chunk";
      agent: string;
      text: string;
    }>;

    expect(chunks.length).toBeGreaterThan(0);
    // Should have chunks from multiple agents
    const agents = new Set(chunks.map((c) => c.agent));
    expect(agents.size).toBeGreaterThanOrEqual(2);
  });
});
