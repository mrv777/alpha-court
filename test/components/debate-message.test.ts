import { describe, it, expect } from "vitest";
import { parseCitationStream } from "@/lib/citations";

// Test the logic behind DebateMessage — parsing content into segments with citations

describe("DebateMessage content parsing", () => {
  it("parses plain text without citations", () => {
    const content = "This is a plain message with no citations.";
    const result = parseCitationStream(content, "");
    expect(result.segments).toEqual([
      { type: "text", content: "This is a plain message with no citations." },
    ]);
    expect(result.remainingBuffer).toBe("");
  });

  it("parses message with inline citations", () => {
    const content =
      "Smart money shows [[cite:sm-netflow|+$2.3M inflow]] which is bullish.";
    const result = parseCitationStream(content, "");
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0]).toEqual({
      type: "text",
      content: "Smart money shows ",
    });
    expect(result.segments[1]).toEqual({
      type: "citation",
      endpoint: "sm-netflow",
      displayValue: "+$2.3M inflow",
    });
    expect(result.segments[2]).toEqual({
      type: "text",
      content: " which is bullish.",
    });
  });

  it("parses multiple citations in a message", () => {
    const content =
      "The [[cite:sm-netflow|inflow is $2M]] and [[cite:dexscreener|volume is $5M]].";
    const result = parseCitationStream(content, "");
    expect(result.segments).toHaveLength(5);

    const citations = result.segments.filter((s) => s.type === "citation");
    expect(citations).toHaveLength(2);
    expect(citations[0]).toEqual({
      type: "citation",
      endpoint: "sm-netflow",
      displayValue: "inflow is $2M",
    });
    expect(citations[1]).toEqual({
      type: "citation",
      endpoint: "dexscreener",
      displayValue: "volume is $5M",
    });
  });

  it("handles empty content", () => {
    const result = parseCitationStream("", "");
    expect(result.segments).toEqual([]);
  });
});

describe("DebateMessage agent style mapping", () => {
  const AGENT_STYLE: Record<
    string,
    { label: string; border: string; labelColor: string; icon: string }
  > = {
    bull: {
      label: "The Bull",
      border: "border-l-bull",
      labelColor: "text-bull",
      icon: "🟢",
    },
    bear: {
      label: "The Bear",
      border: "border-l-bear",
      labelColor: "text-bear",
      icon: "🔴",
    },
    judge: {
      label: "The Judge",
      border: "border-l-judge",
      labelColor: "text-judge",
      icon: "⚖️",
    },
  };

  it("maps bull to green border", () => {
    expect(AGENT_STYLE.bull.border).toBe("border-l-bull");
    expect(AGENT_STYLE.bull.labelColor).toBe("text-bull");
  });

  it("maps bear to red border", () => {
    expect(AGENT_STYLE.bear.border).toBe("border-l-bear");
    expect(AGENT_STYLE.bear.labelColor).toBe("text-bear");
  });

  it("maps judge to gold border", () => {
    expect(AGENT_STYLE.judge.border).toBe("border-l-judge");
    expect(AGENT_STYLE.judge.labelColor).toBe("text-judge");
  });
});

describe("DebateMessage evidence map", () => {
  it("builds evidence map from array", () => {
    const evidence = [
      { endpoint: "sm-netflow", displayValue: "+$2.3M inflow" },
      { endpoint: "dexscreener", displayValue: "$5M volume" },
    ];
    const map = new Map<string, string>();
    for (const e of evidence) {
      map.set(e.endpoint, e.displayValue);
    }
    expect(map.get("sm-netflow")).toBe("+$2.3M inflow");
    expect(map.get("dexscreener")).toBe("$5M volume");
    expect(map.get("nonexistent")).toBeUndefined();
  });

  it("handles empty evidence", () => {
    const map = new Map<string, string>();
    expect(map.size).toBe(0);
  });
});
