import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_DIR = path.join(__dirname, "../../data/test-jupiter");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test.db");

process.env.DATABASE_PATH = TEST_DB_PATH;

import { getJupiterPrice } from "@/lib/data/jupiter";
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
  delete process.env.JUPITER_API_KEY;
});

afterEach(() => {
  cleanup();
});

const MINT = "So11111111111111111111111111111111111111112";

describe("getJupiterPrice", () => {
  it("parses flat response format (lite-api)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        [MINT]: {
          usdPrice: 150.25,
          blockId: 123456,
          decimals: 9,
          priceChange24h: 5.2,
          createdAt: "2024-01-01",
          liquidity: 1000000,
        },
      }),
    } as Response);

    const result = await getJupiterPrice(MINT);

    expect(result.success).toBe(true);
    expect(result.data!.usdPrice).toBe(150.25);
    expect(result.data!.priceChange24h).toBe(5.2);
  });

  it("parses wrapped response format ({ data: ... })", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          [MINT]: {
            usdPrice: 151.00,
            blockId: 123457,
            decimals: 9,
            priceChange24h: -2.1,
            createdAt: "2024-01-01",
            liquidity: 1000000,
          },
        },
      }),
    } as Response);

    const result = await getJupiterPrice(MINT);

    expect(result.success).toBe(true);
    expect(result.data!.usdPrice).toBe(151.00);
    expect(result.data!.priceChange24h).toBe(-2.1);
  });

  it("returns error for unknown token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response);

    const result = await getJupiterPrice("UNKNOWN_TOKEN");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Token not found in Jupiter response");
  });

  it("handles HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await getJupiterPrice(MINT);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Jupiter API HTTP 500");
  });

  it("handles network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Connection refused"));

    const result = await getJupiterPrice(MINT);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Connection refused");
  });

  it("handles null priceChange24h", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        [MINT]: {
          usdPrice: 150.00,
          blockId: 1,
          decimals: 9,
          priceChange24h: null,
          createdAt: "2024-01-01",
          liquidity: 1000,
        },
      }),
    } as Response);

    const result = await getJupiterPrice(MINT);
    expect(result.data!.priceChange24h).toBeNull();
  });

  it("uses lite-api by default", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        [MINT]: { usdPrice: 1, blockId: 1, decimals: 9, priceChange24h: null, createdAt: "", liquidity: 0 },
      }),
    } as Response);

    await getJupiterPrice(MINT);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("lite-api.jup.ag"),
      expect.anything()
    );
  });

  it("uses paid API when JUPITER_API_KEY is set", async () => {
    process.env.JUPITER_API_KEY = "test-key";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        [MINT]: { usdPrice: 1, blockId: 1, decimals: 9, priceChange24h: null, createdAt: "", liquidity: 0 },
      }),
    } as Response);

    await getJupiterPrice(MINT);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("api.jup.ag"),
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "test-key" }),
      })
    );
  });

  it("caches response on second call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        [MINT]: { usdPrice: 100, blockId: 1, decimals: 9, priceChange24h: 1.5, createdAt: "", liquidity: 0 },
      }),
    } as Response);

    const first = await getJupiterPrice(MINT);
    expect(first.cached).toBe(false);

    const second = await getJupiterPrice(MINT);
    expect(second.cached).toBe(true);
    expect(second.data).toEqual(first.data);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
