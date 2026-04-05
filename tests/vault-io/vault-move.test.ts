import { access, chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadRuntimeConfig } from "../../src/config.js";
import { mapWikilinkTarget, rewriteWikilinksForMove } from "../../src/tools/wikilink-repair.js";
import { vaultMove } from "../../src/tools/vault-move.js";

const validSourceNote = `---
pake_id: "550e8400-e29b-41d4-a716-446655440000"
pake_type: SourceNote
title: "T"
created: "2026-04-02"
modified: "2026-04-02"
status: draft
confidence_score: 0.5
verification_status: pending
creation_method: ai
tags: []
---

# Body
`;

describe("wikilink repair helpers", () => {
  it("maps full vault-relative paths and basename variants", () => {
    expect(mapWikilinkTarget("03-Resources/old.md", "03-Resources/old.md", "01-Projects/P/new.md")).toBe(
      "01-Projects/P/new.md",
    );
    expect(mapWikilinkTarget("03-Resources/old", "03-Resources/old.md", "01-Projects/P/new.md")).toBe(
      "01-Projects/P/new.md",
    );
    expect(mapWikilinkTarget("old.md", "03-Resources/old.md", "01-Projects/P/new.md")).toBe("new.md");
  });

  it("rewrites wikilinks in markdown text", () => {
    const before = "See [[03-Resources/old.md]] and ![[03-Resources/old|alias]].";
    const after = rewriteWikilinksForMove(before, "03-Resources/old.md", "01-Projects/P/new.md");
    expect(after).toContain("[[01-Projects/P/new.md]]");
    expect(after).toContain("![[01-Projects/P/new.md|alias]]");
  });
});

