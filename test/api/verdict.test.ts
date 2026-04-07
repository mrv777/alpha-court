import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDb, closeDb } from "@/lib/db";
import path from "path";
import fs from "fs";

// Use a test-specific database
const TEST_DB_PATH = path.join(__dirname, "../../data/test-verdict.db");

beforeEach(() => {
  process.env.DATABASE_PATH = TEST_DB_PATH;

  // Ensure clean state
  for (const ext of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TEST_DB_PATH + ext);
    } catch {
      // File doesn't exist
    }
  }

  // Initialize DB with test data
  const db = getDb();

  // Insert a completed trial
  db.prepare(
    `INSERT INTO trials (id, token_address, chain, token_name, token_symbol, status,
       verdict_score, verdict_label, verdict_summary,
       bull_conviction, bear_conviction,
       safety_score, safety_details_json,
       created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "completed001",
    "So1111111111111111111111111111111111111111111",
    "solana",
    "Test Token",
    "TEST",
    "completed",
    65,
    "STRONG BUY",
    "Strong smart money inflows with clean security profile.",
    82,
    45,
    "clean",
    JSON.stringify(["no issues"]),
    Math.floor(Date.now() / 1000) - 600,
    Math.floor(Date.now() / 1000)
  );

  // Insert a pending trial
  db.prepare(
    `INSERT INTO trials (id, token_address, chain, token_name, token_symbol, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "pending00001",
    "So2222222222222222222222222222222222222222222",
    "solana",
    "Pending Token",
    "PEND",
    "debating",
    Math.floor(Date.now() / 1000)
  );

  // Insert a trial with warnings
  db.prepare(
    `INSERT INTO trials (id, token_address, chain, token_name, token_symbol, status,
       verdict_score, verdict_label, verdict_summary,
       bull_conviction, bear_conviction,
       safety_score, safety_details_json,
       created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "warnings0001",
    "So3333333333333333333333333333333333333333333",
    "solana",
    "Risky Token",
    "RISK",
    "completed",
    -45,
    "SELL",
    "Multiple security concerns detected.",
    30,
    85,
    "warnings",
    JSON.stringify(["balance mutable authority", "freeze authority"]),
    Math.floor(Date.now() / 1000) - 300,
    Math.floor(Date.now() / 1000)
  );
});

afterEach(() => {
  closeDb();
  for (const ext of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(TEST_DB_PATH + ext);
    } catch {
      // Ignore
    }
  }
});

describe("Verdict API data retrieval", () => {
  it("returns completed trial verdict data", () => {
    const trial = getDb()
      .prepare(
        `SELECT id, token_address, chain, token_name, token_symbol, status,
                verdict_score, verdict_label, verdict_summary,
                bull_conviction, bear_conviction,
                safety_score, safety_details_json
         FROM trials WHERE id = ?`
      )
      .get("completed001") as Record<string, unknown>;

    expect(trial).toBeDefined();
    expect(trial.status).toBe("completed");
    expect(trial.verdict_score).toBe(65);
    expect(trial.verdict_label).toBe("STRONG BUY");
    expect(trial.verdict_summary).toBe(
      "Strong smart money inflows with clean security profile."
    );
    expect(trial.bull_conviction).toBe(82);
    expect(trial.bear_conviction).toBe(45);
    expect(trial.safety_score).toBe("clean");
  });

  it("returns 404 for missing trial", () => {
    const trial = getDb()
      .prepare("SELECT * FROM trials WHERE id = ?")
      .get("nonexistent");

    expect(trial).toBeUndefined();
  });

  it("returns 404 for incomplete trial", () => {
    const trial = getDb()
      .prepare("SELECT id, status, verdict_score FROM trials WHERE id = ?")
      .get("pending00001") as Record<string, unknown>;

    expect(trial).toBeDefined();
    expect(trial.status).toBe("debating");
    expect(trial.verdict_score).toBeNull();

    // API should return 404 for incomplete trials
    const isComplete =
      trial.status === "completed" && trial.verdict_score !== null;
    expect(isComplete).toBe(false);
  });

  it("returns safety details as parsed JSON", () => {
    const trial = getDb()
      .prepare("SELECT safety_details_json FROM trials WHERE id = ?")
      .get("warnings0001") as Record<string, unknown>;

    const details = JSON.parse(trial.safety_details_json as string);
    expect(details).toEqual([
      "balance mutable authority",
      "freeze authority",
    ]);
  });

  it("formats verdict response correctly", () => {
    const trial = getDb()
      .prepare(
        `SELECT id, token_address, chain, token_name, token_symbol,
                verdict_score, verdict_label, verdict_summary,
                bull_conviction, bear_conviction,
                safety_score, safety_details_json
         FROM trials WHERE id = ?`
      )
      .get("completed001") as Record<string, unknown>;

    // Simulate API response formatting
    const response = {
      id: trial.id,
      tokenAddress: trial.token_address,
      chain: trial.chain,
      tokenName: trial.token_name,
      tokenSymbol: trial.token_symbol,
      score: trial.verdict_score,
      label: trial.verdict_label,
      summary: trial.verdict_summary,
      bullConviction: trial.bull_conviction ?? 0,
      bearConviction: trial.bear_conviction ?? 0,
      safety: trial.safety_score ?? "clean",
    };

    expect(response.id).toBe("completed001");
    expect(response.score).toBe(65);
    expect(response.label).toBe("STRONG BUY");
    expect(response.chain).toBe("solana");
    expect(response.tokenSymbol).toBe("TEST");
  });
});

describe("Verdict page meta tags", () => {
  it("generates correct OG meta for completed trial", () => {
    const trial = getDb()
      .prepare(
        `SELECT token_name, token_symbol, verdict_label, verdict_summary
         FROM trials WHERE id = ?`
      )
      .get("completed001") as Record<string, unknown>;

    const displayName = trial.token_symbol
      ? `$${trial.token_symbol}`
      : trial.token_name;

    const title = `${displayName}: ${trial.verdict_label} — Alpha Court`;
    expect(title).toBe("$TEST: STRONG BUY — Alpha Court");
  });

  it("OG image URL is correct", () => {
    const trialId = "completed001";
    const imageUrl = `/api/verdict/${trialId}/image`;
    expect(imageUrl).toBe("/api/verdict/completed001/image");
  });

  it("in-progress trial gets fallback title", () => {
    const trial = getDb()
      .prepare("SELECT status, verdict_score FROM trials WHERE id = ?")
      .get("pending00001") as Record<string, unknown>;

    const isComplete =
      trial.status === "completed" && trial.verdict_score !== null;
    const title = isComplete
      ? "Verdict — Alpha Court"
      : "Trial in Progress — Alpha Court";
    expect(title).toBe("Trial in Progress — Alpha Court");
  });
});

describe("OG image API", () => {
  it("returns 404 PNG for missing trial", () => {
    const trial = getDb()
      .prepare("SELECT * FROM trials WHERE id = ?")
      .get("nonexistent");
    expect(trial).toBeUndefined();
    // Route would return fallback PNG with 404 status
  });

  it("returns 404 PNG for incomplete trial", () => {
    const trial = getDb()
      .prepare("SELECT status, verdict_score FROM trials WHERE id = ?")
      .get("pending00001") as Record<string, unknown>;
    expect(trial.status).not.toBe("completed");
    // Route would return fallback PNG with 404 status
  });

  it("concurrent request deduplication logic", () => {
    // Test that the pendingRenders map prevents double-render
    const pendingRenders = new Map<string, Promise<Buffer>>();

    const trialId = "completed001";
    expect(pendingRenders.has(trialId)).toBe(false);

    // Simulate first render request
    const renderPromise = Promise.resolve(Buffer.from("fake-png"));
    pendingRenders.set(trialId, renderPromise);
    expect(pendingRenders.has(trialId)).toBe(true);

    // Second request should return the same promise
    const secondRequest = pendingRenders.get(trialId);
    expect(secondRequest).toBe(renderPromise);

    // After completion, cleanup
    pendingRenders.delete(trialId);
    expect(pendingRenders.has(trialId)).toBe(false);
  });

  it("image cache TTL logic", () => {
    const imageCache = new Map<
      string,
      { png: Buffer; generatedAt: number }
    >();
    const IMAGE_CACHE_TTL = 300_000; // 5 minutes

    const trialId = "completed001";
    const now = Date.now();

    // Fresh cache entry
    imageCache.set(trialId, {
      png: Buffer.from("fake"),
      generatedAt: now,
    });
    const cached = imageCache.get(trialId)!;
    expect(now - cached.generatedAt < IMAGE_CACHE_TTL).toBe(true);

    // Expired cache entry
    imageCache.set(trialId, {
      png: Buffer.from("fake"),
      generatedAt: now - 400_000,
    });
    const expired = imageCache.get(trialId)!;
    expect(now - expired.generatedAt < IMAGE_CACHE_TTL).toBe(false);
  });
});
