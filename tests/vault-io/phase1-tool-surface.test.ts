import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import {
  PHASE1_VAULT_IO_TOOL_NAMES,
  registerVaultIoTools,
} from "../../src/register-vault-io-tools.js";

describe("Phase 1 Vault IO tool surface", () => {
  it("registerVaultIoTools exposes exactly the nine normative tool names", () => {
    const server = new McpServer({ name: "test-cns-phase1-surface", version: "0.0.0" });
    const handles = registerVaultIoTools(server, { vaultRoot: "/tmp/vault" });

    const names = Object.keys(handles).sort();
    const expected = [...PHASE1_VAULT_IO_TOOL_NAMES].sort();
    expect(names).toEqual(expected);
    expect(names).toHaveLength(9);
  });
});
