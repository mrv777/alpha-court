import type { DexScreenerTokenData } from "@/lib/data/types";
import type { JupiterPriceData } from "@/lib/data/types";
import type { GoPlusResult } from "@/lib/data/types";
import type {
  SmNetflowEntry,
  WhoBoughtSoldEntry,
  TokenFlowIntelligence,
  ProfilerPnlSummary,
  TokenDexTrade,
  TokenHolder,
  SmDexTrade,
  TokenFlow,
  TokenInfo,
  TokenOhlcv,
} from "@/lib/nansen/types";

// ── Core types ─────────────────────────────────────────────────────────

export type AgentRole = "bull" | "bear" | "judge";

export type DebatePhase =
  | "gathering"
  | "opening"
  | "rebuttal"
  | "cross_exam"
  | "verdict";

// ── Data bundles ───────────────────────────────────────────────────────

export interface BullData {
  smNetflow: SmNetflowEntry[] | null;
  whoBought: WhoBoughtSoldEntry[] | null;
  flowIntelligence: TokenFlowIntelligence | null;
  profilerPnl: ProfilerPnlSummary | null;
  dexScreener: DexScreenerTokenData | null;
  jupiterPrice: JupiterPriceData | null;
}

export interface BearData {
  dexTrades: TokenDexTrade[] | null;
  holders: TokenHolder[] | null;
  smDexTrades: SmDexTrade[] | null;
  tokenFlows: TokenFlow[] | null;
  dexScreener: DexScreenerTokenData | null;
  security: GoPlusResult | null;
}

export interface JudgeData {
  tokenInfo: TokenInfo | null;
  ohlcv: TokenOhlcv[] | null;
  whoSold: WhoBoughtSoldEntry[] | null;
  profilerPnl: ProfilerPnlSummary | null;
}

export type AgentData = BullData | BearData | JudgeData;

// ── Messages ───────────────────────────────────────────────────────────

export interface AgentMessage {
  role: AgentRole;
  phase: DebatePhase;
  content: string;
  model: string;
  timestamp: number;
}

// ── Verdict ────────────────────────────────────────────────────────────

export interface VerdictScores {
  score: number; // -100 to 100
  label: string; // e.g. "Strong Buy", "Hold", "Strong Sell"
  summary: string;
  bull_conviction: number; // 0-100
  bear_conviction: number; // 0-100
}
