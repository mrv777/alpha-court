"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/lib/utils";
import type { Chain } from "@/lib/data/types";
import type { TokenSearchResult } from "@/app/api/token/search/route";

interface TokenInputProps {
  chain: Chain;
  onSelect: (token: TokenSearchResult) => void;
  onRawSubmit: (raw: string) => void;
  disabled?: boolean;
  className?: string;
}

export function TokenInput({
  chain,
  onSelect,
  onRawSubmit,
  disabled,
  className,
}: TokenInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TokenSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/token/search?q=${encodeURIComponent(q)}&chain=${chain}`
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as { results: TokenSearchResult[] };
        setResults(data.results);
        setIsOpen(data.results.length > 0);
        setActiveIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [chain]
  );

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 500);
  };

  const selectToken = (token: TokenSearchResult) => {
    setQuery(`${token.token_symbol} — ${token.token_name}`);
    setIsOpen(false);
    setResults([]);
    onSelect(token);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        e.preventDefault();
        onRawSubmit(query.trim());
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % results.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          selectToken(results[activeIndex]);
        } else if (query.trim()) {
          onRawSubmit(query.trim());
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset when chain changes
  useEffect(() => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
  }, [chain]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-court-text-muted" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Enter token address or name..."
          disabled={disabled}
          className="h-12 pl-10 pr-10 text-base bg-court-surface border-court-border text-court-text placeholder:text-court-text-dim"
          autoComplete="off"
          spellCheck={false}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-court-text-muted animate-spin" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-court-border bg-court-surface shadow-lg"
        >
          {results.map((token, i) => (
            <li
              key={`${token.token_address}-${token.chain}`}
              role="option"
              aria-selected={i === activeIndex}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-3 py-3 min-h-[44px] transition-colors",
                i === activeIndex
                  ? "bg-court-border-light"
                  : "hover:bg-court-border"
              )}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => selectToken(token)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-court-text">
                    {token.token_symbol}
                  </span>
                  <span className="truncate text-sm text-court-text-muted">
                    {token.token_name}
                  </span>
                  {token.source === "nansen" ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-bull" />
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-court-text-dim">
                      <AlertTriangle className="size-3" />
                      Limited data
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-court-text-dim font-mono">
                  <span>
                    {token.token_address.slice(0, 6)}...
                    {token.token_address.slice(-4)}
                  </span>
                  {token.market_cap_usd != null && (
                    <span>MCap {formatUsd(token.market_cap_usd, true)}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isOpen && results.length === 0 && !isLoading && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-court-border bg-court-surface p-4 text-center text-sm text-court-text-muted shadow-lg">
          No tokens found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
