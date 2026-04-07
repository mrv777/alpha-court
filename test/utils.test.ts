import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatUsd,
  formatPnl,
  formatPct,
  formatNumber,
  truncateAddress,
  timeAgo,
} from "@/lib/utils";

describe("formatUsd", () => {
  it("formats standard values", () => {
    expect(formatUsd(1234.56)).toBe("$1,234.56");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(-500)).toBe("-$500.00");
  });

  it("compact mode for millions", () => {
    expect(formatUsd(2_300_000, true)).toBe("$2.3M");
    expect(formatUsd(-1_500_000, true)).toBe("$-1.5M");
  });

  it("compact mode for thousands", () => {
    expect(formatUsd(45_000, true)).toBe("$45.0K");
    expect(formatUsd(1_000, true)).toBe("$1.0K");
  });

  it("compact mode falls through for small values", () => {
    expect(formatUsd(500, true)).toBe("$500.00");
    expect(formatUsd(0, true)).toBe("$0.00");
  });
});

describe("formatPnl", () => {
  it("adds + prefix for positive", () => {
    expect(formatPnl(1234)).toBe("+$1,234.00");
  });

  it("no + for negative", () => {
    expect(formatPnl(-500)).toBe("-$500.00");
  });

  it("+ prefix for zero", () => {
    expect(formatPnl(0)).toBe("+$0.00");
  });
});

describe("formatPct", () => {
  it("formats with sign and one decimal", () => {
    expect(formatPct(12.34)).toBe("+12.3%");
    expect(formatPct(-5.678)).toBe("-5.7%");
    expect(formatPct(0)).toBe("+0.0%");
  });
});

describe("formatNumber", () => {
  it("formats with default decimals", () => {
    expect(formatNumber(1234567.89)).toBe("1,234,567.89");
  });

  it("respects custom decimals", () => {
    expect(formatNumber(1234.5, 0)).toBe("1,235");
    expect(formatNumber(1234.5, 4)).toBe("1,234.5000");
  });
});

describe("truncateAddress", () => {
  it("truncates long addresses", () => {
    const addr = "So11111111111111111111111111111111111111112";
    expect(truncateAddress(addr)).toBe("So11...1112");
  });

  it("returns short addresses unchanged", () => {
    expect(truncateAddress("short")).toBe("short");
    expect(truncateAddress("12345678901")).toBe("12345678901");
  });

  it("respects custom char count", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    expect(truncateAddress(addr, 6)).toBe("0x1234...345678");
  });
});

describe("timeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats seconds ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:30Z"));
    expect(timeAgo("2026-01-01T12:00:00Z")).toBe("30s ago");
  });

  it("formats minutes ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:05:00Z"));
    expect(timeAgo("2026-01-01T12:00:00Z")).toBe("5m ago");
  });

  it("formats hours ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T15:00:00Z"));
    expect(timeAgo("2026-01-01T12:00:00Z")).toBe("3h ago");
  });

  it("formats days ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-04T12:00:00Z"));
    expect(timeAgo("2026-01-01T12:00:00Z")).toBe("3d ago");
  });

  it("accepts unix timestamp (ms)", () => {
    vi.useFakeTimers();
    const now = new Date("2026-01-01T12:00:00Z").getTime();
    vi.setSystemTime(now);
    expect(timeAgo(now - 120_000)).toBe("2m ago");
  });
});
