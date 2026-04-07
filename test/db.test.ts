import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_DIR = path.join(__dirname, "../data/test");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test.db");

// Point db.ts to our test database
process.env.DATABASE_PATH = TEST_DB_PATH;

// Must import after setting env var
import { getDb, closeDb } from "@/lib/db";

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
});

afterEach(() => {
  cleanup();
});

describe("Database", () => {
  it("auto-creates directory and database file", () => {
    expect(fs.existsSync(TEST_DB_DIR)).toBe(false);
    getDb();
    expect(fs.existsSync(TEST_DB_PATH)).toBe(true);
  });

  it("enables WAL mode", () => {
    const db = getDb();
    const result = db.pragma("journal_mode") as { journal_mode: string }[];
    expect(result[0].journal_mode).toBe("wal");
  });

  it("creates all three tables", () => {
    const db = getDb();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("nansen_cache");
    expect(names).toContain("trials");
    expect(names).toContain("debate_messages");
  });

  it("creates all indexes", () => {
    const db = getDb();
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name"
      )
      .all() as { name: string }[];
    const names = indexes.map((i) => i.name);
    expect(names).toContain("idx_trials_token_chain");
    expect(names).toContain("idx_trials_created");
    expect(names).toContain("idx_debate_messages_trial");
    expect(names).toContain("idx_nansen_cache_key");
  });

  it("inserts and reads from nansen_cache", () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO nansen_cache (cache_key, command, params_json, response_json, chain, created_at, ttl_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run("key1", "token info", "{}", '{"data":"test"}', "solana", Date.now(), 300);

    const row = db
      .prepare("SELECT * FROM nansen_cache WHERE cache_key = ?")
      .get("key1") as Record<string, unknown>;
    expect(row.command).toBe("token info");
    expect(row.chain).toBe("solana");
    expect(row.ttl_seconds).toBe(300);
  });

  it("enforces unique cache_key", () => {
    const db = getDb();
    const insert = db.prepare(
      `INSERT INTO nansen_cache (cache_key, command, params_json, response_json, chain, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    insert.run("dup", "cmd", "{}", "{}", "solana", Date.now());
    expect(() => insert.run("dup", "cmd", "{}", "{}", "solana", Date.now())).toThrow();
  });

  it("inserts and reads trials with nanoid-style id", () => {
    const db = getDb();
    const id = "V1StGXR8_Z5j";
    db.prepare(
      `INSERT INTO trials (id, token_address, chain, status, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, "So11111111111111111111111111111111111111112", "solana", "pending", Date.now());

    const trial = db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as Record<string, unknown>;
    expect(trial.token_address).toBe("So11111111111111111111111111111111111111112");
    expect(trial.status).toBe("pending");
  });

  it("inserts debate_messages with foreign key to trials", () => {
    const db = getDb();
    const trialId = "test_trial_01";
    db.prepare(
      `INSERT INTO trials (id, token_address, chain, status, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(trialId, "addr", "solana", "pending", Date.now());

    db.prepare(
      `INSERT INTO debate_messages (trial_id, agent, phase, content, sequence, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(trialId, "bull", "opening", "Smart money is flowing in...", 1, Date.now());

    const msgs = db
      .prepare("SELECT * FROM debate_messages WHERE trial_id = ?")
      .all(trialId) as Record<string, unknown>[];
    expect(msgs).toHaveLength(1);
    expect(msgs[0].agent).toBe("bull");
    expect(msgs[0].phase).toBe("opening");
  });

  it("enforces foreign key on debate_messages", () => {
    const db = getDb();
    expect(() =>
      db
        .prepare(
          `INSERT INTO debate_messages (trial_id, agent, phase, content, sequence, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run("nonexistent", "bull", "opening", "test", 1, Date.now())
    ).toThrow();
  });

  it("returns same instance on multiple getDb() calls", () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  it("cache TTL logic: fresh vs expired entries", () => {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    // Fresh entry (created 60s ago, TTL 300s)
    db.prepare(
      `INSERT INTO nansen_cache (cache_key, command, params_json, response_json, chain, created_at, ttl_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run("fresh", "cmd", "{}", '{"fresh":true}', "solana", now - 60, 300);

    // Expired entry (created 600s ago, TTL 300s)
    db.prepare(
      `INSERT INTO nansen_cache (cache_key, command, params_json, response_json, chain, created_at, ttl_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run("expired", "cmd", "{}", '{"fresh":false}', "solana", now - 600, 300);

    const fresh = db
      .prepare(
        "SELECT * FROM nansen_cache WHERE cache_key = ? AND (created_at + ttl_seconds) > ?"
      )
      .get("fresh", now) as Record<string, unknown> | undefined;
    expect(fresh).toBeDefined();

    const expired = db
      .prepare(
        "SELECT * FROM nansen_cache WHERE cache_key = ? AND (created_at + ttl_seconds) > ?"
      )
      .get("expired", now) as Record<string, unknown> | undefined;
    expect(expired).toBeUndefined();
  });
});
