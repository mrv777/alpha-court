import { createXai } from "@ai-sdk/xai";
import { streamText, generateText, Output } from "ai";
import type { z } from "zod";
import { log } from "@/lib/logger";

// ── Models ─────────────────────────────────────────────────────────────

export const FAST = "grok-4-1-fast-non-reasoning" as const;
export const REASONING = "grok-4-1-fast-reasoning" as const;

// ── Provider ───────────────────────────────────────────────────────────

const xai = createXai({
  apiKey: process.env.XAI_API_KEY,
});

// ── Error types ────────────────────────────────────────────────────────

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: "TIMEOUT" | "RATE_LIMIT" | "API_ERROR" | "PARSE_ERROR",
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "LLMError";
  }
}

function wrapError(err: unknown): LLMError {
  if (err instanceof LLMError) return err;
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes("429") || message.toLowerCase().includes("rate limit")) {
    return new LLMError(message, "RATE_LIMIT", true);
  }
  if (message.includes("500") || message.includes("502") || message.includes("503")) {
    return new LLMError(message, "API_ERROR", true);
  }
  if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
    return new LLMError(message, "TIMEOUT", true);
  }
  return new LLMError(message, "API_ERROR", false);
}

// ── Retry helper ───────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const wrapped = wrapError(err);
    if (wrapped.retryable) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        return await fn();
      } catch (retryErr) {
        throw wrapError(retryErr);
      }
    }
    throw wrapped;
  }
}

// ── Streaming chat ─────────────────────────────────────────────────────

export interface StreamChatOptions {
  targetWords?: number;
  tools?: Record<string, unknown>;
  /** Abort signal for external cancellation */
  signal?: AbortSignal;
}

/**
 * Stream text from xAI model. Returns an async iterable of text chunks.
 * Implements soft timeout: stops yielding if streamed word count exceeds 2x targetWords.
 * Implements stall detection: throws if no chunks received for 45s (90s for first token).
 */
export async function* streamChat(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: StreamChatOptions = {}
): AsyncGenerator<string, void, undefined> {
  const { targetWords, tools, signal } = options;
  const maxWords = targetWords ? targetWords * 2 : Infinity;
  const startTime = Date.now();

  log.info("streamChat start", { model, targetWords, hasTools: !!tools });

  const callLLM = () =>
    streamText({
      model: xai.responses(model),
      system: systemPrompt,
      prompt: userPrompt,
      ...(tools ? { tools: tools as Parameters<typeof streamText>[0]["tools"] } : {}),
      abortSignal: signal,
    });

  let result: ReturnType<typeof streamText>;
  try {
    result = callLLM();
  } catch (err) {
    const wrapped = wrapError(err);
    log.warn("streamChat initial call failed, retrying", { model, error: wrapped.message, retryable: wrapped.retryable });
    if (wrapped.retryable) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        result = callLLM();
      } catch (retryErr) {
        throw wrapError(retryErr);
      }
    } else {
      throw wrapped;
    }
  }

  let wordCount = 0;
  let lastChunkTime = Date.now();
  let receivedFirstChunk = false;
  const STALL_TIMEOUT_MS = 45_000;
  const FIRST_TOKEN_TIMEOUT_MS = 90_000;

  for await (const chunk of result.textStream) {
    // Stall detection — allow longer for first token (reasoning models + tool use)
    const now = Date.now();
    const timeout = receivedFirstChunk ? STALL_TIMEOUT_MS : FIRST_TOKEN_TIMEOUT_MS;
    if (now - lastChunkTime > timeout) {
      const elapsed = Math.round((now - lastChunkTime) / 1000);
      log.error("Stream stalled", { model, elapsed, receivedFirstChunk, totalWords: wordCount });
      throw new LLMError(
        `Stream stalled: no chunks for ${elapsed}s`,
        "TIMEOUT",
        true
      );
    }

    if (!receivedFirstChunk) {
      log.info("streamChat first token", { model, ttftMs: now - startTime });
    }
    lastChunkTime = now;
    receivedFirstChunk = true;

    // Soft timeout: stop if we've exceeded 2x target word count
    wordCount += chunk.split(/\s+/).filter(Boolean).length;
    if (wordCount > maxWords) {
      log.info("streamChat soft word limit hit", { model, wordCount, maxWords });
      yield chunk;
      return;
    }

    yield chunk;
  }

  log.info("streamChat complete", { model, wordCount, durationMs: Date.now() - startTime });
}

// ── Structured output ──────────────────────────────────────────────────

/**
 * Generate a structured object from xAI model using Output.object().
 * Retries once on parse failure.
 */
export async function structuredOutput<T>(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>
): Promise<T> {
  log.info("structuredOutput start", { model });
  const startTime = Date.now();

  const generate = async () => {
    const { output } = await generateText({
      model: xai.responses(model),
      system: systemPrompt,
      prompt: userPrompt,
      output: Output.object({ schema }),
    });
    if (output === undefined || output === null) {
      throw new LLMError("Structured output returned null", "PARSE_ERROR", true);
    }
    return output;
  };

  try {
    const result = await withRetry(generate);
    log.info("structuredOutput complete", { model, durationMs: Date.now() - startTime });
    return result;
  } catch (err) {
    log.error("structuredOutput failed", { model, error: err instanceof Error ? err.message : String(err), durationMs: Date.now() - startTime });
    throw wrapError(err);
  }
}

// ── Search tools for Judge ─────────────────────────────────────────────

export function getJudgeTools() {
  return {
    web_search: xai.tools.webSearch(),
    x_search: xai.tools.xSearch(),
  };
}
