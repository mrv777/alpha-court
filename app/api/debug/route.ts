import { getDb } from "@/lib/db";
import { getCacheStats, pruneExpiredCache } from "@/lib/cache";
import { activeDebates } from "@/lib/debate-engine";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface TrialStats {
  total: number;
  completed: number;
  error: number;
  in_progress: number;
  avg_duration_seconds: number | null;
}

interface RecentError {
  id: string;
  token_symbol: string | null;
  chain: string;
  error_message: string | null;
  created_at: number;
}

interface CacheByEndpoint {
  command: string;
  count: number;
}

export async function GET() {
  if (process.env.DEBUG_ENABLED !== "true") {
    return new Response(null, { status: 404 });
  }

  const db = getDb();

  // Trial stats
  const trialStats = db
    .prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN status NOT IN ('completed', 'error') THEN 1 ELSE 0 END) as in_progress,
        AVG(CASE WHEN completed_at IS NOT NULL THEN completed_at - created_at ELSE NULL END) as avg_duration_seconds
      FROM trials`
    )
    .get() as TrialStats;

  // Recent errors (last 10)
  const recentErrors = db
    .prepare(
      `SELECT id, token_symbol, chain, error_message, created_at
       FROM trials
       WHERE status = 'error'
       ORDER BY created_at DESC
       LIMIT 10`
    )
    .all() as RecentError[];

  // Cache stats
  const cacheStats = getCacheStats();

  // Cache by endpoint
  const cacheByEndpoint = db
    .prepare(
      `SELECT command, COUNT(*) as count
       FROM nansen_cache
       GROUP BY command
       ORDER BY count DESC`
    )
    .all() as CacheByEndpoint[];

  // Active debates
  const activeDebateIds = Array.from(activeDebates.keys());
  const activeDebateDetails = activeDebateIds.map((id) => {
    const debate = activeDebates.get(id)!;
    return {
      trialId: id,
      listenerCount: debate.listeners.size,
    };
  });

  // Prune expired cache entries (housekeeping)
  const pruned = pruneExpiredCache();

  // Read recent log entries
  const logDir = process.env.LOG_PATH || path.join(process.cwd(), "data", "logs");
  const logFile = path.join(logDir, "app.log");
  let logLines: string[] = [];
  let logSizeBytes = 0;
  try {
    const stat = fs.statSync(logFile);
    logSizeBytes = stat.size;
    // Read last 32KB to get recent entries without loading entire file
    const readSize = Math.min(stat.size, 32 * 1024);
    const fd = fs.openSync(logFile, "r");
    const buf = Buffer.alloc(readSize);
    fs.readSync(fd, buf, 0, readSize, Math.max(0, stat.size - readSize));
    fs.closeSync(fd);
    const raw = buf.toString("utf-8");
    const allLines = raw.split("\n").filter(Boolean);
    // If we read from middle of file, drop the first (possibly partial) line
    if (stat.size > readSize) allLines.shift();
    logLines = allLines.slice(-200);
  } catch {
    // No log file yet
  }

  return Response.json({
    timestamp: Math.floor(Date.now() / 1000),
    trials: {
      total: trialStats.total,
      completed: trialStats.completed,
      errored: trialStats.error,
      inProgress: trialStats.in_progress,
      avgDurationSeconds: trialStats.avg_duration_seconds
        ? Math.round(trialStats.avg_duration_seconds)
        : null,
    },
    cache: {
      ...cacheStats,
      byEndpoint: cacheByEndpoint,
      prunedThisRequest: pruned,
    },
    activeDebates: activeDebateDetails,
    recentErrors: recentErrors.map((e) => ({
      id: e.id,
      tokenSymbol: e.token_symbol,
      chain: e.chain,
      error: e.error_message,
      createdAt: e.created_at,
    })),
    logs: {
      sizeBytes: logSizeBytes,
      lines: logLines,
    },
  });
}
