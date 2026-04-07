"use client";

import { cn } from "@/lib/utils";
import { Check, X, Loader2 } from "lucide-react";
import type { DataProgress } from "@/hooks/use-debate-stream";
import type { AgentRole } from "@/lib/agents/types";

const AGENT_CONFIG: Record<
  AgentRole,
  { label: string; color: string; borderColor: string }
> = {
  bull: {
    label: "The Bull",
    color: "text-bull",
    borderColor: "border-bull/30",
  },
  bear: {
    label: "The Bear",
    color: "text-bear",
    borderColor: "border-bear/30",
  },
  judge: {
    label: "The Judge",
    color: "text-judge",
    borderColor: "border-judge/30",
  },
};

interface DataProgressGridProps {
  items: DataProgress[];
}

function StatusIcon({ status }: { status: DataProgress["status"] }) {
  switch (status) {
    case "complete":
      return <Check className="size-3.5 text-bull" />;
    case "error":
      return <X className="size-3.5 text-bear" />;
    case "pending":
    default:
      return <Loader2 className="size-3.5 text-court-text-dim animate-spin" />;
  }
}

function AgentGroup({
  agent,
  items,
}: {
  agent: AgentRole;
  items: DataProgress[];
}) {
  const config = AGENT_CONFIG[agent];

  return (
    <div
      className={cn(
        "rounded-lg border bg-court-surface p-3",
        config.borderColor
      )}
    >
      <h3
        className={cn("text-xs font-semibold uppercase tracking-wider mb-2", config.color)}
      >
        {config.label}
      </h3>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.endpoint}
            className={cn(
              "flex items-center gap-2 text-xs font-mono",
              item.status === "complete" && "text-court-text-muted",
              item.status === "error" && "text-bear/70",
              item.status === "pending" && "text-court-text-dim"
            )}
          >
            <StatusIcon status={item.status} />
            <span className="truncate">{item.endpoint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DataProgressGrid({ items }: DataProgressGridProps) {
  const grouped: Record<AgentRole, DataProgress[]> = {
    bull: [],
    bear: [],
    judge: [],
  };

  for (const item of items) {
    grouped[item.agent]?.push(item);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {(["bull", "bear", "judge"] as const).map(
        (agent) =>
          grouped[agent].length > 0 && (
            <AgentGroup key={agent} agent={agent} items={grouped[agent]} />
          )
      )}
    </div>
  );
}
