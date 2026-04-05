import { describe, expect, it } from "vitest";
import { CnsError } from "../../src/errors.js";
import { parseNoteFrontmatter } from "../../src/pake/parse-frontmatter.js";
import { isContractManifestReadmePath, isInboxVaultPath, normalizeVaultRelativePosix } from "../../src/pake/path-rules.js";
import { validatePakeForVaultPath } from "../../src/pake/validate.js";

type PakeType = "SourceNote" | "InsightNote" | "SynthesisNote" | "WorkflowNote" | "ValidationNote";

const base = {
  pake_id: "550e8400-e29b-41d4-a716-446655440000",
  title: "Example",
  created: "2026-04-02",
  modified: "2026-04-02",
  status: "draft" as const,
  confidence_score: 0.8,
  verification_status: "pending" as const,
  creation_method: "human" as const,
  tags: ["a"],
};

function minimalForType(pake_type: PakeType) {
  return { ...base, pake_type };
}

describe("path rules", () => {
  it("normalizes backslashes and leading ./", () => {
    expect(normalizeVaultRelativePosix(".\\03-Resources\\n.md")).toBe("03-Resources/n.md");
  });

  it("detects inbox only by path prefix", () => {
    expect(isInboxVaultPath("00-Inbox/cap.md")).toBe(true);
    expect(isInboxVaultPath("00-Inbox/nested/cap.md")).toBe(true);
    expect(isInboxVaultPath("03-Resources/note.md")).toBe(false);
  });

  it("detects contract manifest readme paths", () => {
    expect(isContractManifestReadmePath("01-Projects/_README.md")).toBe(true);
    expect(isContractManifestReadmePath("_README.md")).toBe(true);
    expect(isContractManifestReadmePath("03-Resources/note.md")).toBe(false);
  });
});

describe("validatePakeForVaultPath", () => {
  for (const pake_type of [
    "SourceNote",
    "InsightNote",
    "SynthesisNote",
    "WorkflowNote",
    "ValidationNote",
  ] as const) {
    it(`accepts minimal valid frontmatter for ${pake_type}`, () => {
      expect(() =>
        validatePakeForVaultPath(`03-Resources/${pake_type}.md`, minimalForType(pake_type)),
      ).not.toThrow();
    });
  }

  it("skips validation for inbox paths regardless of frontmatter shape", () => {
    expect(() =>
      validatePakeForVaultPath("00-Inbox/raw.md", { not: "pake", garbage: true }),
    ).not.toThrow();
  });

  it("skips validation for _README.md manifest paths", () => {
    expect(() =>
      validatePakeForVaultPath("02-Areas/_README.md", {
        purpose: "areas",
        schema_required: false,
      }),
    ).not.toThrow();
  });

  it("throws SCHEMA_INVALID for invalid pake_type enum", () => {
    try {
      validatePakeForVaultPath("03-Resources/bad.md", { ...base, pake_type: "NotAType" });
      expect.fail("expected throw");
    } catch (e: unknown) {
      expect(e).toMatchObject({ code: "SCHEMA_INVALID" });
    }
  });

  it("throws SCHEMA_INVALID for non-v4 UUID", () => {
    try {
      validatePakeForVaultPath("03-Resources/bad.md", {
        ...base,
        pake_id: "550e8400-e29b-31d4-a716-446655440000",
      });
      expect.fail("expected throw");
    } catch (e: unknown) {
      expect(e).toMatchObject({ code: "SCHEMA_INVALID" });
      const err = e as CnsError;
      expect(err.details?.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: "pake_id" })]),
      );
    }
  });

  it("allows optional source_uri for InsightNote (per-type optional field)", () => {
    expect(() =>
      validatePakeForVaultPath("03-Resources/i.md", {
        ...minimalForType("InsightNote"),
      }),
    ).not.toThrow();
    expect(() =>
      validatePakeForVaultPath("03-Resources/i2.md", {
        ...minimalForType("InsightNote"),
        source_uri: "https://example.com",
      }),
    ).not.toThrow();
  });

  it("rejects wrong type for optional source_uri", () => {
    expect(() =>
      validatePakeForVaultPath("03-Resources/i3.md", {
        ...minimalForType("InsightNote"),
        source_uri: 123,
      }),
    ).toThrowError(expect.objectContaining({ code: "SCHEMA_INVALID" }));
  });

  it("does not treat non-inbox paths as inbox when frontmatter is empty", () => {
    expect(() => validatePakeForVaultPath("03-Resources/empty-fm.md", {})).toThrowError(
      expect.objectContaining({ code: "SCHEMA_INVALID" }),
    );
  });
});

describe("parseNoteFrontmatter", () => {
  it("parses YAML frontmatter and body", () => {
    const raw = `---
title: "Hi"
pake_id: "550e8400-e29b-41d4-a716-446655440000"
---
Body here`;
    const { frontmatter, body } = parseNoteFrontmatter(raw);
    expect(body.trim()).toBe("Body here");
    expect(frontmatter.title).toBe("Hi");
  });

  it("throws IO_ERROR on invalid YAML", () => {
    expect(() =>
      parseNoteFrontmatter(`---\n title: [broken\n---\n`),
    ).toThrowError(expect.objectContaining({ code: "IO_ERROR" }));
  });
});

describe("parse + validate integration", () => {
  it("validates parsed frontmatter for a non-inbox note path", () => {
    const raw = `---
pake_id: "550e8400-e29b-41d4-a716-446655440000"
pake_type: WorkflowNote
title: "Spec"
created: "2026-04-02"
modified: "2026-04-02"
status: in-progress
confidence_score: 0.5
verification_status: verified
creation_method: ai
tags: [cns]
---
`;
    const { frontmatter } = parseNoteFrontmatter(raw);
    expect(() => validatePakeForVaultPath("01-Projects/p/spec.md", frontmatter)).not.toThrow();
  });
});
