import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/vault-lint");
const skillPath = join(skillDir, "SKILL.md");
const bulkScanPath = join(skillDir, "scripts/bulk_scan.py");
const patchMemoryPath = join(skillDir, "scripts/patch-memory-vault-line.mjs");

describe("Story 36-2 Hermes vault-lint skill mirror", () => {
  it("defines the skill package with Pitfalls, bulk_scan, patch-memory script, and install helper", () => {
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(bulkScanPath));
    assert.ok(existsSync(patchMemoryPath));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-vault-lint.sh")));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: vault-lint"));
    assert.ok(body.includes("/vault-lint"));
    assert.ok(body.includes("## Pitfalls"));
    assert.ok(body.includes("bulk_scan.py"));
    assert.ok(body.includes("patch-memory-vault-line.mjs"));
    assert.ok(body.includes("execute_code"));
  });

  it("bulk_scan.py is present and documents VAULT env", () => {
    const body = readFileSync(bulkScanPath, "utf8");
    assert.ok(body.includes("VAULT") || body.includes("vault"));
  });
});
