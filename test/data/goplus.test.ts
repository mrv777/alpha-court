import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_DIR = path.join(__dirname, "../../data/test-goplus");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test.db");

process.env.DATABASE_PATH = TEST_DB_PATH;

import { checkTokenSecurity } from "@/lib/data/goplus";
import { getDb, closeDb } from "@/lib/db";

function cleanup() {
  closeDb();
  for (const ext of ["", "-wal", "-shm"]) {
    const f = TEST_DB_PATH + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  if (fs.existsSync(TEST_DB_DIR)) fs.rmdirSync(TEST_DB_DIR);
}

const TOKEN = "DangerousToken111111111111111111111111111";

function mockGoPlusResponse(tokenData: Record<string, unknown>) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      code: 1,
      result: { [TOKEN]: tokenData },
    }),
  } as Response);
}

beforeEach(() => {
  cleanup();
  getDb();
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("checkTokenSecurity", () => {
  it("returns safe=true for trusted tokens", async () => {
    mockGoPlusResponse({ trusted_token: 1 });

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(true);
    expect(result.data.reasons).toEqual([]);
  });

  it("returns safe=true for clean token (no risks)", async () => {
    mockGoPlusResponse({
      mintable: { status: "0" },
      freezable: { status: "0" },
      balance_mutable_authority: { status: "0" },
      closable: { status: "0" },
      non_transferable: 0,
    });

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(true);
    expect(result.data.reasons).toEqual([]);
  });

  it("detects balance mutable authority", async () => {
    mockGoPlusResponse({
      balance_mutable_authority: { status: "1" },
    });

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(false);
    expect(result.data.reasons).toContain("balance mutable authority active");
  });

  it("detects non-transferable token", async () => {
    mockGoPlusResponse({
      non_transferable: 1,
    });

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(false);
    expect(result.data.reasons).toContain("token is non-transferable");
  });

  it("detects closable token accounts", async () => {
    mockGoPlusResponse({
      closable: { status: "1" },
    });

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(false);
    expect(result.data.reasons).toContain(
      "token accounts can be closed by authority"
    );
  });

  it("detects malicious mint authority", async () => {
    mockGoPlusResponse({
      mintable: {
        status: "1",
        authority: [{ address: "EVIL", malicious_address: 1 }],
      },
    });

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(false);
    expect(result.data.reasons).toContain("mint authority flagged as malicious");
  });

  it("does NOT flag mintable with non-malicious authority", async () => {
    mockGoPlusResponse({
      mintable: {
        status: "1",
        authority: [{ address: "LEGIT", malicious_address: 0 }],
      },
    });

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(true);
  });

  it("detects malicious freeze authority", async () => {
    mockGoPlusResponse({
      freezable: {
        status: "1",
        authority: [{ address: "EVIL", malicious_address: 1 }],
      },
    });

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(false);
    expect(result.data.reasons).toContain(
      "freeze authority flagged as malicious"
    );
  });

  it("detects hidden transfer fees", async () => {
    mockGoPlusResponse({
      transfer_fee: { max_fee: 500 },
    });

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(false);
    expect(result.data.reasons).toContain(
      "hidden transfer fee detected (max: 500)"
    );
  });

  it("detects multiple risks simultaneously", async () => {
    mockGoPlusResponse({
      balance_mutable_authority: { status: "1" },
      non_transferable: 1,
      closable: { status: "1" },
    });

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(false);
    expect(result.data.reasons).toHaveLength(3);
  });

  // Fail-open tests

  it("returns safe=true on HTTP error (fail-open)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(true);
  });

  it("returns safe=true on network error (fail-open)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error")
    );

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(true);
  });

  it("returns safe=true when API returns unexpected code (fail-open)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ code: 0, result: null }),
    } as Response);

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(true);
  });

  it("returns safe=true when token not in database (fail-open)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 1,
        result: { OTHER_TOKEN: {} },
      }),
    } as Response);

    const result = await checkTokenSecurity(TOKEN);
    expect(result.data.safe).toBe(true);
  });

  it("caches response on second call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 1,
        result: {
          [TOKEN]: {
            balance_mutable_authority: { status: "1" },
          },
        },
      }),
    } as Response);

    const first = await checkTokenSecurity(TOKEN);
    expect(first.cached).toBe(false);
    expect(first.data.safe).toBe(false);

    const second = await checkTokenSecurity(TOKEN);
    expect(second.cached).toBe(true);
    expect(second.data.safe).toBe(false);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
