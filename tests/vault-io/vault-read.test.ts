import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vaultReadFile } from "../../src/tools/vault-read.js";

describe("vaultReadFile", () => {
  it("reads UTF-8 file contents under vault root", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-read-"));
    await writeFile(path.join(vaultRoot, "note.md"), "# Title\n\nbody", "utf8");

    await expect(vaultReadFile(vaultRoot, "note.md")).resolves.toBe("# Title\n\nbody");
  });

  it("returns NOT_FOUND when file does not exist", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-read-"));

    await expect(vaultReadFile(vaultRoot, "missing.md")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns VAULT_BOUNDARY when path escapes vault", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-read-"));

    await expect(vaultReadFile(vaultRoot, "../outside.md")).rejects.toMatchObject({
      code: "VAULT_BOUNDARY",
    });
  });

  it("returns IO_ERROR when path is a directory", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-read-"));
    await mkdir(path.join(vaultRoot, "folder"), { recursive: true });

    await expect(vaultReadFile(vaultRoot, "folder")).rejects.toMatchObject({
      code: "IO_ERROR",
    });
  });
});
