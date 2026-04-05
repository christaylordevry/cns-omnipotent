import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vaultReadFrontmatter } from "../../src/tools/vault-read-frontmatter.js";

describe("vaultReadFrontmatter", () => {
  it("returns frontmatter for a single file", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-fm-"));
    await writeFile(
      path.join(vaultRoot, "note.md"),
      "---\ntitle: Hello\ntags:\n  - a\n---\n\nbody",
      "utf8",
    );

    await expect(vaultReadFrontmatter(vaultRoot, ["note.md"])).resolves.toEqual({
      results: [
        {
          path: "note.md",
          frontmatter: { title: "Hello", tags: ["a"] },
        },
      ],
    });
  });

  it("returns multiple results in order", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-fm-"));
    await writeFile(path.join(vaultRoot, "a.md"), "---\nx: 1\n---\n", "utf8");
    await writeFile(path.join(vaultRoot, "b.md"), "---\ny: 2\n---\n", "utf8");

    await expect(vaultReadFrontmatter(vaultRoot, ["a.md", "b.md"])).resolves.toEqual({
      results: [
        { path: "a.md", frontmatter: { x: 1 } },
        { path: "b.md", frontmatter: { y: 2 } },
      ],
    });
  });

  it("returns empty frontmatter when no --- block", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-fm-"));
    await writeFile(path.join(vaultRoot, "plain.md"), "# Only body\n", "utf8");

    await expect(vaultReadFrontmatter(vaultRoot, ["plain.md"])).resolves.toEqual({
      results: [{ path: "plain.md", frontmatter: {} }],
    });
  });

  it("returns NOT_FOUND when file does not exist", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-fm-"));

    await expect(vaultReadFrontmatter(vaultRoot, ["missing.md"])).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns VAULT_BOUNDARY when path escapes vault", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-fm-"));

    await expect(vaultReadFrontmatter(vaultRoot, ["../outside.md"])).rejects.toMatchObject({
      code: "VAULT_BOUNDARY",
    });
  });

  it("returns IO_ERROR when path is a directory", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-fm-"));
    await mkdir(path.join(vaultRoot, "folder"), { recursive: true });

    await expect(vaultReadFrontmatter(vaultRoot, ["folder"])).rejects.toMatchObject({
      code: "IO_ERROR",
    });
  });

  it("returns IO_ERROR when YAML in frontmatter is invalid", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-fm-"));
    await writeFile(
      path.join(vaultRoot, "bad.md"),
      "---\ntitle: [broken\n---\n",
      "utf8",
    );

    await expect(vaultReadFrontmatter(vaultRoot, ["bad.md"])).rejects.toMatchObject({
      code: "IO_ERROR",
    });
  });
});
