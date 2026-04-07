import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all data sources
vi.mock("@/lib/nansen/endpoints", () => ({
  getTokenInfo: vi.fn(),
  getTokenOhlcv: vi.fn(),
  getWhoBoughtSold: vi.fn(),
  getProfilerPnlSummary: vi.fn(),
}));

vi.mock("@/lib/llm", () => ({
  REASONING: "grok-4-1-fast-reasoning",
}));

import {
  fetchJudgeData,
  buildJudgeCrossExamPrompt,
  buildJudgeVerdictPrompt,
  buildJudgeVerdictStructuredPrompt,
  verdictSchema,
  JUDGE_MODEL,
} from "@/lib/agents/judge";
import * as endpoints from "@/lib/nansen/endpoints";
import type { JudgeData } from "@/lib/agents/types";

function mockAllSuccess() {
  vi.mocked(endpoints.getTokenInfo).mockResolvedValue({
    success: true,
    data: {
      contract_address: "0x1", symbol: "TEST", name: "TestToken",
      logo: null, spot_metrics: { volume_total_usd: 1200000, buy_volume_usd: 700000, sell_volume_usd: 500000, total_trades: 5000 },
      token_details: { token_deployment_date: "2024-06-01", website: null, x: null, telegram: null, market_cap: 30000000 },
    },
    error: null, cached: false, command: "",
  });
  vi.mocked(endpoints.getTokenOhlcv).mockResolvedValue({
    success: true,
    data: [
      { interval_start: "2025-01-01", open: 0.0003, high: 0.00035, low: 0.00028, close: 0.00034, volume: 1200000, volume_usd: 1200000, market_cap: null },
    ],
    error: null, cached: false, command: "",
  });
  vi.mocked(endpoints.getWhoBoughtSold).mockResolvedValue({
    success: true,
    data: [{ address: "w1", address_label: "SM", bought_token_volume: 0, bought_volume_usd: 0, sold_token_volume: 75000, sold_volume_usd: 75000, token_trade_volume: 75000, trade_volume_usd: 75000 }],
    error: null, cached: false, command: "",
  });
  vi.mocked(endpoints.getProfilerPnlSummary).mockResolvedValue({
    success: true,
    data: { realized_pnl_usd: 250000, realized_pnl_percent: 65, win_rate: 0.65, traded_times: 80, traded_token_count: 30, top5_tokens: [] },
    error: null, cached: false, command: "",
  });
}

describe("JUDGE_MODEL", () => {
  it("uses REASONING model", () => {
    expect(JUDGE_MODEL).toBe("grok-4-1-fast-reasoning");
  });
});

describe("fetchJudgeData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls correct data sources", async () => {
    mockAllSuccess();
    await fetchJudgeData("0x1", "solana");

    expect(endpoints.getTokenInfo).toHaveBeenCalledWith("0x1", "solana");
    expect(endpoints.getTokenOhlcv).toHaveBeenCalledWith("0x1", "solana");
    expect(endpoints.getWhoBoughtSold).toHaveBeenCalledWith("solana", "0x1", "sell");
  });

  it("returns null for failed data sources", async () => {
    vi.mocked(endpoints.getTokenInfo).mockResolvedValue({
      success: false, data: null, error: "failed", cached: false, command: "",
    });
    vi.mocked(endpoints.getTokenOhlcv).mockResolvedValue({
      success: false, data: null, error: "failed", cached: false, command: "",
    });
    vi.mocked(endpoints.getWhoBoughtSold).mockResolvedValue({
      success: false, data: null, error: "failed", cached: false, command: "",
    });
    vi.mocked(endpoints.getProfilerPnlSummary).mockResolvedValue({
      success: false, data: null, error: "n/a", cached: false, command: "",
    });

    const result = await fetchJudgeData("0x1", "solana");
    expect(result.tokenInfo).toBeNull();
    expect(result.ohlcv).toBeNull();
    expect(result.whoSold).toBeNull();
  });

  it("returns all data on success", async () => {
    mockAllSuccess();
    const result = await fetchJudgeData("0x1", "solana");
    expect(result.tokenInfo).not.toBeNull();
    expect(result.ohlcv).not.toBeNull();
    expect(result.whoSold).not.toBeNull();
  });
});

