/**
 * Nansen CLI response types.
 * Matched against actual CLI output as of 2026-04-07.
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
  market_cap_usd: number | null;
  net_flow_1h_usd: number;
  net_flow_24h_usd: number;
  net_flow_7d_usd: number;
  net_flow_30d_usd: number;
  trader_count: number;
  token_age_days: number;
  token_sectors: string[];
}

export interface SmDexTrade {
  trader_address: string;
  trader_address_label: string;
  chain: string;
  token_bought_address: string;
  token_bought_symbol: string;
  token_bought_amount: number;
  token_bought_fdv: number | null;
  token_bought_market_cap: number | null;
  token_bought_age_days: number;
  token_sold_address: string;
  token_sold_symbol: string;
  token_sold_amount: number;
  token_sold_fdv: number | null;
  token_sold_market_cap: number | null;
  token_sold_age_days: number;
  trade_value_usd: number;
  transaction_hash: string;
  block_timestamp: string;
}

// ── Token Domain ────────────────────────────────────────────────────

export interface TokenInfo {
  contract_address: string;
  name: string;
  symbol: string;
  logo: string | null;
  spot_metrics: {
    volume_total_usd: number;
    buy_volume_usd: number;
    sell_volume_usd: number;
    total_trades: number;
    [key: string]: unknown;
  } | null;
  token_details: {
    token_deployment_date: string | null;
    website: string | null;
    x: string | null;
    telegram: string | null;
    market_cap: number | null;
    [key: string]: unknown;
  } | null;
}

export interface WhoBoughtSoldEntry {
  address: string;
  address_label: string;
  bought_token_volume: number;
  bought_volume_usd: number;
  sold_token_volume: number;
  sold_volume_usd: number;
  token_trade_volume: number;
  trade_volume_usd: number;
}

export interface TokenFlowIntelligence {
  exchange_net_flow_usd: number;
  exchange_avg_flow_usd: number;
  exchange_wallet_count: number;
  fresh_wallets_net_flow_usd: number;
  fresh_wallets_avg_flow_usd: number;
  fresh_wallets_wallet_count: number;
  public_figure_net_flow_usd: number;
  public_figure_avg_flow_usd: number;
  public_figure_wallet_count: number;
  smart_trader_net_flow_usd: number;
  smart_trader_avg_flow_usd: number;
  smart_trader_wallet_count: number;
  top_pnl_net_flow_usd: number;
  top_pnl_avg_flow_usd: number;
  top_pnl_wallet_count: number;
  whale_net_flow_usd: number;
  whale_avg_flow_usd: number;
  whale_wallet_count: number;
}

export interface TokenDexTrade {
  transaction_hash: string;
  trader_address: string;
  trader_address_label: string;
  chain: string;
  token_bought_address: string;
  token_bought_symbol: string;
  token_bought_amount: number;
  token_sold_address: string;
  token_sold_symbol: string;
  token_sold_amount: number;
  trade_value_usd: number;
  block_timestamp: string;
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
  interval_start: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volume_usd: number;
  market_cap: {
    open: number;
    high: number;
    low: number;
    close: number;
  } | null;
}

// ── Profiler Domain ─────────────────────────────────────────────────

export interface ProfilerPnlSummary {
  realized_pnl_usd: number;
  realized_pnl_percent: number;
  win_rate: number;
  traded_times: number;
  traded_token_count: number;
  top5_tokens: Array<{
    token_address?: string;
    token_symbol?: string;
    pnl_usd?: number;
  }>;
}

// ── Search ──────────────────────────────────────────────────────────

export interface SearchResult {
  token_address: string;
  token_symbol: string;
  token_name: string;
  chain: string;
  market_cap_usd: number | null;
}
