import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_DIR = path.join(__dirname, "../../data/test-trial");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "trial.db");

process.env.DATABASE_PATH = TEST_DB_PATH;

import { POST } from "@/app/api/trial/route";
import { getDb, closeDb } from "@/lib/db";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3100/api/trial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function cleanup() {
  closeDb();
  for (const ext of ["", "-wal", "-shm"]) {
    const f = TEST_DB_PATH + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  if (fs.existsSync(TEST_DB_DIR)) fs.rmdirSync(TEST_DB_DIR);
}

beforeEach(() => {
  cleanup();
  getDb(); // ensure schema created
});

afterEach(() => {
  cleanup();
});

describe("POST /api/trial", () => {
  it("creates a trial with valid Solana address", async () => {
    const res = await POST(
      makeRequest({
        tokenAddress: "So11111111111111111111111111111111111111112",
        chain: "solana",
        tokenName: "Wrapped SOL",
        tokenSymbol: "SOL",
      }) as any
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.trialId).toBeDefined();
    expect(data.trialId).toHaveLength(12);
    expect(data.cooldown).toBe(false);
  });

  it("creates a trial with valid EVM address on base", async () => {
    const res = await POST(
      makeRequest({
        tokenAddress: "0x4200000000000000000000000000000000000042",
        chain: "base",
      }) as any
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.trialId).toHaveLength(12);
  });

  it("rejects missing tokenAddress", async () => {
    const res = await POST(makeRequest({ chain: "solana" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("tokenAddress is required");
  });

  it("rejects invalid Solana address", async () => {
    const res = await POST(
      makeRequest({ tokenAddress: "invalid!address", chain: "solana" }) as any
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid solana address");
  });

  it("rejects invalid EVM address", async () => {
    const res = await POST(
      makeRequest({ tokenAddress: "0xZZZZ", chain: "ethereum" }) as any
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid ethereum address");
  });

  it("enforces 30-min cooldown for same token+chain", async () => {
    const addr = "So11111111111111111111111111111111111111112";

    // First trial
    const res1 = await POST(
      makeRequest({ tokenAddress: addr, chain: "solana" }) as any
    );
    expect(res1.status).toBe(201);
    const data1 = await res1.json();

    // Second trial — should hit cooldown
    const res2 = await POST(
      makeRequest({ tokenAddress: addr, chain: "solana" }) as any
    );
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.cooldown).toBe(true);
    expect(data2.trialId).toBe(data1.trialId);
    expect(data2.remainingSeconds).toBeGreaterThan(0);
    expect(data2.remainingSeconds).toBeLessThanOrEqual(1800);
  });

  it("allows same token on different chain", async () => {
    const addr = "So11111111111111111111111111111111111111112";

    const res1 = await POST(
      makeRequest({ tokenAddress: addr, chain: "solana" }) as any
    );
    expect(res1.status).toBe(201);

    // Different chain — should not cooldown
    // Use EVM address for base
    const res2 = await POST(
      makeRequest({
        tokenAddress: "0x4200000000000000000000000000000000000042",
        chain: "base",
      }) as any
    );
    expect(res2.status).toBe(201);
    const data2 = await res2.json();
    expect(data2.cooldown).toBe(false);
  });

  it("allows trial after cooldown expires", async () => {
    const addr = "So11111111111111111111111111111111111111112";
    const db = getDb();

    // Insert an old trial (35 min ago — past cooldown)
    const oldTime = Math.floor(Date.now() / 1000) - 35 * 60;
    db.prepare(
      `INSERT INTO trials (id, token_address, chain, status, created_at)
       VALUES (?, ?, ?, 'completed', ?)`
    ).run("old_trial_001", addr, "solana", oldTime);

    // New trial should work
    const res = await POST(
      makeRequest({ tokenAddress: addr, chain: "solana" }) as any
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.cooldown).toBe(false);
  });

  it("extracts address from Solscan URL", async () => {
    const res = await POST(
      makeRequest({
        tokenAddress:
          "https://solscan.io/token/So11111111111111111111111111111111111111112",
        chain: "solana",
      }) as any
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.trialId).toHaveLength(12);

    // Verify it stored the extracted address
    const db = getDb();
    const trial = db
      .prepare("SELECT token_address FROM trials WHERE id = ?")
      .get(data.trialId) as { token_address: string };
    expect(trial.token_address).toBe(
      "So11111111111111111111111111111111111111112"
    );
  });

  it("stores token name and symbol", async () => {
    const res = await POST(
      makeRequest({
        tokenAddress: "So11111111111111111111111111111111111111112",
        chain: "solana",
        tokenName: "Wrapped SOL",
        tokenSymbol: "SOL",
      }) as any
    );

    const data = await res.json();
    const db = getDb();
    const trial = db
      .prepare("SELECT token_name, token_symbol FROM trials WHERE id = ?")
      .get(data.trialId) as { token_name: string; token_symbol: string };
    expect(trial.token_name).toBe("Wrapped SOL");
    expect(trial.token_symbol).toBe("SOL");
  });

  it("defaults chain to solana for invalid value", async () => {
    const res = await POST(
      makeRequest({
        tokenAddress: "So11111111111111111111111111111111111111112",
        chain: "polygon",
      }) as any
    );

    expect(res.status).toBe(201);

    const data = await res.json();
    const db = getDb();
    const trial = db
      .prepare("SELECT chain FROM trials WHERE id = ?")
      .get(data.trialId) as { chain: string };
    expect(trial.chain).toBe("solana");
  });

  it("rejects invalid JSON body", async () => {
    const res = await POST(
      new Request("http://localhost:3100/api/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }) as any
    );
    expect(res.status).toBe(400);
  });
});
