import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_DIR = path.join(__dirname, "../../data/test-search");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "search.db");

process.env.DATABASE_PATH = TEST_DB_PATH;

// Mock the nansen endpoints module
const mockNansenSearch = vi.fn();
vi.mock("@/lib/nansen/endpoints", () => ({
  nansenSearch: (...args: unknown[]) => mockNansenSearch(...args),
}));

// Import after mocks
import { GET } from "@/app/api/token/search/route";
import { closeDb } from "@/lib/db";

function makeRequest(params: Record<string, string>): Request {
  const url = new URL("http://localhost:3100/api/token/search");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString());
}

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
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("GET /api/token/search", () => {
  it("returns empty for short query", async () => {
    const res = await GET(makeRequest({ q: "a" }));
    const data = await res.json();
    expect(data.results).toEqual([]);
  });

  it("returns Nansen results when available", async () => {
    mockNansenSearch.mockResolvedValue({
      success: true,
      data: [
        {
          token_address: "So11111111111111111111111111111111111111112",
          token_symbol: "SOL",
          token_name: "Wrapped SOL",
          chain: "solana",
          market_cap_usd: 80000000000,
        },
      ],
      error: null,
      cached: false,
      command: "research search --query SOL --chain solana",
    });

    const res = await GET(makeRequest({ q: "SOL", chain: "solana" }));
    const data = await res.json();

    expect(data.results).toHaveLength(1);
    expect(data.results[0].token_symbol).toBe("SOL");
    expect(data.results[0].source).toBe("nansen");
    expect(data.source).toBe("nansen");
  });

  it("falls back to DexScreener when Nansen returns empty", async () => {
    mockNansenSearch.mockResolvedValue({
      success: true,
      data: [],
      error: null,
      cached: false,
      command: "research search --query UNKNOWN --chain solana",
    });

    // Mock DexScreener fetch
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pairs: [
            {
              baseToken: {
                address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
                symbol: "BONK",
                name: "Bonk",
              },
              chainId: "solana",
              marketCap: 1500000000,
            },
          ],
        }),
        { status: 200 }
      )
    );

    const res = await GET(makeRequest({ q: "BONK", chain: "solana" }));
    const data = await res.json();

    expect(data.results).toHaveLength(1);
    expect(data.results[0].token_symbol).toBe("BONK");
    expect(data.results[0].source).toBe("dexscreener");
    expect(data.source).toBe("dexscreener");

    fetchSpy.mockRestore();
  });

  it("falls back to DexScreener when Nansen times out (>2s)", async () => {
    // Nansen takes too long
    mockNansenSearch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        success: true,
        data: [{ token_address: "late", token_symbol: "LATE", token_name: "Late", chain: "solana", market_cap_usd: null }],
        error: null,
        cached: false,
        command: "search",
      }), 5000))
    );

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pairs: [
            {
              baseToken: {
                address: "addr123",
                symbol: "FAST",
                name: "Fast Token",
              },
              chainId: "solana",
              marketCap: 500000,
            },
          ],
        }),
        { status: 200 }
      )
    );

    const res = await GET(makeRequest({ q: "test", chain: "solana" }));
    const data = await res.json();

    expect(data.source).toBe("dexscreener");
    expect(data.results[0].token_symbol).toBe("FAST");

    fetchSpy.mockRestore();
  });

  it("returns empty when both sources fail", async () => {
    mockNansenSearch.mockResolvedValue({
      success: false,
      data: null,
      error: "CLI error",
      cached: false,
      command: "search",
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Server Error", { status: 500 })
    );

    const res = await GET(makeRequest({ q: "nothing", chain: "solana" }));
    const data = await res.json();

    expect(data.results).toEqual([]);

    fetchSpy.mockRestore();
  });

  it("deduplicates DexScreener results by address", async () => {
    mockNansenSearch.mockResolvedValue({
      success: true, data: [], error: null, cached: false, command: "search",
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pairs: [
            { baseToken: { address: "addr1", symbol: "TOK", name: "Token" }, chainId: "solana", marketCap: 100 },
            { baseToken: { address: "addr1", symbol: "TOK", name: "Token" }, chainId: "solana", marketCap: 100 },
            { baseToken: { address: "addr2", symbol: "TOK2", name: "Token2" }, chainId: "solana", marketCap: 200 },
          ],
        }),
        { status: 200 }
      )
    );

    const res = await GET(makeRequest({ q: "TOK", chain: "solana" }));
    const data = await res.json();

    expect(data.results).toHaveLength(2);

    fetchSpy.mockRestore();
  });

  it("defaults to solana for invalid chain", async () => {
    mockNansenSearch.mockResolvedValue({
      success: true,
      data: [
        { token_address: "addr", token_symbol: "TEST", token_name: "Test", chain: "solana", market_cap_usd: null },
      ],
      error: null,
      cached: false,
      command: "search",
    });

    const res = await GET(makeRequest({ q: "TEST", chain: "invalid" }));
    const data = await res.json();

    expect(data.results[0].chain).toBe("solana");
    expect(mockNansenSearch).toHaveBeenCalledWith("TEST", "solana");
  });
});
