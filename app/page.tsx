import Image from "next/image";
import { getDb } from "@/lib/db";
import { LandingClient } from "./landing-client";

interface TrialRow {
  id: string;
  token_symbol: string | null;
  token_name: string | null;
  token_icon_url: string | null;
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
      `SELECT id, token_symbol, token_name, token_icon_url, chain, verdict_label, verdict_score, status, created_at
       FROM trials
       ORDER BY created_at DESC
       LIMIT 10`
    )
    .all() as TrialRow[];
}

export default function HomePage() {
  const recentTrials = getRecentTrials();

  return (
    <main className="relative flex flex-1 flex-col items-center px-4 pt-20 pb-12 overflow-hidden">
      {/* Ambient glow orbs — animated */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute top-[-20%] left-[10%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.10)_0%,transparent_70%)] blur-3xl"
          style={{ animation: "float-1 20s ease-in-out infinite, pulse-glow 8s ease-in-out infinite" }}
        />
        <div
          className="absolute bottom-[-10%] right-[5%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(34,197,94,0.06)_0%,transparent_70%)] blur-3xl"
          style={{ animation: "float-2 25s ease-in-out infinite, pulse-glow 10s ease-in-out infinite 2s" }}
        />
        <div
          className="absolute top-[50%] right-[30%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.05)_0%,transparent_70%)] blur-3xl"
          style={{ animation: "float-3 22s ease-in-out infinite, pulse-glow 12s ease-in-out infinite 4s" }}
        />
      </div>

      {/* Dot grid pattern — faded at edges */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle,rgba(136,136,160,0.12)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,black_30%,transparent_100%)]" />

      {/* Hero */}
      <div className="flex flex-col items-center mb-3">
        <Image
          src="/logo.png"
          alt="Alpha Court"
          width={72}
          height={72}
          className="rounded-xl mb-5 shadow-[0_0_60px_rgba(245,158,11,0.2)]"
          priority
        />
        <h1 className="font-heading text-4xl font-bold tracking-tight text-court-text sm:text-5xl [text-shadow:0_0_40px_rgba(245,158,11,0.25),0_0_80px_rgba(245,158,11,0.08)]">
          Alpha Court
        </h1>
      </div>
      <p className="mb-10 text-center text-court-text-muted max-w-md text-base">
        Three AI agents argue about every trade using on-chain data.
        <br />
        <span className="text-court-text-dim">Watch the trial. Get the verdict.</span>
      </p>

      {/* Token input + chain selector + CTA */}
      <LandingClient recentTrials={recentTrials} />
    </main>
  );
}
