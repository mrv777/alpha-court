"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Verdict } from "@/hooks/use-debate-stream";
import { SafetyBadge } from "@/components/safety-badge";

// ── Helpers ──────────────────────────────────────────────────────────

function getVerdictColor(score: number): string {
  if (score >= 60) return "text-bull";
  if (score >= 20) return "text-bull/80";
  if (score > -20) return "text-court-text-muted";
  if (score > -60) return "text-bear/80";
  return "text-bear";
}

function getVerdictBgGlow(score: number): string {
  if (score >= 60) return "shadow-[0_0_60px_rgba(34,197,94,0.15)]";
  if (score >= 20) return "shadow-[0_0_40px_rgba(34,197,94,0.08)]";
  if (score > -20) return "";
  if (score > -60) return "shadow-[0_0_40px_rgba(239,68,68,0.08)]";
  return "shadow-[0_0_60px_rgba(239,68,68,0.15)]";
}

function getScoreColor(score: number): string {
  if (score >= 60) return "#22c55e";
  if (score >= 20) return "#4ade80";
  if (score > -20) return "#8888a0";
  if (score > -60) return "#f87171";
  return "#ef4444";
}

// ── Score Bar (horizontal position bar) ──────────────────────────────

function ScoreBar({
  score,
  label,
  tokenName,
  animated,
}: {
  score: number;
  label: string;
  tokenName: string;
  animated: boolean;
}) {
  const color = getScoreColor(score);
  const verdictColor = getVerdictColor(score);
  // Map -100..+100 to 0%..100%
  const position = ((score + 100) / 200) * 100;
  const fillFrom = score >= 0 ? 50 : position;
  const fillWidth = score >= 0 ? position - 50 : 50 - position;

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-3">
      {/* Large score number */}
      <div
        className={cn(
          "text-5xl font-mono font-bold tabular-nums",
          animated
            ? "opacity-100 transition-opacity duration-500 delay-[800ms]"
            : "opacity-0"
        )}
        style={{ color }}
      >
        {score > 0 ? `+${score}` : score}
      </div>

      {/* Verdict label */}
      <div
        className={cn(
          "text-center",
          animated
            ? "opacity-100 translate-y-0 transition-all duration-500 delay-[1000ms]"
            : "opacity-0 translate-y-1"
        )}
      >
        <h2 className={cn("text-lg font-bold uppercase tracking-wider", verdictColor)}>
          {label}
        </h2>
        <p className="text-xs text-court-text-dim mt-0.5">{tokenName}</p>
      </div>

      {/* Horizontal bar */}
      <div
        className={cn(
          "w-full",
          animated
            ? "opacity-100 transition-opacity duration-300 delay-[1100ms]"
            : "opacity-0"
        )}
      >
        <div className="relative h-1.5 w-full bg-court-border">
          {/* Center line */}
          <div className="absolute left-1/2 top-0 w-px h-full bg-court-text-dim/40" />
          {/* Fill from center to score */}
          <div
            className="absolute top-0 h-full transition-all duration-[1500ms] ease-out"
            style={{
              left: `${fillFrom}%`,
              width: animated ? `${fillWidth}%` : "0%",
              backgroundColor: color,
            }}
          />
          {/* Position marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 transition-all duration-[1500ms] ease-out"
            style={{
              left: animated ? `${position}%` : "50%",
              backgroundColor: color,
            }}
          />
        </div>
        {/* Scale labels */}
        <div className="flex justify-between mt-1">
          <span className="text-[10px] font-mono text-court-text-dim">-100</span>
          <span className="text-[10px] font-mono text-court-text-dim">0</span>
          <span className="text-[10px] font-mono text-court-text-dim">+100</span>
        </div>
      </div>
    </div>
  );
}

// ── Conviction Meter ─────────────────────────────────────────────────

function ConvictionMeter({
  label,
  value,
  color,
  animated,
}: {
  label: string;
  value: number;
  color: string;
  animated: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-court-text-muted">{label}</span>
        <span className={cn("text-sm font-mono font-bold", color)}>
          {value}
        </span>
      </div>
      <div className="h-3 bg-court-border overflow-hidden">
        <div
          className={cn(
            "h-full",
            color === "text-bull" ? "bg-bull" : "bg-bear",
            animated
              ? "transition-all duration-[2000ms] ease-out"
              : ""
          )}
          style={{ width: animated ? `${value}%` : "0%" }}
        />
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

interface VerdictDisplayProps {
  verdict: Verdict;
  tokenName: string;
  safetyDetails?: string[] | null;
  className?: string;
  /** Skip animation (for OG image / static render) */
  static?: boolean;
}

export function VerdictDisplay({
  verdict,
  tokenName,
  safetyDetails,
  className,
  static: isStatic = false,
}: VerdictDisplayProps) {
  const [animated, setAnimated] = useState(isStatic);

  useEffect(() => {
    if (isStatic) return;
    // Brief dramatic pause then trigger animations
    const timer = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(timer);
  }, [isStatic]);

  const verdictColor = getVerdictColor(verdict.score);
  const bgGlow = getVerdictBgGlow(verdict.score);

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 flex flex-col items-center gap-5",
        bgGlow,
        className
      )}
    >
      {/* Top edge highlight */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
        verdict.score >= 20 ? "via-bull/60" : verdict.score <= -20 ? "via-bear/60" : "via-judge/40"
      )} />
      {/* Score bar */}
      <ScoreBar
        score={verdict.score}
        label={verdict.label}
        tokenName={tokenName}
        animated={animated}
      />

      {/* Summary */}
      <p
        className={cn(
          "text-sm text-court-text-muted text-center max-w-md leading-relaxed",
          animated
            ? "opacity-100 transition-opacity duration-500 delay-[1200ms]"
            : "opacity-0"
        )}
      >
        {verdict.summary}
      </p>

      {/* Conviction meters */}
      <div
        className={cn(
          "w-full max-w-md space-y-3",
          animated
            ? "opacity-100 transition-opacity duration-300 delay-[1400ms]"
            : "opacity-0"
        )}
      >
        <ConvictionMeter
          label="Bull Conviction"
          value={verdict.bull_conviction}
          color="text-bull"
          animated={animated}
        />
        <ConvictionMeter
          label="Bear Conviction"
          value={verdict.bear_conviction}
          color="text-bear"
          animated={animated}
        />
      </div>

      {/* Safety badge */}
      <div
        className={cn(
          animated
            ? "opacity-100 transition-opacity duration-300 delay-[1600ms]"
            : "opacity-0"
        )}
      >
        <SafetyBadge
          score={verdict.safety}
          details={safetyDetails}
        />
      </div>
    </div>
  );
}
