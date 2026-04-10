import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_DIR = path.join(__dirname, "../../data/test-nansen-endpoints");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test.db");

process.env.DATABASE_PATH = TEST_DB_PATH;

// Mock the nansenCliCall function
vi.mock("@/lib/nansen/client", () => ({
  nansenCliCall: vi.fn(),
  parseCliOutput: vi.fn(),
}));

import { nansenCliCall } from "@/lib/nansen/client";
import {
  TTL,
  getSmNetflow,
  getWhoBoughtSold,
  getTokenFlowIntelligence,
  getProfilerPnlSummary,
  getTokenDexTrades,
  getTokenHolders,
  getSmDexTrades,
  getTokenFlows,
  getTokenInfo,
  getTokenOhlcv,
  nansenSearch,
} from "@/lib/nansen/endpoints";
import { getDb, closeDb } from "@/lib/db";

const mockNansenCliCall = vi.mocked(nansenCliCall);

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
  mockNansenCliCall.mockResolvedValue({
    success: true,
    data: [],
    error: null,
    cached: false,
    command: "test",
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TTL values match spec", () => {
  const SEVEN_DAYS = 604800;
  it("token info = 7 days", () => expect(TTL.TOKEN_INFO).toBe(SEVEN_DAYS));
  it("ohlcv = 7 days", () => expect(TTL.OHLCV).toBe(SEVEN_DAYS));
  it("who-bought-sold = 7 days", () => expect(TTL.WHO_BOUGHT_SOLD).toBe(SEVEN_DAYS));
  it("dex-trades = 7 days", () => expect(TTL.DEX_TRADES).toBe(SEVEN_DAYS));
  it("sm-netflow = 7 days", () => expect(TTL.SM_NETFLOW).toBe(SEVEN_DAYS));
  it("holders = 7 days", () => expect(TTL.HOLDERS).toBe(SEVEN_DAYS));
  it("flows = 7 days", () => expect(TTL.FLOWS).toBe(SEVEN_DAYS));
  it("profiler = 7 days", () => expect(TTL.PROFILER).toBe(SEVEN_DAYS));
  it("search = 7 days", () => expect(TTL.SEARCH).toBe(SEVEN_DAYS));
});

describe("Endpoint command construction", () => {
  it("getSmNetflow builds correct command", async () => {
    await getSmNetflow("solana", "TOKEN123");
    expect(mockNansenCliCall).toHaveBeenCalledWith(
      "research smart-money netflow --chain solana --token TOKEN123 --limit 500",
      expect.objectContaining({
        ttlSeconds: TTL.SM_NETFLOW,
        chain: "solana",
        tokenAddress: "TOKEN123",
      })
    );
  });

  it("getWhoBoughtSold builds correct command with buy side", async () => {
    await getWhoBoughtSold("solana", "TOKEN123", "buy");
    expect(mockNansenCliCall).toHaveBeenCalledWith(
      "research token who-bought-sold --chain solana --token TOKEN123 --side buy --limit 500",
      expect.objectContaining({
        ttlSeconds: TTL.WHO_BOUGHT_SOLD,
        tokenAddress: "TOKEN123",
      })
    );
  });

  it("getWhoBoughtSold builds correct command with sell side", async () => {
    await getWhoBoughtSold("solana", "TOKEN123", "sell");
    expect(mockNansenCliCall).toHaveBeenCalledWith(
      expect.stringContaining("--side sell"),
      expect.anything()
    );
  });

  it("getTokenFlowIntelligence builds correct command", async () => {
    await getTokenFlowIntelligence("base", "TOKEN456");
    expect(mockNansenCliCall).toHaveBeenCalledWith(
      "research token flow-intelligence --token TOKEN456 --chain base",
      expect.objectContaining({
        ttlSeconds: TTL.FLOW_INTELLIGENCE,
        chain: "base",
      })
    );
  });

  it("getProfilerPnlSummary builds correct command", async () => {
    await getProfilerPnlSummary("WALLET_ADDR", "solana");
    expect(mockNansenCliCall).toHaveBeenCalledWith(
      "research profiler pnl-summary --address WALLET_ADDR --chain solana",
      expect.objectContaining({
        ttlSeconds: TTL.PROFILER,
      })
    );
  });

  it("getTokenDexTrades builds correct command", async () => {
    await getTokenDexTrades("ethereum", "TOKEN789");
    expect(mockNansenCliCall).toHaveBeenCalledWith(
      "research token dex-trades --token TOKEN789 --chain ethereum --limit 500",
      expect.objectContaining({
        ttlSeconds: TTL.DEX_TRADES,
        chain: "ethereum",
      })
    );
  });

  it("getTokenHolders builds correct command", async () => {
    await getTokenHolders("solana", "TOKEN123");
    expect(mockNansenCliCall).toHaveBeenCalledWith(
      "research token holders --token TOKEN123 --chain solana --limit 500",
      expect.objectContaining({
        ttlSeconds: TTL.HOLDERS,
      })
    );
  });

  it("getSmDexTrades builds correct command", async () => {
    await getSmDexTrades("solana", "TOKEN123");
    expect(mockNansenCliCall).toHaveBeenCalledWith(
      "research smart-money dex-trades --chain solana --token TOKEN123 --limit 500",
      expect.objectContaining({
        ttlSeconds: TTL.SM_DEX_TRADES,
      })
    );
  });

  it("getTokenFlows builds correct command with whale label", async () => {
    await getTokenFlows("solana", "TOKEN123");
    expect(mockNansenCliCall).toHaveBeenCalledWith(
      "research token flows --token TOKEN123 --chain solana --label whale --limit 500",
      expect.objectContaining({
        ttlSeconds: TTL.FLOWS,
      })
    );
  });

  it("getTokenFlows accepts custom label", async () => {
    await getTokenFlows("solana", "TOKEN123", "fund");
    expect(mockNansenCliCall).toHaveBeenCalledWith(
      expect.stringContaining("--label fund"),
      expect.anything()
    );
  });

  it("getTokenInfo builds correct command", async () => {
    await getTokenInfo("TOKEN123", "solana");
    expect(mockNansenCliCall).toHaveBeenCalledWith(
      "research token info --token TOKEN123 --chain solana",
      expect.objectContaining({
        ttlSeconds: TTL.TOKEN_INFO,
      })
    );
  });

  it("getTokenOhlcv builds correct command", async () => {
    await getTokenOhlcv("TOKEN123", "solana");
    expect(mockNansenCliCall).toHaveBeenCalledWith(
      "research token ohlcv --token TOKEN123 --chain solana",
      expect.objectContaining({
        ttlSeconds: TTL.OHLCV,
      })
    );
  });

  it("nansenSearch builds correct command with quoted query", async () => {
    await nansenSearch("bonk", "solana");
    expect(mockNansenCliCall).toHaveBeenCalledWith(
      'research search --query "bonk" --chain solana',
      expect.objectContaining({
        ttlSeconds: TTL.SEARCH,
      })
    );
  });
});
