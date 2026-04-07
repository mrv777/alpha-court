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

function getGaugeRotation(score: number): number {
  // Map -100..+100 to -90..+90 degrees
  return (score / 100) * 90;
}

function getGaugeColor(score: number): string {
  if (score >= 60) return "#22c55e";
  if (score >= 20) return "#4ade80";
  if (score > -20) return "#8888a0";
  if (score > -60) return "#f87171";
  return "#ef4444";
}

// ── Score Gauge (SVG arc) ────────────────────────────────────────────

function ScoreGauge({
  score,
  animated,
}: {
  score: number;
  animated: boolean;
}) {
  const radius = 80;
  const strokeWidth = 8;
  const center = 100;
  // Arc from -90deg (left) to +90deg (right), bottom half hidden
  // We draw a semicircle from 180deg to 0deg (top half)
  const startAngle = 180;
  const endAngle = 0;
  const totalSweep = 180;

  // Score maps -100..100 to 0..180 degrees from left
  const scoreAngle = ((score + 100) / 200) * totalSweep;
  const currentAngle = animated ? scoreAngle : 0;

  // Convert angle to SVG arc coordinates
  function polarToCartesian(angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center - radius * Math.sin(rad),
    };
  }

  // Background arc (full semicircle)
  const bgStart = polarToCartesian(startAngle);
  const bgEnd = polarToCartesian(endAngle);
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 0 1 ${bgEnd.x} ${bgEnd.y}`;

  // Foreground arc (score portion)
  const fgStart = polarToCartesian(startAngle);
  const fgAngle = startAngle - currentAngle;
  const fgEnd = polarToCartesian(Math.max(fgAngle, endAngle));
  const largeArc = currentAngle > 180 ? 1 : 0;
  const fgPath =
    currentAngle > 0
      ? `M ${fgStart.x} ${fgStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${fgEnd.x} ${fgEnd.y}`
      : "";

  const color = getGaugeColor(score);

  return (
    <div className="relative w-[200px] h-[110px]">
      <svg viewBox="0 0 200 110" className="w-full h-full">
        {/* Background track */}
        <path
          d={bgPath}
          fill="none"
          stroke="#1e1e2e"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Score arc */}
        {fgPath && (
          <path
            d={fgPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={animated ? "transition-all duration-[1500ms] ease-out" : ""}
          />
        )}
        {/* Tick marks */}
        {[-100, -50, 0, 50, 100].map((tick) => {
          const angle = startAngle - ((tick + 100) / 200) * totalSweep;
          const inner = polarToCartesian(angle);
          const outerRadius = radius + 12;
          const rad = (angle * Math.PI) / 180;
          const outer = {
            x: center + outerRadius * Math.cos(rad),
            y: center - outerRadius * Math.sin(rad),
          };
          return (
            <line
              key={tick}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#555570"
              strokeWidth={1}
            />
          );
        })}
      </svg>
      {/* Center score number */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <span
          className={cn(
            "text-3xl font-mono font-bold tabular-nums",
            animated
              ? "opacity-100 transition-opacity duration-500 delay-1000"
              : "opacity-0"
          )}
          style={{ color }}
        >
          {score > 0 ? `+${score}` : score}
        </span>
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
      <div className="h-3 rounded-full bg-court-border overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
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
        "relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-6 flex flex-col items-center gap-5",
        bgGlow,
        className
      )}
    >
      {/* Top edge highlight */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
        verdict.score >= 20 ? "via-bull/40" : verdict.score <= -20 ? "via-bear/40" : "via-judge/30"
      )} />
      {/* Score gauge */}
      <ScoreGauge score={verdict.score} animated={animated} />

      {/* Verdict label */}
      <div
        className={cn(
          "text-center",
          animated
            ? "opacity-100 translate-y-0 transition-all duration-700 delay-1000"
            : "opacity-0 translate-y-2"
        )}
      >
        <h2 className={cn("text-2xl font-bold tracking-tight", verdictColor)}>
          {verdict.label}
        </h2>
        <p className="text-xs text-court-text-dim mt-1">
          {tokenName}
        </p>
      </div>

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
