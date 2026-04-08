"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Share2, Download, Check } from "lucide-react";

interface ShareButtonProps {
  trialId: string;
  tokenName?: string;
  verdictLabel?: string;
  verdictScore?: number;
  className?: string;
}

function buildXIntentUrl(tokenName: string, label: string, score: number, url: string): string {
  const scoreStr = score > 0 ? `+${score}` : `${score}`;
  const text = `I put ${tokenName} on trial at Alpha Court. The verdict: ${label} (${scoreStr}). #NansenCLI`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function ShareButton({ trialId, tokenName, verdictLabel, verdictScore, className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const verdictUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verdict/${trialId}`
      : `/verdict/${trialId}`;

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(verdictUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = verdictUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [verdictUrl]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/verdict/${trialId}/image`);
      if (!res.ok) throw new Error("Failed to generate image");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alpha-court-verdict-${trialId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [trialId]);

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      <button
        type="button"
        onClick={handleShare}
        className={cn(
          "flex items-center gap-2 border border-judge/20 bg-judge/[0.08] px-3 py-2 whitespace-nowrap",
          "text-sm font-semibold text-judge transition-all hover:bg-judge/[0.15] hover:border-judge/30",
          copied && "border-bull/30 bg-bull/[0.08] text-bull"
        )}
      >
        {copied ? (
          <>
            <Check className="size-4" />
            Copied!
          </>
        ) : (
          <>
            <Share2 className="size-4" />
            Share
          </>
        )}
      </button>

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-2 border border-white/[0.06] bg-white/[0.04] px-3 py-2 whitespace-nowrap text-sm font-medium text-court-text-muted transition-all hover:bg-white/[0.08] disabled:opacity-50"
      >
        <Download className={cn("size-4", downloading && "animate-pulse")} />
        {downloading ? "Saving..." : "Download"}
      </button>

      {tokenName && verdictLabel != null && verdictScore != null && (
        <a
          href={buildXIntentUrl(tokenName, verdictLabel, verdictScore, verdictUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 border border-white/[0.06] bg-white/[0.04] px-3 py-2 whitespace-nowrap text-sm font-medium text-court-text-muted transition-all hover:bg-white/[0.08]"
        >
          <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Post to X
        </a>
      )}
    </div>
  );
}
