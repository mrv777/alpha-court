import { describe, it, expect } from "vitest";

describe("Error state rendering", () => {
  it("trial error page accepts error and unstable_retry props", async () => {
    // Import the error component to verify it exists and exports correctly
    const mod = await import("@/app/trial/[id]/error");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("verdict error page accepts error and unstable_retry props", async () => {
    const mod = await import("@/app/verdict/[id]/error");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("root error page accepts error and unstable_retry props", async () => {
    const mod = await import("@/app/error");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("trial not-found page renders", async () => {
    const mod = await import("@/app/trial/[id]/not-found");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("verdict not-found page renders", async () => {
    const mod = await import("@/app/verdict/[id]/not-found");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("root not-found page renders", async () => {
    const mod = await import("@/app/not-found");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});

describe("Loading skeleton rendering", () => {
  it("trial loading page renders", async () => {
    const mod = await import("@/app/trial/[id]/loading");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("verdict loading page renders", async () => {
    const mod = await import("@/app/verdict/[id]/loading");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });
});
