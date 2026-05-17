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
  it("defines the skill package at v1.3.0 with live trace, connect, today, ghost, drift, and verify", () => {
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(taskPromptPath));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-vault-think.sh")));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: vault-think"));
    assert.ok(body.includes("version: 1.3.0"));
    assert.ok(body.includes("/verify"));
    assert.ok(body.includes("mutator exception"));
    assert.ok(body.includes("## When to use"));
    assert.ok(body.includes("/challenge"));
    assert.ok(body.includes("/emerge"));
    assert.ok(body.includes("/ideas"));
    assert.ok(body.includes("/today"));
    assert.ok(body.includes("/today --brief"));
    assert.ok(body.includes("/trace "));
    assert.ok(body.includes("/connect "));
    assert.ok(body.includes("/ghost "));
    assert.ok(body.includes("/drift"));
    assert.ok(!body.includes("v1.1 stubs"));
    assert.ok(!body.includes("No (v1.1)"));
    assert.ok(body.includes("OBSIDIAN_API_KEY"));
    assert.ok(body.includes("https://127.0.0.1:27124"));
    assert.ok(body.includes("Obsidian Local REST API"));
    assert.ok(body.includes("vault_list"));
  });

  it("restricts v1.0 MCP reads to vault_search and vault_read only (vault_list forbidden)", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("vault_search"));
    assert.ok(body.includes("vault_read"));
    assert.ok(body.includes("## 4) Forbidden tools reminder"));
    assert.ok(body.includes("**All other commands:** do **not** call **`vault_list`**"));
    assert.ok(body.includes("**`/verify`:**"));
    assert.ok(body.includes("marking subcommands may call **`vault_update_frontmatter`**"));
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

  it("documents v1.0 output templates without ghost/drift stub refusal", () => {
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
    assert.ok(!body.includes("v1.1-not-active"));
    assert.ok(!body.includes("v1.1-not-active — /ghost and /drift"));
    assert.ok(body.includes("/ghost"));
    assert.ok(body.includes("/drift"));
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
  it("documents /today triggers, procedure, and vault_list carve-out", () => {
    const skill = readFileSync(skillPath, "utf8");
    const task = readFileSync(taskPromptPath, "utf8");

    assert.ok(skill.includes("version: 1.3.0"));
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
    assert.ok(
      task.includes("**`/today` and `/drift` paths:**") ||
        task.includes("**`/today`**, **`/drift`:**") ||
        task.includes("**`/today`:**"),
    );
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

describe("Story 32-3 Hermes vault-think /ghost and /drift", () => {
  it("activates v1.2.0 ghost and drift procedures with MCP caps and templates", () => {
    const skill = readFileSync(skillPath, "utf8");
    const task = readFileSync(taskPromptPath, "utf8");

    assert.ok(skill.includes("version: 1.3.0"));
    assert.ok(skill.includes("/ghost "));
    assert.ok(skill.includes("/drift"));

    assert.ok(task.includes("### 1c) `/ghost`"));
    assert.ok(task.includes("### 1d) `/drift`"));
    assert.ok(task.includes("vault-think: ghost requires question"));
    assert.ok(task.includes("### `/ghost`"));
    assert.ok(task.includes("### `/drift`"));
    assert.ok(task.includes("≤**6** search, ≤**8** read") || task.includes("caps ≤**6** search, ≤**8** read"));
    assert.ok(task.includes("ghost: no vault writing found on this topic."));
    assert.ok(task.includes("👻 Ghost —"));
    assert.ok(task.includes("Sources: <comma-separated note titles>"));

    const ghostSection = task.slice(task.indexOf("### `/ghost`"), task.indexOf("### `/drift`"));
    assert.ok(ghostSection.includes("vault_search"));
    assert.ok(ghostSection.includes("vault_read"));
    assert.ok(!ghostSection.includes("vault_list"));

    const driftSection = task.slice(task.indexOf("### `/drift`"), task.indexOf("### `/today`"));
    assert.ok(driftSection.includes("vault_list"));
    assert.ok(driftSection.includes("DailyNotes/"));
    assert.ok(driftSection.includes("14"));
    assert.ok(driftSection.includes("≥3"));
    assert.ok(driftSection.includes("03-Resources/"));
    assert.ok(driftSection.includes("SynthesisNote"));
    assert.ok(driftSection.includes("vault_read_frontmatter"));
    assert.ok(driftSection.includes("resolved only when a matching note has **`pake_type: SynthesisNote`**"));
    assert.ok(driftSection.includes("non-`SynthesisNote` do **not** count as resolved"));
    assert.ok(!driftSection.includes("unresolved if no `pake_type: SynthesisNote` hit and no title match"));
    assert.ok(driftSection.includes("🌀 Drift"));
    assert.ok(driftSection.includes("Circling without landing:"));
    assert.ok(driftSection.match(/\/graduate|run-chain/));
    assert.ok(task.includes("**`/ghost`:**") || task.includes("**`/ghost` path:**"));
    assert.ok(task.includes("v1.2.0"));
  });
});

describe("Story 33-1 Hermes vault-think /verify", () => {
  it("documents v1.3.0 verify queue, single-note, marking tokens, and narrow mutator contract", () => {
    const skill = readFileSync(skillPath, "utf8");
    const task = readFileSync(taskPromptPath, "utf8");

    assert.ok(skill.includes("version: 1.3.0"));
    assert.ok(skill.includes("/verify verified "));
    assert.ok(skill.includes("/verify disputed "));
    assert.ok(skill.includes("vault-relative path"));
    assert.ok(!skill.includes("/verify verified `** + path or title"));
    assert.ok(skill.includes("vault_update_frontmatter"));
    assert.ok(skill.includes("mutator exception"));

    assert.ok(task.includes("### 1g) `/verify`"));
    assert.ok(task.includes("v1.3.0"));
    assert.ok(task.includes("### `/verify`"));
    assert.ok(task.includes("verification_status: pending"));
    assert.ok(task.includes("pake_type: SynthesisNote"));
    assert.ok(task.includes("03-Resources/"));
    assert.ok(task.includes("Queue mode"));
    assert.ok(task.includes("Single-note review"));
    assert.ok(task.includes("Marking mode"));
    assert.ok(task.includes("/verify verified|disputed"));
    assert.ok(task.includes("vault-think: verify ambiguous"));
    assert.ok(task.includes("vault-think: verify not-found"));
    assert.ok(task.includes("vault-think: verify not-synthesis"));
    assert.ok(task.includes("vault-think: verify already verified"));
    assert.ok(task.includes("vault-think: verify already disputed"));
    assert.ok(task.includes("✅ Verify queue"));
    assert.ok(task.includes("Mark: /verify verified"));
    assert.ok(task.includes("Mark: /verify disputed"));

    const verifySection = task.slice(task.indexOf("### `/verify`"), task.indexOf("### `/today`"));
    assert.ok(verifySection.includes("vault_search"));
    assert.ok(verifySection.includes("vault_read_frontmatter"));
    assert.ok(verifySection.includes("vault_update_frontmatter"));
    assert.ok(verifySection.includes('"verification_status"'));
    assert.ok(verifySection.includes("≤ **1** `vault_update_frontmatter`"));
    assert.ok(!verifySection.includes("vault_move"));
    assert.ok(!verifySection.includes("vault_create_note"));
    assert.ok(task.includes("**Marking target resolution**"));
    assert.ok(task.includes("do **not** filter from the pending set"));
    const markingBlock = task.slice(
      task.indexOf("**Marking target resolution**"),
      task.indexOf("#### Queue mode"),
    );
    assert.ok(markingBlock.includes("vault_read_frontmatter"));
    assert.ok(!markingBlock.includes("pending set from step"));
  });

  it("carves verify out of the global vault_update_frontmatter ban", () => {
    const task = readFileSync(taskPromptPath, "utf8");
    assert.ok(task.includes("**`/verify`:**"));
    assert.match(
      task,
      /\/verify.*vault_update_frontmatter[\s\S]*All other commands:[\s\S]*do \*\*not\*\* call[\s\S]*vault_update_frontmatter/,
    );
  });

  it("marking mode resolves by direct path lookup, not the pending queue", () => {
    const task = readFileSync(taskPromptPath, "utf8");
    const markingSection = task.slice(
      task.indexOf("#### Marking mode"),
      task.indexOf("**Caps (this command):**"),
    );
    assert.ok(markingSection.includes("Marking target resolution"));
    assert.ok(markingSection.includes("Guards **3–6** there must run before any mutator"));
    assert.ok(!markingSection.includes("pending set from step"));
  });
});
