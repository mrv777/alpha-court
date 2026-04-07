import {
  getSmNetflow,
  getWhoBoughtSold,
  getTokenFlowIntelligence,
  getProfilerPnlSummary,
} from "@/lib/nansen/endpoints";
import { getDexScreenerToken } from "@/lib/data/dexscreener";
import { getJupiterPrice } from "@/lib/data/jupiter";
import type { BullData } from "./types";
import { FAST } from "@/lib/llm";

export { FAST as BULL_MODEL };

// ── Data fetching ──────────────────────────────────────────────────────

/**
 * Fetch all data sources for the Bull agent concurrently.
 * Each source is fail-safe: errors result in null, not thrown exceptions.
 */
export async function fetchBullData(
  tokenAddress: string,
  chain: string
): Promise<BullData> {
  const [smNetflow, whoBought, flowIntelligence, profilerPnl, dexScreener, jupiterPrice] =
    await Promise.all([
      getSmNetflow(chain, tokenAddress).then((r) => (r.success ? r.data : null)),
      getWhoBoughtSold(chain, tokenAddress, "buy").then((r) => (r.success ? r.data : null)),
      getTokenFlowIntelligence(chain, tokenAddress).then((r) => (r.success ? r.data : null)),
      // Use a known top buyer address if available, otherwise skip profiler
      getWhoBoughtSold(chain, tokenAddress, "buy").then((r) => {
        if (r.success && r.data && Array.isArray(r.data) && r.data.length > 0) {
          return getProfilerPnlSummary(r.data[0].address, chain).then((p) =>
            p.success ? p.data : null
          );
        }
        return null;
      }),
      getDexScreenerToken(tokenAddress, chain).then((r) => (r.success ? r.data : null)),
      getJupiterPrice(tokenAddress).then((r) => (r.success ? r.data : null)),
    ]);

  return { smNetflow, whoBought, flowIntelligence, profilerPnl, dexScreener, jupiterPrice };
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
3. Market structure — Price, volume, liquidity from DexScreener supporting upside?
4. Track record — Do top buyers have high win_rate and realized_pnl_usd?

## Citation Rules
- Cite data using this exact format: [[cite:endpoint-name|display value]]
- Example: [[cite:sm-netflow|$2.4M net inflow over 7 days]]
- Only cite data you have been provided. Never fabricate citations.
- Every major claim must have at least one citation.
- NEVER cite "No data available" or empty data sections.
- Every citation's display value must clearly read as a bullish signal, not a raw field name or boolean.

## Style
- Confident but analytical, not reckless
- Lead with your strongest data points
- Acknowledge risks briefly only to reframe them as opportunities
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
  ];

  const user = `## Token: ${tokenName}

Present your opening argument for why traders should BUY this token. Analyze the data below and build a compelling bullish case.

${sections.join("\n\n")}

## Requirements
- Target: 200-300 words
- Cite every key data point using [[cite:endpoint|value]] format
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
  ];

  const user = `## The Bear's Opening Argument
${bearOpening}

## Your Data
${sections.join("\n\n")}

## Task
Deliver a focused rebuttal to The Bear's argument above. Counter their strongest points with your data.

## Requirements
- Target: 150-200 words
- Cite data using [[cite:endpoint|value]] format
- Address the Bear's specific claims directly
- Reframe their risks as opportunities where the data supports it`;

  return { system: BULL_SYSTEM, user };
}
