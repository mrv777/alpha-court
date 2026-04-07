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
    success: true, data: [{ token_address: "0x1", token_symbol: "TEST", chain: "solana", market_cap_usd: 30000000, net_flow_1h_usd: 100000, net_flow_24h_usd: 2400000, net_flow_7d_usd: 5000000, net_flow_30d_usd: 8000000, trader_count: 15, token_age_days: 180, token_sectors: [] }], error: null, cached: false, command: "",
  });
  vi.mocked(endpoints.getWhoBoughtSold).mockResolvedValue({
    success: true, data: [{ address: "wallet1", address_label: "Smart Money", bought_token_volume: 50000, bought_volume_usd: 50000, sold_token_volume: 0, sold_volume_usd: 0, token_trade_volume: 50000, trade_volume_usd: 50000 }], error: null, cached: false, command: "",
  });
  vi.mocked(endpoints.getTokenFlowIntelligence).mockResolvedValue({
    success: true, data: { exchange_net_flow_usd: -500000, exchange_avg_flow_usd: 100000, exchange_wallet_count: 5, fresh_wallets_net_flow_usd: 1000000, fresh_wallets_avg_flow_usd: 200000, fresh_wallets_wallet_count: 10, public_figure_net_flow_usd: 0, public_figure_avg_flow_usd: 0, public_figure_wallet_count: 0, smart_trader_net_flow_usd: 2400000, smart_trader_avg_flow_usd: 160000, smart_trader_wallet_count: 15, top_pnl_net_flow_usd: 500000, top_pnl_avg_flow_usd: 50000, top_pnl_wallet_count: 10, whale_net_flow_usd: 300000, whale_avg_flow_usd: 100000, whale_wallet_count: 3 }, error: null, cached: false, command: "",
  });
  vi.mocked(endpoints.getProfilerPnlSummary).mockResolvedValue({
    success: true, data: { realized_pnl_usd: 500000, realized_pnl_percent: 72, win_rate: 0.72, traded_times: 150, traded_token_count: 45, top5_tokens: [] }, error: null, cached: false, command: "",
  });
  vi.mocked(dex.getDexScreenerToken).mockResolvedValue({
    success: true, data: { priceUsd: 0.00034, liquidityUsd: 500000, volume24hUsd: 1200000, fdvUsd: 45000000, marketCapUsd: 30000000, pairCreatedAt: "2024-06-01T00:00:00Z", imageUrl: null }, error: null, cached: false,
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
    smNetflow: [{ token_address: "0x1", token_symbol: "TEST", chain: "solana", market_cap_usd: 30000000, net_flow_1h_usd: 100000, net_flow_24h_usd: 2400000, net_flow_7d_usd: 5000000, net_flow_30d_usd: 8000000, trader_count: 15, token_age_days: 180, token_sectors: [] }],
    whoBought: [{ address: "w1", address_label: "SM", bought_token_volume: 50000, bought_volume_usd: 50000, sold_token_volume: 0, sold_volume_usd: 0, token_trade_volume: 50000, trade_volume_usd: 50000 }],
    flowIntelligence: null,
    profilerPnl: null,
    dexScreener: { priceUsd: 0.00034, liquidityUsd: 500000, volume24hUsd: 1200000, fdvUsd: 45000000, marketCapUsd: 30000000, pairCreatedAt: "2024-06-01T00:00:00Z", imageUrl: null },
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

});
