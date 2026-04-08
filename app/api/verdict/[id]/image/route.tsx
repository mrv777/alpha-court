import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getDb } from "@/lib/db";

interface TrialRow {
  id: string;
  token_name: string | null;
  token_symbol: string | null;
  chain: string;
  status: string;
  verdict_score: number | null;
  verdict_label: string | null;
  verdict_summary: string | null;
  bull_conviction: number | null;
  bear_conviction: number | null;
  safety_score: string | null;
  safety_details_json: string | null;
  price_usd: number | null;
  mcap_usd: number | null;
  liquidity_usd: number | null;
}

function getScoreColor(score: number): string {
  if (score >= 60) return "#22c55e";
  if (score >= 20) return "#4ade80";
  if (score > -20) return "#8888a0";
  if (score > -60) return "#f87171";
  return "#ef4444";
}

function truncateSummary(summary: string, maxChars = 220): string {
  if (summary.length <= maxChars) return summary;
  return summary.slice(0, maxChars - 3).trimEnd() + "...";
}

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPrice(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(4)}`;
}

// Cache the logo in memory after first read
let logoCached: string | null = null;

async function getLogoDataUri(): Promise<string | null> {
  if (logoCached) return logoCached;
  try {
    const buf = await readFile(join(process.cwd(), "public/logo.png"));
    logoCached = `data:image/png;base64,${buf.toString("base64")}`;
    return logoCached;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: trialId } = await params;

  const trial = getDb()
    .prepare(
      `SELECT id, token_name, token_symbol, chain, status,
              verdict_score, verdict_label, verdict_summary,
              bull_conviction, bear_conviction,
              safety_score, safety_details_json,
              price_usd, mcap_usd, liquidity_usd
       FROM trials WHERE id = ?`
    )
    .get(trialId) as TrialRow | undefined;

  if (!trial || trial.status !== "completed" || trial.verdict_score === null) {
    return new Response("Trial not found or incomplete", { status: 404 });
  }

  const logoUri = await getLogoDataUri();

  const score = trial.verdict_score;
  const label = trial.verdict_label ?? "HOLD";
  const summary = truncateSummary(trial.verdict_summary ?? "");
  const bullConviction = trial.bull_conviction ?? 50;
  const bearConviction = trial.bear_conviction ?? 50;
  const safety = trial.safety_score ?? "clean";
  const displayName = trial.token_symbol
    ? `$${trial.token_symbol}`
    : trial.token_name ?? "Unknown";

  let safetyReasons: string[] = [];
  if (trial.safety_details_json) {
    try {
      const parsed = JSON.parse(trial.safety_details_json);
      if (Array.isArray(parsed)) safetyReasons = parsed;
      else if (parsed?.reasons) safetyReasons = parsed.reasons;
    } catch {
      // ignore
    }
  }

  const isDangerous = safety === "dangerous";

  const scoreColor = getScoreColor(score);
  const scoreText = score > 0 ? `+${score}` : `${score}`;
  const position = ((score + 100) / 200) * 100;
  const fillFrom = score >= 0 ? 50 : position;
  const fillWidth = score >= 0 ? position - 50 : 50 - position;

  const hasMarketData = trial.price_usd || trial.mcap_usd || trial.liquidity_usd;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          padding: "40px 48px",
          background: "linear-gradient(145deg, #0a0e1a 0%, #141824 50%, #0a0e1a 100%)",
          color: "#f0f0f5",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Accent bar on left edge */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 4,
            height: "100%",
            background: scoreColor,
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {logoUri ? (
              <img
                src={logoUri}
                width={28}
                height={28}
                style={{ borderRadius: 4 }}
              />
            ) : null}
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#f59e0b",
                letterSpacing: 0.5,
              }}
            >
              ALPHA COURT
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 14,
                color: "#555570",
                fontFamily: "monospace",
              }}
            >
              {displayName} on {trial.chain}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#1e1e2e", marginBottom: 24, display: "flex" }} />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flex: 1,
            gap: 40,
            alignItems: "center",
          }}
        >
          {/* Left: score + label + bar */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              minWidth: 220,
            }}
          >
            <div
              style={{
                fontSize: 64,
                fontFamily: "monospace",
                fontWeight: "bold",
                color: scoreColor,
                lineHeight: 1,
              }}
            >
              {scoreText}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: scoreColor,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              {label}
            </div>
            {/* Score bar */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", marginTop: 8 }}>
              <div
                style={{
                  height: 6,
                  width: "100%",
                  background: "#1e1e2e",
                  display: "flex",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: 0,
                    width: 1,
                    height: "100%",
                    background: "#555570",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `${fillFrom}%`,
                    top: 0,
                    width: `${fillWidth}%`,
                    height: "100%",
                    background: scoreColor,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `${position}%`,
                    top: "50%",
                    transform: "translate(-50%,-50%)",
                    width: 2,
                    height: 14,
                    background: scoreColor,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 3,
                }}
              >
                <span style={{ fontSize: 9, fontFamily: "monospace", color: "#555570" }}>-100</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: "#555570" }}>0</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", color: "#555570" }}>+100</span>
              </div>
            </div>

            {/* Dangerous warning under score */}
            {isDangerous && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 12,
                  padding: "4px 12px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                }}
              >
                <span style={{ fontSize: 14 }}>💀</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#ef4444" }}>
                  DANGEROUS{safetyReasons.length > 0 ? ` (${safetyReasons.length})` : ""}
                </span>
              </div>
            )}
          </div>

          {/* Right: summary + conviction + market data */}
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              gap: 20,
            }}
          >
            {/* Summary */}
            <p
              style={{
                fontSize: 18,
                lineHeight: 1.55,
                color: "#c0c0d0",
              }}
            >
              {summary}
            </p>

            {/* Conviction meters */}
            <div style={{ display: "flex", gap: 24 }}>
              {/* Bull */}
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 12, color: "#8888a0" }}>Bull Conviction</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      color: "#22c55e",
                    }}
                  >
                    {bullConviction}%
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "#1e1e2e",
                    display: "flex",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${bullConviction}%`,
                      background: "#22c55e",
                    }}
                  />
                </div>
              </div>
              {/* Bear */}
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 12, color: "#8888a0" }}>Bear Conviction</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      color: "#ef4444",
                    }}
                  >
                    {bearConviction}%
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "#1e1e2e",
                    display: "flex",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${bearConviction}%`,
                      background: "#ef4444",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Market data row */}
            {hasMarketData && (
              <div
                style={{
                  display: "flex",
                  gap: 32,
                  padding: "12px 16px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {trial.price_usd ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 10, color: "#555570", textTransform: "uppercase", letterSpacing: 1 }}>
                      Price
                    </span>
                    <span style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 600, color: "#f0f0f5" }}>
                      {formatPrice(trial.price_usd)}
                    </span>
                  </div>
                ) : null}
                {trial.mcap_usd ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 10, color: "#555570", textTransform: "uppercase", letterSpacing: 1 }}>
                      Market Cap
                    </span>
                    <span style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 600, color: "#f0f0f5" }}>
                      {formatUsd(trial.mcap_usd)}
                    </span>
                  </div>
                ) : null}
                {trial.liquidity_usd ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 10, color: "#555570", textTransform: "uppercase", letterSpacing: 1 }}>
                      Liquidity
                    </span>
                    <span style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 600, color: "#f0f0f5" }}>
                      {formatUsd(trial.liquidity_usd)}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      emoji: "twemoji",
    }
  );
}
