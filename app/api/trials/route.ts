import { getDb } from "@/lib/db";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(1, Number(searchParams.get("limit") || DEFAULT_LIMIT)),
    MAX_LIMIT
  );

  const db = getDb();
  const trials = db
    .prepare(
      `SELECT id, token_address, token_symbol, token_name, chain,
              verdict_label, verdict_score, status, created_at
       FROM trials
       WHERE status = 'completed'
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit);

  return Response.json({ trials, count: trials.length });
}
