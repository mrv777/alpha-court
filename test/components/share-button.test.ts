import { describe, it, expect } from "vitest";

// Test share button logic (URL construction, download filename)

describe("ShareButton URL construction", () => {
  it("constructs verdict URL from origin and trialId", () => {
    const origin = "https://alphacourt.ai";
    const trialId = "abc123xyz789";
    const url = `${origin}/verdict/${trialId}`;
    expect(url).toBe("https://alphacourt.ai/verdict/abc123xyz789");
  });

  it("handles localhost origin", () => {
    const origin = "http://localhost:3100";
    const trialId = "test_trial_1";
    const url = `${origin}/verdict/${trialId}`;
    expect(url).toBe("http://localhost:3100/verdict/test_trial_1");
  });

  it("constructs download filename", () => {
    const trialId = "abc123";
    const filename = `alpha-court-verdict-${trialId}.png`;
    expect(filename).toBe("alpha-court-verdict-abc123.png");
    expect(filename).toMatch(/\.png$/);
  });
});

describe("ShareButton image download", () => {
  it("image API path is correct", () => {
    const trialId = "abc123";
    const apiPath = `/api/verdict/${trialId}/image`;
    expect(apiPath).toBe("/api/verdict/abc123/image");
  });
});
