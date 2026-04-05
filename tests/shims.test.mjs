import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Story 1.2 IDE shims", () => {
  it("vault Claude shim template references AI-Context/AGENTS.md", () => {
    const p = join(root, "specs/cns-vault-contract/shims/CLAUDE.md");
    assert.ok(existsSync(p));
    const body = readFileSync(p, "utf8");
    assert.ok(
      body.includes("AI-Context/AGENTS.md"),
      "vault CLAUDE shim must reference AI-Context/AGENTS.md",
    );
    assert.ok(body.includes("@AI-Context/AGENTS.md"), "spec table mechanism");
  });

  it("vault Cursor template references AI-Context/AGENTS.md", () => {
    const p = join(
      root,
      "specs/cns-vault-contract/shims/cursor-rules/agents.mdc",
    );
    assert.ok(existsSync(p));
    const body = readFileSync(p, "utf8");
    assert.ok(body.includes("AI-Context/AGENTS.md"));
    assert.ok(body.includes("alwaysApply:"));
  });

  it("repo Cursor rule references specs constitution mirror", () => {
    const p = join(root, ".cursor/rules/cns-specs-constitution.mdc");
    assert.ok(existsSync(p));
    const body = readFileSync(p, "utf8");
    assert.ok(
      body.includes("specs/cns-vault-contract/AGENTS.md"),
      "repo rule must point at specs mirror",
    );
    assert.ok(body.includes("alwaysApply:"));
  });
});
