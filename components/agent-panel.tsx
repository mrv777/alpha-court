"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { AgentRole } from "@/lib/agents/types";
import type { Verdict } from "@/hooks/use-debate-stream";

const AGENT_CONFIG: Record<
  AgentRole,
  {
    label: string;
    role: string;
    icon: string;
    avatar: string;
    color: string;
    darkColor: string;
    borderColor: string;
    glowColor: string;
    meterColor: string;
  }
> = {
  bull: {
    label: "The Bull",
    role: "Argues FOR buying",
    icon: "🟢",
    avatar: "/bull-avatar.png",
    color: "text-bull",
    darkColor: "text-bull-dark",
    borderColor: "border-bull/20",
    glowColor: "shadow-[0_0_20px_rgba(34,197,94,0.08)]",
    meterColor: "bg-bull",
  },
  bear: {
    label: "The Bear",
    role: "Argues AGAINST buying",
    icon: "🔴",
    avatar: "/bear-avatar.png",
    color: "text-bear",
    darkColor: "text-bear-dark",
    borderColor: "border-bear/20",
    glowColor: "shadow-[0_0_20px_rgba(239,68,68,0.08)]",
    meterColor: "bg-bear",
  },
  judge: {
    label: "The Judge",
    role: "Impartial arbiter",
    icon: "⚖️",
    avatar: "/judge-avatar.png",
    color: "text-judge",
    darkColor: "text-judge-dark",
    borderColor: "border-judge/20",
    glowColor: "shadow-[0_0_20px_rgba(245,158,11,0.08)]",
    meterColor: "bg-judge",
  },
};

interface AgentPanelProps {
  agent: AgentRole;
  verdict: Verdict | null;
  className?: string;
}

export function AgentPanel({
  agent,
  verdict,
  className,
}: AgentPanelProps) {
  const config = AGENT_CONFIG[agent];
  const conviction =
    verdict && agent === "bull"
      ? verdict.bull_conviction
      : verdict && agent === "bear"
        ? verdict.bear_conviction
        : null;

  const topEdgeColor =
    agent === "bull" ? "via-bull/40" : agent === "bear" ? "via-bear/40" : "via-judge/40";

  return (
    <div
      className={cn(
        "relative overflow-hidden border bg-white/[0.02] backdrop-blur-sm p-4 flex flex-col gap-4",
        config.borderColor,
        config.glowColor,
        className
      )}
    >
      {/* Top edge highlight */}
      <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent", topEdgeColor)} />
      {/* Identity */}
      <div className="flex items-center gap-2.5">
        <Image
          src={config.avatar}
          alt={config.label}
          width={36}
          height={36}
          className="rounded-sm shrink-0"
        />
        <div>
          <h3 className={cn("text-sm font-bold", config.color)}>
            {config.label}
          </h3>
          <p className="text-xs text-court-text-dim">{config.role}</p>
        </div>
      </div>

      {/* Conviction meter — hidden until verdict */}
      {conviction !== null && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-court-text-muted">Conviction</span>
            <span className={cn("text-xs font-mono font-bold", config.color)}>
              {conviction}
            </span>
          </div>
          <div className="h-2 bg-court-border overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-[2000ms] ease-out",
                config.meterColor
              )}
              style={{ width: `${conviction}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact card variant for mobile */
export function AgentPanelCompact({
  agent,
  verdict,
}: AgentPanelProps) {
  const config = AGENT_CONFIG[agent];
  const conviction =
    verdict && agent === "bull"
      ? verdict.bull_conviction
      : verdict && agent === "bear"
        ? verdict.bear_conviction
        : null;

  return (
    <div
      className={cn(
        "border bg-court-surface px-3 py-2 flex items-center gap-3 min-w-[160px] shrink-0",
        config.borderColor
      )}
    >
      <Image
        src={config.avatar}
        alt={config.label}
        width={28}
        height={28}
        className="rounded-sm shrink-0"
      />
      <div className="flex-1 min-w-0">
        <span className={cn("text-xs font-bold", config.color)}>
          {config.label}
        </span>
      </div>
      {conviction !== null && (
        <span className={cn("text-xs font-mono font-bold", config.color)}>
          {conviction}
        </span>
      )}
    </div>
  );
}
