import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseNoteFrontmatter } from "../../src/pake/parse-frontmatter.js";
import { vaultUpdateFrontmatter } from "../../src/tools/vault-update-frontmatter.js";

const validBaseFm = `---
pake_id: "550e8400-e29b-41d4-a716-446655440000"
pake_type: SourceNote
title: "Minimal"
created: "2026-04-02"
modified: "2026-04-02"
status: draft
confidence_score: 0.5
verification_status: pending
creation_method: ai
tags:
  - seed
---

# Body

Keep this line.
`;

describe("vaultUpdateFrontmatter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shallow-merges updates, preserves unspecified keys and body, bumps modified", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-ufm-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    const rel = "03-Resources/note.md";
    await writeFile(path.join(vaultRoot, rel), validBaseFm, "utf8");

    const out = await vaultUpdateFrontmatter(vaultRoot, rel, { status: "reviewed" });

    expect(out.path).toBe(rel);
    expect(out.updated_fields).toEqual(["status", "modified"]);
    expect(out.modified_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const disk = await readFile(path.join(vaultRoot, rel), "utf8");
    const { frontmatter, body } = parseNoteFrontmatter(disk);
    expect(frontmatter.status).toBe("reviewed");
    expect(frontmatter.title).toBe("Minimal");
    expect(frontmatter.tags).toEqual(["seed"]);
    expect(frontmatter.modified).toBe("2026-06-15");
    expect(body).toContain("Keep this line.");
  });

  it("lists modified in updated_fields when the caller included modified in updates", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-ufm-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    const rel = "03-Resources/note.md";
    await writeFile(path.join(vaultRoot, rel), validBaseFm, "utf8");

    const out = await vaultUpdateFrontmatter(vaultRoot, rel, {
      status: "in-progress",
      modified: "2020-01-01",
    });

    expect(new Set(out.updated_fields)).toEqual(new Set(["status", "modified"]));
    const disk = await readFile(path.join(vaultRoot, rel), "utf8");
    const { frontmatter } = parseNoteFrontmatter(disk);
    expect(frontmatter.modified).toBe("2026-06-15");
  });
});

describe("vaultUpdateFrontmatter gates", () => {
  it("fails PROTECTED_PATH on AI-Context before read (WriteGate first)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-ufm-"));
    await mkdir(path.join(vaultRoot, "AI-Context"), { recursive: true });
    await writeFile(path.join(vaultRoot, "AI-Context", "x.md"), validBaseFm, "utf8");

    await expect(
      vaultUpdateFrontmatter(vaultRoot, "AI-Context/x.md", { status: "reviewed" }),
    ).rejects.toMatchObject({ code: "PROTECTED_PATH" });
  });

  it("runs PAKE before secret scan (SCHEMA_INVALID when merged note would also hit secret pattern)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-ufm-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    const rel = "03-Resources/bad.md";
    const withSecretBody = `${validBaseFm.replace("# Body\n\nKeep this line.", "# Body\n\nSee AKIA0123456789ABCDEF")}`;
    await writeFile(path.join(vaultRoot, rel), withSecretBody, "utf8");

    await expect(
      vaultUpdateFrontmatter(vaultRoot, rel, { status: "not-a-status" }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("fails SECRET_PATTERN when PAKE passes on merged frontmatter", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-ufm-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    const rel = "03-Resources/leak.md";
    const withSecretBody = `${validBaseFm.replace("# Body\n\nKeep this line.", "# Body\n\nSee AKIA0123456789ABCDEF")}`;
    await writeFile(path.join(vaultRoot, rel), withSecretBody, "utf8");

    await expect(
      vaultUpdateFrontmatter(vaultRoot, rel, { status: "draft" }),
    ).rejects.toMatchObject({ code: "SECRET_PATTERN" });
  });

  it("fails SCHEMA_INVALID when merged frontmatter breaks PAKE", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-ufm-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    const rel = "03-Resources/note.md";
    await writeFile(path.join(vaultRoot, rel), validBaseFm, "utf8");

    await expect(
      vaultUpdateFrontmatter(vaultRoot, rel, { confidence_score: 2 }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("fails NOT_FOUND when the target file is missing", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-ufm-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });

    await expect(
      vaultUpdateFrontmatter(vaultRoot, "03-Resources/nope.md", { status: "reviewed" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("skips PAKE under 00-Inbox and still writes", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-ufm-"));
    await mkdir(path.join(vaultRoot, "00-Inbox"), { recursive: true });
    const rel = "00-Inbox/cap.md";
    await writeFile(
      path.join(vaultRoot, rel),
      "---\nkind: capture\n---\n\nRaw.\n",
      "utf8",
    );

    const out = await vaultUpdateFrontmatter(vaultRoot, rel, { kind: "triage" });
    expect(out.updated_fields).toEqual(["kind", "modified"]);
    const disk = await readFile(path.join(vaultRoot, rel), "utf8");
    expect(disk).toContain("kind: triage");
    expect(disk).toContain("Raw.");
  });

  it("rejects disallowed merge keys (prototype pollution guard)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-ufm-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    const rel = "03-Resources/note.md";
    await writeFile(path.join(vaultRoot, rel), validBaseFm, "utf8");

    await expect(
      vaultUpdateFrontmatter(vaultRoot, rel, { ["__proto__"]: true } as Record<string, unknown>),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("leaves the file unchanged when validation fails after read", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-ufm-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    const rel = "03-Resources/note.md";
    await writeFile(path.join(vaultRoot, rel), validBaseFm, "utf8");
    const before = await readFile(path.join(vaultRoot, rel), "utf8");

    await expect(
      vaultUpdateFrontmatter(vaultRoot, rel, { confidence_score: 99 }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });

    const after = await readFile(path.join(vaultRoot, rel), "utf8");
    expect(after).toBe(before);
  });
});
