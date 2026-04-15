import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateNoteForEmbeddingSecretGate,
  INDEXING_SECRET_EXCLUSION_REASON,
} from "../../src/brain/indexing-secret-gate.js";

describe("evaluateNoteForEmbeddingSecretGate", () => {
  it("allows content with no pattern hits", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-sec-"));
    const r = await evaluateNoteForEmbeddingSecretGate(vaultRoot, "plain note body");
    expect(r).toEqual({ eligible: true });
  });

  it("returns the first matching pattern id when multiple merged patterns match", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-sec-"));
    const overrideDir = path.join(vaultRoot, "_meta", "schemas");
    await mkdir(overrideDir, { recursive: true });
    await writeFile(
      path.join(overrideDir, "secret-patterns.json"),
      JSON.stringify({
        patterns: [
          { id: "first", regex: "foo" },
          { id: "second", regex: "foo" },
        ],
      }),
      "utf8",
    );
    const r = await evaluateNoteForEmbeddingSecretGate(vaultRoot, "prefix foo suffix");
    expect(r.eligible).toBe(false);
    if (r.eligible) {
      throw new Error("expected exclusion");
    }
    expect(r.reasonCode).toBe(INDEXING_SECRET_EXCLUSION_REASON);
    expect(r.patternId).toBe("first");
  });

  it("excludes on match with stable reason and patternId (no secret echo)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-sec-"));
    const secret = "AKIA0123456789ABCDEF";
    const body = `prefix ${secret} suffix`;
    const r = await evaluateNoteForEmbeddingSecretGate(vaultRoot, body);
    expect(r.eligible).toBe(false);
    if (r.eligible) {
      throw new Error("expected exclusion");
    }
    expect(r.reasonCode).toBe(INDEXING_SECRET_EXCLUSION_REASON);
    expect(r.patternId).toBe("aws_access_key_id");
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("AKIA");
  });

  it("matches secrets in YAML frontmatter values without echoing", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-sec-"));
    const fakePat = `ghp_${"a".repeat(36)}`;
    const note = `---
title: "x"
api_key: "${fakePat}"
---
body
`;
    const r = await evaluateNoteForEmbeddingSecretGate(vaultRoot, note);
    expect(r.eligible).toBe(false);
    if (r.eligible) {
      throw new Error("expected exclusion");
    }
    expect(r.patternId).toBe("github_pat_classic");
    expect(JSON.stringify(r)).not.toContain(fakePat);
  });

  it("body-only hit excludes with patternId", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-sec-"));
    const bad = "key = AKIA0123456789ABCDEF";
    const r = await evaluateNoteForEmbeddingSecretGate(vaultRoot, bad);
    expect(r).toMatchObject({
      eligible: false,
      reasonCode: INDEXING_SECRET_EXCLUSION_REASON,
      patternId: "aws_access_key_id",
    });
  });

  it("uses vault override merge same as WriteGate (vault pattern wins ordering after baseline)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-sec-"));
    const overrideDir = path.join(vaultRoot, "_meta", "schemas");
    await mkdir(overrideDir, { recursive: true });
    await writeFile(
      path.join(overrideDir, "secret-patterns.json"),
      JSON.stringify({
        patterns: [{ id: "vault_only_acme", regex: "ACME_VAULT_ONLY_[0-9]{4}" }],
      }),
      "utf8",
    );
    const content = "token ACME_VAULT_ONLY_4242 here";
    const r = await evaluateNoteForEmbeddingSecretGate(vaultRoot, content);
    expect(r.eligible).toBe(false);
    if (r.eligible) {
      throw new Error("expected exclusion");
    }
    expect(r.patternId).toBe("vault_only_acme");
    expect(JSON.stringify(r)).not.toContain("4242");
  });
});
