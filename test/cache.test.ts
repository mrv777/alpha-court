import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_DIR = path.join(__dirname, "../data/test-cache");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test.db");

process.env.DATABASE_PATH = TEST_DB_PATH;

import {
  generateCacheKey,
  getCached,
  setCache,
  invalidateCacheForToken,
  getCacheStats,
  pruneExpiredCache,
} from "@/lib/cache";
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
  getDb(); // ensure schema is created
});

afterEach(() => {
  cleanup();
});

describe("generateCacheKey", () => {
  it("produces deterministic keys", () => {
    const key1 = generateCacheKey("token info", { chain: "solana", token: "abc" });
    const key2 = generateCacheKey("token info", { chain: "solana", token: "abc" });
    expect(key1).toBe(key2);
  });

  it("sorts params for determinism", () => {
    const key1 = generateCacheKey("cmd", { b: 2, a: 1 });
    const key2 = generateCacheKey("cmd", { a: 1, b: 2 });
    expect(key1).toBe(key2);
  });

  it("produces different keys for different commands", () => {
    const key1 = generateCacheKey("token info", { chain: "solana" });
    const key2 = generateCacheKey("token ohlcv", { chain: "solana" });
    expect(key1).not.toBe(key2);
  });

  it("produces different keys for different params", () => {
    const key1 = generateCacheKey("cmd", { token: "aaa" });
    const key2 = generateCacheKey("cmd", { token: "bbb" });
    expect(key1).not.toBe(key2);
  });

  it("returns a 64-char hex string (sha256)", () => {
    const key = generateCacheKey("test", {});
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("getCached / setCache", () => {
  it("returns null for missing key", () => {
    expect(getCached("nonexistent")).toBeNull();
  });

  it("stores and retrieves data within TTL", () => {
    const key = generateCacheKey("cmd", { a: 1 });
    setCache(key, "cmd", { a: 1 }, { result: "hello" }, "solana", null, 300);
    const result = getCached(key);
    expect(result).toEqual({ result: "hello" });
  });

  it("returns null for expired entries", () => {
    const db = getDb();
    const key = "expired-key";
    const now = Math.floor(Date.now() / 1000);
    // Insert entry that expired 100s ago
    db.prepare(
      `INSERT INTO nansen_cache (cache_key, command, params_json, response_json, chain, created_at, ttl_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(key, "cmd", "{}", '{"old":true}', "solana", now - 400, 300);

    expect(getCached(key)).toBeNull();
  });

  it("upserts on conflict (updates existing entry)", () => {
    const key = generateCacheKey("cmd", {});
    setCache(key, "cmd", {}, { version: 1 }, "solana", null, 300);
    setCache(key, "cmd", {}, { version: 2 }, "solana", null, 300);

    const result = getCached(key);
    expect(result).toEqual({ version: 2 });

    // Only one row should exist
    const db = getDb();
    const count = db
      .prepare("SELECT COUNT(*) as c FROM nansen_cache WHERE cache_key = ?")
      .get(key) as { c: number };
    expect(count.c).toBe(1);
  });

  it("handles null tokenAddress", () => {
    const key = generateCacheKey("search", { q: "test" });
    setCache(key, "search", { q: "test" }, ["result"], "solana", null, 300);
    expect(getCached(key)).toEqual(["result"]);
  });
});

describe("invalidateCacheForToken", () => {
  it("removes entries matching token address", () => {
    const token = "So11111111111111111111111111111111111111112";
    const key1 = generateCacheKey("cmd1", { token });
    const key2 = generateCacheKey("cmd2", { token });
    const key3 = generateCacheKey("cmd3", { token: "other" });

    setCache(key1, "cmd1", { token }, {}, "solana", token, 300);
    setCache(key2, "cmd2", { token }, {}, "solana", token, 300);
    setCache(key3, "cmd3", { token: "other" }, {}, "solana", "other", 300);

    const removed = invalidateCacheForToken(token);
    expect(removed).toBe(2);
    expect(getCached(key1)).toBeNull();
    expect(getCached(key2)).toBeNull();
    expect(getCached(key3)).not.toBeNull(); // other token untouched
  });

  it("returns 0 when no matching entries", () => {
    expect(invalidateCacheForToken("nonexistent")).toBe(0);
  });
});

describe("getCacheStats", () => {
  it("returns correct counts", () => {
    const stats = getCacheStats();
    expect(stats.totalEntries).toBe(0);
    expect(stats.freshEntries).toBe(0);
    expect(stats.expiredEntries).toBe(0);
  });

  it("counts fresh and expired entries separately", () => {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    // Fresh entry
    setCache(generateCacheKey("fresh", {}), "fresh", {}, {}, "solana", null, 300);

    // Expired entry (manually inserted with old timestamp)
    db.prepare(
      `INSERT INTO nansen_cache (cache_key, command, params_json, response_json, chain, created_at, ttl_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run("old-key", "old", "{}", "{}", "solana", now - 1000, 300);

    const stats = getCacheStats();
    expect(stats.totalEntries).toBe(2);
    expect(stats.freshEntries).toBe(1);
    expect(stats.expiredEntries).toBe(1);
  });
});

describe("pruneExpiredCache", () => {
  it("removes only expired entries", () => {
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    // Fresh entry
    setCache(generateCacheKey("fresh", {}), "fresh", {}, {}, "solana", null, 300);

    // Expired entry
    db.prepare(
      `INSERT INTO nansen_cache (cache_key, command, params_json, response_json, chain, created_at, ttl_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run("old-key", "old", "{}", "{}", "solana", now - 1000, 300);

    const pruned = pruneExpiredCache();
    expect(pruned).toBe(1);
    expect(getCacheStats().totalEntries).toBe(1);
  });
});
