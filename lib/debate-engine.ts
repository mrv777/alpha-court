import { getDb } from "@/lib/db";
import { streamChat, structuredOutput, LLMError } from "@/lib/llm";
import { log } from "@/lib/logger";
import { fetchBullData, buildBullOpeningPrompt, buildBullRebuttalPrompt, BULL_MODEL } from "@/lib/agents/bull";
import { fetchBearData, buildBearOpeningPrompt, buildBearRebuttalPrompt, BEAR_MODEL } from "@/lib/agents/bear";
import {
  fetchJudgeData,
  buildJudgeCrossExamPrompt,
  buildJudgeVerdictPrompt,
  buildJudgeVerdictStructuredPrompt,
  verdictSchema,
  JUDGE_MODEL,
} from "@/lib/agents/judge";
import { getJudgeTools } from "@/lib/llm";
import { parseCitations } from "@/lib/citations";
import type { AgentRole, DebatePhase, BullData, BearData, JudgeData, VerdictScores } from "@/lib/agents/types";

// ── SSE Event Types ───────────────────────────────────────────────────

export interface PhaseEvent {
  type: "phase";
  phase: DebatePhase;
  status: "start" | "complete";
}

export interface DataProgressEvent {
  type: "data_progress";
  endpoint: string;
  agent: AgentRole;
  status: "pending" | "complete" | "error";
}

export interface ChunkEvent {
  type: "chunk";
  agent: AgentRole;
  phase: DebatePhase;
  text: string;
}

export interface MessageCompleteEvent {
  type: "message_complete";
  agent: AgentRole;
  phase: DebatePhase;
  content: string;
  evidence: Array<{ endpoint: string; displayValue: string }>;
}

export interface VerdictEvent {
  type: "verdict";
  score: number;
  label: string;
  summary: string;
  bull_conviction: number;
  bear_conviction: number;
  safety: string;
}

export interface ErrorEvent {
  type: "error";
  message: string;
  recoverable: boolean;
}

export interface DoneEvent {
  type: "done";
}

export type DebateEvent =
  | PhaseEvent
  | DataProgressEvent
  | ChunkEvent
  | MessageCompleteEvent
  | VerdictEvent
  | ErrorEvent
  | DoneEvent;

// ── Active debate tracking ────────────────────────────────────────────

export interface ActiveDebate {
  promise: Promise<void>;
  listeners: Set<(event: DebateEvent) => void>;
}

/** Module-level map so concurrent SSE connections share the same engine */
export const activeDebates = new Map<string, ActiveDebate>();

// ── DB helpers ────────────────────────────────────────────────────────

function updateTrialStatus(trialId: string, status: string): void {
  getDb()
    .prepare("UPDATE trials SET status = ? WHERE id = ?")
    .run(status, trialId);
}

function setTrialError(trialId: string, message: string): void {
  getDb()
    .prepare("UPDATE trials SET status = 'error', error_message = ? WHERE id = ?")
    .run(message, trialId);
}

function updateTrialIconUrl(trialId: string, iconUrl: string): void {
  getDb()
    .prepare("UPDATE trials SET token_icon_url = ? WHERE id = ?")
    .run(iconUrl, trialId);
}

