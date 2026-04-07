import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all data sources
vi.mock("@/lib/nansen/endpoints", () => ({
  getSmNetflow: vi.fn(),
  getWhoBoughtSold: vi.fn(),
  getTokenFlowIntelligence: vi.fn(),
  getProfilerPnlSummary: vi.fn(),
}));

vi.mock("@/lib/data/dexscreener", () => ({
  getDexScreenerToken: vi.fn(),
}));

vi.mock("@/lib/data/jupiter", () => ({
  getJupiterPrice: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  FAST: "grok-4-1-fast-non-reasoning",
}));

import { fetchBullData, buildBullOpeningPrompt, buildBullRebuttalPrompt, BULL_MODEL } from "@/lib/agents/bull";
import * as endpoints from "@/lib/nansen/endpoints";
import * as dex from "@/lib/data/dexscreener";
import * as jup from "@/lib/data/jupiter";
import type { BullData } from "@/lib/agents/types";

function mockAllSuccess() {
  vi.mocked(endpoints.getSmNetflow).mockResolvedValue({
    success: true, data: [{ token_address: "0x1", token_symbol: "TEST", chain: "solana", net_flow_usd: 2400000, inflow_usd: 3000000, outflow_usd: 600000, wallet_count: 15 }], error: null, cached: false, command: "",
  });
  vi.mocked(endpoints.getWhoBoughtSold).mockResolvedValue({
    success: true, data: [{ wallet_address: "wallet1", sm_label: "Smart Money", direction: "buy" as const, amount_usd: 50000, token_address: "0x1", token_symbol: "TEST", chain: "solana", traded_at: "2025-01-01" }], error: null, cached: false, command: "",
  });
  vi.mocked(endpoints.getTokenFlowIntelligence).mockResolvedValue({
    success: true, data: { token_address: "0x1", token_symbol: "TEST", chain: "solana", smart_money_inflow_usd: 3000000, smart_money_outflow_usd: 600000, retail_inflow_usd: 1000000, retail_outflow_usd: 500000, net_flow_usd: 2900000 }, error: null, cached: false, command: "",
  });
  vi.mocked(endpoints.getProfilerPnlSummary).mockResolvedValue({
    success: true, data: { wallet_address: "wallet1", total_pnl_usd: 500000, win_rate: 0.72, total_trades: 150, avg_trade_pnl_usd: 3333, best_trade_pnl_usd: 50000, worst_trade_pnl_usd: -10000 }, error: null, cached: false, command: "",
  });
  vi.mocked(dex.getDexScreenerToken).mockResolvedValue({
    success: true, data: { priceUsd: 0.00034, liquidityUsd: 500000, volume24hUsd: 1200000, fdvUsd: 45000000, marketCapUsd: 30000000, pairCreatedAt: "2024-06-01T00:00:00Z" }, error: null, cached: false,
  });
  vi.mocked(jup.getJupiterPrice).mockResolvedValue({
    success: true, data: { usdPrice: 0.00034, priceChange24h: 15.2 }, error: null, cached: false,
  });
}

describe("BULL_MODEL", () => {
  it("uses FAST model", () => {
    expect(BULL_MODEL).toBe("grok-4-1-fast-non-reasoning");
  });
});

