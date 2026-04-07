import Link from "next/link";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";

interface TrialCardProps {
  id: string;
  tokenSymbol: string | null;
  tokenName: string | null;
  chain: string;
  verdictLabel: string | null;
  verdictScore: number | null;
  status: string;
  createdAt: number; // unix seconds
}

function getVerdictColor(label: string | null): {
  text: string;
  bg: string;
  border: string;
  glow: string;
} {
  switch (label) {
    case "STRONG BUY":
    case "BUY":
      return {
        text: "text-bull",
        bg: "bg-bull/10",
        border: "border-bull/30",
        glow: "shadow-[0_0_12px_rgba(34,197,94,0.15)]",
      };
    case "STRONG SELL":
    case "SELL":
      return {
        text: "text-bear",
        bg: "bg-bear/10",
        border: "border-bear/30",
        glow: "shadow-[0_0_12px_rgba(239,68,68,0.15)]",
      };
    case "HOLD":
      return {
        text: "text-court-text-muted",
        bg: "bg-court-border/50",
        border: "border-court-border-light",
        glow: "",
      };
    default:
      return {
        text: "text-court-text-dim",
        bg: "bg-court-border/30",
        border: "border-court-border",
        glow: "",
      };
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "pending":
    case "gathering":
      return "Gathering data...";
    case "debating":
      return "Debating...";
    case "verdict":
      return "Rendering verdict...";
    case "error":
      return "Error";
    default:
      return "";
  }
}

export function TrialCard({
  id,
  tokenSymbol,
  tokenName,
  chain,
  verdictLabel,
  verdictScore,
  status,
  createdAt,
}: TrialCardProps) {
  const colors = getVerdictColor(verdictLabel);
  const isComplete = status === "completed";
  const displaySymbol = tokenSymbol ? `$${tokenSymbol}` : "Unknown";

  return (
    <Link
      href={`/trial/${id}`}
      className={cn(
        "group block rounded-lg border p-4 transition-all",
        "bg-court-surface hover:bg-court-border/50",
        colors.border,
        colors.glow,
        "hover:scale-[1.02]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-court-text">{displaySymbol}</p>
          {tokenName && (
            <p className="truncate text-xs text-court-text-dim">{tokenName}</p>
          )}
        </div>
        <span className="text-xs uppercase text-court-text-dim">{chain}</span>
      </div>

      <div className="mt-3">
        {isComplete && verdictLabel ? (
          <div className="flex items-center justify-between">
            <span className={cn("text-sm font-semibold", colors.text)}>
              {verdictLabel}
            </span>
            {verdictScore != null && (
              <span
                className={cn(
                  "font-mono text-sm font-bold",
                  colors.text
                )}
              >
                {verdictScore > 0 ? "+" : ""}
                {verdictScore}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-court-text-dim animate-pulse">
            {getStatusLabel(status)}
          </p>
        )}
      </div>

      <p className="mt-2 text-xs text-court-text-dim">
        {timeAgo(createdAt * 1000)}
      </p>
    </Link>
  );
}
