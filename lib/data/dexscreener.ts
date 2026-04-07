import { generateCacheKey, getCached, setCache } from "@/lib/cache";
import type { DexScreenerTokenData, DexScreenerResult } from "./types";

const CHAIN_URLS: Record<string, string> = {
  solana: "https://api.dexscreener.com/tokens/v1/solana",
  base: "https://api.dexscreener.com/tokens/v1/base",
  ethereum: "https://api.dexscreener.com/tokens/v1/ethereum",
};

const CACHE_TTL_SECONDS = 120; // 2 minutes

interface DexScreenerPair {
  baseToken: { address: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  priceUsd: string | null;
  liquidity?: { usd: number | null };
  volume?: { h24: number | null };
  fdv?: number | null;
  marketCap?: number | null;
  pairCreatedAt?: number | null;
  info?: { imageUrl?: string; header?: string };
}

/**
 * Fetch token market data from DexScreener (free, no auth).
 * Aggregates liquidity and volume across all pairs.
 * Uses highest-liquidity pair for price, mcap, FDV, and creation date.
 */
export async function getDexScreenerToken(
  tokenAddress: string,
  chain: string = "solana"
): Promise<DexScreenerResult> {
  const cacheKey = generateCacheKey("dexscreener", { tokenAddress, chain });

  // Check cache
  const cached = getCached(cacheKey);
  if (cached !== null) {
    return {
      success: true,
      data: cached as DexScreenerTokenData,
      error: null,
      cached: true,
    };
  }

  try {
    const baseUrl = CHAIN_URLS[chain] || CHAIN_URLS.solana;
    const res = await fetch(`${baseUrl}/${tokenAddress}`, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { success: false, data: null, error: `DexScreener HTTP ${res.status}`, cached: false };
    }

    const pairs = (await res.json()) as DexScreenerPair[];

    if (!Array.isArray(pairs) || pairs.length === 0) {
      return { success: false, data: null, error: "No pairs found on DexScreener", cached: false };
    }

    // Pick highest-liquidity pair for price/mcap/fdv/age
    const best = pairs.reduce((a, b) =>
      (a.liquidity?.usd ?? 0) >= (b.liquidity?.usd ?? 0) ? a : b
    );

    // Aggregate liquidity and volume across all pairs
    const totalLiquidityUsd = pairs.reduce(
      (sum, p) => sum + (p.liquidity?.usd ?? 0),
      0
    );
    const totalVolume24hUsd = pairs.reduce(
      (sum, p) => sum + (p.volume?.h24 ?? 0),
      0
    );

    const createdAtMs = best.pairCreatedAt;
    const pairCreatedAt = createdAtMs
      ? new Date(createdAtMs).toISOString()
      : null;

    // Find image URL from the best pair or any pair that has it
    const imageUrl =
      best.info?.imageUrl ??
      pairs.find((p) => p.info?.imageUrl)?.info?.imageUrl ??
      null;

    const data: DexScreenerTokenData = {
      priceUsd: parseFloat(best.priceUsd ?? "0"),
      liquidityUsd: totalLiquidityUsd,
      volume24hUsd: totalVolume24hUsd,
      fdvUsd: best.fdv ?? null,
      marketCapUsd: best.marketCap ?? null,
      pairCreatedAt,
      imageUrl,
    };

    // Store in cache
    setCache(cacheKey, "dexscreener", { tokenAddress, chain }, data, chain, tokenAddress, CACHE_TTL_SECONDS);

    return { success: true, data, error: null, cached: false };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      cached: false,
    };
  }
}
