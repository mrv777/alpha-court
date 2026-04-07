import { createHash } from "crypto";
import { getDb } from "./db";

/**
 * Generate a deterministic cache key from command + params.
 * Uses sha256(command + JSON.stringify(sorted params)).
 */
export function generateCacheKey(
  command: string,
  params: Record<string, unknown> = {}
): string {
  const sortedParams = JSON.stringify(
    Object.keys(params)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {})
  );
  return createHash("sha256").update(command + sortedParams).digest("hex");
}

interface CachedEntry {
  response_json: string;
  created_at: number;
  ttl_seconds: number;
}

/**
 * Get a cached response if it exists and hasn't expired.
 * Returns parsed JSON data or null.
 */
export function getCached(cacheKey: string): unknown | null {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const row = db
    .prepare(
      "SELECT response_json, created_at, ttl_seconds FROM nansen_cache WHERE cache_key = ? AND (created_at + ttl_seconds) > ?"
    )
    .get(cacheKey, now) as CachedEntry | undefined;

  if (!row) return null;

  try {
    return JSON.parse(row.response_json);
  } catch {
    return null;
  }
}

/**
 * Store a response in the cache. Upserts on cache_key conflict.
 */
export function setCache(
  cacheKey: string,
  command: string,
  params: Record<string, unknown>,
  response: unknown,
  chain: string,
  tokenAddress: string | null,
  ttlSeconds: number
): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(
    `INSERT INTO nansen_cache (cache_key, command, params_json, response_json, chain, token_address, created_at, ttl_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       response_json = excluded.response_json,
       created_at = excluded.created_at,
       ttl_seconds = excluded.ttl_seconds`
  ).run(
    cacheKey,
    command,
    JSON.stringify(params),
    JSON.stringify(response),
    chain,
    tokenAddress,
    now,
    ttlSeconds
  );
}

/**
 * Delete all cached entries for a specific token address.
 */
export function invalidateCacheForToken(tokenAddress: string): number {
  const db = getDb();
  const result = db
    .prepare("DELETE FROM nansen_cache WHERE token_address = ?")
    .run(tokenAddress);
  return result.changes;
}

/**
 * Get cache statistics for the debug page.
 */
export function getCacheStats(): {
  totalEntries: number;
  freshEntries: number;
  expiredEntries: number;
} {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const total = db
    .prepare("SELECT COUNT(*) as count FROM nansen_cache")
    .get() as { count: number };

  const fresh = db
    .prepare(
      "SELECT COUNT(*) as count FROM nansen_cache WHERE (created_at + ttl_seconds) > ?"
    )
    .get(now) as { count: number };

  return {
    totalEntries: total.count,
    freshEntries: fresh.count,
    expiredEntries: total.count - fresh.count,
  };
}

/**
 * Remove expired cache entries. Called periodically or on-demand.
 */
export function pruneExpiredCache(): number {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const result = db
    .prepare("DELETE FROM nansen_cache WHERE (created_at + ttl_seconds) <= ?")
    .run(now);
  return result.changes;
}
