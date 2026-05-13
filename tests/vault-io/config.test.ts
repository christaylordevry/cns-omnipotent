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

