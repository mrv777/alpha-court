"use client";

import { useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { DataProgress } from "@/hooks/use-debate-stream";
import type { AgentRole } from "@/lib/agents/types";

// ── Config ──────────────────────────────────────────────────────────────

const AGENT_CONFIG: Record<
  AgentRole,
  {
    label: string;
    role: string;
    avatar: string;
    color: string;
    colorClass: string;
    borderClass: string;
    bgGlow: string;
    scanColor: string;
  }
> = {
  bull: {
    label: "The Bull",
    role: "Prosecution",
    avatar: "/bull-avatar.png",
    color: "#22c55e",
    colorClass: "text-bull",
    borderClass: "border-bull/20",
    bgGlow: "shadow-[0_0_30px_rgba(34,197,94,0.05)]",
    scanColor: "#22c55e",
  },
  bear: {
    label: "The Bear",
    role: "Defense",
    avatar: "/bear-avatar.png",
    color: "#ef4444",
    colorClass: "text-bear",
    borderClass: "border-bear/20",
    bgGlow: "shadow-[0_0_30px_rgba(239,68,68,0.05)]",
    scanColor: "#ef4444",
  },
  judge: {
    label: "The Judge",
    role: "Presiding",
    avatar: "/judge-avatar.png",
    color: "#f59e0b",
    colorClass: "text-judge",
    borderClass: "border-judge/20",
    bgGlow: "shadow-[0_0_40px_rgba(245,158,11,0.08)]",
    scanColor: "#f59e0b",
  },
};

const AGENT_ORDER: AgentRole[] = ["bull", "judge", "bear"];
const ENTRANCE_DELAYS: Record<AgentRole, number> = { bull: 0, judge: 0.15, bear: 0.3 };

const ENDPOINT_LABELS: Record<string, string> = {
  "smart-money netflow": "Tracking smart money flows",
  "who-bought-sold (buy)": "Finding recent buyers",
  "flow-intelligence": "Analyzing capital inflows",
  "profiler-pnl (buyers)": "Checking buyer win rates",
  "dexscreener (bull)": "Pulling market data",
  "jupiter-price": "Fetching live price",
  "token-dex-trades": "Scanning DEX sell pressure",
  "token-holders": "Analyzing holder concentration",
  "sm-dex-trades": "Tracking smart money exits",
  "token-flows (whale)": "Monitoring whale movements",
  "dexscreener (bear)": "Checking liquidity depth",
  "goplus-security": "Running security audit",
  "token-info": "Reviewing token metadata",
  "token-ohlcv": "Charting price history",
  "who-bought-sold (sell)": "Identifying recent sellers",
  "profiler-pnl (sellers)": "Checking seller PnL",
};

// ── Progress Ring ───────────────────────────────────────────────────────

function ProgressRing({
  completed,
  total,
  color,
}: {
  completed: number;
  total: number;
  color: string;
}) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative size-10 shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 36 36">
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="#1e1e2e"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-[1200ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-court-text-muted">
        {Math.round(pct * 100)}
      </span>
    </div>
  );
}

// ── Status Indicator ────────────────────────────────────────────────────

function StatusIndicator({
  status,
  agentColor,
}: {
  status: DataProgress["status"];
  agentColor: string;
}) {
  if (status === "complete") {
    return (
      <motion.span
        className="flex items-center justify-center size-4"
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.5, 1] }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Check className="size-3.5 text-bull" />
      </motion.span>
    );
  }

  if (status === "error") {
    return (
      <motion.span
        className="flex items-center justify-center size-4"
        animate={{ x: [0, -3, 3, -3, 0] }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <X className="size-3.5 text-bear" />
      </motion.span>
    );
  }

  // pending
  return (
    <span
      className="flex items-center justify-center size-4"
    >
      <span
        className="size-2 rounded-full dot-pulse"
        style={{ backgroundColor: agentColor, opacity: 0.5 }}
      />
    </span>
  );
}

// ── Data Source Row ──────────────────────────────────────────────────────

