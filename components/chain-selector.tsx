"use client";

import { cn } from "@/lib/utils";
import type { Chain } from "@/lib/data/types";

const CHAINS: { value: Chain; label: string; icon: string }[] = [
  { value: "solana", label: "Solana", icon: "◎" },
  { value: "base", label: "Base", icon: "🔵" },
  { value: "ethereum", label: "Ethereum", icon: "⟠" },
];

interface ChainSelectorProps {
  value: Chain;
  onChange: (chain: Chain) => void;
  className?: string;
}

export function ChainSelector({ value, onChange, className }: ChainSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Chain)}
      className={cn(
        "h-12 min-w-[100px] border border-court-border bg-court-surface px-3 text-sm text-court-text",
        "outline-none transition-colors",
        "focus:border-judge focus:ring-1 focus:ring-judge/50",
        "cursor-pointer appearance-none",
        className
      )}
      aria-label="Select blockchain"
    >
      {CHAINS.map((chain) => (
        <option key={chain.value} value={chain.value}>
          {chain.icon} {chain.label}
        </option>
      ))}
    </select>
  );
}
