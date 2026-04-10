import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock functions so they're available during vi.mock factory execution
const { mockStreamText, mockGenerateText, mockWebSearch, mockXSearch, mockResponses } = vi.hoisted(() => ({
  mockStreamText: vi.fn(),
  mockGenerateText: vi.fn(),
  mockWebSearch: vi.fn(() => ({ type: "web_search" })),
  mockXSearch: vi.fn(() => ({ type: "x_search" })),
  mockResponses: vi.fn((model: string) => ({ modelId: model, provider: "xai" })),
}));

vi.mock("@ai-sdk/xai", () => ({
  createXai: () => ({
    responses: mockResponses,
    tools: {
      webSearch: mockWebSearch,
      xSearch: mockXSearch,
    },
  }),
}));

vi.mock("ai", () => ({
  streamText: mockStreamText,
  generateText: mockGenerateText,
  Output: {
    object: (opts: { schema: unknown }) => ({ type: "object", schema: opts.schema }),
  },
}));

import { streamChat, structuredOutput, getJudgeTools, LLMError, FAST, REASONING } from "@/lib/llm";

describe("model constants", () => {
  it("exports correct model names", () => {
    expect(FAST).toBe("grok-4-1-fast-non-reasoning");
    expect(REASONING).toBe("grok-4.20-reasoning");
  });
});

describe("getJudgeTools", () => {
  it("returns web_search and x_search tools", () => {
    const tools = getJudgeTools();
    expect(tools).toHaveProperty("web_search");
    expect(tools).toHaveProperty("x_search");
    expect(mockWebSearch).toHaveBeenCalled();
    expect(mockXSearch).toHaveBeenCalled();
  });
});

describe("streamChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("yields text chunks from stream", async () => {
    const chunks = ["Hello ", "world ", "!"];
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        for (const c of chunks) yield c;
      })(),
    });

    const result: string[] = [];
    for await (const chunk of streamChat(FAST, "system", "user")) {
      result.push(chunk);
    }
    expect(result).toEqual(chunks);
  });

  it("calls streamText with correct params", async () => {
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield "ok";
      })(),
    });

    const gen = streamChat(FAST, "sys prompt", "user prompt");
    await gen.next();

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "sys prompt",
        prompt: "user prompt",
      })
    );
  });

  it("soft timeout stops after 2x target words", async () => {
    // target 3 words = max 6. Chunks of 3 words each.
    // After chunk 3: wordCount=9 > 6, so stops. Chunk 4 never reached.
    const chunks = ["one two three ", "four five six ", "seven eight nine ", "ten eleven twelve "];
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        for (const c of chunks) yield c;
      })(),
    });

    const result: string[] = [];
    for await (const chunk of streamChat(FAST, "sys", "user", { targetWords: 3 })) {
      result.push(chunk);
    }

    expect(result.length).toBe(3); // stops after 3rd chunk exceeds 2x3=6 words
    expect(result).not.toContain("ten eleven twelve ");
  });

  it("retries on 429 error", async () => {
    let callCount = 0;
    mockStreamText.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        throw new Error("429 Too Many Requests");
      }
      return {
        textStream: (async function* () {
          yield "retried";
        })(),
      };
    });

    const result: string[] = [];
    for await (const chunk of streamChat(FAST, "sys", "user")) {
      result.push(chunk);
    }
    expect(result).toEqual(["retried"]);
    expect(callCount).toBe(2);
  });

  it("retries on 500 error", async () => {
    let callCount = 0;
    mockStreamText.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        throw new Error("500 Internal Server Error");
      }
      return {
        textStream: (async function* () {
          yield "ok";
        })(),
      };
    });

    const result: string[] = [];
    for await (const chunk of streamChat(FAST, "sys", "user")) {
      result.push(chunk);
    }
    expect(result).toEqual(["ok"]);
    expect(callCount).toBe(2);
  });
});

