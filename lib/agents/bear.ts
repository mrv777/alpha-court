import {
  getTokenDexTrades,
  getTokenHolders,
  getSmDexTrades,
  getTokenFlows,
} from "@/lib/nansen/endpoints";
import { getDexScreenerToken } from "@/lib/data/dexscreener";
import { checkTokenSecurity } from "@/lib/data/goplus";
import type { BearData } from "./types";
import { FAST } from "@/lib/llm";

export { FAST as BEAR_MODEL };

// ── Data fetching ──────────────────────────────────────────────────────

/**
 * Fetch all data sources for the Bear agent concurrently.
 * Each source is fail-safe: errors result in null, not thrown exceptions.
 */
export async function fetchBearData(
  tokenAddress: string,
  chain: string
): Promise<BearData> {
  const [dexTrades, holders, smDexTrades, tokenFlows, dexScreener, security] =
    await Promise.all([
      getTokenDexTrades(chain, tokenAddress).then((r) => (r.success ? r.data : null)),
      getTokenHolders(chain, tokenAddress).then((r) => (r.success ? r.data : null)),
      getSmDexTrades(chain, tokenAddress).then((r) => (r.success ? r.data : null)),
      getTokenFlows(chain, tokenAddress, "whale").then((r) => (r.success ? r.data : null)),
      getDexScreenerToken(tokenAddress, chain).then((r) => (r.success ? r.data : null)),
      checkTokenSecurity(tokenAddress).then((r) => (r.success ? r.data : null)),
    ]);

  return { dexTrades, holders, smDexTrades, tokenFlows, dexScreener, security };
}

// ── Prompt helpers ─────────────────────────────────────────────────────

function formatDataSection(label: string, data: unknown): string {
  if (data === null || data === undefined) {
    return `### ${label}\nNo data available for ${label}.`;
  }
  return `### ${label}\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
}

// ── System prompt ──────────────────────────────────────────────────────

const BEAR_SYSTEM = `You are The Bear — a skeptical, forensic crypto analyst arguing AGAINST buying a token in a structured debate.

## Your Role
You protect traders from bad entries. You find the risks that others overlook. You back every concern with specific data.

## Analytical Framework
1. Sell pressure analysis — Check sm-dex-trades for labeled wallets (deployers, insiders) selling. Compare sold_volume_usd vs bought_volume_usd in who-bought-sold data.
2. Holder concentration risk — Is supply dangerously concentrated? Look at pct_of_supply for top holders.
3. Smart money exits — Are trader_address_label'd wallets (whales, smart traders) net sellers?
4. Security red flags — Are there on-chain risks from GoPlus (freeze authority, hidden fees, mutable balances)?
5. Liquidity and volume health — Is DexScreener liquidity thin relative to market cap? Can large holders exit safely?

## Citation Rules
- Cite data using this exact format: [[cite:endpoint-name|display value]]
- Example: [[cite:token-holders|Top 10 wallets hold 78% of supply]]
- Only cite data you have been provided. Never fabricate citations.
- Every major claim must have at least one citation.
- NEVER cite "No data available" or empty data sections — absence of data is not evidence.
- Do NOT cite positive security results (e.g., "safe", "safe=true", no red flags) as bearish evidence — only cite actual red flags.
- Every citation's display value must clearly read as a risk or concern, not a raw field name or boolean.

## Style
- Skeptical but analytical, not fearful
- Lead with the most dangerous red flag
- Quantify risks wherever possible
- Frame findings as investor protection, not pessimism`;

// ── Opening prompt ─────────────────────────────────────────────────────

export function buildBearOpeningPrompt(
  data: BearData,
  tokenName: string
): { system: string; user: string } {
  const sections = [
    formatDataSection("DEX Trade Activity (token-dex-trades)", data.dexTrades),
    formatDataSection("Holder Concentration (token-holders)", data.holders),
    formatDataSection("Smart Money DEX Trades (sm-dex-trades)", data.smDexTrades),
    formatDataSection("Whale Flow Patterns (token-flows)", data.tokenFlows),
    formatDataSection("DexScreener Market Data (dexscreener)", data.dexScreener),
    formatDataSection("Security Analysis (goplus)", data.security),
  ];

  const user = `## Token: ${tokenName}

Present your opening argument for why traders should AVOID buying this token. Analyze the data below and identify the key risks.

${sections.join("\n\n")}

## Requirements
- Target: 200-300 words
- Cite every key data point using [[cite:endpoint|value]] format
- Structure: Lead with most critical risk, support with secondary red flags, assess overall risk level`;

  return { system: BEAR_SYSTEM, user };
}

// ── Rebuttal prompt ────────────────────────────────────────────────────

export function buildBearRebuttalPrompt(
  data: BearData,
  bullOpening: string
): { system: string; user: string } {
  const sections = [
    formatDataSection("DEX Trade Activity (token-dex-trades)", data.dexTrades),
    formatDataSection("Holder Concentration (token-holders)", data.holders),
    formatDataSection("Smart Money DEX Trades (sm-dex-trades)", data.smDexTrades),
    formatDataSection("Whale Flow Patterns (token-flows)", data.tokenFlows),
    formatDataSection("DexScreener Market Data (dexscreener)", data.dexScreener),
    formatDataSection("Security Analysis (goplus)", data.security),
  ];

  const user = `## The Bull's Opening Argument
${bullOpening}

## Your Data
${sections.join("\n\n")}

## Task
Deliver a focused rebuttal to The Bull's argument above. Challenge their strongest claims with your data.

## Requirements
- Target: 150-200 words
- Cite data using [[cite:endpoint|value]] format
- Directly address the Bull's specific claims
- Highlight data the Bull conveniently omitted or misrepresented`;

  return { system: BEAR_SYSTEM, user };
}