function persistMessage(
  trialId: string,
  agent: AgentRole | "system",
  phase: DebatePhase,
  content: string,
  evidence: Array<{ endpoint: string; displayValue: string }>,
  sequence: number
): void {
  getDb()
    .prepare(
      `INSERT INTO debate_messages (trial_id, agent, phase, content, evidence_json, sequence, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      trialId,
      agent,
      phase,
      content,
      JSON.stringify(evidence),
      sequence,
      Math.floor(Date.now() / 1000)
    );
}

function updateTrialVerdict(
  trialId: string,
  scores: VerdictScores,
  safety: string,
  safetyDetails?: string[]
): void {
  getDb()
    .prepare(
      `UPDATE trials
       SET status = 'completed',
           verdict_score = ?,
           verdict_label = ?,
           verdict_summary = ?,
           bull_conviction = ?,
           bear_conviction = ?,
           safety_score = ?,
           safety_details_json = ?,
           completed_at = ?
       WHERE id = ?`
    )
    .run(
      scores.score,
      scores.label,
      scores.summary,
      scores.bull_conviction,
      scores.bear_conviction,
      safety,
      safetyDetails ? JSON.stringify(safetyDetails) : null,
      Math.floor(Date.now() / 1000),
      trialId
    );
}

// ── Stream an LLM call, collecting full text ──────────────────────────

async function streamAgent(
  agent: AgentRole,
  phase: DebatePhase,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  emit: (event: DebateEvent) => void,
  options?: { tools?: Record<string, unknown>; targetWords?: number }
): Promise<string> {
  let fullText = "";

  const stream = streamChat(model, systemPrompt, userPrompt, {
    targetWords: options?.targetWords,
    tools: options?.tools,
  });

  for await (const chunk of stream) {
    fullText += chunk;
    emit({ type: "chunk", agent, phase, text: chunk });
  }

  return fullText;
}

/** Stream with retry: try once, retry on failure, throw on second failure */
async function streamAgentWithRetry(
  agent: AgentRole,
  phase: DebatePhase,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  emit: (event: DebateEvent) => void,
  options?: { tools?: Record<string, unknown>; targetWords?: number }
): Promise<string | null> {
  log.info(`${agent} ${phase} starting`, { model });
  const startTime = Date.now();
  try {
    const result = await streamAgent(agent, phase, model, systemPrompt, userPrompt, emit, options);
    log.info(`${agent} ${phase} complete`, { durationMs: Date.now() - startTime, words: result.split(/\s+/).length });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`${agent} ${phase} failed, retrying`, { error: msg, durationMs: Date.now() - startTime });
    emit({ type: "error", message: `${agent} ${phase} failed: ${msg}`, recoverable: true });

    // Retry once after brief delay
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const result = await streamAgent(agent, phase, model, systemPrompt, userPrompt, emit, options);
      log.info(`${agent} ${phase} succeeded on retry`, { durationMs: Date.now() - startTime });
      return result;
    } catch (retryErr) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      log.error(`${agent} ${phase} failed after retry`, { error: retryMsg, durationMs: Date.now() - startTime });
      emit({
        type: "error",
        message: `${agent} ${phase} failed after retry: ${retryMsg}. Skipping.`,
        recoverable: true,
      });
      return null;
    }
  }
}

const JUNK_EVIDENCE_RE = /^(no data|no data available[^)]*|n\/a|null|undefined|safe[= ]*(true)?|true|false)$/i;

function extractEvidence(content: string): Array<{ endpoint: string; displayValue: string }> {
  const { citations } = parseCitations(content);
  return citations
    .filter((c) => !JUNK_EVIDENCE_RE.test(c.displayValue.trim()))
    .map((c) => ({ endpoint: c.endpoint, displayValue: c.displayValue }));
}

// ── Data fetching helpers ─────────────────────────────────────────────

interface DataEndpoint {
  name: string;
  agent: AgentRole;
}

const BULL_ENDPOINTS: DataEndpoint[] = [
  { name: "smart-money netflow", agent: "bull" },
  { name: "who-bought-sold (buy)", agent: "bull" },
  { name: "flow-intelligence", agent: "bull" },
  { name: "profiler-pnl (buyers)", agent: "bull" },
  { name: "dexscreener (bull)", agent: "bull" },
  { name: "jupiter-price", agent: "bull" },
];

const BEAR_ENDPOINTS: DataEndpoint[] = [
  { name: "token-dex-trades", agent: "bear" },
  { name: "token-holders", agent: "bear" },
  { name: "sm-dex-trades", agent: "bear" },
  { name: "token-flows (whale)", agent: "bear" },
  { name: "dexscreener (bear)", agent: "bear" },
  { name: "goplus-security", agent: "bear" },
];

const JUDGE_ENDPOINTS: DataEndpoint[] = [
  { name: "token-info", agent: "judge" },
  { name: "token-ohlcv", agent: "judge" },
  { name: "who-bought-sold (sell)", agent: "judge" },
  { name: "profiler-pnl (sellers)", agent: "judge" },
];

// ── Main debate engine ────────────────────────────────────────────────

export async function runDebate(
  trialId: string,
  tokenAddress: string,
  chain: string,
  tokenName: string,
  emitEvent: (event: DebateEvent) => void
): Promise<void> {
  let sequence = 0;

  const emit = (event: DebateEvent) => {
    emitEvent(event);
    // Also notify any additional listeners (late joiners)
    const active = activeDebates.get(trialId);
    if (active) {
      for (const listener of active.listeners) {
        if (listener !== emitEvent) listener(event);
      }
    }
  };

  log.info("debate started", { trialId, tokenAddress, chain, tokenName });
  const debateStart = Date.now();

  try {
    // ── Phase 1: Data Gathering ─────────────────────────────────────
    emit({ type: "phase", phase: "gathering", status: "start" });
    updateTrialStatus(trialId, "gathering");

    // Emit pending for all endpoints
    for (const ep of [...BULL_ENDPOINTS, ...BEAR_ENDPOINTS, ...JUDGE_ENDPOINTS]) {
      emit({ type: "data_progress", endpoint: ep.name, agent: ep.agent, status: "pending" });
    }

    // Fetch Bull + Bear in parallel, then Judge (safer for rate limits than all 3)
    const gatherStart = Date.now();

    // Bull + Bear concurrently (max ~12 Nansen calls, capped by semaphore to 6 at a time)
    const [bullResult, bearResult] = await Promise.allSettled([
      fetchBullData(tokenAddress, chain),
      fetchBearData(tokenAddress, chain),
    ]);

    let bullData: BullData;
    if (bullResult.status === "fulfilled") {
      bullData = bullResult.value;
      for (const ep of BULL_ENDPOINTS) {
        emit({ type: "data_progress", endpoint: ep.name, agent: ep.agent, status: "complete" });
      }
      log.info("bull data fetched", { trialId, durationMs: Date.now() - gatherStart });
    } else {
      for (const ep of BULL_ENDPOINTS) {
        emit({ type: "data_progress", endpoint: ep.name, agent: ep.agent, status: "error" });
      }
      log.error("bull data fetch failed", { trialId, durationMs: Date.now() - gatherStart, error: bullResult.reason instanceof Error ? bullResult.reason.message : String(bullResult.reason) });
      bullData = { smNetflow: null, whoBought: null, flowIntelligence: null, profilerPnl: null, dexScreener: null, jupiterPrice: null };
    }

    let bearData: BearData;
    if (bearResult.status === "fulfilled") {
      bearData = bearResult.value;
      for (const ep of BEAR_ENDPOINTS) {
        emit({ type: "data_progress", endpoint: ep.name, agent: ep.agent, status: "complete" });
      }
      log.info("bear data fetched", { trialId, durationMs: Date.now() - gatherStart });
    } else {
      for (const ep of BEAR_ENDPOINTS) {
        emit({ type: "data_progress", endpoint: ep.name, agent: ep.agent, status: "error" });
      }
      log.error("bear data fetch failed", { trialId, durationMs: Date.now() - gatherStart, error: bearResult.reason instanceof Error ? bearResult.reason.message : String(bearResult.reason) });
      bearData = { dexTrades: null, holders: null, smDexTrades: null, tokenFlows: null, dexScreener: null, security: null };
    }

    // Judge fetches after Bull+Bear (judge data not needed until cross-exam)
    let judgeData: JudgeData;
    try {
      judgeData = await fetchJudgeData(tokenAddress, chain);
      for (const ep of JUDGE_ENDPOINTS) {
        emit({ type: "data_progress", endpoint: ep.name, agent: ep.agent, status: "complete" });
      }
      log.info("judge data fetched", { trialId, durationMs: Date.now() - gatherStart });
    } catch (err) {
      for (const ep of JUDGE_ENDPOINTS) {
        emit({ type: "data_progress", endpoint: ep.name, agent: ep.agent, status: "error" });
      }
      log.error("judge data fetch failed", { trialId, durationMs: Date.now() - gatherStart, error: err instanceof Error ? err.message : String(err) });
      judgeData = { tokenInfo: null, ohlcv: null, whoSold: null, profilerPnl: null };
    }

    log.info("data gathering complete", { trialId, durationMs: Date.now() - gatherStart });

    emit({ type: "phase", phase: "gathering", status: "complete" });

    // Persist token icon URL from DexScreener (either side has it)
    const iconUrl = bullData.dexScreener?.imageUrl ?? bearData.dexScreener?.imageUrl;
    if (iconUrl) {
      updateTrialIconUrl(trialId, iconUrl);
    }

    // ── Phase 2: Opening Statements (parallel) ──────────────────────
    emit({ type: "phase", phase: "opening", status: "start" });
    updateTrialStatus(trialId, "debating");

    const bullOpeningPrompt = buildBullOpeningPrompt(bullData, tokenName);
    const bearOpeningPrompt = buildBearOpeningPrompt(bearData, tokenName);

    const [bullOpeningText, bearOpeningText] = await Promise.all([
      streamAgentWithRetry("bull", "opening", BULL_MODEL, bullOpeningPrompt.system, bullOpeningPrompt.user, emit, { targetWords: 300 }),
      streamAgentWithRetry("bear", "opening", BEAR_MODEL, bearOpeningPrompt.system, bearOpeningPrompt.user, emit, { targetWords: 300 }),
    ]);

    const bullOpening = bullOpeningText ?? "";
    const bearOpening = bearOpeningText ?? "";

    // Persist and emit message_complete for openings
    if (bullOpening) {
      const evidence = extractEvidence(bullOpening);
      persistMessage(trialId, "bull", "opening", bullOpening, evidence, ++sequence);
      emit({ type: "message_complete", agent: "bull", phase: "opening", content: bullOpening, evidence });
    }

    if (bearOpening) {
      const evidence = extractEvidence(bearOpening);
      persistMessage(trialId, "bear", "opening", bearOpening, evidence, ++sequence);
      emit({ type: "message_complete", agent: "bear", phase: "opening", content: bearOpening, evidence });
    }

    emit({ type: "phase", phase: "opening", status: "complete" });

    // ── Phase 3: Rebuttals (sequential) ─────────────────────────────
    emit({ type: "phase", phase: "rebuttal", status: "start" });

    // Bear rebuts Bull's opening
    let bearRebuttal = "";
    if (bullOpening) {
      const bearRebuttalPrompt = buildBearRebuttalPrompt(bearData, bullOpening);
      const text = await streamAgentWithRetry(
        "bear", "rebuttal", BEAR_MODEL,
        bearRebuttalPrompt.system, bearRebuttalPrompt.user,
        emit, { targetWords: 200 }
      );
      bearRebuttal = text ?? "";
    }

    if (bearRebuttal) {
      const evidence = extractEvidence(bearRebuttal);
      persistMessage(trialId, "bear", "rebuttal", bearRebuttal, evidence, ++sequence);
      emit({ type: "message_complete", agent: "bear", phase: "rebuttal", content: bearRebuttal, evidence });
    }

    // Bull rebuts Bear's opening
    let bullRebuttal = "";
    if (bearOpening) {
      const bullRebuttalPrompt = buildBullRebuttalPrompt(bullData, bearOpening);
      const text = await streamAgentWithRetry(
        "bull", "rebuttal", BULL_MODEL,
        bullRebuttalPrompt.system, bullRebuttalPrompt.user,
        emit, { targetWords: 200 }
      );
      bullRebuttal = text ?? "";
    }

    if (bullRebuttal) {
      const evidence = extractEvidence(bullRebuttal);
      persistMessage(trialId, "bull", "rebuttal", bullRebuttal, evidence, ++sequence);
      emit({ type: "message_complete", agent: "bull", phase: "rebuttal", content: bullRebuttal, evidence });
    }

    emit({ type: "phase", phase: "rebuttal", status: "complete" });

    // ── Phase 4: Cross-Examination ──────────────────────────────────
    emit({ type: "phase", phase: "cross_exam", status: "start" });

    const crossExamPrompt = buildJudgeCrossExamPrompt(
      judgeData,
      bullOpening || "(Bull's opening was unavailable)",
      bearOpening || "(Bear's opening was unavailable)",
      bullRebuttal || "(Bull's rebuttal was unavailable)",
      bearRebuttal || "(Bear's rebuttal was unavailable)"
    );

    const crossExamText = await streamAgentWithRetry(
      "judge", "cross_exam", JUDGE_MODEL,
      crossExamPrompt.system, crossExamPrompt.user,
      emit, { tools: getJudgeTools(), targetWords: 350 }
    );

    const crossExam = crossExamText ?? "";
    if (crossExam) {
      const evidence = extractEvidence(crossExam);
      persistMessage(trialId, "judge", "cross_exam", crossExam, evidence, ++sequence);
      emit({ type: "message_complete", agent: "judge", phase: "cross_exam", content: crossExam, evidence });
    }

    emit({ type: "phase", phase: "cross_exam", status: "complete" });

    // ── Phase 5: Verdict ────────────────────────────────────────────
    emit({ type: "phase", phase: "verdict", status: "start" });
    updateTrialStatus(trialId, "verdict");

    // Build full transcript for verdict
    const transcript = [
      bullOpening ? `### Bull's Opening\n${bullOpening}` : "",
      bearOpening ? `### Bear's Opening\n${bearOpening}` : "",
      bearRebuttal ? `### Bear's Rebuttal\n${bearRebuttal}` : "",
      bullRebuttal ? `### Bull's Rebuttal\n${bullRebuttal}` : "",
      crossExam ? `### Judge's Cross-Examination\n${crossExam}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const verdictPrompt = buildJudgeVerdictPrompt(judgeData, transcript);

    const verdictText = await streamAgentWithRetry(
      "judge", "verdict", JUDGE_MODEL,
      verdictPrompt.system, verdictPrompt.user,
      emit, { tools: getJudgeTools(), targetWords: 300 }
    );

    const verdict = verdictText ?? "";

    if (verdict) {
      const evidence = extractEvidence(verdict);
      persistMessage(trialId, "judge", "verdict", verdict, evidence, ++sequence);
      emit({ type: "message_complete", agent: "judge", phase: "verdict", content: verdict, evidence });
    }

    // Structured output call for scores
    let scores: VerdictScores;
    try {
      const structuredPrompt = buildJudgeVerdictStructuredPrompt(verdict || transcript);
      scores = await structuredOutput(JUDGE_MODEL, structuredPrompt.system, structuredPrompt.user, verdictSchema);
    } catch (err) {
      // Fallback scores if structured output fails
      scores = {
        score: 0,
        label: "Hold",
        summary: "Unable to determine verdict scores.",
        bull_conviction: 50,
        bear_conviction: 50,
      };
      const msg = err instanceof Error ? err.message : String(err);
      log.error("structured verdict extraction failed", { trialId, error: msg });
      emit({ type: "error", message: `Structured verdict extraction failed: ${msg}`, recoverable: true });
    }

    // Determine safety from Bear's GoPlus data
    const safetyReasons = bearData.security?.reasons ?? [];
    const safety = bearData.security
      ? bearData.security.safe
        ? "clean"
        : safetyReasons.length > 2
          ? "dangerous"
          : "warnings"
      : "clean";

    // Update trial with verdict
    updateTrialVerdict(trialId, scores, safety, safetyReasons);

    emit({
      type: "verdict",
      score: scores.score,
      label: scores.label,
      summary: scores.summary,
      bull_conviction: scores.bull_conviction,
      bear_conviction: scores.bear_conviction,
      safety,
    });

    emit({ type: "phase", phase: "verdict", status: "complete" });
    log.info("debate completed", { trialId, durationMs: Date.now() - debateStart, verdictLabel: scores.label, score: scores.score });
    emit({ type: "done" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("debate failed", { trialId, error: message, durationMs: Date.now() - debateStart });
    setTrialError(trialId, message);
    emit({ type: "error", message, recoverable: false });
    emit({ type: "done" });
  } finally {
    // Clean up active debate tracking
    activeDebates.delete(trialId);
  }
}
