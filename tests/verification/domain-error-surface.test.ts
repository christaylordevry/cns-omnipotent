import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "../../src/config.js";
import { CnsError } from "../../src/errors.js";
import { callToolErrorFromCns } from "../../src/mcp-result.js";
import { loadMergedSecretPatterns } from "../../src/secrets/load-patterns.js";

function serializedPayloadText(err: CnsError, mcpVaultRoot: string): string {
  return callToolErrorFromCns(err, { mcpVaultRoot }).content[0].text;
}

describe("MCP domain error surface (Story 6.4)", () => {
  it("loadRuntimeConfig IO_ERROR JSON does not contain absolute CNS_VAULT_ROOT path", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "cns-6-4-cfg-"));
    const notDir = path.join(root, "not-a-directory");
    await writeFile(notDir, "block", "utf8");
    const vaultAbs = path.resolve(notDir);

    let caught: unknown;
    try {
      await loadRuntimeConfig({ env: { CNS_VAULT_ROOT: notDir } as NodeJS.ProcessEnv });
      expect.fail("expected loadRuntimeConfig to reject");
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(CnsError);
    const raw = serializedPayloadText(caught as CnsError, notDir);
    expect(raw).not.toContain(vaultAbs);
    expect(raw).toContain("[vault-root]");
  });

  it("loadMergedSecretPatterns IO_ERROR JSON does not leak vault absolute path from invalid override JSON", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-6-4-secrets-"));
    const vaultAbs = path.resolve(vaultRoot);
    await mkdir(path.join(vaultRoot, "_meta", "schemas"), { recursive: true });
    await writeFile(path.join(vaultRoot, "_meta", "schemas", "secret-patterns.json"), "not-json{", "utf8");

    let caught: unknown;
    try {
      await loadMergedSecretPatterns(vaultRoot);
      expect.fail("expected loadMergedSecretPatterns to reject");
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(CnsError);
    const raw = serializedPayloadText(caught as CnsError, vaultRoot);
    expect(raw).not.toContain(vaultAbs);
  });
});
