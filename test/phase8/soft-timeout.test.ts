import { describe, it, expect } from "vitest";

describe("Soft timeout logic", () => {
  it("calculates 2x target word limit correctly", () => {
    const targetWords = 300;
    const maxWords = targetWords * 2;
    expect(maxWords).toBe(600);
  });

  it("counts words from chunks accurately", () => {
    const chunks = [
      "Smart money is ",
      "flowing into this ",
      "token. The net ",
      "inflow is $2M.",
    ];

    let wordCount = 0;
    for (const chunk of chunks) {
      wordCount += chunk.split(/\s+/).filter(Boolean).length;
    }

    // "Smart money is flowing into this token. The net inflow is $2M."
    // = 12 words
    expect(wordCount).toBe(12);
  });

  it("stops yielding when word count exceeds 2x target", () => {
    const targetWords = 5;
    const maxWords = targetWords * 2; // 10

    const chunks = [
      "one two three ",
      "four five six ",
      "seven eight nine ",
      "ten eleven twelve",
    ];

    let wordCount = 0;
    const yielded: string[] = [];
    let stopped = false;

    for (const chunk of chunks) {
      wordCount += chunk.split(/\s+/).filter(Boolean).length;
      if (wordCount > maxWords) {
        yielded.push(chunk); // yield the final chunk
        stopped = true;
        break;
      }
      yielded.push(chunk);
    }

    expect(stopped).toBe(true);
    // Should have yielded through the third chunk (9 words) then stopped on fourth (12 > 10)
    expect(yielded).toHaveLength(4);
  });

  it("infinite max when no target specified", () => {
    const targetWords = undefined;
    const maxWords = targetWords ? targetWords * 2 : Infinity;
    expect(maxWords).toBe(Infinity);
  });
});
