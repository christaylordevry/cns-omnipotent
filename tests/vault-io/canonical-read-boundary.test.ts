import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vaultListDirectory } from "../../src/tools/vault-list.js";
import { vaultReadFrontmatter } from "../../src/tools/vault-read-frontmatter.js";
import { vaultReadFile } from "../../src/tools/vault-read.js";
import { vaultSearch } from "../../src/tools/vault-search.js";

function resolved(vaultRoot: string, ...segments: string[]): string {
  return path.normalize(path.resolve(vaultRoot, ...segments));
}

describe("canonical read boundary (4-9)", () => {
  it("vault_read throws VAULT_BOUNDARY when path is a symlink outside the vault", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-read-canonical-"));
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), "cns-read-out-"));
    const outsideFile = path.join(outsideDir, "secret.md");
    await writeFile(outsideFile, "escape", "utf8");
    await mkdir(resolved(vaultRoot, "00-Inbox"), { recursive: true });
    const link = resolved(vaultRoot, "00-Inbox", "escape.md");
    await symlink(outsideFile, link);

    await expect(vaultReadFile(vaultRoot, "00-Inbox/escape.md")).rejects.toMatchObject({
      code: "VAULT_BOUNDARY",
    });
  });

  it("vault_read throws NOT_FOUND for dangling symlink target", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-read-canonical-"));
    await mkdir(resolved(vaultRoot, "00-Inbox"), { recursive: true });
    const link = resolved(vaultRoot, "00-Inbox", "broken.md");
    await symlink(resolved(vaultRoot, "00-Inbox", "nonexistent-target.md"), link);

    await expect(vaultReadFile(vaultRoot, "00-Inbox/broken.md")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("vault_read follows symlink when target stays inside vault", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-read-canonical-"));
    await mkdir(resolved(vaultRoot, "00-Inbox"), { recursive: true });
    const real = resolved(vaultRoot, "00-Inbox", "real.md");
    await writeFile(real, "inside", "utf8");
    const link = resolved(vaultRoot, "00-Inbox", "link.md");
    await symlink(path.join("real.md"), link);

    await expect(vaultReadFile(vaultRoot, "00-Inbox/link.md")).resolves.toBe("inside");
  });

  it("vault_list throws VAULT_BOUNDARY when an entry symlink resolves outside the vault", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-read-canonical-"));
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), "cns-read-out-"));
    const outsideFile = path.join(outsideDir, "x.md");
    await writeFile(outsideFile, "x", "utf8");
    await mkdir(resolved(vaultRoot, "sub"), { recursive: true });
    await symlink(outsideFile, resolved(vaultRoot, "sub", "escape.md"));

    await expect(vaultListDirectory(vaultRoot, { userPath: "sub" })).rejects.toMatchObject({
      code: "VAULT_BOUNDARY",
    });
  });

  it("vault_list recursive still throws VAULT_BOUNDARY for outside symlinked directory entries", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-read-canonical-"));
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), "cns-read-out-"));
    await writeFile(path.join(outsideDir, "outside.md"), "x", "utf8");
    await mkdir(resolved(vaultRoot, "sub"), { recursive: true });
    await symlink(outsideDir, resolved(vaultRoot, "sub", "escape-dir"));

    await expect(vaultListDirectory(vaultRoot, { userPath: "sub", recursive: true })).rejects.toMatchObject({
      code: "VAULT_BOUNDARY",
    });
  });

  it("vault_list throws NOT_FOUND for dangling symlink entry", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-read-canonical-"));
    await mkdir(resolved(vaultRoot, "sub"), { recursive: true });
    await symlink(resolved(vaultRoot, "sub", "missing.md"), resolved(vaultRoot, "sub", "broken.md"));

    await expect(vaultListDirectory(vaultRoot, { userPath: "sub" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("vault_search (Node) throws VAULT_BOUNDARY when a markdown path symlink resolves outside", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-read-canonical-"));
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), "cns-read-out-"));
    const outsideMd = path.join(outsideDir, "leak.md");
    await writeFile(outsideMd, "secret-token-4-9-search\n", "utf8");
    await mkdir(resolved(vaultRoot, "notes"), { recursive: true });
    await symlink(outsideMd, resolved(vaultRoot, "notes", "leak.md"));

    await expect(
      vaultSearch(vaultRoot, {
        query: "secret-token-4-9-search",
        scope: "notes",
        forceNodeScanner: true,
      }),
    ).rejects.toMatchObject({ code: "VAULT_BOUNDARY" });
  });

  it("vault_read_frontmatter inherits vault_read boundary (symlink outside)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-read-canonical-"));
    const outsideDir = await mkdtemp(path.join(os.tmpdir(), "cns-read-out-"));
    const outsideFile = path.join(outsideDir, "n.md");
    await writeFile(outsideFile, "---\ntitle: x\n---\n", "utf8");
    await mkdir(resolved(vaultRoot, "00-Inbox"), { recursive: true });
    const link = resolved(vaultRoot, "00-Inbox", "n.md");
    await symlink(outsideFile, link);

    await expect(vaultReadFrontmatter(vaultRoot, ["00-Inbox/n.md"])).rejects.toMatchObject({
      code: "VAULT_BOUNDARY",
    });
  });
});
