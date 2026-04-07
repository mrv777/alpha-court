import { generateCacheKey, getCached, setCache } from "@/lib/cache";
import type { GoPlusResult, GoPlusSecurityResult } from "./types";

const BASE_URL = "https://api.gopluslabs.io/api/v1/solana/token_security";

const CACHE_TTL_SECONDS = 3600; // 60 minutes

interface GoPlusAuthority {
  address: string;
  malicious_address: number; // 1 = flagged malicious
}

interface GoPlusSecurityField {
  status: string; // "0" or "1"
  authority?: GoPlusAuthority[];
}

interface GoPlusTokenData {
  trusted_token?: number; // 1 = known trusted
  mintable?: GoPlusSecurityField;
  freezable?: GoPlusSecurityField;
  balance_mutable_authority?: GoPlusSecurityField;
  closable?: GoPlusSecurityField;
  non_transferable?: number; // 1 = can't transfer
  transfer_fee?: { max_fee?: number };
  [key: string]: unknown;
}

const SAFE_RESULT: GoPlusResult = { safe: true, reasons: [] };

/**
 * Check if a Solana token has dangerous on-chain properties.
 * Fail-open: API errors return { safe: true }.
 */
export async function checkTokenSecurity(
  tokenAddress: string
): Promise<GoPlusSecurityResult> {
  const cacheKey = generateCacheKey("goplus-security", { tokenAddress });

  // Check cache
  const cached = getCached(cacheKey);
  if (cached !== null) {
    return {
      success: true,
      data: cached as GoPlusResult,
      cached: true,
    };
  }

  try {
    const res = await fetch(
      `${BASE_URL}?contract_addresses=${tokenAddress}`,
      { signal: AbortSignal.timeout(10_000) }
    );

    if (!res.ok) {
      return { success: true, data: SAFE_RESULT, cached: false };
    }

    const json = (await res.json()) as {
      code: number;
      result?: Record<string, GoPlusTokenData>;
    };

    if (json.code !== 1 || !json.result) {
      return { success: true, data: SAFE_RESULT, cached: false };
    }

    const data = json.result[tokenAddress];
    if (!data) {
      // Token not in GoPlus database — fail-open
      return { success: true, data: SAFE_RESULT, cached: false };
    }

    // Trusted tokens skip all checks
    if (data.trusted_token === 1) {
      const result: GoPlusResult = { safe: true, reasons: [] };
      setCache(cacheKey, "goplus-security", { tokenAddress }, result, "solana", tokenAddress, CACHE_TTL_SECONDS);
      return { success: true, data: result, cached: false };
    }

    const reasons: string[] = [];

    // 1. Balance mutable authority
    if (data.balance_mutable_authority?.status === "1") {
      reasons.push("balance mutable authority active");
    }

    // 2. Non-transferable
    if (data.non_transferable === 1) {
      reasons.push("token is non-transferable");
    }

    // 3. Closable
    if (data.closable?.status === "1") {
      reasons.push("token accounts can be closed by authority");
    }

    // 4. Mintable with malicious authority
    if (data.mintable?.status === "1") {
      const hasMalicious = data.mintable.authority?.some(
        (a) => a.malicious_address === 1
      );
      if (hasMalicious) {
        reasons.push("mint authority flagged as malicious");
      }
    }

    // 5. Freezable with malicious authority
    if (data.freezable?.status === "1") {
      const hasMalicious = data.freezable.authority?.some(
        (a) => a.malicious_address === 1
      );
      if (hasMalicious) {
        reasons.push("freeze authority flagged as malicious");
      }
    }

    // 6. Hidden transfer fees
    if (data.transfer_fee && typeof data.transfer_fee.max_fee === "number") {
      if (data.transfer_fee.max_fee > 0) {
        reasons.push(
          `hidden transfer fee detected (max: ${data.transfer_fee.max_fee})`
        );
      }
    }

    const result: GoPlusResult = { safe: reasons.length === 0, reasons };

    setCache(cacheKey, "goplus-security", { tokenAddress }, result, "solana", tokenAddress, CACHE_TTL_SECONDS);

    return { success: true, data: result, cached: false };
  } catch {
    // Fail-open: GoPlus errors should never block the debate
    return { success: true, data: SAFE_RESULT, cached: false };
  }
}
