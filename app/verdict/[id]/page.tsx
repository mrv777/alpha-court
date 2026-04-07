import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { VerdictClient } from "./verdict-client";

interface TrialRow {
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
}

function getTrial(id: string): TrialRow | undefined {
  return getDb()
    .prepare(
      `SELECT id, token_address, chain, token_name, token_symbol, status,
              verdict_score, verdict_label, verdict_summary,
              bull_conviction, bear_conviction,
              safety_score, safety_details_json
       FROM trials WHERE id = ?`
    )
    .get(id) as TrialRow | undefined;
}

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const trial = getTrial(id);

  if (!trial || trial.status !== "completed" || trial.verdict_score === null) {
    return { title: "Trial in Progress — Alpha Court" };
  }

  const displayName = trial.token_symbol
    ? `$${trial.token_symbol}`
    : trial.token_name ?? "Token";

  const title = `${displayName}: ${trial.verdict_label} — Alpha Court`;
  const description =
    trial.verdict_summary ?? `AI agents debated ${displayName} and reached a verdict.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: `/api/verdict/${id}/image`,
          width: 1200,
          height: 630,
          alt: `${displayName} verdict: ${trial.verdict_label}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/api/verdict/${id}/image`],
    },
  };
}

export default async function VerdictPage({ params }: Props) {
  const { id } = await params;
  const trial = getTrial(id);

  if (!trial) {
    notFound();
  }

  // Trial not completed yet
  if (trial.status !== "completed" || trial.verdict_score === null) {
    return (
      <div className="min-h-screen bg-court-bg flex flex-col items-center justify-center px-4">
        <div className="text-center">
          <Image
            src="/logo.png"
            alt="Alpha Court"
            width={64}
            height={64}
            className="rounded-lg mx-auto mb-4"
          />
          <h1 className="text-xl font-bold text-court-text mb-2">
            Trial in Progress...
          </h1>
          <p className="text-sm text-court-text-muted mb-6">
            The agents are still debating. Check back soon for the verdict.
          </p>
          <Link
            href={`/trial/${id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-judge/10 border border-judge/20 px-4 py-2 text-sm font-medium text-judge hover:bg-judge/20 transition-colors"
          >
            Watch the Trial →
          </Link>
        </div>
      </div>
    );
  }

  let safetyDetails: string[] | null = null;
  if (trial.safety_details_json) {
    try {
      const parsed = JSON.parse(trial.safety_details_json);
      if (Array.isArray(parsed)) safetyDetails = parsed;
      else if (parsed?.reasons) safetyDetails = parsed.reasons;
    } catch {
      // Ignore
    }
  }

  const displayName = trial.token_symbol
    ? `$${trial.token_symbol}`
    : trial.token_name ?? trial.token_address;

  return (
    <VerdictClient
      trialId={id}
      displayName={displayName}
      chain={trial.chain}
      verdict={{
        score: trial.verdict_score,
        label: trial.verdict_label ?? "HOLD",
        summary: trial.verdict_summary ?? "",
        bull_conviction: trial.bull_conviction ?? 0,
        bear_conviction: trial.bear_conviction ?? 0,
        safety: trial.safety_score ?? "clean",
      }}
      safetyDetails={safetyDetails}
    />
  );
}
