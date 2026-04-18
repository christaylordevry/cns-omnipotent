import { mkdir, mkdtemp, readFile, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseNoteFrontmatter } from "../../src/pake/parse-frontmatter.js";
import {
  buildVaultCreateNoteMarkdown,
  destinationDirectoryForCreate,
  slugFilenameFromTitle,
  vaultCreateNote,
  vaultCreateNoteFromMarkdown,
} from "../../src/tools/vault-create-note.js";

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
tags: []
---
`;

describe("vault create routing helpers", () => {
  it("routes resource types to 03-Resources", () => {
    for (const pake_type of ["SourceNote", "InsightNote", "SynthesisNote", "ValidationNote"] as const) {
      expect(destinationDirectoryForCreate({ title: "", content: "", pake_type, tags: [] })).toBe(
        "03-Resources",
      );
    }
  });

  it("routes WorkflowNote with project", () => {
    expect(
      destinationDirectoryForCreate({
        title: "",
        content: "",
        pake_type: "WorkflowNote",
        tags: [],
        project: "CNS",
      }),
    ).toBe("01-Projects/CNS");
  });

  it("routes WorkflowNote with area when no project", () => {
    expect(
      destinationDirectoryForCreate({
        title: "",
        content: "",
        pake_type: "WorkflowNote",
        tags: [],
        area: "Engineering",
      }),
    ).toBe("02-Areas/Engineering");
  });

  it("routes WorkflowNote to 02-Areas root when no project or area", () => {
    expect(
      destinationDirectoryForCreate({ title: "", content: "", pake_type: "WorkflowNote", tags: [] }),
    ).toBe("02-Areas");
  });

  it("slugFilenameFromTitle strips unsafe characters", () => {
    expect(slugFilenameFromTitle("Hello World!")).toBe("hello-world.md");
  });
});

describe("vaultCreateNote", () => {
  it("buildVaultCreateNoteMarkdown includes optional ai_summary", () => {
    const { markdown } = buildVaultCreateNoteMarkdown({
      title: "T",
      content: "c",
      pake_type: "SourceNote",
      tags: [],
      ai_summary: "Short summary.",
    });
    expect(markdown).toContain("ai_summary:");
    expect(markdown).toContain("Short summary.");
  });

  it("suppressAudit skips agent-log line for vault_create_note", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-create-sa-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });

    await vaultCreateNote(
      vaultRoot,
      {
        title: "No Audit Line",
        content: "# Body",
        pake_type: "SourceNote",
        tags: [],
      },
      { surface: "vitest", suppressAudit: true },
    );

    await expect(readFile(path.join(vaultRoot, "_meta", "logs", "agent-log.md"), "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("creates a SourceNote under 03-Resources with valid PAKE and readable body", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-create-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });

    const out = await vaultCreateNote(vaultRoot, {
      title: "Hello Note",
      content: "# Body\n\nText.",
      pake_type: "SourceNote",
      tags: ["t1"],
      confidence_score: 0.7,
    });

    expect(out.file_path).toBe("03-Resources/hello-note.md");
    const disk = await readFile(path.join(vaultRoot, out.file_path), "utf8");
    const { frontmatter, body } = parseNoteFrontmatter(disk);
    expect(frontmatter.pake_type).toBe("SourceNote");
    expect(frontmatter.title).toBe("Hello Note");
    expect(frontmatter.confidence_score).toBe(0.7);
    expect(body).toContain("# Body");
    expect(out.pake_id).toBe(frontmatter.pake_id);
    expect(out.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("routes WorkflowNote with project and area prefers project", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-create-"));
    await mkdir(path.join(vaultRoot, "01-Projects", "P1"), { recursive: true });

    const out = await vaultCreateNote(vaultRoot, {
      title: "Spec",
      content: "x",
      pake_type: "WorkflowNote",
      tags: ["w"],
      project: "P1",
      area: "Ignored",
    });
    expect(out.file_path).toBe("01-Projects/P1/spec.md");
  });

  it("fails with IO_ERROR when the target file already exists", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-create-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await vaultCreateNote(vaultRoot, {
      title: "Dup",
      content: "one",
      pake_type: "InsightNote",
      tags: [],
    });
    await expect(
      vaultCreateNote(vaultRoot, {
        title: "Dup",
        content: "two",
        pake_type: "InsightNote",
        tags: [],
      }),
    ).rejects.toMatchObject({ code: "IO_ERROR" });
  });

  it("rejects invalid project segment with SCHEMA_INVALID", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-create-"));
    await expect(
      vaultCreateNote(vaultRoot, {
        title: "x",
        content: "y",
        pake_type: "WorkflowNote",
        tags: [],
        project: "../escape",
      }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });
});

describe("vault_create_note gates", () => {
  it("fails PROTECTED_PATH on AI-Context before PAKE (WriteGate first)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-create-"));
    await mkdir(path.join(vaultRoot, "AI-Context"), { recursive: true });
    await expect(
      vaultCreateNoteFromMarkdown(vaultRoot, "AI-Context/bad.md", `${validBaseFm}\n`),
    ).rejects.toMatchObject({ code: "PROTECTED_PATH" });
  });

  it("runs PAKE validation before secret scan (SCHEMA_INVALID when both would fail)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-create-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    const badStatusAndSecret = `---
pake_id: "550e8400-e29b-41d4-a716-446655440000"
pake_type: SourceNote
title: "x"
created: "2026-04-02"
modified: "2026-04-02"
status: not-a-status
confidence_score: 0.5
verification_status: pending
creation_method: ai
tags: []
---
See AKIA0123456789ABCDEF
`;
    await expect(
      vaultCreateNoteFromMarkdown(vaultRoot, "03-Resources/bad.md", badStatusAndSecret),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("fails SECRET_PATTERN when PAKE is valid", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-create-"));
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    const okFm = `---
pake_id: "550e8400-e29b-41d4-a716-446655440000"
pake_type: SourceNote
title: "x"
created: "2026-04-02"
modified: "2026-04-02"
status: draft
confidence_score: 0.5
verification_status: pending
creation_method: ai
tags: []
---
token AKIA0123456789ABCDEF
`;
    await expect(
      vaultCreateNoteFromMarkdown(vaultRoot, "03-Resources/leak.md", okFm),
    ).rejects.toMatchObject({ code: "SECRET_PATTERN" });
  });

  it("throws VAULT_BOUNDARY when 03-Resources symlink escapes the vault (WriteGate)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-create-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "cns-out-"));
    await symlink(outside, path.join(vaultRoot, "03-Resources"));

    const { markdown } = buildVaultCreateNoteMarkdown({
      title: "Esc",
      content: "b",
      pake_type: "SourceNote",
      tags: ["x"],
    });
    await expect(
      vaultCreateNoteFromMarkdown(vaultRoot, "03-Resources/esc.md", markdown),
    ).rejects.toMatchObject({ code: "VAULT_BOUNDARY" });
  });
});

describe("buildVaultCreateNoteMarkdown", () => {
  it("produces parseable YAML that passes PAKE for 03-Resources path", () => {
    const { markdown, pake_id } = buildVaultCreateNoteMarkdown({
      title: 'Title "quoted"',
      content: "Hi",
      pake_type: "ValidationNote",
      tags: ["a", "b"],
      source_uri: "https://ex.com",
    });
    const { frontmatter } = parseNoteFrontmatter(markdown);
    expect(frontmatter.pake_id).toBe(pake_id);
    expect(frontmatter.source_uri).toBe("https://ex.com");
  });
});
