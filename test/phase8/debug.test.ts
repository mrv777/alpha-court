import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Debug API route", () => {
  const originalEnv = process.env.DEBUG_ENABLED;

  afterEach(() => {
    process.env.DEBUG_ENABLED = originalEnv;
  });

  it("returns 404 when DEBUG_ENABLED is not true", async () => {
    process.env.DEBUG_ENABLED = "false";
    const { GET } = await import("@/app/api/debug/route");
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns 404 when DEBUG_ENABLED is undefined", async () => {
    delete process.env.DEBUG_ENABLED;
    // Re-import to pick up new env value
    vi.resetModules();
    const { GET } = await import("@/app/api/debug/route");
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns stats when DEBUG_ENABLED is true", async () => {
    process.env.DEBUG_ENABLED = "true";
    vi.resetModules();
    const { GET } = await import("@/app/api/debug/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("trials");
    expect(data).toHaveProperty("cache");
    expect(data).toHaveProperty("activeDebates");
    expect(data).toHaveProperty("recentErrors");

    // Verify trial stats structure
    expect(data.trials).toHaveProperty("total");
    expect(data.trials).toHaveProperty("completed");
    expect(data.trials).toHaveProperty("errored");
    expect(data.trials).toHaveProperty("inProgress");
    expect(data.trials).toHaveProperty("avgDurationSeconds");

    // Verify cache stats structure
    expect(data.cache).toHaveProperty("totalEntries");
    expect(data.cache).toHaveProperty("freshEntries");
    expect(data.cache).toHaveProperty("expiredEntries");
    expect(data.cache).toHaveProperty("byEndpoint");
    expect(Array.isArray(data.cache.byEndpoint)).toBe(true);

    // Verify active debates is an array
    expect(Array.isArray(data.activeDebates)).toBe(true);

    // Verify recent errors is an array
    expect(Array.isArray(data.recentErrors)).toBe(true);
  });
});

describe("Debug page", () => {
  it("debug-client module exports DebugClient", async () => {
    const mod = await import("@/app/debug/debug-client");
    expect(mod.DebugClient).toBeDefined();
    expect(typeof mod.DebugClient).toBe("function");
  });
});
