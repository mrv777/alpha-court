"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Share2, Download, Check } from "lucide-react";

interface ShareButtonProps {
  trialId: string;
  className?: string;
}

export function ShareButton({ trialId, className }: ShareButtonProps) {
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
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={handleShare}
        className={cn(
          "flex items-center gap-2 border border-judge/20 bg-judge/[0.08] px-5 py-3 min-h-[44px]",
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
            Share Verdict
          </>
        )}
      </button>

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="flex items-center gap-2 border border-white/[0.06] bg-white/[0.04] px-5 py-3 min-h-[44px] text-sm font-medium text-court-text-muted transition-all hover:bg-white/[0.08] disabled:opacity-50"
      >
        <Download className={cn("size-4", downloading && "animate-pulse")} />
        {downloading ? "Generating..." : "Download Card"}
      </button>
    </div>
  );
}
