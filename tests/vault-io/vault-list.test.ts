import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vaultListDirectory } from "../../src/tools/vault-list.js";

describe("vaultListDirectory", () => {
  it("lists files and directories at vault root with metadata", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-list-"));
    await writeFile(path.join(vaultRoot, "a.md"), "# a", "utf8");
    await mkdir(path.join(vaultRoot, "sub"), { recursive: true });
    await writeFile(path.join(vaultRoot, "sub", "b.md"), "# b", "utf8");

    const out = await vaultListDirectory(vaultRoot, { userPath: "." });

    expect(out.path).toBe(".");
    const names = out.entries.map((e) => e.name).sort();
    expect(names).toEqual(["a.md", "sub"]);
    const a = out.entries.find((e) => e.name === "a.md");
    expect(a?.type).toBe("file");
    expect(a?.vaultPath).toBe("a.md");
    expect(a?.modified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const sub = out.entries.find((e) => e.name === "sub");
    expect(sub?.type).toBe("directory");
    expect(sub?.vaultPath).toBe("sub");
  });

  it("lists a nested directory non-recursively", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-list-"));
    await mkdir(path.join(vaultRoot, "00-Inbox"), { recursive: true });
    await writeFile(path.join(vaultRoot, "00-Inbox", "n.md"), "x", "utf8");

    const out = await vaultListDirectory(vaultRoot, { userPath: "00-Inbox" });
    expect(out.path).toBe("00-Inbox");
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0]).toMatchObject({
      name: "n.md",
      vaultPath: "00-Inbox/n.md",
      type: "file",
    });
  });

  it("returns NOT_FOUND for missing directory", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-list-"));

    await expect(vaultListDirectory(vaultRoot, { userPath: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns VAULT_BOUNDARY for escape", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-list-"));

    await expect(vaultListDirectory(vaultRoot, { userPath: "../outside" })).rejects.toMatchObject({
      code: "VAULT_BOUNDARY",
    });
  });

  it("returns IO_ERROR when path is a file", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-list-"));
    await writeFile(path.join(vaultRoot, "only.md"), "x", "utf8");

    await expect(vaultListDirectory(vaultRoot, { userPath: "only.md" })).rejects.toMatchObject({
      code: "IO_ERROR",
    });
  });

  it("lists recursively", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-list-"));
    await mkdir(path.join(vaultRoot, "d1", "d2"), { recursive: true });
    await writeFile(path.join(vaultRoot, "root.md"), "r", "utf8");
    await writeFile(path.join(vaultRoot, "d1", "a.md"), "a", "utf8");
    await writeFile(path.join(vaultRoot, "d1", "d2", "b.md"), "b", "utf8");

    const out = await vaultListDirectory(vaultRoot, { userPath: ".", recursive: true });
    const paths = out.entries.map((e) => e.vaultPath).sort();
    expect(paths).toContain("root.md");
    expect(paths).toContain("d1");
    expect(paths).toContain("d1/a.md");
    expect(paths).toContain("d1/d2");
    expect(paths).toContain("d1/d2/b.md");
  });

  it("recursive listing does not loop on canonical symlink directory cycles", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-list-"));
    await writeFile(path.join(vaultRoot, "root.md"), "r", "utf8");
    await symlink(".", path.join(vaultRoot, "loop"));

    const out = await vaultListDirectory(vaultRoot, { userPath: ".", recursive: true });
    const paths = out.entries.map((e) => e.vaultPath).sort();
    expect(paths).toContain("root.md");
    expect(paths).toContain("loop");
    expect(paths.filter((p) => p === "root.md")).toHaveLength(1);
    expect(paths.filter((p) => p === "loop")).toHaveLength(1);
  });

  it("filter_by_type keeps directories and matching markdown", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-list-"));
    await mkdir(path.join(vaultRoot, "keep"), { recursive: true });
    await writeFile(
      path.join(vaultRoot, "w.md"),
      "---\npake_type: WorkflowNote\nstatus: in-progress\n---\n",
      "utf8",
    );
    await writeFile(
      path.join(vaultRoot, "s.md"),
      "---\npake_type: SourceNote\n---\n",
      "utf8",
    );

    const out = await vaultListDirectory(vaultRoot, {
      userPath: ".",
      filter_by_type: "WorkflowNote",
    });
    const names = out.entries.map((e) => e.name).sort();
    expect(names).toEqual(["keep", "w.md"]);
  });

  it("filter_by_status matches frontmatter status", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-list-"));
    await writeFile(
      path.join(vaultRoot, "a.md"),
      "---\npake_type: WorkflowNote\nstatus: draft\n---\n",
      "utf8",
    );
    await writeFile(
      path.join(vaultRoot, "b.md"),
      "---\npake_type: WorkflowNote\nstatus: reviewed\n---\n",
      "utf8",
    );

    const out = await vaultListDirectory(vaultRoot, {
      userPath: ".",
      filter_by_status: "draft",
    });
    expect(out.entries.map((e) => e.name)).toEqual(["a.md"]);
  });
});
