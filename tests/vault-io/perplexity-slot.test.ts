import { afterEach, describe, expect, it, vi } from "vitest";
import { CnsError } from "../../src/errors.js";

const mocks = vi.hoisted(() => {
  return {
    connectMock: vi.fn(async () => undefined),
    callToolMock: vi.fn(async () => ({
      structuredContent: { answer: "an answer", citations: ["https://example.com/a"] },
    })),
    closeMock: vi.fn(async () => undefined),
    spawnSyncMock: vi.fn(() => ({ status: 0 })),
  };
});

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => {
  return {
    Client: class {
      connect = mocks.connectMock;
      callTool = mocks.callToolMock;
      close = mocks.closeMock;
      constructor() {}
    },
  };
});

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => {
  return {
    StdioClientTransport: class {
      constructor() {}
    },
  };
});

vi.mock("node:child_process", () => ({ spawnSync: mocks.spawnSyncMock }));

import { createPerplexitySlot } from "../../src/agents/perplexity-slot.js";

describe("createPerplexitySlot", () => {
  const originalApiKey = process.env.PERPLEXITY_API_KEY;
  const originalCommand = process.env.PERPLEXITY_MCP_COMMAND;
  const originalArgs = process.env.PERPLEXITY_MCP_ARGS;
  const originalTool = process.env.PERPLEXITY_MCP_TOOL;
  const originalTimeout = process.env.PERPLEXITY_MCP_TIMEOUT_MS;

  afterEach(() => {
    vi.unstubAllGlobals();
    mocks.connectMock.mockClear();
    mocks.callToolMock.mockClear();
    mocks.closeMock.mockClear();
    mocks.spawnSyncMock.mockClear();
    if (originalApiKey === undefined) delete process.env.PERPLEXITY_API_KEY;
    else process.env.PERPLEXITY_API_KEY = originalApiKey;
    if (originalCommand === undefined) delete process.env.PERPLEXITY_MCP_COMMAND;
    else process.env.PERPLEXITY_MCP_COMMAND = originalCommand;
    if (originalArgs === undefined) delete process.env.PERPLEXITY_MCP_ARGS;
    else process.env.PERPLEXITY_MCP_ARGS = originalArgs;
    if (originalTool === undefined) delete process.env.PERPLEXITY_MCP_TOOL;
    else process.env.PERPLEXITY_MCP_TOOL = originalTool;
    if (originalTimeout === undefined) delete process.env.PERPLEXITY_MCP_TIMEOUT_MS;
    else process.env.PERPLEXITY_MCP_TIMEOUT_MS = originalTimeout;
  });

  it("available: false when PERPLEXITY_API_KEY not set", () => {
    delete process.env.PERPLEXITY_API_KEY;
    const slot = createPerplexitySlot();
    expect(slot.available).toBe(false);
  });

  it("available: true when PERPLEXITY_API_KEY is set", () => {
    process.env.PERPLEXITY_API_KEY = "test-api-key-xxxx";
    delete process.env.PERPLEXITY_MCP_ARGS;
    const slot = createPerplexitySlot();
    expect(slot.available).toBe(true);
  });

  it("available: false when PERPLEXITY_API_KEY is set but command not found on PATH", () => {
    process.env.PERPLEXITY_API_KEY = "test-api-key-xxxx";
    delete process.env.PERPLEXITY_MCP_ARGS;
    mocks.spawnSyncMock.mockReturnValueOnce({ status: 1 });
    const slot = createPerplexitySlot();
    expect(slot.available).toBe(false);
  });

  it("search() when command missing throws UNSUPPORTED with operator-actionable message", async () => {
    process.env.PERPLEXITY_API_KEY = "test-api-key-xxxx";
    process.env.PERPLEXITY_MCP_COMMAND = "npx";
    delete process.env.PERPLEXITY_MCP_ARGS;
    mocks.spawnSyncMock.mockReturnValueOnce({ status: 1 });
    const slot = createPerplexitySlot();
    await expect(slot.search("hello")).rejects.toMatchObject({
      name: "CnsError",
      code: "UNSUPPORTED",
    });
    await expect(slot.search("hello")).rejects.toThrow(/command not found on PATH: npx/);
  });

  it("search() when PERPLEXITY_MCP_ARGS is non-JSON throws UNSUPPORTED", async () => {
    process.env.PERPLEXITY_API_KEY = "test-api-key-xxxx";
    process.env.PERPLEXITY_MCP_ARGS = "-y perplexity-mcp";
    const slot = createPerplexitySlot();
    await expect(slot.search("hello")).rejects.toMatchObject({
      name: "CnsError",
      code: "UNSUPPORTED",
    });
    await expect(slot.search("hello")).rejects.toThrow(/PERPLEXITY_MCP_ARGS/);
  });

  it("search() when available is false throws UNSUPPORTED with exact message", async () => {
    delete process.env.PERPLEXITY_API_KEY;
    const slot = createPerplexitySlot();
    await expect(slot.search("hello")).rejects.toMatchObject({
      name: "CnsError",
      code: "UNSUPPORTED",
      message: "Perplexity not configured — PERPLEXITY_API_KEY missing",
    });
  });

  it("happy path: calls MCP tool and returns answer + citations", async () => {
    process.env.PERPLEXITY_API_KEY = "test-api-key-xxxx";
    delete process.env.PERPLEXITY_MCP_ARGS;
    mocks.callToolMock.mockResolvedValueOnce({
      structuredContent: {
        answer: "an answer",
        citations: ["https://example.com/a", "https://example.com/b"],
      },
    });

    const slot = createPerplexitySlot();
    const result = await slot.search("what is perplexity?");

    expect(result).toEqual({
      answer: "an answer",
      citations: ["https://example.com/a", "https://example.com/b"],
    });

    expect(mocks.connectMock).toHaveBeenCalledTimes(1);
    expect(mocks.callToolMock).toHaveBeenCalledTimes(1);
    expect(mocks.callToolMock).toHaveBeenCalledWith({
      name: "search",
      arguments: { query: "what is perplexity?" },
    });
    expect(mocks.closeMock).toHaveBeenCalledTimes(1);
  });

  it("tool error throws IO_ERROR", async () => {
    process.env.PERPLEXITY_API_KEY = "test-api-key-xxxx";
    delete process.env.PERPLEXITY_MCP_ARGS;
    mocks.callToolMock.mockResolvedValueOnce({
      isError: true,
      content: [{ type: "text", text: "bad key" }],
    });

    const slot = createPerplexitySlot();
    const err = await slot.search("hello").catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("IO_ERROR");
    expect((err as CnsError).message).toContain("Perplexity MCP failed:");
  });

  it("MCP call rejects throws IO_ERROR", async () => {
    process.env.PERPLEXITY_API_KEY = "test-api-key-xxxx";
    delete process.env.PERPLEXITY_MCP_ARGS;
    mocks.callToolMock.mockRejectedValueOnce(new Error("mcp down"));

    const slot = createPerplexitySlot();
    const err = await slot.search("hello").catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("IO_ERROR");
    expect((err as CnsError).message).toContain("Perplexity MCP failed:");
    expect((err as CnsError).message).toContain("mcp down");
  });

  it("content-block JSON payload is parsed into PerplexityResult", async () => {
    process.env.PERPLEXITY_API_KEY = "test-api-key-xxxx";
    delete process.env.PERPLEXITY_MCP_ARGS;
    mocks.callToolMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({ answer: "from json", citations: ["https://example.com/c"] }),
        },
      ],
    });

    const slot = createPerplexitySlot();
    const result = await slot.search("hello");
    expect(result).toEqual({ answer: "from json", citations: ["https://example.com/c"] });
  });
});

