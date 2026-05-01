import process from "node:process";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectMock: vi.fn(async () => undefined),
  callToolMock: vi.fn(async () => ({
    structuredContent: { answer: "stub", citations: [] as string[] },
  })),
  closeMock: vi.fn(async () => undefined),
}));

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class {
    connect = mocks.connectMock;
    callTool = mocks.callToolMock;
    close = mocks.closeMock;
    constructor() {}
  },
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: class {
    get pid(): number {
      return 90001;
    }
  },
}));

import { buildPerplexityMcpAdapter } from "../../src/adapters/perplexity-mcp-adapter.js";

describe("buildPerplexityMcpAdapter — timeout subprocess cleanup", () => {
  afterEach(() => {
    mocks.connectMock.mockReset();
    mocks.callToolMock.mockReset();
    mocks.closeMock.mockReset();
  });

  it("invokes kill(SIGKILL) on transport PID and closes client when connect times out", async () => {
    mocks.connectMock.mockImplementation(() => new Promise(() => {}));
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

    const adapter = buildPerplexityMcpAdapter({ timeoutMs: 25 });
    await expect(adapter.search("hello")).rejects.toThrow(/Perplexity MCP connect timed out/);

    expect(killSpy).toHaveBeenCalledWith(90001, "SIGKILL");
    expect(mocks.closeMock).toHaveBeenCalled();

    killSpy.mockRestore();
  });

  it("invokes kill(SIGKILL) on transport PID and closes client when callTool times out", async () => {
    mocks.connectMock.mockResolvedValue(undefined);
    mocks.callToolMock.mockImplementation(() => new Promise(() => {}));
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

    const adapter = buildPerplexityMcpAdapter({ timeoutMs: 25 });
    await expect(adapter.search("hello")).rejects.toThrow(/Perplexity MCP callTool timed out/);

    expect(killSpy).toHaveBeenCalledWith(90001, "SIGKILL");
    expect(mocks.closeMock).toHaveBeenCalled();

    killSpy.mockRestore();
  });
});
