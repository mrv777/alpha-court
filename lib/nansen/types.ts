/**
 * Nansen CLI response types.
 * Defined from docs — may need adjustment after capturing real CLI output.
 */

// ── CLI wrapper result ──────────────────────────────────────────────

export interface NansenCliResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  cached: boolean;
  command: string;
}

// ── Smart Money Domain ──────────────────────────────────────────────

export interface SmNetflowEntry {
  token_address: string;
  token_symbol: string;
  chain: string;
  net_flow_usd: number;
  inflow_usd: number;
  outflow_usd: number;
  wallet_count: number;
}

export interface SmDexTrade {
  wallet_address: string;
  sm_label: string;
  token_address: string;
  token_symbol: string;
  chain: string;
  direction: "buy" | "sell";
  amount_usd: number;
  tx_hash: string;
  traded_at: string;
}

// ── Token Domain ────────────────────────────────────────────────────

export interface TokenInfo {
  token_address: string;
  token_symbol: string;
  token_name: string;
  chain: string;
  market_cap_usd: number | null;
  liquidity_usd: number | null;
  volume_24h_usd: number | null;
  holder_count: number | null;
  top_10_holder_pct: number | null;
  created_at: string | null;
}

export interface WhoBoughtSoldEntry {
  wallet_address: string;
  sm_label: string;
  direction: "buy" | "sell";
  amount_usd: number;
  token_address: string;
  token_symbol: string;
  chain: string;
  traded_at: string;
}

export interface TokenFlowIntelligence {
  token_address: string;
  token_symbol: string;
  chain: string;
  smart_money_inflow_usd: number;
  smart_money_outflow_usd: number;
  retail_inflow_usd: number;
  retail_outflow_usd: number;
  net_flow_usd: number;
}

export interface TokenDexTrade {
  tx_hash: string;
  wallet_address: string;
  token_address: string;
  token_symbol: string;
  chain: string;
  direction: "buy" | "sell";
  amount_usd: number;
  traded_at: string;
}

export interface TokenHolder {
  wallet_address: string;
  label: string | null;
  amount_token: number;
  amount_usd: number;
  pct_of_supply: number;
}

export interface TokenFlow {
  wallet_address: string;
  label: string;
  direction: "in" | "out";
  amount_usd: number;
  token_address: string;
  chain: string;
}

export interface TokenOhlcv {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Profiler Domain ─────────────────────────────────────────────────

export interface ProfilerPnlSummary {
  wallet_address: string;
  total_pnl_usd: number;
  win_rate: number;
  total_trades: number;
  avg_trade_pnl_usd: number;
  best_trade_pnl_usd: number;
  worst_trade_pnl_usd: number;
}

// ── Search ──────────────────────────────────────────────────────────

export interface SearchResult {
  token_address: string;
  token_symbol: string;
  token_name: string;
  chain: string;
  market_cap_usd: number | null;
}
