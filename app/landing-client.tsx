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
      {/* Search row */}
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
        <p className="mt-2 text-sm text-bear">{error}</p>
      )}
      {cooldown && (
        <div className="mt-2 flex items-center gap-2 text-sm text-judge">
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
      <Button
        size="lg"
        onClick={beginTrial}
        disabled={!canSubmit}
        className="mt-4 w-full h-12 text-base font-semibold gap-2"
      >
        <Gavel className="size-5" />
        {isSubmitting ? "Starting Trial..." : "Begin Trial"}
      </Button>

      {/* Recent Trials */}
      <section className="mt-16 w-full">
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
                chain={trial.chain}
                verdictLabel={trial.verdict_label}
                verdictScore={trial.verdict_score}
                status={trial.status}
                createdAt={trial.created_at}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-court-border bg-court-surface p-8 text-center">
            <p className="text-court-text-muted">
              No trials yet — put a token on trial!
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
