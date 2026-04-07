"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Shield, ShieldAlert, Skull } from "lucide-react";

interface SafetyBadgeProps {
  score: string; // "clean" | "warnings" | "dangerous"
  details?: string[] | null;
  className?: string;
}

const CONFIG = {
  clean: {
    icon: Shield,
    label: "Clean",
    color: "text-bull",
    bg: "bg-bull/10",
    border: "border-bull/20",
  },
  warnings: {
    icon: ShieldAlert,
    label: "Warnings",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/20",
  },
  dangerous: {
    icon: Skull,
    label: "Dangerous",
    color: "text-bear",
    bg: "bg-bear/10",
    border: "border-bear/20",
  },
} as const;

export function SafetyBadge({ score, details, className }: SafetyBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Hide entirely if no safety data
  if (!score) return null;

  const config = CONFIG[score as keyof typeof CONFIG] ?? CONFIG.clean;
  const Icon = config.icon;
  const warningCount =
    score === "warnings" || score === "dangerous"
      ? details?.length ?? 0
      : 0;
  const hasDetails = details && details.length > 0;

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        type="button"
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 min-h-[44px] sm:min-h-0 sm:py-1 text-xs font-medium transition-colors",
          config.bg,
          config.border,
          config.color,
          "hover:brightness-110 cursor-default",
          hasDetails && "cursor-pointer"
        )}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip((s) => !s)}
        aria-label={`Safety: ${config.label}`}
      >
        <Icon className="size-3.5" />
        <span>{config.label}</span>
        {warningCount > 0 && (
          <span className="rounded-full bg-current/20 px-1.5 text-[10px] font-bold">
            {warningCount}
          </span>
        )}
      </button>

      {/* Tooltip with GoPlus findings */}
      {showTooltip && hasDetails && (
        <>
          {/* Backdrop for mobile tap-to-dismiss */}
          <div
            className="fixed inset-0 z-40 sm:hidden"
            onClick={() => setShowTooltip(false)}
          />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-[calc(100vw-2rem)] sm:w-64 max-w-64">
            <div className="rounded-lg border border-court-border bg-court-surface p-3 shadow-xl">
              <h4 className="text-xs font-semibold text-court-text mb-2">
                Security Findings
              </h4>
              <ul className="space-y-1">
                {details.map((reason, i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex items-start gap-1.5 text-xs",
                      config.color
                    )}
                  >
                    <span className="mt-0.5 shrink-0">•</span>
                    <span className="text-court-text-muted">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-court-surface border-b border-r border-court-border rotate-45 -mt-1" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
