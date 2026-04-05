import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertWithinVault, resolveVaultPath } from "../../src/paths.js";

describe("vault path boundary", () => {
  it("resolves a vault-relative path under root", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-vault-"));
    const resolved = resolveVaultPath(vaultRoot, "notes/a.md");
    expect(resolved.startsWith(path.normalize(vaultRoot + path.sep))).toBe(true);
  });

  it("rejects traversal that escapes the vault root", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-vault-"));
    expect(() => resolveVaultPath(vaultRoot, "../escape.md")).toThrowError(/escapes vault root/i);
  });

  it("allows resolution exactly at vault root (e.g. '.' or empty relative segment)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-vault-"));
    expect(resolveVaultPath(vaultRoot, ".")).toBe(path.normalize(path.resolve(vaultRoot)));
    expect(resolveVaultPath(vaultRoot, "")).toBe(path.normalize(path.resolve(vaultRoot)));
  });

  it("assertWithinVault allows the vault root path itself", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-vault-"));
    const normalized = path.normalize(path.resolve(vaultRoot));
    expect(() => assertWithinVault(vaultRoot, normalized)).not.toThrow();
  });

  it("rejects an absolute path outside the vault root", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-vault-"));
    const outside = path.resolve(path.join(vaultRoot, "..", "outside.md"));
    expect(() => resolveVaultPath(vaultRoot, outside)).toThrow();
  });

  it("assertWithinVault rejects outside path", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-vault-"));
    const outside = path.resolve(path.join(vaultRoot, "..", "outside.md"));
    expect(() => assertWithinVault(vaultRoot, outside)).toThrow();
  });
});

