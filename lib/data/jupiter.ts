import { generateCacheKey, getCached, setCache } from "@/lib/cache";
import type { JupiterPriceData, JupiterResult } from "./types";

const LITE_API = "https://lite-api.jup.ag/price/v3";
const PAID_API = "https://api.jup.ag/price/v3";

const CACHE_TTL_SECONDS = 60; // 1 minute

export const KNOWN_TOKENS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
} as const;

interface JupiterPriceEntry {
  usdPrice: number;
  blockId: number;
  decimals: number;
  priceChange24h: number | null;
  createdAt: string;
  liquidity: number;
}

// lite-api returns flat: { [mint]: entry }
// api.jup.ag may wrap in { data: { [mint]: entry } }
type JupiterRawResponse =
  | Record<string, JupiterPriceEntry>
  | { data: Record<string, JupiterPriceEntry> };

/**
 * Fetch real-time price for a single Solana token mint address.
 * Uses lite-api (no auth) unless JUPITER_API_KEY is set.
 */
export async function getJupiterPrice(
  mintAddress: string
): Promise<JupiterResult> {
  const cacheKey = generateCacheKey("jupiter-price", { mintAddress });

  // Check cache
  const cached = getCached(cacheKey);
  if (cached !== null) {
    return {
      success: true,
      data: cached as JupiterPriceData,
      error: null,
      cached: true,
    };
  }

  try {
    const apiKey = process.env.JUPITER_API_KEY;
    const baseUrl = apiKey ? PAID_API : LITE_API;
    const url = `${baseUrl}?ids=${mintAddress}`;

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return {
        success: false,
        data: null,
        error: `Jupiter API HTTP ${res.status}`,
        cached: false,
      };
    }

    const json = (await res.json()) as JupiterRawResponse;

    // Normalize: unwrap { data: ... } if present
    const raw = json as Record<string, unknown>;
    const entries: Record<string, JupiterPriceEntry> =
      raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
        ? (raw.data as Record<string, JupiterPriceEntry>)
        : (json as Record<string, JupiterPriceEntry>);

    const entry = entries[mintAddress];
    if (!entry?.usdPrice) {
      return {
        success: false,
        data: null,
        error: "Token not found in Jupiter response",
        cached: false,
      };
    }

    const data: JupiterPriceData = {
      usdPrice: entry.usdPrice,
      priceChange24h: entry.priceChange24h ?? null,
    };

    setCache(cacheKey, "jupiter-price", { mintAddress }, data, "solana", mintAddress, CACHE_TTL_SECONDS);

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
