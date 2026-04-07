import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all data sources
vi.mock("@/lib/nansen/endpoints", () => ({
  getTokenDexTrades: vi.fn(),
  getTokenHolders: vi.fn(),
  getSmDexTrades: vi.fn(),
  getTokenFlows: vi.fn(),
}));

vi.mock("@/lib/data/dexscreener", () => ({
  getDexScreenerToken: vi.fn(),
}));

vi.mock("@/lib/data/goplus", () => ({
  checkTokenSecurity: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  FAST: "grok-4-1-fast-non-reasoning",
}));

import { fetchBearData, buildBearOpeningPrompt, buildBearRebuttalPrompt, BEAR_MODEL } from "@/lib/agents/bear";
import * as endpoints from "@/lib/nansen/endpoints";
import * as dex from "@/lib/data/dexscreener";
import * as goplus from "@/lib/data/goplus";
import type { BearData } from "@/lib/agents/types";

function mockAllSuccess() {
  vi.mocked(endpoints.getTokenDexTrades).mockResolvedValue({
    success: true, data: [{ transaction_hash: "tx1", trader_address: "w1", trader_address_label: "whale", chain: "solana", token_bought_address: "0x1", token_bought_symbol: "TEST", token_bought_amount: 1000, token_sold_address: "0x2", token_sold_symbol: "USDC", token_sold_amount: 25000, trade_value_usd: 25000, block_timestamp: "2025-01-01" }], error: null, cached: false, command: "",
  });
  vi.mocked(endpoints.getTokenHolders).mockResolvedValue({
    success: true, data: [{ wallet_address: "w1", label: "whale", amount_token: 1000000, amount_usd: 500000, pct_of_supply: 12.5 }], error: null, cached: false, command: "",
  });
  vi.mocked(endpoints.getSmDexTrades).mockResolvedValue({
    success: true, data: [{ trader_address: "w2", trader_address_label: "Smart Money", chain: "solana", token_bought_address: "0x2", token_bought_symbol: "USDC", token_bought_amount: 100000, token_bought_fdv: null, token_bought_market_cap: null, token_bought_age_days: 1000, token_sold_address: "0x1", token_sold_symbol: "TEST", token_sold_amount: 500000, token_sold_fdv: 45000000, token_sold_market_cap: 30000000, token_sold_age_days: 180, trade_value_usd: 100000, transaction_hash: "tx2", block_timestamp: "2025-01-02" }], error: null, cached: false, command: "",
  });
  vi.mocked(endpoints.getTokenFlows).mockResolvedValue({
    success: true, data: [{ wallet_address: "w3", label: "whale", direction: "out" as const, amount_usd: 200000, token_address: "0x1", chain: "solana" }], error: null, cached: false, command: "",
  });
  vi.mocked(dex.getDexScreenerToken).mockResolvedValue({
    success: true, data: { priceUsd: 0.00034, liquidityUsd: 50000, volume24hUsd: 120000, priceChangeH1: -3.5, priceChangeH6: -8.1, priceChangeH24: -12.4, fdvUsd: 45000000, marketCapUsd: 30000000, pairCreatedAt: "2024-12-01T00:00:00Z", imageUrl: null }, error: null, cached: false,
  });
  vi.mocked(goplus.checkTokenSecurity).mockResolvedValue({
    success: true, data: { safe: false, reasons: ["balance mutable authority active"] }, cached: false,
  });
}

describe("BEAR_MODEL", () => {
  it("uses FAST model", () => {
    expect(BEAR_MODEL).toBe("grok-4-1-fast-non-reasoning");
  });
});

