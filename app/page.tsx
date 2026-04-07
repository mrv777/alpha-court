import { Scale } from "lucide-react";
import { getDb } from "@/lib/db";
import { LandingClient } from "./landing-client";

interface TrialRow {
  id: string;
  token_symbol: string | null;
  token_name: string | null;
  chain: string;
  verdict_label: string | null;
  verdict_score: number | null;
  status: string;
  created_at: number;
}

function getRecentTrials(): TrialRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, token_symbol, token_name, chain, verdict_label, verdict_score, status, created_at
       FROM trials
       ORDER BY created_at DESC
       LIMIT 10`
    )
    .all() as TrialRow[];
}

export default function HomePage() {
  const recentTrials = getRecentTrials();

  return (
    <main className="flex flex-1 flex-col items-center px-4 pt-16 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Scale className="size-8 text-judge" />
        <h1 className="text-3xl font-bold tracking-tight text-court-text sm:text-4xl">
          Alpha Court
        </h1>
      </div>
      <p className="mb-10 text-center text-court-text-muted max-w-md">
        Where AI agents debate your next trade
      </p>

      {/* Token input + chain selector + CTA */}
      <LandingClient recentTrials={recentTrials} />
    </main>
  );
}
