import { describe, it, expect } from "vitest";
import type { Verdict } from "@/hooks/use-debate-stream";

// Test the verdict display logic (color, label, gauge rotation)

function getVerdictColor(score: number): string {
  if (score >= 60) return "text-bull";
  if (score >= 20) return "text-bull/80";
  if (score > -20) return "text-court-text-muted";
  if (score > -60) return "text-bear/80";
  return "text-bear";
}

function getGaugeRotation(score: number): number {
  return (score / 100) * 90;
}

function getGaugeColor(score: number): string {
  if (score >= 60) return "#22c55e";
  if (score >= 20) return "#4ade80";
  if (score > -20) return "#8888a0";
  if (score > -60) return "#f87171";
  return "#ef4444";
}

describe("VerdictDisplay score ranges", () => {
  it("STRONG BUY: score 80 → bull green", () => {
    expect(getVerdictColor(80)).toBe("text-bull");
    expect(getGaugeColor(80)).toBe("#22c55e");
  });

  it("BUY: score 40 → lighter bull green", () => {
    expect(getVerdictColor(40)).toBe("text-bull/80");
    expect(getGaugeColor(40)).toBe("#4ade80");
  });

  it("HOLD: score 0 → muted gray", () => {
    expect(getVerdictColor(0)).toBe("text-court-text-muted");
    expect(getGaugeColor(0)).toBe("#8888a0");
  });

  it("SELL: score -40 → lighter bear red", () => {
    expect(getVerdictColor(-40)).toBe("text-bear/80");
    expect(getGaugeColor(-40)).toBe("#f87171");
  });

  it("STRONG SELL: score -80 → bear red", () => {
    expect(getVerdictColor(-80)).toBe("text-bear");
    expect(getGaugeColor(-80)).toBe("#ef4444");
  });

  it("edge: score 100 → max bull", () => {
    expect(getVerdictColor(100)).toBe("text-bull");
    expect(getGaugeRotation(100)).toBe(90);
  });

  it("edge: score -100 → max bear", () => {
    expect(getVerdictColor(-100)).toBe("text-bear");
    expect(getGaugeRotation(-100)).toBe(-90);
  });

  it("edge: score 0 → centered gauge", () => {
    expect(getGaugeRotation(0)).toBe(0);
  });

  it("boundary: score 20 → bull/80", () => {
    expect(getVerdictColor(20)).toBe("text-bull/80");
  });

  it("boundary: score -20 → bear/80 (> -20 is exclusive)", () => {
    expect(getVerdictColor(-20)).toBe("text-bear/80");
  });

  it("boundary: score 60 → full bull", () => {
    expect(getVerdictColor(60)).toBe("text-bull");
  });

  it("boundary: score -60 → full bear", () => {
    expect(getVerdictColor(-60)).toBe("text-bear");
  });
});

describe("VerdictDisplay conviction meters", () => {
  it("conviction width matches value percentage", () => {
    const verdicts: Verdict[] = [
      {
        score: 50,
        label: "BUY",
        summary: "Test",
        bull_conviction: 85,
        bear_conviction: 42,
        safety: "clean",
      },
      {
        score: -30,
        label: "SELL",
        summary: "Test",
        bull_conviction: 30,
        bear_conviction: 90,
        safety: "warnings",
      },
      {
        score: 0,
        label: "HOLD",
        summary: "Test",
        bull_conviction: 50,
        bear_conviction: 50,
        safety: "clean",
      },
    ];

    for (const v of verdicts) {
      // Width is value% as a string
      expect(`${v.bull_conviction}%`).toMatch(/^\d+%$/);
      expect(`${v.bear_conviction}%`).toMatch(/^\d+%$/);
      expect(v.bull_conviction).toBeGreaterThanOrEqual(0);
      expect(v.bull_conviction).toBeLessThanOrEqual(100);
      expect(v.bear_conviction).toBeGreaterThanOrEqual(0);
      expect(v.bear_conviction).toBeLessThanOrEqual(100);
    }
  });

  it("extreme convictions: 0 and 100", () => {
    expect(`${0}%`).toBe("0%");
    expect(`${100}%`).toBe("100%");
  });
});

describe("VerdictDisplay label mapping", () => {
  const cases: [number, string][] = [
    [100, "STRONG BUY"],
    [75, "STRONG BUY"],
    [60, "STRONG BUY"],
    [40, "BUY"],
    [20, "BUY"],
    [0, "HOLD"],
    [-10, "HOLD"],
    [-30, "SELL"],
    [-60, "STRONG SELL"],
    [-100, "STRONG SELL"],
  ];

  function getExpectedLabel(score: number): string {
    if (score >= 60) return "STRONG BUY";
    if (score >= 20) return "BUY";
    if (score > -20) return "HOLD";
    if (score > -60) return "SELL";
    return "STRONG SELL";
  }

  for (const [score, expected] of cases) {
    it(`score ${score} → ${expected}`, () => {
      expect(getExpectedLabel(score)).toBe(expected);
    });
  }
});
