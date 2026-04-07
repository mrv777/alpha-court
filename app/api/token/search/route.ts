import { nansenSearch } from "@/lib/nansen/endpoints";
import type { Chain } from "@/lib/data/types";

export interface TokenSearchResult {
  token_address: string;
  token_symbol: string;
  token_name: string;
  chain: string;
  market_cap_usd: number | null;
  /** "nansen" = verified data, "dexscreener" = fallback with limited coverage */
  source: "nansen" | "dexscreener";
}

export interface TokenSearchResponse {
  results: TokenSearchResult[];
  source: "nansen" | "dexscreener" | "both";
}

const VALID_CHAINS = new Set<Chain>(["solana", "base", "ethereum"]);

const DEXSCREENER_CHAIN_MAP: Record<string, string> = {
  solana: "solana",
  base: "base",
  ethereum: "ethereum",
};

/**
 * GET /api/token/search?q=query&chain=solana
 *
 * Primary: Nansen CLI search
 * Fallback: DexScreener search if Nansen is slow (>2s) or returns empty
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const chainParam = url.searchParams.get("chain") || "solana";

  if (!q || q.length < 2) {
    return Response.json({ results: [], source: "nansen" } satisfies TokenSearchResponse);
  }

  const chain = VALID_CHAINS.has(chainParam as Chain) ? (chainParam as Chain) : "solana";

  // Race Nansen against a 2s timeout
  const nansenPromise = nansenSearch(q, chain);
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));

  const nansenResult = await Promise.race([nansenPromise, timeoutPromise]);

  // If Nansen returned results, use them
  if (nansenResult && nansenResult.success && nansenResult.data && nansenResult.data.length > 0) {
    const results: TokenSearchResult[] = nansenResult.data.map((r) => ({
      token_address: r.token_address,
      token_symbol: r.token_symbol,
      token_name: r.token_name,
      chain: r.chain,
      market_cap_usd: r.market_cap_usd,
      source: "nansen" as const,
    }));
    return Response.json({ results, source: "nansen" } satisfies TokenSearchResponse);
  }

  // Fallback: DexScreener search
  try {
    const dexRes = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!dexRes.ok) {
      // If both fail, return empty
      return Response.json({ results: [], source: "dexscreener" } satisfies TokenSearchResponse);
    }

    const dexData = (await dexRes.json()) as {
      pairs?: Array<{
        baseToken: { address: string; symbol: string; name: string };
        chainId: string;
        marketCap?: number | null;
        fdv?: number | null;
      }>;
    };

    const dexChainId = DEXSCREENER_CHAIN_MAP[chain];
    const pairs = dexData.pairs ?? [];

    // Filter to requested chain, deduplicate by address
    const seen = new Set<string>();
    const results: TokenSearchResult[] = [];

    for (const pair of pairs) {
      if (pair.chainId !== dexChainId) continue;
      const addr = pair.baseToken.address;
      if (seen.has(addr)) continue;
      seen.add(addr);

      results.push({
        token_address: addr,
        token_symbol: pair.baseToken.symbol,
        token_name: pair.baseToken.name,
        chain,
        market_cap_usd: pair.marketCap ?? pair.fdv ?? null,
        source: "dexscreener",
      });

      if (results.length >= 10) break;
    }

    return Response.json({ results, source: "dexscreener" } satisfies TokenSearchResponse);
  } catch {
    // Both sources failed
    return Response.json({ results: [], source: "nansen" } satisfies TokenSearchResponse);
  }
}
