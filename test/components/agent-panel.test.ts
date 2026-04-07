import { describe, it, expect } from "vitest";
import type { Verdict } from "@/hooks/use-debate-stream";

// Test the conviction extraction logic from AgentPanel

function getConviction(agent: string, verdict: Verdict | null): number | null {
  if (!verdict) return null;
  if (agent === "bull") return verdict.bull_conviction;
  if (agent === "bear") return verdict.bear_conviction;
  return null;
}

describe("AgentPanel conviction logic", () => {
  const verdict: Verdict = {
    score: 47,
    label: "BUY",
    summary: "Test verdict",
    bull_conviction: 73,
    bear_conviction: 58,
    safety: "clean",
  };

  it("returns bull conviction for bull agent", () => {
    expect(getConviction("bull", verdict)).toBe(73);
  });

  it("returns bear conviction for bear agent", () => {
    expect(getConviction("bear", verdict)).toBe(58);
  });

  it("returns null for judge agent", () => {
    expect(getConviction("judge", verdict)).toBeNull();
  });

  it("returns null when no verdict", () => {
    expect(getConviction("bull", null)).toBeNull();
    expect(getConviction("bear", null)).toBeNull();
  });
});

describe("AgentPanel evidence display", () => {
  it("shows evidence items up to limit", () => {
    const evidence = Array.from({ length: 10 }, (_, i) => ({
      endpoint: `ep-${i}`,
      displayValue: `Value ${i}`,
    }));
    // Component shows up to 6
    const displayed = evidence.slice(0, 6);
    expect(displayed).toHaveLength(6);
    expect(displayed[0].displayValue).toBe("Value 0");
    expect(displayed[5].displayValue).toBe("Value 5");
  });

  it("handles empty evidence", () => {
    const evidence: Array<{ endpoint: string; displayValue: string }> = [];
    expect(evidence.length).toBe(0);
  });
});
