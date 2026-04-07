import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { TrialClient } from "./trial-client";

interface TrialRow {
  id: string;
  token_address: string;
  chain: string;
  token_name: string | null;
  token_symbol: string | null;
  token_icon_url: string | null;
  status: string;
  verdict_label: string | null;
  verdict_summary: string | null;
  error_message: string | null;
}

function getTrial(id: string): TrialRow | undefined {
  return getDb()
    .prepare(
      `SELECT id, token_address, chain, token_name, token_symbol, token_icon_url,
              status, verdict_label, verdict_summary, error_message
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

  if (!trial) {
    return { title: "Trial Not Found — Alpha Court" };
  }

  const displayName = trial.token_symbol
    ? `$${trial.token_symbol}`
    : trial.token_name ?? "Token";

  const isComplete = trial.status === "completed" && trial.verdict_label;

  const title = isComplete
    ? `${displayName}: ${trial.verdict_label} — Alpha Court`
    : `${displayName} Trial — Alpha Court`;

  const description = isComplete
    ? (trial.verdict_summary ?? `AI agents debated ${displayName} and reached a verdict.`)
    : `AI agents are debating whether to buy ${displayName}. Watch the trial live.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(isComplete
        ? {
            images: [
              {
                url: `/api/verdict/${id}/image`,
                width: 1200,
                height: 630,
                alt: `${displayName} verdict: ${trial.verdict_label}`,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: isComplete ? "summary_large_image" : "summary",
      title,
      description,
      ...(isComplete ? { images: [`/api/verdict/${id}/image`] } : {}),
    },
  };
}

export default async function TrialPage({ params }: Props) {
  const { id } = await params;
  const trial = getTrial(id);

  if (!trial) {
    notFound();
  }

  return <TrialClient trial={trial} />;
}
