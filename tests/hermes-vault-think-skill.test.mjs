import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/vault-think");
const skillPath = join(skillDir, "SKILL.md");
const taskPromptPath = join(skillDir, "references/task-prompt.md");

describe("Story 31-3 Hermes vault-think skill mirror", () => {
  it("defines the skill package at v1.1.1 with live trace, connect, and today", () => {
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(taskPromptPath));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-vault-think.sh")));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: vault-think"));
    assert.ok(body.includes("version: 1.1.1"));
    assert.ok(body.includes("## When to use"));
    assert.ok(body.includes("/challenge"));
    assert.ok(body.includes("/emerge"));
    assert.ok(body.includes("/ideas"));
    assert.ok(body.includes("/today"));
    assert.ok(body.includes("/today --brief"));
    assert.ok(body.includes("/trace "));
    assert.ok(body.includes("/connect "));
    assert.ok(body.includes("OBSIDIAN_API_KEY"));
    assert.ok(body.includes("https://127.0.0.1:27124"));
    assert.ok(!body.includes("No (v1.1)") || body.includes("ghost") && body.includes("drift"));
    assert.ok(body.includes("/ghost"));
    assert.ok(body.includes("/drift"));
    assert.ok(body.includes("Obsidian Local REST API"));
    assert.ok(body.includes("vault_list"));
  });

  it("restricts v1.0 MCP reads to vault_search and vault_read only (vault_list forbidden)", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("vault_search"));
    assert.ok(body.includes("vault_read"));
    assert.ok(body.includes("## 4) Forbidden tools reminder"));
    assert.ok(body.includes("**All other commands:** do **not** call **`vault_list`**"));
    for (const forbidden of [
      "vault_create_note",
      "vault_update_frontmatter",
      "vault_append_daily",
      "vault_move",
      "vault_log_action",
      "vault_read_frontmatter",
    ]) {
      assert.ok(body.includes(forbidden), `task-prompt must forbid ${forbidden}`);
    }
  });

  it("documents v1.0 output templates and ghost/drift stub refusal only", () => {
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
    assert.ok(body.includes("/ghost"));
    assert.ok(body.includes("/drift"));
    assert.ok(body.includes("/trace, /connect, or /today"));
    assert.ok(!body.includes("/trace, /connect, /ghost"));
    assert.ok(!body.includes("/trace, /connect, /ghost, and /drift"));
  });

  it("documents trace and connect REST procedures with curl and Discord templates", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("## 3) v1.1 live triggers"));
    assert.ok(body.includes("curl -sk"));
    assert.ok(body.includes("GET /vault/"));
    assert.ok(body.includes("/search/simple/"));
    assert.ok(body.includes("POST /search/"));
    assert.ok(body.includes("Search for notes that link to the **resolved note**"));
    assert.ok(body.includes("frontmatter title, basename without `.md`, full vault-relative path, and path without `.md`"));
    assert.ok(!body.includes("For each forward target"));
    assert.ok(body.includes("🔗 Trace:"));
    assert.ok(body.includes("← Backlinks"));
    assert.ok(body.includes("→ Forward links"));
    assert.ok(body.includes("🌉 Connect:"));
    assert.ok(body.includes("vault-think: obsidian-rest-unavailable"));
    assert.ok(body.includes("vault-think: obsidian-rest-no-api-key"));
    assert.ok(body.includes("vault-think: trace not-found"));
    assert.ok(body.includes("vault-think: trace ambiguous"));
    assert.ok(body.includes("vault-think: connect requires two concepts"));
    assert.ok(body.includes("vault-think: connect no direct connection found"));
  });
});

describe("Story 32-2 Hermes vault-think /today", () => {
  it("documents /today triggers, procedure, and v1.1.1 carve-out for vault_list", () => {
    const skill = readFileSync(skillPath, "utf8");
    const task = readFileSync(taskPromptPath, "utf8");

    assert.ok(skill.includes("version: 1.1.1"));
    assert.ok(skill.includes("/today"));
    assert.ok(skill.includes("/today --brief"));

    assert.ok(task.includes("### 1b) `/today`"));
    assert.ok(task.includes("/today` or `/today` + trailing spaces only"));
    assert.ok(task.includes("/today --brief` (+ trailing spaces only)"));
    assert.ok(task.includes("### `/today`"));
    assert.ok(task.includes("DailyNotes/"));
    assert.ok(task.includes("{today_utc}.md"));
    assert.ok(task.includes("01-Projects/"));
    assert.ok(task.includes("top **5**"));
    assert.ok(task.includes("00-Inbox/"));
    assert.ok(task.includes("**No** `vault_read` on inbox"));
    assert.ok(task.includes("📅 Today —"));
    assert.ok(task.includes("**Active projects"));
    assert.ok(task.includes("**Inbox:**"));
    assert.ok(task.includes("Brief (`--brief`) — exactly 3 lines"));
    assert.ok(task.includes("no project section"));
    assert.ok(task.match(/vault_list.*DailyNotes/s) || task.includes("`vault_list`** `DailyNotes/`"));
    assert.ok(task.includes("**`/today` path only:** may call **`vault_list`**"));
  });

  it("keeps v1.0 challenge/emerge/ideas on vault_search without vault_list", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    const challenge = body.slice(body.indexOf("### `/challenge`"), body.indexOf("### `/emerge`"));
    const emerge = body.slice(body.indexOf("### `/emerge`"), body.indexOf("### `/ideas`"));
    const ideas = body.slice(body.indexOf("### `/ideas`"), body.indexOf("## 3) v1.1 live triggers"));

    for (const section of [challenge, emerge, ideas]) {
      assert.ok(section.includes("vault_search"), "v1.0 section must use vault_search");
      assert.ok(!section.includes("vault_list"), "v1.0 section must not use vault_list");
    }
  });
});
