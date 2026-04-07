import { describe, it, expect } from "vitest";
import {
  parseCitations,
  parseCitationStream,
} from "@/lib/citations";

describe("parseCitations", () => {
  it("returns empty for empty input", () => {
    const result = parseCitations("");
    expect(result.cleanText).toBe("");
    expect(result.citations).toHaveLength(0);
  });

  it("returns text unchanged when no citations", () => {
    const text = "This is plain text with no citations.";
    const result = parseCitations(text);
    expect(result.cleanText).toBe(text);
    expect(result.citations).toHaveLength(0);
  });

  it("parses a single citation", () => {
    const text = "Smart money inflow is [[cite:sm-netflow|$2.4M net inflow over 7 days]] which is bullish.";
    const result = parseCitations(text);
    expect(result.cleanText).toBe("Smart money inflow is $2.4M net inflow over 7 days which is bullish.");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toEqual({
      endpoint: "sm-netflow",
      displayValue: "$2.4M net inflow over 7 days",
      startIndex: 22,
      endIndex: 50,
    });
  });

  it("parses multiple citations", () => {
    const text =
      "The [[cite:sm-netflow|inflow is $2M]] and [[cite:dexscreener|volume is $5M daily]].";
    const result = parseCitations(text);
    expect(result.cleanText).toBe("The inflow is $2M and volume is $5M daily.");
    expect(result.citations).toHaveLength(2);
    expect(result.citations[0].endpoint).toBe("sm-netflow");
    expect(result.citations[1].endpoint).toBe("dexscreener");
  });

  it("handles citation with special characters in value", () => {
    const text = "The price is [[cite:jupiter|$0.00034 (+15.2%)]].";
    const result = parseCitations(text);
    expect(result.cleanText).toBe("The price is $0.00034 (+15.2%).");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].displayValue).toBe("$0.00034 (+15.2%)");
  });

  it("handles nested parentheses in citation values", () => {
    const text = "Security shows [[cite:goplus|safe (no freeze auth (verified))]].";
    const result = parseCitations(text);
    expect(result.cleanText).toBe("Security shows safe (no freeze auth (verified)).");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].displayValue).toBe("safe (no freeze auth (verified))");
  });

  it("leaves malformed citations (missing closing brackets) as-is", () => {
    const text = "This has a [[cite:broken|missing end bracket and continues.";
    const result = parseCitations(text);
    expect(result.cleanText).toBe(text);
    expect(result.citations).toHaveLength(0);
  });

  it("leaves malformed citations (no pipe) as-is", () => {
    const text = "This has a [[cite:nopipe]] in it.";
    const result = parseCitations(text);
    // The regex requires a pipe, so this won't match
    expect(result.cleanText).toBe(text);
    expect(result.citations).toHaveLength(0);
  });

  it("handles citation at the start of text", () => {
    const text = "[[cite:sm-netflow|$5M inflow]] is significant.";
    const result = parseCitations(text);
    expect(result.cleanText).toBe("$5M inflow is significant.");
    expect(result.citations[0].startIndex).toBe(0);
  });

  it("handles citation at the end of text", () => {
    const text = "See [[cite:dexscreener|24h volume of $1.2M]]";
    const result = parseCitations(text);
    expect(result.cleanText).toBe("See 24h volume of $1.2M");
    expect(result.citations[0].endIndex).toBe(result.cleanText.length);
  });
});

describe("parseCitationStream", () => {
  it("returns text segments for plain text", () => {
    const result = parseCitationStream("plain text here", "");
    expect(result.segments).toEqual([{ type: "text", content: "plain text here" }]);
    expect(result.remainingBuffer).toBe("");
  });

  it("parses a complete citation in a single chunk", () => {
    const result = parseCitationStream(
      "before [[cite:sm-netflow|$2M inflow]] after",
      ""
    );
    expect(result.segments).toEqual([
      { type: "text", content: "before " },
      { type: "citation", endpoint: "sm-netflow", displayValue: "$2M inflow" },
      { type: "text", content: " after" },
    ]);
    expect(result.remainingBuffer).toBe("");
  });

  it("buffers partial citation at end of chunk", () => {
    const result = parseCitationStream("text before [[cite:sm-net", "");
    expect(result.segments).toEqual([{ type: "text", content: "text before " }]);
    expect(result.remainingBuffer).toBe("[[cite:sm-net");
  });

  it("completes partial citation from buffer", () => {
    const result = parseCitationStream("flow|$2M inflow]] after", "[[cite:sm-net");
    expect(result.segments).toEqual([
      { type: "citation", endpoint: "sm-netflow", displayValue: "$2M inflow" },
      { type: "text", content: " after" },
    ]);
    expect(result.remainingBuffer).toBe("");
  });

  it("buffers a single opening bracket at end", () => {
    const result = parseCitationStream("some text [", "");
    expect(result.segments).toEqual([{ type: "text", content: "some text " }]);
    expect(result.remainingBuffer).toBe("[");
  });

  it("handles multiple citations in one chunk", () => {
    const result = parseCitationStream(
      "[[cite:a|val1]] and [[cite:b|val2]]",
      ""
    );
    expect(result.segments).toEqual([
      { type: "citation", endpoint: "a", displayValue: "val1" },
      { type: "text", content: " and " },
      { type: "citation", endpoint: "b", displayValue: "val2" },
    ]);
    expect(result.remainingBuffer).toBe("");
  });

  it("handles empty input", () => {
    const result = parseCitationStream("", "");
    expect(result.segments).toEqual([]);
    expect(result.remainingBuffer).toBe("");
  });

  it("handles citation with parentheses in value", () => {
    const result = parseCitationStream(
      "[[cite:jupiter|$0.00034 (+15.2%)]] ok",
      ""
    );
    expect(result.segments).toEqual([
      { type: "citation", endpoint: "jupiter", displayValue: "$0.00034 (+15.2%)" },
      { type: "text", content: " ok" },
    ]);
  });

  it("buffers incomplete [[cite: at end", () => {
    const result = parseCitationStream("text [[ci", "");
    expect(result.segments).toEqual([{ type: "text", content: "text " }]);
    expect(result.remainingBuffer).toBe("[[ci");
  });
});
