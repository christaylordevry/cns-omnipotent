import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Story 1.1 constitution mirror", () => {
  it("AGENTS.md is within 500-line budget", () => {
    const p = join(root, "specs/cns-vault-contract/AGENTS.md");
    assert.ok(existsSync(p));
    const lines = readFileSync(p, "utf8").split("\n").length;
    assert.ok(lines <= 500, `AGENTS.md has ${lines} lines, max 500`);
  });

  it("module files exist with substantive content", () => {
    for (const f of ["vault-io.md", "security.md"]) {
      const p = join(root, "specs/cns-vault-contract/modules", f);
      assert.ok(existsSync(p), `missing ${p}`);
      const body = readFileSync(p, "utf8");
      assert.ok(body.length > 200, `${f} should be non-placeholder`);
    }
  });

  it("vault-io module retains full protocol headings", () => {
    const body = readFileSync(
      join(root, "specs/cns-vault-contract/modules/vault-io.md"),
      "utf8",
    );
    assert.ok(body.includes("Reading Notes"));
    assert.ok(body.includes("Writing Notes"));
  });

  it("planning-artifacts AGENTS matches specs mirror", () => {
    const specPath = join(root, "specs/cns-vault-contract/AGENTS.md");
    const planPath = join(
      root,
      "_bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md",
    );
    assert.strictEqual(readFileSync(specPath, "utf8"), readFileSync(planPath, "utf8"));
  });

  it("Phase 1 spec exists at repo path referenced by CLAUDE.md", () => {
    assert.ok(
      existsSync(join(root, "specs/cns-vault-contract/CNS-Phase-1-Spec.md")),
    );
  });
});
