import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/vault-think");
const skillPath = join(skillDir, "SKILL.md");
const taskPromptPath = join(skillDir, "references/task-prompt.md");

describe("Story 29-10 Hermes vault-think skill mirror", () => {
  it("defines the skill package and install helper", () => {
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(taskPromptPath));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-vault-think.sh")));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: vault-think"));
    assert.ok(body.includes("## When to use"));
    assert.ok(body.includes("/challenge"));
    assert.ok(body.includes("/emerge"));
    assert.ok(body.includes("/ideas"));
    assert.ok(body.includes("## v1.1 stubs"));
    assert.ok(body.includes("/trace"));
    assert.ok(body.includes("/connect"));
    assert.ok(body.includes("/ghost"));
    assert.ok(body.includes("/drift"));
    assert.ok(body.includes("Obsidian Local REST API"));
    assert.ok(body.includes("not-yet-active") || body.includes("not yet active") || body.includes("No (v1.1)"));
  });

  it("restricts MCP reads to vault_search and vault_read only", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("vault_search"));
    assert.ok(body.includes("vault_read"));
    assert.ok(body.includes("## 3) Forbidden tools reminder"));
    for (const forbidden of [
      "vault_create_note",
      "vault_update_frontmatter",
      "vault_append_daily",
      "vault_move",
      "vault_log_action",
      "vault_list",
      "vault_read_frontmatter",
    ]) {
      assert.ok(body.includes(forbidden), `task-prompt must forbid ${forbidden}`);
    }
  });

  it("documents v1.0 output templates and stub refusal", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("⚡ Challenge:"));
    assert.ok(body.includes("Supporting evidence from your vault:"));
    assert.ok(body.includes("Contradicting evidence from your vault:"));
    assert.ok(body.includes("The tension:"));
    assert.ok(body.includes("💡 Emerging idea:"));
    assert.ok(body.includes("Draft thesis:"));
    assert.ok(body.includes("🧠 Vault Idea Report"));
    assert.ok(body.includes("🛠 Tools to build:"));
    assert.ok(body.includes("🤝 People to reach out to:"));
    assert.ok(body.includes("🔍 Topics to investigate:"));
    assert.ok(body.includes("✍️ Things to write:"));
    assert.ok(body.includes("v1.1-not-active"));
  });
});
