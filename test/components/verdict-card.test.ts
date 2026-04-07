import { describe, it, expect } from "vitest";
import { buildVerdictCardHtml, type VerdictCardData } from "@/components/verdict-card";

const baseData: VerdictCardData = {
  tokenName: "TestToken",
  tokenSymbol: "TEST",
  chain: "solana",
  score: 65,
  label: "STRONG BUY",
  summary: "Strong smart money inflows with clean security profile.",
  bullConviction: 82,
  bearConviction: 45,
  safety: "clean",
};

describe("VerdictCard HTML generation", () => {
  it("generates valid HTML document", () => {
    const html = buildVerdictCardHtml(baseData);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html>");
    expect(html).toContain("</html>");
  });

  it("sets correct dimensions (1200x630)", () => {
    const html = buildVerdictCardHtml(baseData);
    expect(html).toContain("width: 1200px");
    expect(html).toContain("height: 630px");
    expect(html).toContain("width:1200px;height:630px");
  });

  it("includes token symbol with $ prefix", () => {
    const html = buildVerdictCardHtml(baseData);
    expect(html).toContain("$TEST");
  });

  it("uses token name when no symbol", () => {
    const data = { ...baseData, tokenSymbol: null };
    const html = buildVerdictCardHtml(data);
    expect(html).toContain("TestToken");
    expect(html).not.toContain("$null");
  });

  it("includes chain name", () => {
    const html = buildVerdictCardHtml(baseData);
    expect(html).toContain("solana");
  });

  it("includes verdict label", () => {
    const html = buildVerdictCardHtml(baseData);
    expect(html).toContain("STRONG BUY");
  });

  it("includes summary text", () => {
    const html = buildVerdictCardHtml(baseData);
    expect(html).toContain("Strong smart money inflows");
  });

  it("includes conviction values", () => {
    const html = buildVerdictCardHtml(baseData);
    expect(html).toContain("82");
    expect(html).toContain("45");
    expect(html).toContain("Bull Conviction");
    expect(html).toContain("Bear Conviction");
  });

  it("includes safety indicator", () => {
    const html = buildVerdictCardHtml(baseData);
    expect(html).toContain("Clean");
    expect(html).toContain("🛡️");
  });

  it("includes Alpha Court branding", () => {
    const html = buildVerdictCardHtml(baseData);
    expect(html).toContain("ALPHA COURT");
    expect(html).toContain("⚖️");
  });

  it("shows warning safety with count", () => {
    const data: VerdictCardData = {
      ...baseData,
      safety: "warnings",
      safetyReasons: ["balance mutable", "freeze authority"],
    };
    const html = buildVerdictCardHtml(data);
    expect(html).toContain("Warnings");
    expect(html).toContain("⚠️");
    expect(html).toContain("2 findings");
  });

  it("shows dangerous safety", () => {
    const data: VerdictCardData = {
      ...baseData,
      safety: "dangerous",
      safetyReasons: ["a", "b", "c"],
    };
    const html = buildVerdictCardHtml(data);
    expect(html).toContain("Dangerous");
    expect(html).toContain("💀");
  });

  it("truncates long summary to 3 lines", () => {
    const longSummary = "A".repeat(300);
    const data = { ...baseData, summary: longSummary };
    const html = buildVerdictCardHtml(data);
    // Should be truncated with ellipsis
    expect(html).toContain("...");
    // Should not contain the full string
    expect(html).not.toContain(longSummary);
  });

  it("does not truncate short summary", () => {
    const shortSummary = "Brief summary.";
    const data = { ...baseData, summary: shortSummary };
    const html = buildVerdictCardHtml(data);
    expect(html).toContain(shortSummary);
    expect(html).not.toContain("...");
  });

  it("includes SVG gauge", () => {
    const html = buildVerdictCardHtml(baseData);
    expect(html).toContain("<svg");
    expect(html).toContain("</svg>");
  });

  it("formats positive score with + prefix in gauge", () => {
    const data = { ...baseData, score: 65 };
    const html = buildVerdictCardHtml(data);
    expect(html).toContain("+65");
  });

  it("formats negative score without + prefix", () => {
    const data = { ...baseData, score: -30 };
    const html = buildVerdictCardHtml(data);
    expect(html).toContain("-30");
    expect(html).not.toContain("+-30");
  });

  it("formats zero score", () => {
    const data = { ...baseData, score: 0 };
    const html = buildVerdictCardHtml(data);
    expect(html).toContain(">0<");
  });

  it("single safety reason uses singular 'finding'", () => {
    const data: VerdictCardData = {
      ...baseData,
      safety: "warnings",
      safetyReasons: ["freeze authority"],
    };
    const html = buildVerdictCardHtml(data);
    expect(html).toContain("1 finding)");
  });
});