function DataSourceRow({
  item,
  agentColor,
}: {
  item: DataProgress;
  agentColor: string;
}) {
  const prevStatusRef = useRef(item.status);
  const justCompleted = useRef(false);

  useEffect(() => {
    if (prevStatusRef.current === "pending" && item.status === "complete") {
      justCompleted.current = true;
    }
    prevStatusRef.current = item.status;
  }, [item.status]);

  const showFlash =
    justCompleted.current && item.status === "complete";

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs font-mono relative overflow-hidden rounded px-1.5 py-0.5",
        item.status === "complete" && "text-court-text-muted",
        item.status === "error" && "text-bear/70",
        item.status === "pending" && "text-court-text-dim"
      )}
      style={
        showFlash
          ? ({ "--flash-color": `${agentColor}15` } as React.CSSProperties)
          : undefined
      }
    >
      {showFlash && <div className="row-flash absolute inset-0" />}
      <StatusIndicator status={item.status} agentColor={agentColor} />
      <span className="truncate">{ENDPOINT_LABELS[item.endpoint] ?? item.endpoint}</span>
    </div>
  );
}

// ── Agent Briefing Card ─────────────────────────────────────────────────

function AgentBriefing({
  agent,
  items,
}: {
  agent: AgentRole;
  items: DataProgress[];
}) {
  const config = AGENT_CONFIG[agent];
  const completed = items.filter((i) => i.status === "complete").length;
  const hasPending = items.some((i) => i.status === "pending");
  const bgColorClass =
    agent === "bull" ? "bg-bull" : agent === "bear" ? "bg-bear" : "bg-judge";
  const topGlowClass =
    agent === "bull"
      ? "via-bull/30"
      : agent === "bear"
        ? "via-bear/30"
        : "via-judge/30";

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden border bg-white/[0.02] backdrop-blur-sm",
        config.borderClass,
        config.bgGlow,
        agent === "judge" && "sm:-mt-1 sm:mb-1"
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: ENTRANCE_DELAYS[agent],
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      {/* Colored top accent bar */}
      <div className={cn("h-[3px]", bgColorClass)} />

      {/* Top edge glow */}
      <div
        className={cn(
          "absolute inset-x-0 top-[3px] h-px bg-gradient-to-r from-transparent to-transparent",
          topGlowClass
        )}
      />

      {/* Scan-line overlay while loading */}
      <AnimatePresence>
        {hasPending && (
          <motion.div
            className="scan-line"
            style={{ "--scan-color": config.scanColor } as React.CSSProperties}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      {/* Card header */}
      <div className="flex items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2.5">
          <Image
            src={config.avatar}
            alt={config.label}
            width={32}
            height={32}
            className="rounded-sm shrink-0"
          />
          <div>
            <h3
              className={cn(
                "text-xs font-bold uppercase tracking-wider",
                config.colorClass
              )}
            >
              {config.label}
            </h3>
            <p className="text-[10px] text-court-text-dim">{config.role}</p>
          </div>
        </div>
        <ProgressRing
          completed={completed}
          total={items.length}
          color={config.color}
        />
      </div>

      {/* Data source list */}
      <motion.div
        className="px-3 pb-3 space-y-0.5"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: 0.06, delayChildren: ENTRANCE_DELAYS[agent] + 0.2 },
          },
        }}
      >
        {items.map((item) => (
          <motion.div
            key={item.endpoint}
            variants={{
              hidden: { opacity: 0, x: -8 },
              visible: { opacity: 1, x: 0 },
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <DataSourceRow item={item} agentColor={config.color} />
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ── Main Grid ───────────────────────────────────────────────────────────

interface DataProgressGridProps {
  items: DataProgress[];
}

export function DataProgressGrid({ items }: DataProgressGridProps) {
  const grouped = useMemo(() => {
    const g: Record<AgentRole, DataProgress[]> = {
      bull: [],
      bear: [],
      judge: [],
    };
    for (const item of items) {
      g[item.agent]?.push(item);
    }
    return g;
  }, [items]);

  const totalItems = items.length;
  const completedItems = items.filter((i) => i.status === "complete").length;
  const pct = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-court-text-muted">
            Gathering Evidence
          </h2>
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1 rounded-full bg-judge animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </span>
        </div>
        <p className="text-xs text-court-text-dim">
          Agents are building their cases...
        </p>
      </div>

      {/* Agent cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {AGENT_ORDER.map(
          (agent) =>
            grouped[agent].length > 0 && (
              <AgentBriefing
                key={agent}
                agent={agent}
                items={grouped[agent]}
              />
            )
        )}
      </div>

      {/* Overall progress bar */}
      <div className="mx-auto max-w-xs">
        <div className="h-0.5 bg-court-border overflow-hidden">
          <motion.div
            className="h-full bg-judge"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
        <p className="text-center text-[10px] text-court-text-dim mt-1.5 font-mono">
          {completedItems}/{totalItems} sources
        </p>
      </div>
    </div>
  );
}
