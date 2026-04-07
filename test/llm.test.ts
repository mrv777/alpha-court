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
    expect(REASONING).toBe("grok-4-1-fast-reasoning");
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