describe("streamChat Grok tag stripping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockStream(chunks: string[]) {
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        for (const c of chunks) yield c;
      })(),
    });
  }

  async function collect(opts?: { targetWords?: number }): Promise<string> {
    let full = "";
    for await (const chunk of streamChat(FAST, "sys", "user", opts)) {
      full += chunk;
    }
    return full;
  }

  it("strips full Grok tags within a single chunk", async () => {
    mockStream(['text<grok:render type="render_inline_citation">more text']);
    expect(await collect()).toBe("textmore text");
  });

  it("strips closing Grok tags", async () => {
    mockStream(["data</argument>rest"]);
    expect(await collect()).toBe("datarest");
  });

  it("strips </grok:render> tags", async () => {
    mockStream(["before</grok:render>after"]);
    expect(await collect()).toBe("beforeafter");
  });

  it("strips multiple Grok tags in sequence", async () => {
    mockStream([
      'value</argument>\n<grok:render type="render_inline_citation">\n</grok:render>clean',
    ]);
    expect(await collect()).toBe("value\n\nclean");
  });

  it("strips Grok tag split across two chunks", async () => {
    mockStream(["text before<grok:ren", 'der type="foo">text after']);
    expect(await collect()).toBe("text beforetext after");
  });

  it("strips </argument> split across chunks", async () => {
    mockStream(["data</argu", "ment>rest"]);
    expect(await collect()).toBe("datarest");
  });

  it("preserves legitimate < comparisons (e.g. $154K < $200K)", async () => {
    mockStream(["buy volume $154K < sell volume $200K"]);
    expect(await collect()).toBe("buy volume $154K < sell volume $200K");
  });

  it("preserves < at end of chunk followed by non-tag text", async () => {
    mockStream(["price < ", "$0.05 target"]);
    expect(await collect()).toBe("price < $0.05 target");
  });

  it("preserves > in normal text", async () => {
    mockStream(["buys > sells, net positive"]);
    expect(await collect()).toBe("buys > sells, net positive");
  });

  it("handles chunk that is entirely a Grok tag", async () => {
    mockStream(['<argument name="citation_id">']);
    expect(await collect()).toBe("");
  });

  it("handles empty stream", async () => {
    mockStream([]);
    expect(await collect()).toBe("");
  });

  it("handles tag at very start of stream", async () => {
    mockStream(['<grok:render>content after']);
    expect(await collect()).toBe("content after");
  });

  it("handles tag at very end of stream", async () => {
    mockStream(['content before</grok:render>']);
    expect(await collect()).toBe("content before");
  });

  it("strips argument tag with attributes", async () => {
    mockStream(['<argument name="citation_id">token-info</argument>']);
    expect(await collect()).toBe("token-info");
  });
});

describe("structuredOutput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed output", async () => {
    const mockOutput = { score: 50, label: "Buy" };
    mockGenerateText.mockResolvedValue({ output: mockOutput });

    // Use a simple schema mock
    const schema = {} as never;
    const result = await structuredOutput(FAST, "sys", "user", schema);
    expect(result).toEqual(mockOutput);
  });

  it("retries on null output", async () => {
    let callCount = 0;
    mockGenerateText.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ output: null });
      }
      return Promise.resolve({ output: { score: 42 } });
    });

    const schema = {} as never;
    const result = await structuredOutput(FAST, "sys", "user", schema);
    expect(result).toEqual({ score: 42 });
    expect(callCount).toBe(2);
  });

  it("throws LLMError on persistent failure", async () => {
    mockGenerateText.mockResolvedValue({ output: null });

    const schema = {} as never;
    await expect(structuredOutput(FAST, "sys", "user", schema)).rejects.toThrow(LLMError);
  });
});

describe("LLMError", () => {
  it("wraps errors with correct code", () => {
    const err = new LLMError("rate limited", "RATE_LIMIT", true);
    expect(err.code).toBe("RATE_LIMIT");
    expect(err.retryable).toBe(true);
    expect(err.name).toBe("LLMError");
    expect(err.message).toBe("rate limited");
  });
});
