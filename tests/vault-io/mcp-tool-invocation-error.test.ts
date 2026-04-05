import { describe, expect, it } from "vitest";
import { CnsError } from "../../src/errors.js";
import { handleToolInvocationCatch } from "../../src/mcp-result.js";

describe("handleToolInvocationCatch (MCP tool boundary)", () => {
  it("maps a plain Error to IO_ERROR with safe JSON (no stack in payload)", () => {
    const out = handleToolInvocationCatch(new Error("disk full"));
    expect(out.isError).toBe(true);
    const body = JSON.parse(out.content[0].text) as {
      code: string;
      message: string;
      details?: { name?: string; debug?: string };
    };
    expect(body.code).toBe("IO_ERROR");
    expect(body.message).toBe("An unexpected internal error occurred");
    expect(body.details).toEqual({ name: "Error", debug: "disk full" });
    expect(JSON.stringify(body)).not.toMatch(/stack/i);
  });

  it("passes through CnsError unchanged (same code as callToolErrorFromCns)", () => {
    const out = handleToolInvocationCatch(new CnsError("NOT_FOUND", "missing.md"));
    expect(out.isError).toBe(true);
    const body = JSON.parse(out.content[0].text) as { code: string; message: string };
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toBe("missing.md");
  });

  it("maps non-Error throws to IO_ERROR with kind detail", () => {
    const out = handleToolInvocationCatch("string-boom");
    const body = JSON.parse(out.content[0].text) as {
      code: string;
      details?: { kind?: string; debug?: string };
    };
    expect(body.code).toBe("IO_ERROR");
    expect(body.details).toEqual({ kind: "string", debug: "string-boom" });
  });
});
