import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

const TEST_DB_DIR = path.join(__dirname, "../../data/test-nansen-client");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test.db");

process.env.DATABASE_PATH = TEST_DB_PATH;

// Mock child_process.exec before importing client
const { mockExec } = vi.hoisted(() => {
  const mockExec = vi.fn();
  return { mockExec };
});
vi.mock("child_process", () => ({
  exec: mockExec,
}));

import { parseCliOutput, nansenCliCall } from "@/lib/nansen/client";
import { getDb, closeDb } from "@/lib/db";

function cleanup() {
  closeDb();
  for (const ext of ["", "-wal", "-shm"]) {
    const f = TEST_DB_PATH + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  if (fs.existsSync(TEST_DB_DIR)) fs.rmdirSync(TEST_DB_DIR);
}

// Helper to make mockExec resolve with stdout
function mockExecSuccess(stdout: string) {
  mockExec.mockImplementation(
    (_cmd: string, _opts: unknown, callback: (err: null, result: { stdout: string; stderr: string }) => void) => {
      callback(null, { stdout, stderr: "" });
    }
  );
}

function mockExecError(message: string, stderr?: string) {
  mockExec.mockImplementation(
    (_cmd: string, _opts: unknown, callback: (err: Error & { stderr?: string; stdout?: string }) => void) => {
      const err = new Error(message) as Error & { stderr?: string; stdout?: string };
      err.stderr = stderr || "";
      err.stdout = "";
      callback(err);
    }
  );
}

function mockExecTimeout() {
  mockExec.mockImplementation(
    (_cmd: string, _opts: unknown, callback: (err: Error & { killed?: boolean; signal?: string }) => void) => {
      const err = new Error("Command timed out") as Error & { killed?: boolean; signal?: string };
      err.killed = true;
      err.signal = "SIGTERM";
      callback(err);
    }
  );
}

beforeEach(() => {
  cleanup();
  getDb();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("parseCliOutput", () => {
  it("parses plain JSON object", () => {
    const result = parseCliOutput<{ key: string }>('{"key": "value"}');
    expect(result).toEqual({ key: "value" });
  });

  it("parses JSON array", () => {
    const result = parseCliOutput<number[]>("[1, 2, 3]");
    expect(result).toEqual([1, 2, 3]);
  });

  it("unwraps { success: true, data } wrapper", () => {
    const result = parseCliOutput<{ name: string }>(
      '{"success": true, "data": {"name": "test"}}'
    );
    expect(result).toEqual({ name: "test" });
  });

  it("throws on { success: false }", () => {
    expect(() =>
      parseCliOutput('{"success": false, "error": "Not found"}')
    ).toThrow("Not found");
  });

  it("strips non-JSON prefix (progress bars)", () => {
    const raw = 'Fetching data...\nProgress: 100%\n{"success": true, "data": {"count": 42}}';
    const result = parseCliOutput<{ count: number }>(raw);
    expect(result).toEqual({ count: 42 });
  });

  it("handles non-JSON prefix before array", () => {
    const raw = "Loading...\n[1, 2, 3]";
    const result = parseCliOutput<number[]>(raw);
    expect(result).toEqual([1, 2, 3]);
  });

  it("throws on no JSON found", () => {
    expect(() => parseCliOutput("No JSON here")).toThrow("No JSON found");
  });

  it("picks earliest JSON start between { and [", () => {
    // Array appears before object
    const raw = '[{"id":1}]';
    const result = parseCliOutput<Array<{ id: number }>>(raw);
    expect(result).toEqual([{ id: 1 }]);
  });
});

describe("nansenCliCall", () => {
  it("returns parsed data on success", async () => {
    mockExecSuccess('{"success": true, "data": {"token": "SOL"}}');

    const result = await nansenCliCall<{ token: string }>(
      "research token info --token SOL",
      { skipCache: true }
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ token: "SOL" });
    expect(result.cached).toBe(false);
    expect(result.command).toBe("research token info --token SOL");
  });

  it("caches response and returns cached on second call", async () => {
    mockExecSuccess('{"success": true, "data": {"price": 100}}');

    const params = { endpoint: "test", token: "abc" };

    const first = await nansenCliCall<{ price: number }>(
      "research token info --token abc",
      { ttlSeconds: 300, params }
    );
    expect(first.success).toBe(true);
    expect(first.cached).toBe(false);

    const second = await nansenCliCall<{ price: number }>(
      "research token info --token abc",
      { ttlSeconds: 300, params }
    );
    expect(second.success).toBe(true);
    expect(second.cached).toBe(true);
    expect(second.data).toEqual({ price: 100 });

    // exec should only be called once (second was cached)
    expect(mockExec).toHaveBeenCalledTimes(1);
  });

  it("skips cache when skipCache is true", async () => {
    mockExecSuccess('{"success": true, "data": {"v": 1}}');

    await nansenCliCall("cmd", { ttlSeconds: 300, params: { x: 1 } });
    await nansenCliCall("cmd", { skipCache: true, ttlSeconds: 300, params: { x: 1 } });

    expect(mockExec).toHaveBeenCalledTimes(2);
  });

  it("returns error result on CLI failure (does not throw)", async () => {
    mockExecError("Command failed", "some error output");

    const result = await nansenCliCall("bad-command", { skipCache: true });

    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.cached).toBe(false);
  });

  it("retries once on failure", async () => {
    let callCount = 0;
    mockExec.mockImplementation(
      (_cmd: string, _opts: unknown, callback: (err: Error | null, result?: { stdout: string; stderr: string }) => void) => {
        callCount++;
        if (callCount === 1) {
          callback(new Error("First attempt failed"));
        } else {
          callback(null, { stdout: '{"success": true, "data": {"retry": true}}', stderr: "" });
        }
      }
    );

    const result = await nansenCliCall<{ retry: boolean }>("cmd", { skipCache: true });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ retry: true });
    expect(callCount).toBe(2);
  });

  it("returns error after all retries exhausted", async () => {
    mockExecError("Always fails");

    const result = await nansenCliCall("cmd", { skipCache: true });

    expect(result.success).toBe(false);
    // 1 initial + 1 retry = 2 calls
    expect(mockExec).toHaveBeenCalledTimes(2);
  });

  it("handles timeout (killed process)", async () => {
    mockExecTimeout();

    const result = await nansenCliCall("slow-command", { skipCache: true });

    expect(result.success).toBe(false);
    expect(result.error).toContain("timed out");
  });

  it("handles empty CLI output", async () => {
    mockExecSuccess("");

    const result = await nansenCliCall("empty-cmd", { skipCache: true });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Empty CLI output");
  });

  it("passes correct command to exec", async () => {
    mockExecSuccess('{"success": true, "data": {}}');

    await nansenCliCall("research token info --token SOL --chain solana", {
      skipCache: true,
    });

    expect(mockExec).toHaveBeenCalledWith(
      "nansen research token info --token SOL --chain solana",
      expect.objectContaining({ timeout: 45000 }),
      expect.any(Function)
    );
  });

  it("limits concurrent CLI calls to 6", async () => {
    let concurrentCount = 0;
    let maxConcurrent = 0;

    mockExec.mockImplementation(
      (_cmd: string, _opts: unknown, callback: (err: null, result: { stdout: string; stderr: string }) => void) => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);

        // Simulate async work
        setTimeout(() => {
          concurrentCount--;
          callback(null, { stdout: '{"success": true, "data": {"ok": true}}', stderr: "" });
        }, 50);
      }
    );

    // Fire 10 concurrent calls
    const promises = Array.from({ length: 10 }, (_, i) =>
      nansenCliCall(`cmd-${i}`, { skipCache: true, params: { i } })
    );

    await Promise.all(promises);

    // All should succeed
    for (const result of await Promise.all(promises)) {
      expect(result.success).toBe(true);
    }

    // Max concurrent should be capped at 6
    expect(maxConcurrent).toBeLessThanOrEqual(6);
  });
});