describe("fetchBearData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls all 6 data sources", async () => {
    mockAllSuccess();
    await fetchBearData("0x1", "solana");

    expect(endpoints.getTokenDexTrades).toHaveBeenCalledWith("solana", "0x1");
    expect(endpoints.getTokenHolders).toHaveBeenCalledWith("solana", "0x1");
    expect(endpoints.getSmDexTrades).toHaveBeenCalledWith("solana", "0x1");
    expect(endpoints.getTokenFlows).toHaveBeenCalledWith("solana", "0x1", "whale");
    expect(dex.getDexScreenerToken).toHaveBeenCalledWith("0x1", "solana");
    expect(goplus.checkTokenSecurity).toHaveBeenCalledWith("0x1");
  });

  it("returns null for failed data sources", async () => {
    vi.mocked(endpoints.getTokenDexTrades).mockResolvedValue({
      success: false, data: null, error: "failed", cached: false, command: "",
    });
    vi.mocked(endpoints.getTokenHolders).mockResolvedValue({
      success: false, data: null, error: "failed", cached: false, command: "",
    });
    vi.mocked(endpoints.getSmDexTrades).mockResolvedValue({
      success: false, data: null, error: "failed", cached: false, command: "",
    });
    vi.mocked(endpoints.getTokenFlows).mockResolvedValue({
      success: false, data: null, error: "failed", cached: false, command: "",
    });
    vi.mocked(dex.getDexScreenerToken).mockResolvedValue({
      success: false, data: null, error: "failed", cached: false,
    });
    vi.mocked(goplus.checkTokenSecurity).mockResolvedValue({
      success: true, data: { safe: true, reasons: [] }, cached: false,
    });

    const result = await fetchBearData("0x1", "solana");
    expect(result.dexTrades).toBeNull();
    expect(result.holders).toBeNull();
    expect(result.smDexTrades).toBeNull();
    expect(result.tokenFlows).toBeNull();
    expect(result.dexScreener).toBeNull();
    // GoPlus succeeded
    expect(result.security).toEqual({ safe: true, reasons: [] });
  });

  it("returns all data on success", async () => {
    mockAllSuccess();
    const result = await fetchBearData("0x1", "solana");
    expect(result.dexTrades).not.toBeNull();
    expect(result.holders).not.toBeNull();
    expect(result.smDexTrades).not.toBeNull();
    expect(result.tokenFlows).not.toBeNull();
    expect(result.dexScreener).not.toBeNull();
    expect(result.security).not.toBeNull();
    expect(result.security?.safe).toBe(false);
  });
});

describe("buildBearOpeningPrompt", () => {
  const sampleData: BearData = {
    dexTrades: [{ transaction_hash: "tx1", trader_address: "w1", trader_address_label: "whale", chain: "solana", token_bought_address: "0x1", token_bought_symbol: "TEST", token_bought_amount: 1000, token_sold_address: "0x2", token_sold_symbol: "USDC", token_sold_amount: 25000, trade_value_usd: 25000, block_timestamp: "2025-01-01" }],
    holders: [{ wallet_address: "w1", label: "whale", amount_token: 1000000, amount_usd: 500000, pct_of_supply: 78 }],
    smDexTrades: null,
    tokenFlows: null,
    dexScreener: { priceUsd: 0.00034, liquidityUsd: 50000, volume24hUsd: 120000, priceChangeH1: -3.5, priceChangeH6: -8.1, priceChangeH24: -12.4, fdvUsd: 45000000, marketCapUsd: 30000000, pairCreatedAt: "2024-12-01T00:00:00Z", imageUrl: null },
    security: { safe: false, reasons: ["balance mutable authority active"] },
  };

  it("includes token name", () => {
    const { user } = buildBearOpeningPrompt(sampleData, "TestToken");
    expect(user).toContain("TestToken");
  });

  it("includes all data sections", () => {
    const { user } = buildBearOpeningPrompt(sampleData, "TestToken");
    expect(user).toContain("DEX Trade Activity");
    expect(user).toContain("Holder Concentration");
    expect(user).toContain("Smart Money DEX Trades");
    expect(user).toContain("Whale Flow Patterns");
    expect(user).toContain("DexScreener Market Data");
    expect(user).toContain("Security Analysis");
  });

  it("includes risk-focused framework in system prompt", () => {
    const { system } = buildBearOpeningPrompt(sampleData, "TestToken");
    expect(system).toContain("Sell pressure");
    expect(system).toContain("concentration risk");
    expect(system).toContain("Security red flags");
  });

  it("includes word target", () => {
    const { user } = buildBearOpeningPrompt(sampleData, "TestToken");
    expect(user).toContain("200-300 words");
  });

  it("handles missing data with clear message", () => {
    const { user } = buildBearOpeningPrompt(sampleData, "TestToken");
    expect(user).toContain("No data available for Smart Money DEX Trades");
    expect(user).toContain("No data available for Whale Flow Patterns");
  });

  it("includes security risk data", () => {
    const { user } = buildBearOpeningPrompt(sampleData, "TestToken");
    expect(user).toContain("balance mutable authority active");
  });
});

describe("buildBearRebuttalPrompt", () => {
  const sampleData: BearData = {
    dexTrades: [], holders: [], smDexTrades: null,
    tokenFlows: null, dexScreener: null, security: null,
  };

  it("includes bull's opening text", () => {
    const { user } = buildBearRebuttalPrompt(sampleData, "The Bull says this token will moon.");
    expect(user).toContain("The Bull says this token will moon.");
  });

  it("includes word target for rebuttal", () => {
    const { user } = buildBearRebuttalPrompt(sampleData, "bull text");
    expect(user).toContain("150-200 words");
  });

});