describe("buildJudgeCrossExamPrompt", () => {
  const sampleData: JudgeData = {
    tokenInfo: {
      contract_address: "0x1", symbol: "TEST", name: "TestToken",
      logo: null, spot_metrics: { volume_total_usd: 1200000, buy_volume_usd: 700000, sell_volume_usd: 500000, total_trades: 5000 },
      token_details: { token_deployment_date: "2024-06-01", website: null, x: null, telegram: null, market_cap: 30000000 },
    },
    ohlcv: [{ interval_start: "2025-01-01", open: 0.0003, high: 0.00035, low: 0.00028, close: 0.00034, volume: 1200000, volume_usd: 1200000, market_cap: null }],
    whoSold: null,
    profilerPnl: null,
  };

  it("includes full debate transcript", () => {
    const { user } = buildJudgeCrossExamPrompt(
      sampleData, "bull opening", "bear opening", "bull rebuttal", "bear rebuttal"
    );
    expect(user).toContain("bull opening");
    expect(user).toContain("bear opening");
    expect(user).toContain("bull rebuttal");
    expect(user).toContain("bear rebuttal");
  });

  it("includes all data sections", () => {
    const { user } = buildJudgeCrossExamPrompt(
      sampleData, "bo", "beo", "br", "ber"
    );
    expect(user).toContain("Token Info");
    expect(user).toContain("Price History OHLCV");
    expect(user).toContain("Recent Sellers");
    expect(user).toContain("Top Seller PnL Profile");
  });

  it("includes word target", () => {
    const { user } = buildJudgeCrossExamPrompt(
      sampleData, "bo", "beo", "br", "ber"
    );
    expect(user).toContain("250-350 words");
  });

  it("mentions X/Twitter search capability", () => {
    const { user } = buildJudgeCrossExamPrompt(
      sampleData, "bo", "beo", "br", "ber"
    );
    expect(user).toContain("X/Twitter");
  });
});

describe("buildJudgeVerdictPrompt", () => {
  const sampleData: JudgeData = {
    tokenInfo: null, ohlcv: null, whoSold: null, profilerPnl: null,
  };

  it("includes full transcript", () => {
    const { user } = buildJudgeVerdictPrompt(sampleData, "full transcript here");
    expect(user).toContain("full transcript here");
  });

  it("includes word target", () => {
    const { user } = buildJudgeVerdictPrompt(sampleData, "transcript");
    expect(user).toContain("200-300 words");
  });

  it("handles all-null data gracefully", () => {
    const { user } = buildJudgeVerdictPrompt(sampleData, "transcript");
    expect(user).toContain("No data available");
  });
});

describe("buildJudgeVerdictStructuredPrompt", () => {
  it("includes verdict text", () => {
    const { user } = buildJudgeVerdictStructuredPrompt("The verdict is Buy.");
    expect(user).toContain("The verdict is Buy.");
  });

  it("specifies the score range", () => {
    const { user } = buildJudgeVerdictStructuredPrompt("verdict");
    expect(user).toContain("-100");
    expect(user).toContain("100");
  });

  it("specifies all labels", () => {
    const { user } = buildJudgeVerdictStructuredPrompt("verdict");
    expect(user).toContain("Strong Buy");
    expect(user).toContain("Strong Sell");
    expect(user).toContain("Hold");
  });
});

describe("verdictSchema", () => {
  it("validates a correct verdict object", () => {
    const valid = {
      score: 65,
      label: "Buy",
      summary: "Token shows strong fundamentals.",
      bull_conviction: 75,
      bear_conviction: 40,
    };
    const result = verdictSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects score out of range", () => {
    const invalid = {
      score: 150,
      label: "Buy",
      summary: "test",
      bull_conviction: 75,
      bear_conviction: 40,
    };
    const result = verdictSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const invalid = { score: 50 };
    const result = verdictSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects conviction out of range", () => {
    const invalid = {
      score: 50,
      label: "Buy",
      summary: "test",
      bull_conviction: 150,
      bear_conviction: 40,
    };
    const result = verdictSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