describe("vaultMove", () => {
  it("renames a note in a temp vault (fallback) and appends audit with source and destination", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-move-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await mkdir(path.join(vaultRoot, "01-Projects", "CNS"), { recursive: true });
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
    await writeFile(path.join(vaultRoot, "03-Resources", "note.md"), validSourceNote, "utf8");

    const out = await vaultMove(vaultRoot, "03-Resources/note.md", "01-Projects/CNS/note.md", {
      surface: "vitest",
    });

    expect(out.old_path).toBe("03-Resources/note.md");
    expect(out.new_path).toBe("01-Projects/CNS/note.md");
    expect(out.backlinks_updated).toBe(0);
    expect(out.partial_wikilink_repair).toBe(false);

    const moved = await readFile(path.join(vaultRoot, "01-Projects", "CNS", "note.md"), "utf8");
    expect(moved).toContain("# Body");
    expect(moved).toMatch(/modified:\s*['"]\d{4}-\d{2}-\d{2}['"]/);

    const log = await readFile(path.join(vaultRoot, "_meta", "logs", "agent-log.md"), "utf8");
    expect(log).toContain('"source":"03-Resources/note.md"');
    expect(log).toContain('"destination":"01-Projects/CNS/note.md"');
    expect(log).toContain("| vitest |");
  });

  it("updates backlinks in another note after move", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-move-links-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await mkdir(path.join(vaultRoot, "01-Projects", "CNS"), { recursive: true });
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
    await writeFile(path.join(vaultRoot, "03-Resources", "a.md"), validSourceNote, "utf8");
    await writeFile(
      path.join(vaultRoot, "03-Resources", "b.md"),
      `${validSourceNote}\nLink: [[03-Resources/a.md]]\n`,
      "utf8",
    );

    const out = await vaultMove(vaultRoot, "03-Resources/a.md", "01-Projects/CNS/a.md", { surface: "vitest" });
    expect(out.backlinks_updated).toBe(1);
    expect(out.partial_wikilink_repair).toBe(false);
    const b = await readFile(path.join(vaultRoot, "03-Resources", "b.md"), "utf8");
    expect(b).toContain("[[01-Projects/CNS/a.md]]");
  });

  it("throws NOT_FOUND when source is missing", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-move-miss-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });

    await expect(
      vaultMove(vaultRoot, "03-Resources/nope.md", "03-Resources/x.md", { surface: "vitest" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws IO_ERROR when destination already exists", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-move-exist-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
    await writeFile(path.join(vaultRoot, "03-Resources", "a.md"), validSourceNote, "utf8");
    await writeFile(path.join(vaultRoot, "03-Resources", "b.md"), validSourceNote, "utf8");

    await expect(
      vaultMove(vaultRoot, "03-Resources/a.md", "03-Resources/b.md", { surface: "vitest" }),
    ).rejects.toMatchObject({ code: "IO_ERROR" });
  });

  it("throws PROTECTED_PATH when destination is under AI-Context", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-move-ai-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await mkdir(path.join(vaultRoot, "AI-Context"), { recursive: true });
    await writeFile(path.join(vaultRoot, "03-Resources", "a.md"), validSourceNote, "utf8");

    await expect(
      vaultMove(vaultRoot, "03-Resources/a.md", "AI-Context/x.md", { surface: "vitest" }),
    ).rejects.toMatchObject({ code: "PROTECTED_PATH" });
  });

  it("throws VAULT_BOUNDARY when destination escapes the vault", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-move-bound-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await writeFile(path.join(vaultRoot, "03-Resources", "a.md"), validSourceNote, "utf8");

    await expect(
      vaultMove(vaultRoot, "03-Resources/a.md", "../../../escape.md", { surface: "vitest" }),
    ).rejects.toMatchObject({ code: "VAULT_BOUNDARY" });
  });

  it("throws SCHEMA_INVALID when moving from Inbox into governed tree with invalid PAKE", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-move-pake-"));
    await mkdir(path.join(vaultRoot, "00-Inbox"), { recursive: true });
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await writeFile(path.join(vaultRoot, "00-Inbox", "raw.md"), "---\nnot: pake\n---\n", "utf8");

    await expect(
      vaultMove(vaultRoot, "00-Inbox/raw.md", "03-Resources/raw.md", { surface: "vitest" }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("rejects IO_ERROR when Obsidian CLI exits 0 but source file still exists (copy-only fake)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-move-cli-copy-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await mkdir(path.join(vaultRoot, "01-Projects", "CNS"), { recursive: true });
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
    await writeFile(path.join(vaultRoot, "_meta", "logs", "agent-log.md"), "", "utf8");
    await writeFile(path.join(vaultRoot, "03-Resources", "note.md"), validSourceNote, "utf8");

    const fakeCliJs = path.join(vaultRoot, "fake-obsidian-copy.mjs");
    await writeFile(
      fakeCliJs,
      `import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
const root = process.env.CNS_VAULT_ROOT;
if (!root) process.exit(1);
let srcRel = "";
let dstRel = "";
for (const a of process.argv.slice(2)) {
  if (a.startsWith("path=")) srcRel = a.slice(5);
  if (a.startsWith("to=")) dstRel = a.slice(3);
}
const srcAbs = path.join(root, ...srcRel.split("/"));
const dstAbs = path.join(root, ...dstRel.split("/"));
mkdirSync(path.dirname(dstAbs), { recursive: true });
copyFileSync(srcAbs, dstAbs);
process.exit(0);
`,
      "utf8",
    );

    const fakeCli = path.join(vaultRoot, "fake-obsidian.sh");
    await writeFile(
      fakeCli,
      `#!/bin/sh
export CNS_VAULT_ROOT="${vaultRoot.replace(/"/g, '\\"')}"
exec node "${fakeCliJs.replace(/"/g, '\\"')}" "$@"
`,
      "utf8",
    );
    await chmod(fakeCli, 0o755);

    await expect(
      vaultMove(vaultRoot, "03-Resources/note.md", "01-Projects/CNS/note.md", {
        surface: "vitest",
        obsidianCliPath: fakeCli,
      }),
    ).rejects.toMatchObject({ code: "IO_ERROR" });

    // Fake CLI copied to dest but left source — we fail closed before overwriting dest or appending audit.
    await expect(access(path.join(vaultRoot, "03-Resources", "note.md"))).resolves.toBeUndefined();
    await expect(access(path.join(vaultRoot, "01-Projects", "CNS", "note.md"))).resolves.toBeUndefined();

    const logContent = await readFile(path.join(vaultRoot, "_meta/logs/agent-log.md"), "utf8");
    expect(logContent).toBe(""); // no audit entry on fail-closed path
  });

  it("falls back to rename when Obsidian CLI exits non-zero", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-move-cli-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await mkdir(path.join(vaultRoot, "01-Projects", "CNS"), { recursive: true });
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
    await writeFile(path.join(vaultRoot, "03-Resources", "note.md"), validSourceNote, "utf8");

    const fakeCli = path.join(vaultRoot, "fake-obsidian.sh");
    await writeFile(fakeCli, "#!/bin/sh\nexit 1\n", "utf8");
    await chmod(fakeCli, 0o755);

    const out = await vaultMove(vaultRoot, "03-Resources/note.md", "01-Projects/CNS/note.md", {
      surface: "vitest",
      obsidianCliPath: fakeCli,
    });
    expect(out.new_path).toBe("01-Projects/CNS/note.md");
    expect(out.partial_wikilink_repair).toBe(false);
  });

  it("pre-validates secret scan before rename and leaves source in place on SECRET_PATTERN", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-move-secret-precheck-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await mkdir(path.join(vaultRoot, "01-Projects", "CNS"), { recursive: true });
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
    const sourceRel = "03-Resources/note.md";
    const destRel = "01-Projects/CNS/note.md";
    const sourceAbs = path.join(vaultRoot, sourceRel);
    const destAbs = path.join(vaultRoot, destRel);
    const secretBody = "secret sk-proj-ABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
    await writeFile(sourceAbs, `${validSourceNote}\n${secretBody}\n`, "utf8");

    await expect(vaultMove(vaultRoot, sourceRel, destRel, { surface: "vitest" })).rejects.toMatchObject({
      code: "SECRET_PATTERN",
    });

    await expect(access(sourceAbs)).resolves.toBeUndefined();
    await expect(access(destAbs)).rejects.toBeDefined();
  });

  it("sets partial_wikilink_repair when a linking note cannot be rewritten (protected path)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-move-partial-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await mkdir(path.join(vaultRoot, "01-Projects", "CNS"), { recursive: true });
    await mkdir(path.join(vaultRoot, "AI-Context"), { recursive: true });
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
    await writeFile(path.join(vaultRoot, "03-Resources", "a.md"), validSourceNote, "utf8");
    await writeFile(
      path.join(vaultRoot, "AI-Context", "linker.md"),
      `${validSourceNote}\nLink: [[03-Resources/a.md]]\n`,
      "utf8",
    );

    const out = await vaultMove(vaultRoot, "03-Resources/a.md", "01-Projects/CNS/a.md", { surface: "vitest" });
    expect(out.partial_wikilink_repair).toBe(true);
    expect(out.wikilink_repair_warnings?.some((w) => w.startsWith("wikilink_skip_protected:"))).toBe(true);
    const linker = await readFile(path.join(vaultRoot, "AI-Context", "linker.md"), "utf8");
    expect(linker).toContain("[[03-Resources/a.md]]");
  });
});

describe("loadRuntimeConfig obsidian CLI", () => {
  it("exposes obsidianCliPath when CNS_OBSIDIAN_CLI is set", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-obs-"));
    const cfg = await loadRuntimeConfig({
      env: {
        CNS_VAULT_ROOT: dir,
        CNS_OBSIDIAN_CLI: "/usr/bin/obsidian",
      } as NodeJS.ProcessEnv,
    });
    expect(cfg.obsidianCliPath).toBe("/usr/bin/obsidian");
  });
});
