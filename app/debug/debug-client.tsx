"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Database, Activity, AlertCircle, Radio, FileText } from "lucide-react";

interface DebugData {
  timestamp: number;
  trials: {
    total: number;
    completed: number;
    errored: number;
    inProgress: number;
    avgDurationSeconds: number | null;
  };
  cache: {
    totalEntries: number;
    freshEntries: number;
    expiredEntries: number;
    byEndpoint: Array<{ command: string; count: number }>;
    prunedThisRequest: number;
  };
  activeDebates: Array<{
    trialId: string;
    listenerCount: number;
  }>;
  recentErrors: Array<{
    id: string;
    tokenSymbol: string | null;
    chain: string;
    error: string | null;
    createdAt: number;
  }>;
  logs: {
    sizeBytes: number;
    lines: string[];
  };
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-court-text",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-court-border bg-court-surface p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`size-4 ${color}`} />
        <span className="text-xs text-court-text-muted uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-mono font-bold ${color}`}>{value}</p>
    </div>
  );
}

export function DebugClient() {
  const [data, setData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<"all" | "info" | "warn" | "error">("all");
  const [logSearch, setLogSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/debug");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="min-h-screen bg-court-bg p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-court-text">
              Alpha Court Debug
            </h1>
            <p className="text-xs text-court-text-dim font-mono">
              {data
                ? `Last updated: ${new Date(data.timestamp * 1000).toLocaleTimeString()}`
                : "Loading..."}
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-court-surface border border-court-border px-3 py-1.5 text-xs text-court-text-muted hover:bg-court-border/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-bear/30 bg-bear/10 p-4 mb-6">
            <p className="text-sm text-bear">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Trial Stats */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-court-text-muted mb-3">
                Trial Stats
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total"
                  value={data.trials.total}
                  icon={Activity}
                  color="text-judge"
                />
                <StatCard
                  label="Completed"
                  value={data.trials.completed}
                  icon={Activity}
                  color="text-bull"
                />
                <StatCard
                  label="Errored"
                  value={data.trials.errored}
                  icon={AlertCircle}
                  color="text-bear"
                />
                <StatCard
                  label="Avg Duration"
                  value={
                    data.trials.avgDurationSeconds
                      ? `${data.trials.avgDurationSeconds}s`
                      : "—"
                  }
                  icon={Activity}
                />
              </div>
            </section>

            {/* Cache Stats */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-court-text-muted mb-3">
                Cache
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                <StatCard
                  label="Total Entries"
                  value={data.cache.totalEntries}
                  icon={Database}
                  color="text-judge"
                />
                <StatCard
                  label="Fresh"
                  value={data.cache.freshEntries}
                  icon={Database}
                  color="text-bull"
                />
                <StatCard
                  label="Expired"
                  value={data.cache.expiredEntries}
                  icon={Database}
                  color="text-court-text-dim"
                />
              </div>

              {data.cache.byEndpoint.length > 0 && (
                <div className="rounded-lg border border-court-border bg-court-surface p-4">
                  <h3 className="text-xs text-court-text-muted uppercase tracking-wider mb-2">
                    By Endpoint
                  </h3>
                  <div className="space-y-1">
                    {data.cache.byEndpoint.map((ep) => (
                      <div
                        key={ep.command}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="font-mono text-court-text-muted">
                          {ep.command}
                        </span>
                        <span className="font-mono text-court-text font-bold">
                          {ep.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Active Debates */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-court-text-muted mb-3">
                Active Debates
              </h2>
              {data.activeDebates.length > 0 ? (
                <div className="rounded-lg border border-court-border bg-court-surface p-4">
                  <div className="space-y-2">
                    {data.activeDebates.map((d) => (
                      <div
                        key={d.trialId}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Radio className="size-3 text-bull animate-pulse" />
                          <span className="font-mono text-court-text">
                            {d.trialId}
                          </span>
                        </div>
                        <span className="text-court-text-dim">
                          {d.listenerCount} listener
                          {d.listenerCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-court-text-dim">
                  No active debates
                </p>
              )}
            </section>

            {/* Recent Errors */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-court-text-muted mb-3">
                Recent Errors
              </h2>
              {data.recentErrors.length > 0 ? (
                <div className="rounded-lg border border-court-border bg-court-surface divide-y divide-court-border">
                  {data.recentErrors.map((err) => (
                    <div key={err.id} className="p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-court-text">
                          {err.id}
                        </span>
                        {err.tokenSymbol && (
                          <span className="text-xs text-court-text-muted">
                            ${err.tokenSymbol}
                          </span>
                        )}
                        <span className="text-xs text-court-text-dim">
                          {err.chain}
                        </span>
                        <span className="ml-auto text-xs text-court-text-dim">
                          {new Date(err.createdAt * 1000).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-bear font-mono break-all">
                        {err.error ?? "Unknown error"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-court-text-dim">No recent errors</p>
              )}
            </section>

            {/* Server Logs */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-court-text-muted">
                    Server Logs
                  </h2>
                  <span className="text-xs text-court-text-dim font-mono">
                    {data.logs.sizeBytes > 0
                      ? `${(data.logs.sizeBytes / 1024).toFixed(1)} KB`
                      : "empty"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Search logs..."
                    className="rounded-md border border-court-border bg-court-bg px-2 py-1 text-xs text-court-text font-mono placeholder:text-court-text-dim focus:outline-none focus:border-judge/50 w-40"
                  />
                  {(["all", "info", "warn", "error"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setLogFilter(level)}
                      className={`rounded px-2 py-0.5 text-xs font-mono transition-colors ${
                        logFilter === level
                          ? level === "error"
                            ? "bg-bear/20 text-bear"
                            : level === "warn"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : level === "info"
                                ? "bg-bull/20 text-bull"
                                : "bg-court-border text-court-text"
                          : "text-court-text-dim hover:text-court-text-muted"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              {data.logs.lines.length > 0 ? (
                <div className="rounded-lg border border-court-border bg-court-surface overflow-hidden">
                  <div className="max-h-96 overflow-y-auto p-3 space-y-0.5">
                    {data.logs.lines
                      .filter((line) => {
                        if (logFilter !== "all") {
                          const levelMatch = line.match(/\[(INFO|WARN|ERROR|DEBUG)]/);
                          if (!levelMatch) return false;
                          if (logFilter !== levelMatch[1].toLowerCase()) return false;
                        }
                        if (logSearch) {
                          return line.toLowerCase().includes(logSearch.toLowerCase());
                        }
                        return true;
                      })
                      .slice(-100)
                      .map((line, i) => {
                        const isError = line.includes("[ERROR]");
                        const isWarn = line.includes("[WARN]");
                        const isDebug = line.includes("[DEBUG]");
                        return (
                          <div
                            key={i}
                            className={`text-xs font-mono break-all leading-relaxed ${
                              isError
                                ? "text-bear"
                                : isWarn
                                  ? "text-yellow-400"
                                  : isDebug
                                    ? "text-court-text-dim"
                                    : "text-court-text-muted"
                            }`}
                          >
                            {line}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-court-text-dim">
                  <FileText className="size-3.5" />
                  <span>No log entries yet</span>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
