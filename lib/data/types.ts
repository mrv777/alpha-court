/** DexScreener aggregated token data */
export interface DexScreenerTokenData {
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  fdvUsd: number | null;
  marketCapUsd: number | null;
  pairCreatedAt: string | null;
  imageUrl: string | null;
}

export interface DexScreenerResult {
  success: boolean;
  data: DexScreenerTokenData | null;
  error: string | null;
  cached: boolean;
}

/** Jupiter price data */
export interface JupiterPriceData {
  usdPrice: number;
  priceChange24h: number | null;
}

export interface JupiterResult {
  success: boolean;
  data: JupiterPriceData | null;
  error: string | null;
  cached: boolean;
}

/** GoPlus security assessment */
export interface GoPlusResult {
  safe: boolean;
  reasons: string[];
}

export interface GoPlusSecurityResult {
  success: boolean;
  data: GoPlusResult;
  cached: boolean;
}

/** Supported chains */
export type Chain = "solana" | "base" | "ethereum";
