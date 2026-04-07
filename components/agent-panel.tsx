"use client";

import { cn } from "@/lib/utils";
import type { AgentRole } from "@/lib/agents/types";
import type { Verdict } from "@/hooks/use-debate-stream";

const AGENT_CONFIG: Record<
  AgentRole,
  {
    label: string;
    role: string;
    icon: string;
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
    color: "text-judge",
    darkColor: "text-judge-dark",
    borderColor: "border-judge/20",
    glowColor: "shadow-[0_0_20px_rgba(245,158,11,0.08)]",
    meterColor: "bg-judge",
  },
};

interface AgentPanelProps {
  agent: AgentRole;
  evidence: Array<{ endpoint: string; displayValue: string }>;
  verdict: Verdict | null;
  className?: string;
}

export function AgentPanel({
  agent,
  evidence,
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

  return (
    <div
      className={cn(
        "rounded-lg border bg-court-surface p-4 flex flex-col gap-4",
        config.borderColor,
        config.glowColor,
        className
      )}
    >
      {/* Identity */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{config.icon}</span>
        <div>
          <h3 className={cn("text-sm font-bold", config.color)}>
            {config.label}
          </h3>
          <p className="text-xs text-court-text-dim">{config.role}</p>
        </div>
      </div>

      {/* Evidence highlights */}
      <div className="flex-1 min-h-0">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-court-text-muted mb-2">
          Key Evidence
        </h4>
        {evidence.length > 0 ? (
          <ul className="space-y-1.5">
            {evidence.slice(0, 6).map((e, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-xs text-court-text-muted"
              >
                <span className={cn("mt-0.5 shrink-0", config.color)}>•</span>
                <span className="font-mono leading-tight">
                  {e.displayValue}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-court-text-dim italic">
            No evidence available
          </p>
        )}
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
          <div className="h-2 rounded-full bg-court-border overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-[2000ms] ease-out",
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
  evidence,
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
        "rounded-lg border bg-court-surface px-3 py-2 flex items-center gap-3",
        config.borderColor
      )}
    >
      <span className="text-base">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <span className={cn("text-xs font-bold", config.color)}>
          {config.label}
        </span>
        {evidence.length > 0 && (
          <p className="text-xs text-court-text-dim truncate font-mono">
            {evidence[0].displayValue}
            {evidence.length > 1 && ` +${evidence.length - 1} more`}
          </p>
        )}
      </div>
      {conviction !== null && (
        <span className={cn("text-xs font-mono font-bold", config.color)}>
          {conviction}
        </span>
      )}
    </div>
  );
}
