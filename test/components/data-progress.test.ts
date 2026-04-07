import { describe, it, expect } from "vitest";
import type { DataProgress } from "@/hooks/use-debate-stream";

// Test the data grouping logic that DataProgressGrid uses
function groupByAgent(items: DataProgress[]): Record<string, DataProgress[]> {
  const grouped: Record<string, DataProgress[]> = {
    bull: [],
    bear: [],
    judge: [],
  };
  for (const item of items) {
    grouped[item.agent]?.push(item);
  }
  return grouped;
}

describe("DataProgressGrid grouping", () => {
  it("groups items by agent correctly", () => {
    const items: DataProgress[] = [
      { endpoint: "smart-money netflow", agent: "bull", status: "complete" },
      { endpoint: "who-bought-sold (buy)", agent: "bull", status: "pending" },
      { endpoint: "token-dex-trades", agent: "bear", status: "complete" },
      { endpoint: "token-holders", agent: "bear", status: "error" },
      { endpoint: "token-info", agent: "judge", status: "pending" },
    ];

    const grouped = groupByAgent(items);
    expect(grouped.bull).toHaveLength(2);
    expect(grouped.bear).toHaveLength(2);
    expect(grouped.judge).toHaveLength(1);
  });

  it("handles empty items", () => {
    const grouped = groupByAgent([]);
    expect(grouped.bull).toHaveLength(0);
    expect(grouped.bear).toHaveLength(0);
    expect(grouped.judge).toHaveLength(0);
  });

  it("all items have correct status values", () => {
    const items: DataProgress[] = [
      { endpoint: "ep1", agent: "bull", status: "pending" },
      { endpoint: "ep2", agent: "bull", status: "complete" },
      { endpoint: "ep3", agent: "bull", status: "error" },
    ];

    const grouped = groupByAgent(items);
    expect(grouped.bull[0].status).toBe("pending");
    expect(grouped.bull[1].status).toBe("complete");
    expect(grouped.bull[2].status).toBe("error");
  });

  it("handles all items in one agent group", () => {
    const items: DataProgress[] = [
      { endpoint: "ep1", agent: "bear", status: "complete" },
      { endpoint: "ep2", agent: "bear", status: "complete" },
      { endpoint: "ep3", agent: "bear", status: "complete" },
    ];

    const grouped = groupByAgent(items);
    expect(grouped.bull).toHaveLength(0);
    expect(grouped.bear).toHaveLength(3);
    expect(grouped.judge).toHaveLength(0);
  });
});
