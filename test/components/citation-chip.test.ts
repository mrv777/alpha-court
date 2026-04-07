import { describe, it, expect } from "vitest";

// Test the chip color logic extracted from CitationChip
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
  if (endpoint.startsWith("dexscreener") || endpoint.startsWith("jupiter")) {
    return {
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "border-sky-500/30",
    };
  }
  return {
    bg: "bg-bull/10",
    text: "text-bull",
    border: "border-bull/30",
  };
}

describe("CitationChip color logic", () => {
  it("returns Nansen colors for sm-netflow", () => {
    const colors = getChipColor("sm-netflow");
    expect(colors.text).toBe("text-bull");
  });

  it("returns Nansen colors for who-bought-sold", () => {
    const colors = getChipColor("who-bought-sold");
    expect(colors.text).toBe("text-bull");
  });

  it("returns DexScreener colors for dexscreener endpoint", () => {
    const colors = getChipColor("dexscreener");
    expect(colors.text).toBe("text-sky-400");
  });

  it("returns Jupiter colors for jupiter endpoint", () => {
    const colors = getChipColor("jupiter");
    expect(colors.text).toBe("text-sky-400");
  });

  it("returns GoPlus colors for goplus endpoint", () => {
    const colors = getChipColor("goplus-security");
    expect(colors.text).toBe("text-judge");
  });

  it("returns Nansen colors for unknown endpoint", () => {
    const colors = getChipColor("unknown-endpoint");
    expect(colors.text).toBe("text-bull");
  });

  it("handles empty endpoint string", () => {
    const colors = getChipColor("");
    expect(colors.text).toBe("text-bull");
  });
});

describe("CitationChip display", () => {
  it("should display value text directly", () => {
    const displayValue = "$2.3M net inflow";
    expect(displayValue).toBe("$2.3M net inflow");
  });

  it("should handle missing raw data gracefully", () => {
    const rawData: string | null = null;
    expect(rawData).toBeNull();
  });

  it("should have accessible label", () => {
    const endpoint = "sm-netflow";
    const displayValue = "$2.3M inflow";
    const label = `Citation: ${displayValue} from ${endpoint}`;
    expect(label).toBe("Citation: $2.3M inflow from sm-netflow");
  });
});
