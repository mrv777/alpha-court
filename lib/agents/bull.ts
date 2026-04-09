import {
  getSmNetflow,
  getWhoBoughtSold,
  getTokenFlowIntelligence,
  getProfilerPnlSummary,
} from "@/lib/nansen/endpoints";
import { getDexScreenerToken } from "@/lib/data/dexscreener";
import { getJupiterPrice } from "@/lib/data/jupiter";
import { checkTokenSecurity } from "@/lib/data/goplus";
import { log } from "@/lib/logger";
import type { BullData } from "./types";
import { FAST } from "@/lib/llm";

export { FAST as BULL_MODEL };

// ── Data fetching ──────────────────────────────────────────────────────

/** Wrap a fetch call with timing log */
async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    log.info(`bull endpoint done`, { endpoint: name, durationMs: Date.now() - start });
    return result;
  } catch (err) {
    log.error(`bull endpoint error`, { endpoint: name, durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

/**
 * Fetch all data sources for the Bull agent concurrently.
 * Each source is fail-safe: errors result in null, not thrown exceptions.
 */
export async function fetchBullData(
  tokenAddress: string,
  chain: string
): Promise<BullData> {
  const start = Date.now();
  const [smNetflow, whoBought, flowIntelligence, profilerPnl, dexScreener, jupiterPrice, security] =
    await Promise.all([
      timed("smart-money-netflow", () => getSmNetflow(chain, tokenAddress).then((r) => (r.success ? r.data : null))),
      timed("who-bought-sold-buy", () => getWhoBoughtSold(chain, tokenAddress, "buy").then((r) => (r.success ? r.data : null))),
      timed("flow-intelligence", () => getTokenFlowIntelligence(chain, tokenAddress).then((r) => (r.success ? r.data : null))),
      timed("profiler-pnl-buyers", () =>
        getWhoBoughtSold(chain, tokenAddress, "buy").then((r) => {
          if (r.success && r.data && Array.isArray(r.data) && r.data.length > 0) {
            return getProfilerPnlSummary(r.data[0].address, chain).then((p) =>
              p.success ? p.data : null
            );
          }
          return null;
        })
      ),
      timed("dexscreener-bull", () => getDexScreenerToken(tokenAddress, chain).then((r) => (r.success ? r.data : null))),
      timed("jupiter-price", () => getJupiterPrice(tokenAddress).then((r) => (r.success ? r.data : null))),
      timed("goplus-security", () => checkTokenSecurity(tokenAddress).then((r) => (r.success ? r.data : null))),
    ]);
  log.info("bull fetchBullData complete", { durationMs: Date.now() - start });

  return { smNetflow, whoBought, flowIntelligence, profilerPnl, dexScreener, jupiterPrice, security };
}

// ── Prompt helpers ─────────────────────────────────────────────────────

function formatDataSection(label: string, data: unknown): string {
  if (data === null || data === undefined) {
    return `### ${label}\nNo data available for ${label}.`;
  }
  return `### ${label}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

// ── System prompt ──────────────────────────────────────────────────────

const BULL_SYSTEM = `You are The Bull — a confident, data-driven crypto analyst arguing FOR buying a token in a structured debate.

## Your Role
You advocate for the bullish case. You find opportunity where others see risk. You back every claim with specific data points.

## Analytical Framework
1. Smart money positioning — Are labeled wallets (Token Millionaires, Active Millionaires, whales) net buyers? Check address_label and bought_volume_usd vs sold_volume_usd.
2. Capital flow momentum — Compare net_flow_24h_usd vs net_flow_7d_usd vs net_flow_30d_usd to show acceleration. Highlight fresh_wallets_net_flow_usd and smart_trader_net_flow_usd from flow intelligence.
3. Market structure — Price, volume, liquidity from DexScreener supporting upside? Are priceChangeH1/H6/H24 showing accelerating momentum?
4. Track record — Do top buyers have high win_rate and realized_pnl_usd?
5. Security posture — Review GoPlus security data. If the token is clean, use it to strengthen your case. If there are flags, acknowledge them honestly and explain why they're acceptable or mitigated.

## Tools
You have access to web_search and x_search tools. Use them to find recent news, project announcements, partnerships, exchange listings, or positive sentiment on X/Twitter that supports your bullish case. On-chain data is your primary evidence — search supplements it with real-time context.

## Style
- Confident but analytical, not reckless
- Lead with your strongest data points
- Acknowledge risks (including security flags) to reframe them as opportunities or explain why they're manageable
- Use specific numbers, not vague claims`;

// ── Opening prompt ─────────────────────────────────────────────────────

export function buildBullOpeningPrompt(
  data: BullData,
  tokenName: string
): { system: string; user: string } {
  const sections = [
    formatDataSection("Smart Money Net Flow (sm-netflow)", data.smNetflow),
    formatDataSection("Recent Smart Money Buyers (who-bought-sold)", data.whoBought),
    formatDataSection("Flow Intelligence (flow-intelligence)", data.flowIntelligence),
    formatDataSection("Top Buyer PnL Profile (profiler-pnl)", data.profilerPnl),
    formatDataSection("DexScreener Market Data (dexscreener)", data.dexScreener),
    formatDataSection("Jupiter Real-Time Price (jupiter)", data.jupiterPrice),
    formatDataSection("Security Analysis (goplus)", data.security),
  ];

  const user = `## Token: ${tokenName}

Present your opening argument for why traders should BUY this token. Analyze the data below and build a compelling bullish case.

${sections.join("\n\n")}

## Requirements
- Target: 200-300 words
- Reference specific numbers from the data to back every claim
- Structure: Lead with strongest signal, support with secondary data, briefly address obvious risks`;

  return { system: BULL_SYSTEM, user };
}

// ── Rebuttal prompt ────────────────────────────────────────────────────

export function buildBullRebuttalPrompt(
  data: BullData,
  bearOpening: string
): { system: string; user: string } {
  const sections = [
    formatDataSection("Smart Money Net Flow (sm-netflow)", data.smNetflow),
    formatDataSection("Recent Smart Money Buyers (who-bought-sold)", data.whoBought),
    formatDataSection("Flow Intelligence (flow-intelligence)", data.flowIntelligence),
    formatDataSection("Top Buyer PnL Profile (profiler-pnl)", data.profilerPnl),
    formatDataSection("DexScreener Market Data (dexscreener)", data.dexScreener),
    formatDataSection("Jupiter Real-Time Price (jupiter)", data.jupiterPrice),
    formatDataSection("Security Analysis (goplus)", data.security),
  ];

  const user = `## The Bear's Opening Argument
${bearOpening}

## Your Data
${sections.join("\n\n")}

## Task
Deliver a focused rebuttal to The Bear's argument above. Counter their strongest points with your data.

## Requirements
- Target: 150-200 words
- Reference specific numbers from the data to back every claim
- Address the Bear's specific claims directly
- Reframe their risks as opportunities where the data supports it`;

  return { system: BULL_SYSTEM, user };
}
