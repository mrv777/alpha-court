"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChainSelector } from "@/components/chain-selector";
import { TokenInput } from "@/components/token-input";
import { TrialCard } from "@/components/trial-card";
import type { Chain } from "@/lib/data/types";
import type { TokenSearchResult } from "@/app/api/token/search/route";

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

interface LandingClientProps {
  recentTrials: TrialRow[];
}

export function LandingClient({ recentTrials }: LandingClientProps) {
  const router = useRouter();
  const [chain, setChain] = useState<Chain>("solana");
  const [selectedToken, setSelectedToken] = useState<TokenSearchResult | null>(null);
  const [rawInput, setRawInput] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<{
    trialId: string;
    remainingSeconds: number;
  } | null>(null);

  // Cooldown countdown timer
  useEffect(() => {
    if (!cooldown) return;
    if (cooldown.remainingSeconds <= 0) {
      setCooldown(null);
      return;
    }
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (!prev || prev.remainingSeconds <= 1) return null;
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSelect = useCallback((token: TokenSearchResult) => {
    setSelectedToken(token);
    setRawInput(null);
    setError(null);
    setCooldown(null);
  }, []);

  const handleRawSubmit = useCallback((raw: string) => {
    setRawInput(raw);
    setSelectedToken(null);
    setError(null);
    setCooldown(null);
  }, []);

  const beginTrial = async () => {
    const tokenAddress = selectedToken?.token_address || rawInput;
    if (!tokenAddress) return;

    setIsSubmitting(true);
    setError(null);
    setCooldown(null);

    try {
      const res = await fetch("/api/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress,
          chain,
          tokenName: selectedToken?.token_name,
          tokenSymbol: selectedToken?.token_symbol,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create trial");
        return;
      }

      if (data.cooldown) {
        setCooldown({
          trialId: data.trialId,
          remainingSeconds: data.remainingSeconds,
        });
        return;
      }

      router.push(`/trial/${data.trialId}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    !isSubmitting && (selectedToken !== null || rawInput !== null);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Search area — glass card */}
      <div className="glow-border rounded-2xl p-4 sm:p-5">
        <div className="flex gap-2">
          <TokenInput
            chain={chain}
            onSelect={handleSelect}
            onRawSubmit={handleRawSubmit}
            disabled={isSubmitting}
            className="flex-1"
          />
          <ChainSelector value={chain} onChange={setChain} className="shrink-0" />
        </div>

        {/* Error / cooldown messages */}
        {error && (
          <p className="mt-3 text-sm text-bear">{error}</p>
        )}
        {cooldown && (
          <div className="mt-3 flex items-center gap-2 text-sm text-judge">
            <span>
              Trial exists — new trial available in{" "}
              <span className="font-mono font-bold">
                {formatCountdown(cooldown.remainingSeconds)}
              </span>
            </span>
            <button
              onClick={() => router.push(`/trial/${cooldown.trialId}`)}
              className="underline underline-offset-2 hover:text-judge/80 transition-colors"
            >
              View existing trial
            </button>
          </div>
        )}

        {/* CTA */}
        <div className="relative mt-4">
          {/* Glow behind button */}
          <div className="absolute inset-0 -z-10 mx-auto h-full w-3/4 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,rgba(245,158,11,0.15),transparent)] blur-xl" />
          <Button
            size="lg"
            onClick={beginTrial}
            disabled={!canSubmit}
            className="w-full h-12 text-base font-semibold gap-2 shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_40px_rgba(245,158,11,0.35)] transition-shadow duration-300"
          >
            <Gavel className="size-5" />
            {isSubmitting ? "Starting Trial..." : "Begin Trial"}
          </Button>
        </div>
      </div>

      {/* How it works — 3 agent previews */}
      <div className="mt-12 grid grid-cols-3 gap-3">
        {[
          { label: "The Bull", desc: "Argues FOR", color: "text-bull", border: "border-bull/20", glow: "via-bull/40", avatar: "/bull-avatar.png" },
          { label: "The Judge", desc: "Decides", color: "text-judge", border: "border-judge/20", glow: "via-judge/40", avatar: "/judge-avatar.png" },
          { label: "The Bear", desc: "Argues AGAINST", color: "text-bear", border: "border-bear/20", glow: "via-bear/40", avatar: "/bear-avatar.png" },
        ].map((a) => (
          <div
            key={a.label}
            className={`relative overflow-hidden rounded-xl border ${a.border} bg-white/[0.02] backdrop-blur-sm p-3 text-center`}
          >
            {/* Top edge highlight */}
            <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${a.glow} to-transparent`} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.avatar} alt={a.label} className="size-10 rounded-lg mx-auto mb-2" />
            <p className={`text-xs font-bold ${a.color}`}>{a.label}</p>
            <p className="text-[10px] text-court-text-dim">{a.desc}</p>
          </div>
        ))}
      </div>

      {/* Recent Trials */}
      <section className="mt-14 w-full">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-court-text-muted">
          Recent Trials
        </h2>
        {recentTrials.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {recentTrials.map((trial) => (
              <TrialCard
                key={trial.id}
                id={trial.id}
                tokenSymbol={trial.token_symbol}
                tokenName={trial.token_name}
                tokenIconUrl={trial.token_icon_url}
                chain={trial.chain}
                verdictLabel={trial.verdict_label}
                verdictScore={trial.verdict_score}
                status={trial.status}
                createdAt={trial.created_at}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-8 text-center">
            <p className="text-court-text-muted">
              No trials yet — put a token on trial!
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
