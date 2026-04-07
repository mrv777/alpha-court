import { z } from "zod";
import {
  getTokenInfo,
  getTokenOhlcv,
  getWhoBoughtSold,
  getProfilerPnlSummary,
} from "@/lib/nansen/endpoints";
import { log } from "@/lib/logger";
import type { JudgeData, VerdictScores } from "./types";
import { REASONING } from "@/lib/llm";

export { REASONING as JUDGE_MODEL };

// ── Data fetching ──────────────────────────────────────────────────────

/** Wrap a fetch call with timing log */
async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    log.info(`judge endpoint done`, { endpoint: name, durationMs: Date.now() - start });
    return result;
  } catch (err) {
    log.error(`judge endpoint error`, { endpoint: name, durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * Fetch all data sources for the Judge agent concurrently.
 * Each source is fail-safe: errors result in null, not thrown exceptions.
 */
export async function fetchJudgeData(
  tokenAddress: string,
  chain: string
): Promise<JudgeData> {
  const start = Date.now();
  const [tokenInfo, ohlcv, whoSold, profilerPnl] = await Promise.all([
    timed("token-info", () => getTokenInfo(tokenAddress, chain).then((r) => (r.success ? r.data : null))),
    timed("token-ohlcv", () => getTokenOhlcv(tokenAddress, chain).then((r) => (r.success ? r.data : null))),
    timed("who-bought-sold-sell", () => getWhoBoughtSold(chain, tokenAddress, "sell").then((r) => (r.success ? r.data : null))),
    timed("profiler-pnl-sellers", () =>
      getWhoBoughtSold(chain, tokenAddress, "sell").then((r) => {
        if (r.success && r.data && Array.isArray(r.data) && r.data.length > 0) {
          return getProfilerPnlSummary(r.data[0].address, chain).then((p) =>
            p.success ? p.data : null
          );
        }
        return null;
      })
    ),
  ]);
  log.info("judge fetchJudgeData complete", { durationMs: Date.now() - start });

  return { tokenInfo, ohlcv, whoSold, profilerPnl };
}

// ── Prompt helpers ─────────────────────────────────────────────────────

function formatDataSection(label: string, data: unknown): string {
  if (data === null || data === undefined) {
    return `### ${label}\nNo data available for ${label}.`;
  }
  return `### ${label}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

// ── System prompt ──────────────────────────────────────────────────────

const JUDGE_SYSTEM = `You are The Judge — an impartial, authoritative arbiter presiding over a crypto token debate between The Bull and The Bear.

## Your Role
You evaluate evidence quality, not just quantity. You cross-reference claims against your own independent data and real-time information from X/Twitter and the web. You deliver a fair, well-reasoned verdict.

## Analytical Framework
1. Evidence quality — Are claims supported by data, or speculative?
2. Data consistency — Do Bull and Bear's data tell a coherent story?
3. Independent verification — What does your own data show?
4. Real-time sentiment — What does X/Twitter and web say about this token?
5. Risk-reward balance — Weighing upside potential against downside risk

## Style
- Measured and authoritative
- Evaluate each side's strongest arguments fairly
- Call out unsupported claims or cherry-picked data
- Deliver a clear, actionable verdict`;

// ── Cross-examination prompt ───────────────────────────────────────────

export function buildJudgeCrossExamPrompt(
  data: JudgeData,
  bullOpening: string,
  bearOpening: string,
  bullRebuttal: string,
  bearRebuttal: string
): { system: string; user: string } {
  const sections = [
    formatDataSection("Token Info (token-info)", data.tokenInfo),
    formatDataSection("Price History OHLCV (token-ohlcv)", data.ohlcv),
    formatDataSection("Recent Sellers (who-bought-sold)", data.whoSold),
    formatDataSection("Top Seller PnL Profile (profiler-pnl)", data.profilerPnl),
  ];

  const user = `## Full Debate Transcript

### Bull's Opening
${bullOpening}

### Bear's Opening
${bearOpening}

### Bull's Rebuttal
${bullRebuttal}

### Bear's Rebuttal
${bearRebuttal}

## Your Independent Data
${sections.join("\n\n")}

## Task
Cross-examine both sides. Identify the strongest and weakest arguments from each. Note any claims that aren't supported by the data, or data that was conveniently omitted. Use your X/Twitter search and web search tools to cross-reference key claims against real-time sentiment and news.

## Requirements
- Target: 250-350 words
- Reference specific numbers from your independent data to back every claim
- Evaluate each side fairly — acknowledge strong points even from the side you may disagree with
- Flag any unsupported or misleading claims`;

  return { system: JUDGE_SYSTEM, user };
}

// ── Verdict prompt ─────────────────────────────────────────────────────

export function buildJudgeVerdictPrompt(
  data: JudgeData,
  fullTranscript: string
): { system: string; user: string } {
  const sections = [
    formatDataSection("Token Info (token-info)", data.tokenInfo),
    formatDataSection("Price History OHLCV (token-ohlcv)", data.ohlcv),
    formatDataSection("Recent Sellers (who-bought-sold)", data.whoSold),
    formatDataSection("Top Seller PnL Profile (profiler-pnl)", data.profilerPnl),
  ];

  const user = `## Full Trial Transcript
${fullTranscript}

## Your Independent Data
${sections.join("\n\n")}

## Task
Render your final verdict. Weigh all evidence presented during the trial, combined with your own independent data and any X/Twitter or web findings. Deliver a clear, decisive ruling.

## Requirements
- Target: 200-300 words
- Structure: Brief summary of key evidence → Your assessment → Clear verdict
- Reference specific numbers from the data to back every claim
- End with a clear, actionable recommendation
- Be clear and actionable — but proportional. A slight edge should yield a moderate recommendation, not an extreme one. Reserve "Strong Buy/Sell" for overwhelming, unambiguous evidence.
- Your verdict must be consistent with your cross-examination findings. If you flagged significant risks in the cross-examination, your verdict should reflect that caution.`;

  return { system: JUDGE_SYSTEM, user };
}

// ── Structured verdict extraction ──────────────────────────────────────

export const verdictSchema = z.object({
  score: z.number().min(-100).max(100),
  label: z.string(),
  summary: z.string(),
  bull_conviction: z.number().min(0).max(100),
  bear_conviction: z.number().min(0).max(100),
});

export function buildJudgeVerdictStructuredPrompt(verdictText: string, crossExamText?: string): {
  system: string;
  user: string;
} {
  const system = `You extract structured scores from a judge's verdict and cross-examination text. The scores must reflect the overall tone and caveats expressed in BOTH the cross-examination and the final verdict. Output only the requested JSON structure.`;

  const user = `${crossExamText ? `## Cross-Examination Analysis\n${crossExamText}\n\n` : ""}## Final Verdict
${verdictText}

## Task
Extract the following from the verdict above:
- score: A number from -100 (extreme sell) to 100 (extreme buy). 0 = neutral/hold. Calibrate using these ranges:
  - 70 to 100: Strong Buy — overwhelming, unambiguous bullish evidence
  - 40 to 69: Buy — clear bullish edge with manageable risks
  - 10 to 39: Lean Buy — slight bullish edge but notable risks or caveats
  - -9 to 9: Hold — balanced, mixed, or insufficient evidence
  - -39 to -10: Lean Sell — slight bearish edge
  - -69 to -40: Sell — clear bearish evidence
  - -100 to -70: Strong Sell — overwhelming bearish evidence
  If the text mentions significant risks or caveats alongside a bullish/bearish lean, the score should reflect that uncertainty (closer to center, not extreme).
- label: One of: "Strong Buy", "Buy", "Lean Buy", "Hold", "Lean Sell", "Sell", "Strong Sell" — must match the score range above
- summary: A single sentence capturing the verdict (max 50 words)
- bull_conviction: How convincing was the Bull's case? 0-100
- bear_conviction: How convincing was the Bear's case? 0-100`;

  return { system, user };
}
