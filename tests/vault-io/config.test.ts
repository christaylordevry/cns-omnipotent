import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getImplementationRepoRoot } from "../../src/implementation-root.js";
import { loadRuntimeConfig, warnIfCiFixtureVaultRoot } from "../../src/config.js";

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

  it("exposes Discord disambiguation env when set", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-config-discord-"));
    const cfg = await loadRuntimeConfig({
      env: {
        CNS_VAULT_ROOT: dir,
        CNS_DISCORD_HERMES_CHANNEL_ID: " 1500733488897462382 ",
        HERMES_DISCORD_TOKEN: "fake-token",
      } as NodeJS.ProcessEnv,
    });
    expect(cfg.discordHermesChannelId).toBe("1500733488897462382");
    expect(cfg.discordBotToken).toBe("fake-token");
  });

  it("prefers CNS_DISCORD_BOT_TOKEN over HERMES_DISCORD_TOKEN", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-config-discord2-"));
    const cfg = await loadRuntimeConfig({
      env: {
        CNS_VAULT_ROOT: dir,
        CNS_DISCORD_BOT_TOKEN: "primary",
        HERMES_DISCORD_TOKEN: "secondary",
        CNS_DISCORD_HERMES_CHANNEL_ID: "1",
      } as NodeJS.ProcessEnv,
    });
    expect(cfg.discordBotToken).toBe("primary");
  });
});

describe("warnIfCiFixtureVaultRoot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warns when CNS_VAULT_ROOT is the repo CI fixture", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const fixtureRoot = path.join(getImplementationRepoRoot(), "Knowledge-Vault-ACTIVE");

    await warnIfCiFixtureVaultRoot(fixtureRoot);

    expect(stderrSpy).toHaveBeenCalled();
    const message = String(stderrSpy.mock.calls[0]?.[0] ?? "");
    expect(message).toMatch(/CI fixture/i);
    expect(message).toMatch(/canonical live vault/i);
    expect(message).toMatch(/CNS_VAULT_ROOT/i);
  });

  it("stays silent for a non-fixture vault root", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-config-other-root-"));

    await warnIfCiFixtureVaultRoot(dir);

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("never throws even when the path is invalid", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await expect(warnIfCiFixtureVaultRoot("\0bad")).resolves.toBeUndefined();

    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("loadRuntimeConfig warns for fixture root but still returns config", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const fixtureRoot = path.join(getImplementationRepoRoot(), "Knowledge-Vault-ACTIVE");

    const cfg = await loadRuntimeConfig({
      env: { CNS_VAULT_ROOT: fixtureRoot } as NodeJS.ProcessEnv,
    });

    expect(cfg.vaultRoot).toBe(fixtureRoot);
    expect(stderrSpy).toHaveBeenCalled();
  });
});

