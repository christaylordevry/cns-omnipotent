import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CnsError } from "../../src/errors.js";
import { loadMergedSecretPatterns } from "../../src/secrets/load-patterns.js";
import {
  assertContentMatchesNoSecretPatterns,
  assertVaultWriteContentNoSecretPatterns,
} from "../../src/secrets/scan.js";
import type { CompiledSecretPattern } from "../../src/secrets/pattern-config.js";

describe("assertContentMatchesNoSecretPatterns", () => {
  const trivial: CompiledSecretPattern[] = [{ id: "test_token", regex: /SECRET_TEST_TOKEN_[A-Z0-9]{8}/ }];

  it("allows content with no hits", () => {
    expect(() => assertContentMatchesNoSecretPatterns("hello world", trivial)).not.toThrow();
  });

  it("throws SECRET_PATTERN without echoing the matched substring", () => {
    const secret = "SECRET_TEST_TOKEN_ABCD1234";
    const body = `prefix ${secret} suffix`;
    try {
      assertContentMatchesNoSecretPatterns(body, trivial);
      expect.fail("expected throw");
    } catch (e: unknown) {
      expect(e).toMatchObject({ code: "SECRET_PATTERN" });
      const msg = String((e as Error).message);
      expect(msg).not.toContain(secret);
      expect((e as CnsError).details).toEqual({ patternId: "test_token" });
    }
  });
});

describe("loadMergedSecretPatterns + assertVaultWriteContentNoSecretPatterns", () => {
  it("loads baseline repo config when vault has no override", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-sec-"));
    const patterns = await loadMergedSecretPatterns(vaultRoot);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some((p) => p.id === "aws_access_key_id")).toBe(true);
  });

  it("merges vault override patterns after baseline", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-sec-"));
    const overrideDir = path.join(vaultRoot, "_meta", "schemas");
    await mkdir(overrideDir, { recursive: true });
    await writeFile(
      path.join(overrideDir, "secret-patterns.json"),
      JSON.stringify({
        patterns: [{ id: "vault_only_acme", regex: "ACME_VAULT_ONLY_[0-9]{4}" }],
      }),
      "utf8",
    );
    const patterns = await loadMergedSecretPatterns(vaultRoot);
    const ids = patterns.map((p) => p.id);
    expect(ids).toContain("aws_access_key_id");
    expect(ids).toContain("vault_only_acme");

    await expect(
      assertVaultWriteContentNoSecretPatterns(vaultRoot, "token ACME_VAULT_ONLY_4242 here"),
    ).rejects.toSatisfy((e: unknown) => {
      expect(e).toMatchObject({
        code: "SECRET_PATTERN",
        details: { patternId: "vault_only_acme" },
      });
      const err = e as CnsError;
      expect(String(err.message)).not.toContain("ACME_VAULT_ONLY_4242");
      expect(JSON.stringify(err.details)).toBe(JSON.stringify({ patternId: "vault_only_acme" }));
      return true;
    });
  });

  it("rejects AWS-like access key id in full note text", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-sec-"));
    const bad = "key = AKIA0123456789ABCDEF";
    await expect(assertVaultWriteContentNoSecretPatterns(vaultRoot, bad)).rejects.toMatchObject({
      code: "SECRET_PATTERN",
      details: { patternId: "aws_access_key_id" },
    });
  });

  it("rejects secrets in YAML frontmatter values (no-secret-in-message)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-sec-"));
    const fakePat = `ghp_${"a".repeat(36)}`;
    const note = `---
title: "x"
api_key: "${fakePat}"
---
body
`;
    await expect(assertVaultWriteContentNoSecretPatterns(vaultRoot, note)).rejects.toSatisfy(
      (e: unknown) => {
        expect(e).toMatchObject({
          code: "SECRET_PATTERN",
          details: { patternId: "github_pat_classic" },
        });
        const msg = String((e as Error).message);
        expect(msg).not.toContain(fakePat);
        expect(JSON.stringify((e as CnsError).details)).not.toContain(fakePat);
        return true;
      },
    );
  });

  it("fails loudly when vault override JSON is invalid (no silent baseline-only fallback)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-sec-"));
    const overrideDir = path.join(vaultRoot, "_meta", "schemas");
    await mkdir(overrideDir, { recursive: true });
    await writeFile(path.join(overrideDir, "secret-patterns.json"), "{ not json", "utf8");
    await expect(loadMergedSecretPatterns(vaultRoot)).rejects.toMatchObject({ code: "IO_ERROR" });
  });

  it("fails loudly when vault override fails Zod schema", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-sec-"));
    const overrideDir = path.join(vaultRoot, "_meta", "schemas");
    await mkdir(overrideDir, { recursive: true });
    await writeFile(
      path.join(overrideDir, "secret-patterns.json"),
      JSON.stringify({ patterns: "must-be-array" }),
      "utf8",
    );
    await expect(loadMergedSecretPatterns(vaultRoot)).rejects.toMatchObject({ code: "IO_ERROR" });
  });
});
