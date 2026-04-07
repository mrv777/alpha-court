import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { TrialClient } from "./trial-client";

interface TrialRow {
  id: string;
  token_address: string;
  chain: string;
  token_name: string | null;
  token_symbol: string | null;
  status: string;
  error_message: string | null;
}

export default async function TrialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const trial = getDb()
    .prepare(
      "SELECT id, token_address, chain, token_name, token_symbol, status, error_message FROM trials WHERE id = ?"
    )
    .get(id) as TrialRow | undefined;

  if (!trial) {
    notFound();
  }

  return <TrialClient trial={trial} />;
}
