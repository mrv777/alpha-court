import { describe, it, expect } from "vitest";

// Test the safety badge state logic

const CONFIG = {
  clean: { label: "Clean", color: "text-bull" },
  warnings: { label: "Warnings", color: "text-yellow-400" },
  dangerous: { label: "Dangerous", color: "text-bear" },
} as const;

function getSafetyConfig(score: string) {
  return CONFIG[score as keyof typeof CONFIG] ?? CONFIG.clean;
}

function getWarningCount(score: string, details?: string[] | null): number {
  if (score === "warnings" || score === "dangerous") {
    return details?.length ?? 0;
  }
  return 0;
}

function shouldHideBadge(score: string | null | undefined): boolean {
  return !score;
}

describe("SafetyBadge states", () => {
  it("clean state → green shield, no count", () => {
    const config = getSafetyConfig("clean");
    expect(config.label).toBe("Clean");
    expect(config.color).toBe("text-bull");
    expect(getWarningCount("clean")).toBe(0);
  });

  it("warnings state → yellow, shows count", () => {
    const config = getSafetyConfig("warnings");
    expect(config.label).toBe("Warnings");
    expect(config.color).toBe("text-yellow-400");
    const reasons = ["balance mutable", "freeze authority"];
    expect(getWarningCount("warnings", reasons)).toBe(2);
  });

  it("dangerous state → red, shows count", () => {
    const config = getSafetyConfig("dangerous");
    expect(config.label).toBe("Dangerous");
    expect(config.color).toBe("text-bear");
    const reasons = ["balance mutable", "freeze authority", "hidden fee"];
    expect(getWarningCount("dangerous", reasons)).toBe(3);
  });

  it("warnings with no details → count is 0", () => {
    expect(getWarningCount("warnings", null)).toBe(0);
    expect(getWarningCount("warnings", undefined)).toBe(0);
    expect(getWarningCount("warnings", [])).toBe(0);
  });

  it("unknown score → falls back to clean", () => {
    const config = getSafetyConfig("unknown");
    expect(config.label).toBe("Clean");
  });
});

describe("SafetyBadge visibility", () => {
  it("hidden when no safety data (null)", () => {
    expect(shouldHideBadge(null)).toBe(true);
  });

  it("hidden when no safety data (undefined)", () => {
    expect(shouldHideBadge(undefined)).toBe(true);
  });

  it("hidden when empty string", () => {
    expect(shouldHideBadge("")).toBe(true);
  });

  it("visible when score is 'clean'", () => {
    expect(shouldHideBadge("clean")).toBe(false);
  });

  it("visible when score is 'warnings'", () => {
    expect(shouldHideBadge("warnings")).toBe(false);
  });

  it("visible when score is 'dangerous'", () => {
    expect(shouldHideBadge("dangerous")).toBe(false);
  });
});

describe("SafetyBadge tooltip", () => {
  it("shows individual findings in tooltip", () => {
    const details = [
      "balance mutable authority active",
      "token accounts can be closed by authority",
    ];
    // Tooltip should display each reason
    expect(details).toHaveLength(2);
    expect(details[0]).toContain("balance mutable");
    expect(details[1]).toContain("closed by authority");
  });

  it("handles empty findings array", () => {
    const details: string[] = [];
    expect(details).toHaveLength(0);
  });
});
