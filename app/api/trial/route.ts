import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { isPaidRequest } from "@/lib/x402";
import type { Chain } from "@/lib/data/types";

const VALID_CHAINS = new Set<Chain>(["solana", "base", "ethereum"]);
const COOLDOWN_HOURS = Number(process.env.COOLDOWN_HOURS || "2");
const COOLDOWN_SECONDS = Math.round(COOLDOWN_HOURS * 3600);

// Address validation patterns
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function isValidAddress(address: string, chain: Chain): boolean {
  if (chain === "solana") return SOLANA_ADDRESS_RE.test(address);
  return EVM_ADDRESS_RE.test(address); // base + ethereum
}

/** Extract a Solana address from a Solscan URL */
function extractAddressFromUrl(input: string): string {
  // Match solscan.io/token/<address> or solscan.io/account/<address>
  const solscanMatch = input.match(
    /solscan\.io\/(?:token|account)\/([1-9A-HJ-NP-Za-km-z]{32,44})/
  );
  if (solscanMatch) return solscanMatch[1];

  // Match etherscan.io/token/<address> or basescan.org/token/<address>
  const ethMatch = input.match(
    /(?:etherscan\.io|basescan\.org)\/(?:token|address)\/(0x[0-9a-fA-F]{40})/
  );
  if (ethMatch) return ethMatch[1];

  return input;
}

export async function POST(request: Request) {
  let body: { tokenAddress?: string; chain?: string; tokenName?: string; tokenSymbol?: string };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawAddress = body.tokenAddress?.trim();
  if (!rawAddress) {
    return Response.json({ error: "tokenAddress is required" }, { status: 400 });
  }

  const chain: Chain = VALID_CHAINS.has(body.chain as Chain)
    ? (body.chain as Chain)
    : "solana";

  // Extract address from URL if pasted
  const tokenAddress = extractAddressFromUrl(rawAddress);

  if (!isValidAddress(tokenAddress, chain)) {
    return Response.json(
      { error: `Invalid ${chain} address format` },
      { status: 400 }
    );
  }

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const cooldownCutoff = now - COOLDOWN_SECONDS;

  // Check cooldown — same token + same chain only
  const existingTrial = db
    .prepare(
      `SELECT id, created_at, status, verdict_score, verdict_label
       FROM trials
       WHERE token_address = ? AND chain = ? AND created_at > ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(tokenAddress, chain, cooldownCutoff) as
    | {
        id: string;
        created_at: number;
        status: string;
        verdict_score: number | null;
        verdict_label: string | null;
      }
    | undefined;

  if (existingTrial && !isPaidRequest(request)) {
    const cooldownEndsAt = existingTrial.created_at + COOLDOWN_SECONDS;
    const remainingSeconds = cooldownEndsAt - now;
    return Response.json(
      {
        cooldown: true,
        trialId: existingTrial.id,
        status: existingTrial.status,
        verdictScore: existingTrial.verdict_score,
        verdictLabel: existingTrial.verdict_label,
        cooldownEndsAt,
        remainingSeconds,
        cooldownTotal: COOLDOWN_SECONDS,
        hint: "Pay via x402 to bypass cooldown",
      },
      {
        status: 429,
        headers: { "Retry-After": String(remainingSeconds) },
      }
    );
  }

  // Create new trial
  const trialId = nanoid(12);

  try {
    db.prepare(
      `INSERT INTO trials (id, token_address, chain, token_name, token_symbol, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    ).run(
      trialId,
      tokenAddress,
      chain,
      body.tokenName || null,
      body.tokenSymbol || null,
      now
    );
  } catch (err) {
    // Handle race condition: unique constraint violation
    if (
      err instanceof Error &&
      err.message.includes("UNIQUE constraint failed")
    ) {
      // Extremely unlikely with nanoid(12) but handle gracefully
      return Response.json(
        { error: "Trial creation conflict, please retry" },
        { status: 409 }
      );
    }
    throw err;
  }

  return Response.json({ trialId, cooldown: false }, { status: 201 });
}
