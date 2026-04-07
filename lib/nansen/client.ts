import { exec } from "child_process";
import { promisify } from "util";
import { generateCacheKey, getCached, setCache } from "@/lib/cache";
import { log } from "@/lib/logger";
import type { NansenCliResult } from "./types";

const execAsync = promisify(exec);

const TIMEOUT_MS = 45_000;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a Nansen CLI command asynchronously.
 * Returns raw stdout string. Throws on error with best-effort message extraction.
 */
async function execNansenCli(command: string): Promise<string> {
  const fullCommand = `nansen ${command}`;
  try {
    const { stdout } = await execAsync(fullCommand, {
      encoding: "utf-8",
      timeout: TIMEOUT_MS,
      env: { ...process.env },
    });
    return stdout.trim();
  } catch (err: unknown) {
    const execErr = err as {
      stderr?: string;
      stdout?: string;
      message?: string;
      killed?: boolean;
      signal?: string;
    };

    // Timeout detection
    if (execErr.killed || execErr.signal === "SIGTERM") {
      throw new Error(`Nansen CLI timed out after ${TIMEOUT_MS / 1000}s: ${command}`);
    }

    const output = (execErr.stderr || execErr.stdout || "").trim();

    // Try to parse structured Nansen error JSON
    try {
      const jsonStart = output.indexOf("{");
      if (jsonStart !== -1) {
        const parsed = JSON.parse(output.substring(jsonStart));
        const code = parsed.code ?? "";
        const detail = parsed.error ?? parsed.details?.error ?? "";
        if (code || detail) {
          throw new Error(`${code || "NANSEN_ERROR"}: ${detail}`);
        }
      }
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message.includes(":")) {
        throw parseErr;
      }
    }

    throw new Error(output || (execErr.message ?? "Nansen CLI failed"));
  }
}

/**
 * Parse CLI JSON output. Handles:
 * - Non-JSON prefix (progress bars, warnings) before the JSON body
 * - Nansen { success, data } wrapper — unwraps to inner payload
 * - Double-nested { data: { data: [...], pagination } } — unwraps inner data
 */
export function parseCliOutput<T>(raw: string): T {
  const jsonStart = raw.indexOf("{");
  const jsonArrayStart = raw.indexOf("[");

  let start: number;
  if (jsonStart === -1 && jsonArrayStart === -1) {
    throw new Error(`No JSON found in CLI output: ${raw.substring(0, 200)}`);
  } else if (jsonStart === -1) {
    start = jsonArrayStart;
  } else if (jsonArrayStart === -1) {
    start = jsonStart;
  } else {
    start = Math.min(jsonStart, jsonArrayStart);
  }

  const jsonStr = raw.substring(start);
  const parsed = JSON.parse(jsonStr);

  // Handle Nansen CLI wrapper formats
  if (parsed && typeof parsed === "object" && "success" in parsed) {
    if (!parsed.success) {
      throw new Error(
        parsed.error ?? parsed.message ?? "CLI returned success=false"
      );
    }
    // Unwrap { success, data } wrapper
    if ("data" in parsed) {
      let inner = parsed.data;

      // Many Nansen endpoints double-nest: { data: { data: [...], pagination } }
      // Unwrap the inner .data when present (but not for search which uses .tokens)
      if (inner && typeof inner === "object" && !Array.isArray(inner) && "data" in inner) {
        inner = inner.data;
      }

      return inner as T;
    }
  }

  return parsed as T;
}

/**
 * Call a Nansen CLI command with caching and retry logic.
 *
 * @param command - CLI command string (without "nansen " prefix)
 * @param options.ttlSeconds - Cache TTL in seconds
 * @param options.chain - Blockchain (for cache metadata)
 * @param options.tokenAddress - Token address (for cache invalidation)
 * @param options.params - Params for cache key generation
 * @param options.skipCache - Bypass cache
 */
export async function nansenCliCall<T>(
  command: string,
  options: {
    ttlSeconds?: number;
    chain?: string;
    tokenAddress?: string | null;
    params?: Record<string, unknown>;
    skipCache?: boolean;
  } = {}
): Promise<NansenCliResult<T>> {
  const {
    ttlSeconds = 300,
    chain = "solana",
    tokenAddress = null,
    params = {},
    skipCache = false,
  } = options;

  const cacheKey = generateCacheKey(command, params);

  // Check cache
  if (!skipCache && ttlSeconds > 0) {
    const cached = getCached(cacheKey);
    if (cached !== null) {
      log.debug("nansen cache hit", { command });
      return {
        success: true,
        data: cached as T,
        error: null,
        cached: true,
        command,
      };
    }
  }

  // Execute with retry
  let lastError: string | null = null;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      log.info("nansen cli call", { command, attempt });
      const raw = await execNansenCli(command);

      if (!raw) {
        throw new Error("Empty CLI output");
      }

      const parsed = parseCliOutput<T>(raw);

      // Store in cache
      if (ttlSeconds > 0) {
        setCache(cacheKey, command, params, parsed, chain, tokenAddress, ttlSeconds);
      }

      log.info("nansen cli success", { command, durationMs: Date.now() - startTime, cached: false });
      return {
        success: true,
        data: parsed,
        error: null,
        cached: false,
        command,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      log.warn("nansen cli error", { command, attempt, error: lastError });

      // Wait before retry (except on last attempt)
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  log.error("nansen cli failed after retries", { command, error: lastError, durationMs: Date.now() - startTime });
  return {
    success: false,
    data: null,
    error: lastError,
    cached: false,
    command,
  };
}
