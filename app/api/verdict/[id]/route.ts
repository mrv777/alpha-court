import { getDb } from "@/lib/db";

const TRADABLE_CHAINS = new Set(["solana", "base"]);

function buildTradeSuggestion(
  label: string | null,
  tokenAddress: string,
  chain: string
): { action: string; command: string; note: string } | null {
  if (!label || !TRADABLE_CHAINS.has(chain)) return null;

  const upper = label.toUpperCase();
  const nativeToken = chain === "solana" ? "SOL" : "ETH";

  // Only suggest trades for strong signals — "Lean Buy"/"Lean Sell" are excluded
  // because they indicate notable risks or caveats
  if (upper === "STRONG BUY" || upper === "BUY") {
    return {
      action: "buy",
      command: `nansen trade quote --chain ${chain} --from USDC --to ${tokenAddress} --amount 50 --amount-unit usd`,
      note: `Get a swap quote to buy $50 worth, then execute with: nansen trade execute --quote <quoteId>. Requires a Nansen wallet (nansen wallet create). Uses ${nativeToken} for gas.`,
    };
  }

  if (upper === "STRONG SELL" || upper === "SELL") {
    return {
      action: "sell",
      command: `nansen trade quote --chain ${chain} --from ${tokenAddress} --to USDC --amount 50 --amount-unit usd`,
      note: `Get a swap quote to sell $50 worth, then execute with: nansen trade execute --quote <quoteId>. Requires a Nansen wallet with token balance.`,
    };
  }

  return null;
}

interface VerdictRow {
  id: string;
  token_address: string;
  chain: string;
  token_name: string | null;
  token_symbol: string | null;
  status: string;
  verdict_score: number | null;
  verdict_label: string | null;
  verdict_summary: string | null;
  bull_conviction: number | null;
  bear_conviction: number | null;
  safety_score: string | null;
  safety_details_json: string | null;
  created_at: number;
  completed_at: number | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const trial = getDb()
    .prepare(
      `SELECT id, token_address, chain, token_name, token_symbol, status,
              verdict_score, verdict_label, verdict_summary,
              bull_conviction, bear_conviction,
              safety_score, safety_details_json,
              created_at, completed_at
       FROM trials WHERE id = ?`
    )
    .get(id) as VerdictRow | undefined;

  if (!trial) {
    return Response.json({ error: "Trial not found" }, { status: 404 });
  }

  if (trial.status !== "completed" || trial.verdict_score === null) {
    return Response.json(
      {
        pending: true,
        status: trial.status,
        trialId: trial.id,
        hint: "Trial is still in progress. Stream GET /api/debate/{trialId} for live updates, or poll this endpoint.",
      },
      {
        status: 202,
        headers: { "Retry-After": "10" },
      }
    );
  }

  const safetyDetails = trial.safety_details_json
    ? (() => {
        try {
          return JSON.parse(trial.safety_details_json);
        } catch {
          return null;
        }
      })()
    : null;

  // Build trade suggestion for agents when verdict is actionable
  const trade = buildTradeSuggestion(
    trial.verdict_label,
    trial.token_address,
    trial.chain
  );

  return Response.json({
    id: trial.id,
    tokenAddress: trial.token_address,
    chain: trial.chain,
    tokenName: trial.token_name,
    tokenSymbol: trial.token_symbol,
    score: trial.verdict_score,
    label: trial.verdict_label,
    summary: trial.verdict_summary,
    bullConviction: trial.bull_conviction ?? 0,
    bearConviction: trial.bear_conviction ?? 0,
    safety: trial.safety_score ?? "clean",
    safetyDetails: safetyDetails,
    createdAt: trial.created_at,
    completedAt: trial.completed_at,
    ...(trade ? { trade } : {}),
  });
}