describe("fetchBullData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls all 6 data sources", async () => {
    mockAllSuccess();
    await fetchBullData("0x1", "solana");

    expect(endpoints.getSmNetflow).toHaveBeenCalledWith("solana", "0x1");
    expect(endpoints.getWhoBoughtSold).toHaveBeenCalledWith("solana", "0x1", "buy");
    expect(endpoints.getTokenFlowIntelligence).toHaveBeenCalledWith("solana", "0x1");
    expect(dex.getDexScreenerToken).toHaveBeenCalledWith("0x1", "solana");
    expect(jup.getJupiterPrice).toHaveBeenCalledWith("0x1");
  });

  it("returns null for failed data sources", async () => {
    vi.mocked(endpoints.getSmNetflow).mockResolvedValue({
      success: false, data: null, error: "CLI failed", cached: false, command: "",
    });
    vi.mocked(endpoints.getWhoBoughtSold).mockResolvedValue({
      success: true, data: [], error: null, cached: false, command: "",
    });
    vi.mocked(endpoints.getTokenFlowIntelligence).mockResolvedValue({
      success: false, data: null, error: "timeout", cached: false, command: "",
    });
    vi.mocked(endpoints.getProfilerPnlSummary).mockResolvedValue({
      success: false, data: null, error: "n/a", cached: false, command: "",
    });
    vi.mocked(dex.getDexScreenerToken).mockResolvedValue({
      success: false, data: null, error: "no pairs", cached: false,
    });
    vi.mocked(jup.getJupiterPrice).mockResolvedValue({
      success: false, data: null, error: "not found", cached: false,
    });

    const result = await fetchBullData("0x1", "solana");
    expect(result.smNetflow).toBeNull();
    expect(result.flowIntelligence).toBeNull();
    expect(result.dexScreener).toBeNull();
    expect(result.jupiterPrice).toBeNull();
  });
});

describe("buildBullOpeningPrompt", () => {
  const sampleData: BullData = {
    smNetflow: [{ token_address: "0x1", token_symbol: "TEST", chain: "solana", net_flow_usd: 2400000, inflow_usd: 3000000, outflow_usd: 600000, wallet_count: 15 }],
    whoBought: [{ wallet_address: "w1", sm_label: "SM", direction: "buy", amount_usd: 50000, token_address: "0x1", token_symbol: "TEST", chain: "solana", traded_at: "2025-01-01" }],
    flowIntelligence: null,
    profilerPnl: null,
    dexScreener: { priceUsd: 0.00034, liquidityUsd: 500000, volume24hUsd: 1200000, fdvUsd: 45000000, marketCapUsd: 30000000, pairCreatedAt: "2024-06-01T00:00:00Z" },
    jupiterPrice: { usdPrice: 0.00034, priceChange24h: 15.2 },
  };

  it("includes token name", () => {
    const { user } = buildBullOpeningPrompt(sampleData, "TestToken");
    expect(user).toContain("TestToken");
  });

  it("includes all data sections", () => {
    const { user } = buildBullOpeningPrompt(sampleData, "TestToken");
    expect(user).toContain("Smart Money Net Flow");
    expect(user).toContain("Recent Smart Money Buyers");
    expect(user).toContain("Flow Intelligence");
    expect(user).toContain("DexScreener Market Data");
    expect(user).toContain("Jupiter Real-Time Price");
    expect(user).toContain("Top Buyer PnL Profile");
  });

  it("includes citation instructions in system prompt", () => {
    const { system } = buildBullOpeningPrompt(sampleData, "TestToken");
    expect(system).toContain("[[cite:");
    expect(system).toContain("Never fabricate citations");
  });

  it("includes word target", () => {
    const { user } = buildBullOpeningPrompt(sampleData, "TestToken");
    expect(user).toContain("200-300 words");
  });

  it("handles missing data with clear message", () => {
    const { user } = buildBullOpeningPrompt(sampleData, "TestToken");
    expect(user).toContain("No data available for Flow Intelligence");
    expect(user).toContain("No data available for Top Buyer PnL Profile");
  });

  it("includes actual data as JSON", () => {
    const { user } = buildBullOpeningPrompt(sampleData, "TestToken");
    expect(user).toContain("2400000");
    expect(user).toContain("0.00034");
  });
});

describe("buildBullRebuttalPrompt", () => {
  const sampleData: BullData = {
    smNetflow: [], whoBought: [], flowIntelligence: null,
    profilerPnl: null, dexScreener: null, jupiterPrice: null,
  };

  it("includes bear's opening text", () => {
    const { user } = buildBullRebuttalPrompt(sampleData, "The Bear says this token is risky.");
    expect(user).toContain("The Bear says this token is risky.");
  });

  it("includes word target for rebuttal", () => {
    const { user } = buildBullRebuttalPrompt(sampleData, "bear text");
    expect(user).toContain("150-200 words");
  });

  it("includes citation instructions", () => {
    const { system } = buildBullRebuttalPrompt(sampleData, "bear text");
    expect(system).toContain("[[cite:");
  });
});
