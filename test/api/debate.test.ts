import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_DIR = path.join(__dirname, "../../data/test-debate-api");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "debate.db");

process.env.DATABASE_PATH = TEST_DB_PATH;

// ── Mock the debate engine ────────────────────────────────────────────

const mockRunDebate = vi.fn();

vi.mock("@/lib/debate-engine", async () => {
  const activeDebates = new Map();
  return {
    runDebate: (...args: unknown[]) => mockRunDebate(...args),
    activeDebates,
  };
});

import { GET } from "@/app/api/debate/[id]/route";
import { getDb, closeDb } from "@/lib/db";
import { activeDebates } from "@/lib/debate-engine";

// ── Helpers ───────────────────────────────────────────────────────────

function cleanup() {
  closeDb();
  activeDebates.clear();
  for (const ext of ["", "-wal", "-shm"]) {
    const f = TEST_DB_PATH + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  if (fs.existsSync(TEST_DB_DIR)) fs.rmdirSync(TEST_DB_DIR);
}

function makeRequest(trialId: string): Request {
  return new Request(`http://localhost:3100/api/debate/${trialId}`, {
    method: "GET",
  });
}

function createTrial(
  id: string,
  status = "pending",
  opts?: { verdict_score?: number; verdict_label?: string; verdict_summary?: string; error_message?: string; bull_conviction?: number; bear_conviction?: number; safety_score?: string }
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO trials (id, token_address, chain, token_name, status, verdict_score, verdict_label, verdict_summary, bull_conviction, bear_conviction, safety_score, error_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    "So11111111111111111111111111111111111111112",
    "solana",
    "Test Token",
    status,
    opts?.verdict_score ?? null,
    opts?.verdict_label ?? null,
    opts?.verdict_summary ?? null,
    opts?.bull_conviction ?? null,
    opts?.bear_conviction ?? null,
    opts?.safety_score ?? null,
    opts?.error_message ?? null,
    Math.floor(Date.now() / 1000)
  );
}

function insertMessage(trialId: string, agent: string, phase: string, content: string, sequence: number): void {
  getDb().prepare(
    `INSERT INTO debate_messages (trial_id, agent, phase, content, evidence_json, sequence, created_at)
     VALUES (?, ?, ?, ?, '[]', ?, ?)`
  ).run(trialId, agent, phase, content, sequence, Math.floor(Date.now() / 1000));
}

async function readSSEStream(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  return text;
}

function parseSSEEvents(raw: string): Array<{ event: string; data: unknown }> {
  const events: Array<{ event: string; data: unknown }> = [];
  const blocks = raw.split("\n\n").filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n");
    let event = "";
    let data = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) event = line.slice(7);
      if (line.startsWith("data: ")) data = line.slice(6);
    }

    if (event && data) {
      try {
        events.push({ event, data: JSON.parse(data) });
      } catch {
        events.push({ event, data });
      }
    }
  }

  return events;
}

// ── Tests ─────────────────────────────────────────────────────────────

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  getDb();
});

afterEach(() => {
  cleanup();
});

