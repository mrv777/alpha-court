"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

/** Map endpoint prefix to a color scheme */
function getChipColor(endpoint: string): {
  bg: string;
  text: string;
  border: string;
} {
  if (endpoint.startsWith("goplus")) {
    return {
      bg: "bg-judge/10",
      text: "text-judge",
      border: "border-judge/30",
    };
  }
  if (
    endpoint.startsWith("dexscreener") ||
    endpoint.startsWith("jupiter")
  ) {
    return {
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "border-sky-500/30",
    };
  }
  // Nansen / default
  return {
    bg: "bg-bull/10",
    text: "text-bull",
    border: "border-bull/30",
  };
}

interface CitationChipProps {
  endpoint: string;
  displayValue: string;
  /** Raw data snippet for expanded view (from evidence_json) */
  rawData?: string | null;
}

export function CitationChip({
  endpoint,
  displayValue,
  rawData,
}: CitationChipProps) {
  const [expanded, setExpanded] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const colors = getChipColor(endpoint);

  // Close popup on outside click
  useEffect(() => {
    if (!expanded) return;
    function handleClick(e: MouseEvent) {
      if (
        chipRef.current &&
        !chipRef.current.contains(e.target as Node) &&
        popupRef.current &&
        !popupRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [expanded]);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [expanded]);

  return (
    <span className="relative inline-flex align-baseline">
      <button
        ref={chipRef}
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "inline-flex items-center gap-1 border px-1.5 py-0.5",
          "text-xs font-mono font-medium leading-tight",
          "transition-transform duration-150 ease-out",
          "hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "animate-in fade-in zoom-in-95 duration-200",
          colors.bg,
          colors.text,
          colors.border
        )}
        aria-expanded={expanded}
        aria-label={`Citation: ${displayValue} from ${endpoint}`}
      >
        {displayValue}
      </button>

      {expanded && (
        <div
          ref={popupRef}
          role="tooltip"
          className={cn(
            "absolute left-0 sm:left-0 top-full z-50 mt-1",
            "w-[calc(100vw-2rem)] sm:w-64 max-w-64 max-h-48 overflow-auto",
            "border border-court-border-light bg-court-surface p-3",
            "shadow-lg shadow-black/30",
            "text-xs font-mono text-court-text-muted",
            "animate-in fade-in slide-in-from-top-1 duration-150"
          )}
        >
          <p className={cn("font-semibold mb-1.5", colors.text)}>
            {endpoint}
          </p>
          {rawData ? (
            <pre className="whitespace-pre-wrap break-words">{rawData}</pre>
          ) : (
            <p className="italic text-court-text-dim">Data unavailable</p>
          )}
        </div>
      )}
    </span>
  );
}
