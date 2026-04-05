import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CnsError } from "../../src/errors.js";
import {
  resolveEffectiveSearchScope,
  scopeAllowsMetaLogs,
  vaultSearch,
} from "../../src/tools/vault-search.js";

describe("resolveEffectiveSearchScope", () => {
  it("uses explicit scope when provided", () => {
    expect(resolveEffectiveSearchScope("00-Inbox", undefined)).toBe("00-Inbox");
  });

  it("falls back to default when scope omitted", () => {
    expect(resolveEffectiveSearchScope(undefined, "01-Projects")).toBe("01-Projects");
  });

  it("throws UNSUPPORTED when neither scope nor default", () => {
    try {
      resolveEffectiveSearchScope(undefined, undefined);
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(CnsError);
      expect((e as CnsError).code).toBe("UNSUPPORTED");
    }
  });
});

describe("scopeAllowsMetaLogs", () => {
  it("is true only for _meta/logs scopes", () => {
    expect(scopeAllowsMetaLogs("_meta/logs")).toBe(true);
    expect(scopeAllowsMetaLogs("_meta/logs/sub")).toBe(true);
    expect(scopeAllowsMetaLogs(".")).toBe(false);
    expect(scopeAllowsMetaLogs("_meta")).toBe(false);
  });
});

describe("vaultSearch (Node scanner)", () => {
  it("finds matches under scope", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-search-"));
    await mkdir(path.join(vaultRoot, "notes"), { recursive: true });
    await writeFile(path.join(vaultRoot, "notes", "a.md"), "# Hello unique-token-xyz\nbody\n", "utf8");

    const out = await vaultSearch(vaultRoot, {
      query: "unique-token-xyz",
      scope: "notes",
      forceNodeScanner: true,
    });

    expect(out.hits).toHaveLength(1);
    expect(out.hits[0].path).toBe("notes/a.md");
    expect(out.hits[0].matched_snippet).toContain("unique-token-xyz");
    expect(out.hits[0].frontmatter_summary).toBe("{}");
  });

  it("respects .gitignore for markdown files", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-search-"));
    await writeFile(path.join(vaultRoot, ".gitignore"), "*.ignored.md\n", "utf8");
    await writeFile(path.join(vaultRoot, "visible.md"), "find-me-abc\n", "utf8");
    await writeFile(path.join(vaultRoot, "x.ignored.md"), "find-me-abc\n", "utf8");

    const out = await vaultSearch(vaultRoot, {
      query: "find-me-abc",
      scope: ".",
      forceNodeScanner: true,
    });

    expect(out.hits.map((h) => h.path)).toEqual(["visible.md"]);
  });

  it("excludes _meta/logs unless scope is under logs", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-search-"));
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
    await writeFile(path.join(vaultRoot, "root.md"), "secret-log-token\n", "utf8");
    await writeFile(path.join(vaultRoot, "_meta", "logs", "agent-log.md"), "secret-log-token\n", "utf8");

    const scoped = await vaultSearch(vaultRoot, {
      query: "secret-log-token",
      scope: ".",
      forceNodeScanner: true,
    });
    expect(scoped.hits.map((h) => h.path)).toEqual(["root.md"]);

    const inLogs = await vaultSearch(vaultRoot, {
      query: "secret-log-token",
      scope: "_meta/logs",
      forceNodeScanner: true,
    });
    expect(inLogs.hits.map((h) => h.path)).toContain("_meta/logs/agent-log.md");
  });

  it("caps at max_results", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-search-"));
    for (let i = 0; i < 15; i++) {
      await writeFile(path.join(vaultRoot, `f${i}.md`), `line hit-${i}\n`, "utf8");
    }

    const out = await vaultSearch(vaultRoot, {
      query: "line",
      scope: ".",
      maxResults: 7,
      forceNodeScanner: true,
    });
    expect(out.hits.length).toBe(7);
  });

  it("does not loop on canonical symlink directory cycles", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-search-"));
    await writeFile(path.join(vaultRoot, "root.md"), "cycle-safe-token\n", "utf8");
    await symlink(".", path.join(vaultRoot, "loop"));

    const out = await vaultSearch(vaultRoot, {
      query: "cycle-safe-token",
      scope: ".",
      forceNodeScanner: true,
    });

    expect(out.hits).toHaveLength(1);
    expect(out.hits[0].path).toBe("root.md");
  });

  it("returns NOT_FOUND for missing scope directory", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-search-"));

    await expect(
      vaultSearch(vaultRoot, { query: "x", scope: "nope", forceNodeScanner: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