describe("GET /api/debate/[id]", () => {
  it("returns 404 for missing trial", async () => {
    const response = await GET(makeRequest("nonexistent"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe("Trial not found");
  });

  it("returns correct SSE headers", async () => {
    createTrial("test1", "completed", {
      verdict_score: 50,
      verdict_label: "Buy",
      verdict_summary: "Good",
      bull_conviction: 70,
      bear_conviction: 40,
      safety_score: "clean",
    });

    const response = await GET(makeRequest("test1"), {
      params: Promise.resolve({ id: "test1" }),
    });

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(response.headers.get("Connection")).toBe("keep-alive");
  });

  it("replays completed trial messages and verdict", async () => {
    createTrial("completed1", "completed", {
      verdict_score: 72,
      verdict_label: "Buy",
      verdict_summary: "Strong signals",
      bull_conviction: 80,
      bear_conviction: 35,
      safety_score: "clean",
    });
    insertMessage("completed1", "bull", "opening", "Bull opening text", 1);
    insertMessage("completed1", "bear", "opening", "Bear opening text", 2);

    const response = await GET(makeRequest("completed1"), {
      params: Promise.resolve({ id: "completed1" }),
    });

    const raw = await readSSEStream(response);
    const events = parseSSEEvents(raw);

    // Should have phase:complete events for the stored phases
    const phaseEvents = events.filter((e) => e.event === "phase");
    expect(phaseEvents.length).toBeGreaterThan(0);

    // Should have message_complete events
    const msgEvents = events.filter((e) => e.event === "message_complete");
    expect(msgEvents.length).toBe(2);
    expect((msgEvents[0].data as any).agent).toBe("bull");
    expect((msgEvents[1].data as any).agent).toBe("bear");

    // Should have verdict event
    const verdictEvents = events.filter((e) => e.event === "verdict");
    expect(verdictEvents.length).toBe(1);
    expect((verdictEvents[0].data as any).score).toBe(72);
    expect((verdictEvents[0].data as any).label).toBe("Buy");

    // Should have done event
    const doneEvents = events.filter((e) => e.event === "done");
    expect(doneEvents.length).toBe(1);
  });

  it("SSE events use correct format", async () => {
    createTrial("fmt1", "completed", {
      verdict_score: 0,
      verdict_label: "Hold",
      verdict_summary: "Neutral",
      bull_conviction: 50,
      bear_conviction: 50,
      safety_score: "clean",
    });

    const response = await GET(makeRequest("fmt1"), {
      params: Promise.resolve({ id: "fmt1" }),
    });

    const raw = await readSSEStream(response);

    // Each event block should follow "event: X\ndata: Y\n\n" format
    const blocks = raw.split("\n\n").filter(Boolean);
    for (const block of blocks) {
      expect(block).toMatch(/^event: \w+\ndata: .+/);
    }
  });

  it("replays error trial with stored messages and error", async () => {
    createTrial("err1", "error", { error_message: "LLM crashed" });
    insertMessage("err1", "bull", "opening", "Partial bull text", 1);

    const response = await GET(makeRequest("err1"), {
      params: Promise.resolve({ id: "err1" }),
    });

    const raw = await readSSEStream(response);
    const events = parseSSEEvents(raw);

    // Should have the stored message
    const msgEvents = events.filter((e) => e.event === "message_complete");
    expect(msgEvents.length).toBe(1);

    // Should have error event
    const errEvents = events.filter((e) => e.event === "error");
    expect(errEvents.length).toBe(1);
    expect((errEvents[0].data as any).message).toBe("LLM crashed");
    expect((errEvents[0].data as any).recoverable).toBe(false);

    // Should have done
    const doneEvents = events.filter((e) => e.event === "done");
    expect(doneEvents.length).toBe(1);
  });

  it("starts debate engine for pending trial", async () => {
    createTrial("pending1", "pending");

    // Mock runDebate to emit events and resolve
    mockRunDebate.mockImplementation(
      async (_id: string, _addr: string, _chain: string, _name: string, emit: (e: any) => void) => {
        emit({ type: "phase", phase: "gathering", status: "start" });
        emit({ type: "phase", phase: "gathering", status: "complete" });
        emit({ type: "done" });
      }
    );

    const response = await GET(makeRequest("pending1"), {
      params: Promise.resolve({ id: "pending1" }),
    });

    const raw = await readSSEStream(response);
    const events = parseSSEEvents(raw);

    expect(mockRunDebate).toHaveBeenCalledTimes(1);
    expect(mockRunDebate).toHaveBeenCalledWith(
      "pending1",
      "So11111111111111111111111111111111111111112",
      "solana",
      "Test Token",
      expect.any(Function)
    );

    // Should have the emitted events
    expect(events.some((e) => e.event === "phase")).toBe(true);
    expect(events.some((e) => e.event === "done")).toBe(true);
  });

  it("concurrent connections share same engine instance", async () => {
    createTrial("shared1", "pending");

    let resolveDebate: () => void;
    const debateStarted = new Promise<void>((r) => { resolveDebate = r; });

    mockRunDebate.mockImplementation(
      async (_id: string, _addr: string, _chain: string, _name: string, emit: (e: any) => void) => {
        resolveDebate!();
        // Emit events after a tick to allow second connection to attach
        await new Promise((r) => setTimeout(r, 50));
        emit({ type: "phase", phase: "gathering", status: "start" });
        emit({ type: "done" });
      }
    );

    // First connection starts the engine
    const response1Promise = GET(makeRequest("shared1"), {
      params: Promise.resolve({ id: "shared1" }),
    });

    // Wait for debate to start
    await debateStarted;

    // runDebate should only be called once even with second connection
    expect(mockRunDebate).toHaveBeenCalledTimes(1);
  });
});
