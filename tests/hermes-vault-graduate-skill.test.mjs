import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/vault-graduate");
const skillPath = join(skillDir, "SKILL.md");
const taskPromptPath = join(skillDir, "references/task-prompt.md");
const installScript = join(root, "scripts/install-hermes-skill-vault-graduate.sh");

describe("Story 32-1 Hermes vault-graduate skill mirror", () => {
  it("defines the skill package at v1.0.0 with /vault-graduate triggers", () => {
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(taskPromptPath));
    assert.ok(existsSync(installScript));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: vault-graduate"));
    assert.ok(body.includes("version: 1.0.1"));
    assert.ok(body.includes("/vault-graduate"));
    assert.ok(body.includes("/vault-graduate --days"));
    assert.ok(body.includes("## When to use"));
    assert.ok(body.includes("vault_create_note"));
    assert.ok(body.includes("vault_append_daily"));
    assert.ok(body.includes("vault-think"));
  });

  it("documents #graduate extraction and case-insensitive tag match", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("#graduate"));
    assert.ok(/case-insensitive/i.test(body));
    assert.ok(body.includes("DailyNotes/"));
  });

  it("documents vault_create_note InsightNote field contract", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("vault_create_note"));
    assert.ok(body.includes("InsightNote"));
    assert.ok(body.includes("source_uri"));
    assert.ok(body.includes("vault://DailyNotes/"));
    assert.ok(body.includes("#<url-encoded-title-slug>"));
    assert.ok(body.includes("title_slug"));
    assert.ok(body.includes("graduate"));
    assert.ok(body.includes("daily-note"));
    assert.ok(body.includes("confidence_score"));
  });

  it("uses per-idea source_uri fragments so multiple lines from one daily do not collide", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("Per-idea URI"));
    assert.ok(body.includes("distinct `source_uri`"));
    assert.ok(body.includes("my-great-idea") || body.includes("My great idea"));
    assert.match(body, /vault:\/\/DailyNotes\/[^`\s]+#/);
  });

  it("documents graduation receipt on today's daily via vault_append_daily", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("## Graduated"));
    assert.ok(body.includes("vault_append_daily"));
    assert.ok(body.includes("(from DailyNotes/"));
    assert.ok(body.includes("Option B"));
    assert.ok(body.includes("today_utc"));
  });

  it("documents dedup skip and Discord report templates", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("already graduated"));
    assert.ok(body.includes("vault_search"));
    assert.ok(body.includes("03-Resources/"));
    assert.ok(body.includes("vault_read_frontmatter"));
    assert.ok(body.includes("🎓 Graduate report"));
    assert.ok(body.includes("No #graduate tags found in the last"));
    assert.ok(body.includes("vault-graduate: bad-trigger"));
    assert.ok(body.includes("/vault-graduate --days"));
  });

  it("allows create/append mutators and forbids update/move/log", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("Allowed mutators"));
    assert.ok(body.includes("vault_create_note"));
    assert.ok(body.includes("vault_append_daily"));
    const forbiddenSection = body.slice(
      body.indexOf("## 8) Forbidden tools"),
      body.indexOf("## 9)"),
    );
    for (const forbidden of [
      "vault_update_frontmatter",
      "vault_move",
      "vault_log_action",
    ]) {
      assert.ok(forbiddenSection.includes(forbidden), `must forbid ${forbidden}`);
    }
    assert.ok(forbiddenSection.includes("Do **not** call"));
  });
});
