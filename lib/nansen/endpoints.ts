import { nansenCliCall } from "./client";
import type {
  NansenCliResult,
  SmNetflowEntry,
  SmDexTrade,
  TokenInfo,
  WhoBoughtSoldEntry,
  TokenFlowIntelligence,
  ProfilerPnlSummary,
  TokenDexTrade,
  TokenHolder,
  TokenFlow,
  TokenOhlcv,
  SearchResult,
} from "./types";

// ── Cache TTLs (seconds) ────────────────────────────────────────────

const SEVEN_DAYS = 604800;

export const TTL = {
  TOKEN_INFO: SEVEN_DAYS,
  OHLCV: SEVEN_DAYS,
  WHO_BOUGHT_SOLD: SEVEN_DAYS,
  DEX_TRADES: SEVEN_DAYS,
  SM_NETFLOW: SEVEN_DAYS,
  SM_DEX_TRADES: SEVEN_DAYS,
  HOLDERS: SEVEN_DAYS,
  FLOWS: SEVEN_DAYS,
  FLOW_INTELLIGENCE: SEVEN_DAYS,
  PROFILER: SEVEN_DAYS,
  SEARCH: SEVEN_DAYS,
} as const;

// ── Bull Endpoints ──────────────────────────────────────────────────

/** Smart money net capital flow direction for a token */
export function getSmNetflow(
  chain: string,
  token: string
): Promise<NansenCliResult<SmNetflowEntry[]>> {
  const command = `research smart-money netflow --chain ${chain} --token ${token} --limit 500`;
  return nansenCliCall(command, {
    ttlSeconds: TTL.SM_NETFLOW,
    chain,
    tokenAddress: token,
    params: { endpoint: "sm-netflow", chain, token },
  });
}

/** Recent smart money buyers or sellers for a token */
export function getWhoBoughtSold(
  chain: string,
  token: string,
  side: "buy" | "sell"
): Promise<NansenCliResult<WhoBoughtSoldEntry[]>> {
  const command = `research token who-bought-sold --chain ${chain} --token ${token} --side ${side} --limit 500`;
  return nansenCliCall(command, {
    ttlSeconds: TTL.WHO_BOUGHT_SOLD,
    chain,
    tokenAddress: token,
    params: { endpoint: "who-bought-sold", chain, token, side },
  });
}

/** Detailed flow by entity label — CLI returns a single-item array, unwrap it */
export async function getTokenFlowIntelligence(
  chain: string,
  token: string
): Promise<NansenCliResult<TokenFlowIntelligence>> {
  const command = `research token flow-intelligence --token ${token} --chain ${chain}`;
  const result = await nansenCliCall<TokenFlowIntelligence[] | TokenFlowIntelligence>(command, {
    ttlSeconds: TTL.FLOW_INTELLIGENCE,
    chain,
    tokenAddress: token,
    params: { endpoint: "flow-intelligence", chain, token },
  });

  // CLI returns a single-item array — unwrap to a flat object
  if (result.success && Array.isArray(result.data) && result.data.length > 0) {
    return { ...result, data: result.data[0] };
  }
  return result as NansenCliResult<TokenFlowIntelligence>;
}

/** Win rate / PnL of a wallet */
export function getProfilerPnlSummary(
  wallet: string,
  chain: string
): Promise<NansenCliResult<ProfilerPnlSummary>> {
  const command = `research profiler pnl-summary --address ${wallet} --chain ${chain}`;
  return nansenCliCall(command, {
    ttlSeconds: TTL.PROFILER,
    chain,
    params: { endpoint: "profiler-pnl", wallet, chain },
  });
}

// ── Bear Endpoints ──────────────────────────────────────────────────

/** DEX trades for a token (sell pressure / volume) */
export function getTokenDexTrades(
  chain: string,
  token: string
): Promise<NansenCliResult<TokenDexTrade[]>> {
  const command = `research token dex-trades --token ${token} --chain ${chain} --limit 500`;
  return nansenCliCall(command, {
    ttlSeconds: TTL.DEX_TRADES,
    chain,
    tokenAddress: token,
    params: { endpoint: "token-dex-trades", chain, token },
  });
}

/** Token holder concentration analysis */
export function getTokenHolders(
  chain: string,
  token: string
): Promise<NansenCliResult<TokenHolder[]>> {
  const command = `research token holders --token ${token} --chain ${chain} --limit 500`;
  return nansenCliCall(command, {
    ttlSeconds: TTL.HOLDERS,
    chain,
    tokenAddress: token,
    params: { endpoint: "token-holders", chain, token },
  });
}

/** Smart money selling activity */
export function getSmDexTrades(
  chain: string,
  token: string
): Promise<NansenCliResult<SmDexTrade[]>> {
  const command = `research smart-money dex-trades --chain ${chain} --token ${token} --limit 500`;
  return nansenCliCall(command, {
    ttlSeconds: TTL.SM_DEX_TRADES,
    chain,
    tokenAddress: token,
    params: { endpoint: "sm-dex-trades", chain, token },
  });
}

/** Whale exit patterns */
export function getTokenFlows(
  chain: string,
  token: string,
  label: string = "whale"
): Promise<NansenCliResult<TokenFlow[]>> {
  const command = `research token flows --token ${token} --chain ${chain} --label ${label} --limit 500`;
  return nansenCliCall(command, {
    ttlSeconds: TTL.FLOWS,
    chain,
    tokenAddress: token,
    params: { endpoint: "token-flows", chain, token, label },
  });
}

// ── Judge Endpoints ─────────────────────────────────────────────────

/** Token metadata (market cap, supply, age) */
export function getTokenInfo(
  token: string,
  chain: string
): Promise<NansenCliResult<TokenInfo>> {
  const command = `research token info --token ${token} --chain ${chain}`;
  return nansenCliCall(command, {
    ttlSeconds: TTL.TOKEN_INFO,
    chain,
    tokenAddress: token,
    params: { endpoint: "token-info", chain, token },
  });
}

/** Price history and trends */
export function getTokenOhlcv(
  token: string,
  chain: string
): Promise<NansenCliResult<TokenOhlcv[]>> {
  const command = `research token ohlcv --token ${token} --chain ${chain}`;
  return nansenCliCall(command, {
    ttlSeconds: TTL.OHLCV,
    chain,
    tokenAddress: token,
    params: { endpoint: "token-ohlcv", chain, token },
  });
}

// ── Shared ──────────────────────────────────────────────────────────

/** Token lookup / autocomplete */
export async function nansenSearch(
  query: string,
  chain: string
): Promise<NansenCliResult<SearchResult[]>> {
  const command = `research search --query "${query}" --chain ${chain}`;

  // The CLI returns { tokens: [...], entities: [], total_results } with different field names
  const result = await nansenCliCall<{
    tokens?: Array<{
      address: string;
      symbol: string;
      name: string;
      chain: string;
      market_cap?: number | null;
    }>;
  }>(command, {
    ttlSeconds: TTL.SEARCH,
    chain,
    params: { endpoint: "search", query, chain },
  });

  if (!result.success || !result.data?.tokens) {
    return { success: false, data: null, error: result.error, cached: result.cached, command };
  }

  const mapped: SearchResult[] = result.data.tokens.map((t) => ({
    token_address: t.address,
    token_symbol: t.symbol,
    token_name: t.name,
    chain: t.chain,
    market_cap_usd: t.market_cap ?? null,
  }));

  return { success: true, data: mapped, error: null, cached: result.cached, command };
}
