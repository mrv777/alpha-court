import { z } from "zod";
import {
  getTokenInfo,
  getTokenOhlcv,
  getWhoBoughtSold,
  getProfilerPnlSummary,
} from "@/lib/nansen/endpoints";
import type { JudgeData, VerdictScores } from "./types";
import { REASONING } from "@/lib/llm";

export { REASONING as JUDGE_MODEL };

// ── Data fetching ──────────────────────────────────────────────────────

/**
 * Fetch all data sources for the Judge agent concurrently.
 * Each source is fail-safe: errors result in null, not thrown exceptions.
 */
export async function fetchJudgeData(
  tokenAddress: string,
  chain: string
): Promise<JudgeData> {
  const [tokenInfo, ohlcv, whoSold, profilerPnl] = await Promise.all([
    getTokenInfo(tokenAddress, chain).then((r) => (r.success ? r.data : null)),
    getTokenOhlcv(tokenAddress, chain).then((r) => (r.success ? r.data : null)),
    getWhoBoughtSold(chain, tokenAddress, "sell").then((r) => (r.success ? r.data : null)),
    // Use a known top seller address if available, otherwise skip profiler
    getWhoBoughtSold(chain, tokenAddress, "sell").then((r) => {
      if (r.success && r.data && Array.isArray(r.data) && r.data.length > 0) {
        return getProfilerPnlSummary(r.data[0].address, chain).then((p) =>
          p.success ? p.data : null
        );
      }
      return null;
    }),
  ]);

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

## Citation Rules
- Cite data using this exact format: [[cite:endpoint-name|display value]]
- Example: [[cite:token-info|Market cap of $45M with 12,000 holders]]
- Only cite data you have been provided. Never fabricate citations.
- You may also reference X/Twitter or web findings naturally in your text.

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
- Cite your independent data using [[cite:endpoint|value]] format
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
- Cite data using [[cite:endpoint|value]] format
- End with a clear, actionable recommendation
- Be decisive — traders need clarity, not hedging`;

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

export function buildJudgeVerdictStructuredPrompt(verdictText: string): {
  system: string;
  user: string;
} {
  const system = `You extract structured scores from a judge's verdict text. Output only the requested JSON structure.`;

  const user = `## Verdict Text
${verdictText}

## Task
Extract the following from the verdict above:
- score: A number from -100 (extreme sell) to 100 (extreme buy). 0 = neutral/hold.
- label: One of: "Strong Buy", "Buy", "Lean Buy", "Hold", "Lean Sell", "Sell", "Strong Sell"
- summary: A single sentence capturing the verdict (max 50 words)
- bull_conviction: How convincing was the Bull's case? 0-100
- bear_conviction: How convincing was the Bear's case? 0-100`;

  return { system, user };
}
