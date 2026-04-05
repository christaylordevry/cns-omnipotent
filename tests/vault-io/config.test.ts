import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "../../src/config.js";

describe("loadRuntimeConfig", () => {
  it("fails when CNS_VAULT_ROOT is missing", async () => {
    await expect(loadRuntimeConfig({ env: {} as NodeJS.ProcessEnv })).rejects.toMatchObject({
      code: "IO_ERROR",
    });
  });

  it("fails when CNS_VAULT_ROOT does not exist", async () => {
    await expect(
      loadRuntimeConfig({ env: { CNS_VAULT_ROOT: "/path/does/not/exist" } as NodeJS.ProcessEnv }),
    ).rejects.toMatchObject({ code: "IO_ERROR" });
  });

  it("fails when CNS_VAULT_ROOT is a file", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-config-"));
    const filePath = path.join(dir, "not-a-dir.txt");
    await writeFile(filePath, "x");

    await expect(
      loadRuntimeConfig({ env: { CNS_VAULT_ROOT: filePath } as NodeJS.ProcessEnv }),
    ).rejects.toMatchObject({ code: "IO_ERROR" });
  });

  it("fails when CNS_VAULT_ROOT is the filesystem root (Epic B — meaningful boundary)", async () => {
    const { root } = path.parse(path.resolve("/"));
    await expect(
      loadRuntimeConfig({ env: { CNS_VAULT_ROOT: root } as NodeJS.ProcessEnv }),
    ).rejects.toMatchObject({
      code: "IO_ERROR",
      message: expect.stringMatching(/cannot be the filesystem root/i),
    });
  });

  it("prefers env CNS_VAULT_ROOT over host-provided vaultRootFromHost", async () => {
    const dirA = await mkdtemp(path.join(os.tmpdir(), "cns-config-a-"));
    const dirB = await mkdtemp(path.join(os.tmpdir(), "cns-config-b-"));

    const cfg = await loadRuntimeConfig({
      env: { CNS_VAULT_ROOT: dirA } as NodeJS.ProcessEnv,
      vaultRootFromHost: dirB,
    });

    expect(cfg.vaultRoot).toBe(dirA);
  });

  it("exposes CNS_VAULT_DEFAULT_SEARCH_SCOPE when set", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-config-scope-"));
    const cfg = await loadRuntimeConfig({
      env: {
        CNS_VAULT_ROOT: dir,
        CNS_VAULT_DEFAULT_SEARCH_SCOPE: "01-Projects",
      } as NodeJS.ProcessEnv,
    });
    expect(cfg.defaultSearchScope).toBe("01-Projects");
  });
});

