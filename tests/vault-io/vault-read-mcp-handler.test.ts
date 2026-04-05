import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerVaultIoTools } from "../../src/register-vault-io-tools.js";
import { vaultReadFile } from "../../src/tools/vault-read.js";

vi.mock("../../src/tools/vault-read.js", () => ({
  vaultReadFile: vi.fn(),
}));

describe("vault_read registered MCP handler (integration wiring)", () => {
  beforeEach(() => {
    vi.mocked(vaultReadFile).mockReset();
  });

  it("returns isError IO_ERROR when vaultReadFile rejects with a plain Error", async () => {
    vi.mocked(vaultReadFile).mockRejectedValue(new Error("/secret/path EACCES"));

    const server = new McpServer({ name: "test-cns", version: "0.0.0" });
    const { vault_read } = registerVaultIoTools(server, { vaultRoot: "/tmp/vault" });

    const out = await vault_read.handler(
      { path: "note.md" },
      // RequestHandlerExtra — not needed for this handler body
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
    );

    expect(out.isError).toBe(true);
    const body = JSON.parse(out.content[0].text) as {
      code: string;
      message: string;
      details?: { debug?: string; name?: string };
    };
    expect(body.code).toBe("IO_ERROR");
    expect(body.message).toBe("An unexpected internal error occurred");
    expect(body.details?.debug).toBe("/secret/path EACCES");
    expect(body.details?.name).toBe("Error");
    expect(JSON.stringify(body)).not.toMatch(/stack/i);
  });
});
