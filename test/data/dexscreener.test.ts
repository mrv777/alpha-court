import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_DIR = path.join(__dirname, "../../data/test-dexscreener");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test.db");

process.env.DATABASE_PATH = TEST_DB_PATH;

import { getDexScreenerToken } from "@/lib/data/dexscreener";
import { getDb, closeDb } from "@/lib/db";

function cleanup() {
  closeDb();
  for (const ext of ["", "-wal", "-shm"]) {
    const f = TEST_DB_PATH + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  if (fs.existsSync(TEST_DB_DIR)) fs.rmdirSync(TEST_DB_DIR);
}

beforeEach(() => {
  cleanup();
  getDb();
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

const MOCK_PAIRS = [
  {
    baseToken: { address: "TOKEN1", symbol: "TK" },
    quoteToken: { address: "USDC", symbol: "USDC" },
    priceUsd: "1.50",
    priceChange: { h1: 2.5, h6: -1.2, h24: 8.3 },
    liquidity: { usd: 50000 },
    volume: { h24: 100000 },
    fdv: 1000000,
    marketCap: 800000,
    pairCreatedAt: 1700000000000,
  },
  {
    baseToken: { address: "TOKEN1", symbol: "TK" },
    quoteToken: { address: "SOL", symbol: "SOL" },
    priceUsd: "1.48",
    priceChange: { h1: 3.1, h6: -0.5, h24: 9.7 },
    liquidity: { usd: 200000 },
    volume: { h24: 300000 },
    fdv: 1000000,
    marketCap: 800000,
    pairCreatedAt: 1700100000000,
  },
];

describe("getDexScreenerToken", () => {
  it("parses multi-pair response and picks highest liquidity", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_PAIRS,
    } as Response);

    const result = await getDexScreenerToken("TOKEN1", "solana");

    expect(result.success).toBe(true);
    expect(result.data).not.toBeNull();
    // Should pick second pair (liquidity 200k > 50k)
    expect(result.data!.priceUsd).toBe(1.48);
    expect(result.data!.priceChangeH1).toBe(3.1);
    expect(result.data!.priceChangeH6).toBe(-0.5);
    expect(result.data!.priceChangeH24).toBe(9.7);
    expect(result.data!.fdvUsd).toBe(1000000);
    expect(result.data!.marketCapUsd).toBe(800000);
  });

  it("aggregates volume and liquidity across pairs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => MOCK_PAIRS,
    } as Response);

    const result = await getDexScreenerToken("TOKEN1", "solana");

    expect(result.data!.liquidityUsd).toBe(250000); // 50k + 200k
    expect(result.data!.volume24hUsd).toBe(400000); // 100k + 300k
  });

  it("converts pairCreatedAt from unix ms to ISO string", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [MOCK_PAIRS[1]],
    } as Response);

    const result = await getDexScreenerToken("TOKEN1", "solana");
    expect(result.data!.pairCreatedAt).toBe(
      new Date(1700100000000).toISOString()
    );
  });

  it("handles empty pairs array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const result = await getDexScreenerToken("TOKEN1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("No pairs found on DexScreener");
  });

  it("handles non-array response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: "not found" }),
    } as Response);

    const result = await getDexScreenerToken("TOKEN1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("No pairs found on DexScreener");
  });

  it("handles HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 429,
    } as Response);

    const result = await getDexScreenerToken("TOKEN1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("DexScreener HTTP 429");
  });

  it("handles network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const result = await getDexScreenerToken("TOKEN1");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Network error");
  });

  it("handles null price/liquidity/fdv gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          baseToken: { address: "TOKEN1", symbol: "TK" },
          quoteToken: { address: "USDC", symbol: "USDC" },
          priceUsd: null,
          liquidity: undefined,
          volume: undefined,
          fdv: null,
          marketCap: null,
          pairCreatedAt: null,
        },
      ],
    } as Response);

    const result = await getDexScreenerToken("TOKEN1");
    expect(result.success).toBe(true);
    expect(result.data!.priceUsd).toBe(0);
    expect(result.data!.liquidityUsd).toBe(0);
    expect(result.data!.volume24hUsd).toBe(0);
    expect(result.data!.priceChangeH1).toBeNull();
    expect(result.data!.priceChangeH6).toBeNull();
    expect(result.data!.priceChangeH24).toBeNull();
    expect(result.data!.fdvUsd).toBeNull();
    expect(result.data!.pairCreatedAt).toBeNull();
  });

  it("caches response on second call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [MOCK_PAIRS[0]],
    } as Response);

    const first = await getDexScreenerToken("CACHED_TOKEN", "solana");
    expect(first.cached).toBe(false);

    const second = await getDexScreenerToken("CACHED_TOKEN", "solana");
    expect(second.cached).toBe(true);
    expect(second.data).toEqual(first.data);

    // fetch should only be called once
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("uses correct URL for different chains", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [MOCK_PAIRS[0]],
    } as Response);

    await getDexScreenerToken("TOKEN1", "base");

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("tokens/v1/base/TOKEN1"),
      expect.anything()
    );
  });
});
