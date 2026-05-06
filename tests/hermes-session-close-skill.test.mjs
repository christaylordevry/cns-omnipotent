import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/session-close");
const skillPath = join(skillDir, "SKILL.md");
const taskPromptPath = join(skillDir, "references/task-prompt.md");
const triggerPatternPath = join(skillDir, "references/trigger-pattern.md");
const operatorGuidePath = join(root, "Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md");

describe("Story 28.1 Hermes session-close skill mirror", () => {
  it("defines the HI-8 skill package and install helper", () => {
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(taskPromptPath));
    assert.ok(existsSync(triggerPatternPath));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-session-close.sh")));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: session-close"));
    assert.ok(body.includes("/session-close"));
    assert.ok(body.includes("## When to use"));
    assert.ok(body.includes("## Tools"));
    assert.ok(body.includes("## Non-goals"));
    assert.ok(body.includes("OMNIPOTENT_REPO"));
    assert.ok(body.includes("source_add"));
    assert.ok(body.includes("vault_update_frontmatter"));
  });

  it("documents deterministic sprint, artifact, Section 8, and sync rules", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("OMNIPOTENT_REPO"));
    assert.ok(body.includes("/home/christ/ai-factory/projects/Omnipotent.md"));
    assert.ok(body.includes("resolved_repo_root"));
    assert.ok(body.includes("_bmad-output/implementation-artifacts/sprint-status.yaml"));
    assert.ok(body.includes("development_status"));
    assert.ok(body.includes("three most recently modified"));
    assert.ok(body.includes("cns-session-handoff-"));
    assert.ok(body.includes("## 8. Current Focus"));
    assert.ok(body.includes("## 9. Agent Behavior Guidelines"));
    assert.ok(body.includes("Version:"));
    assert.ok(body.includes("Last updated:"));
    assert.ok(body.includes("specs/cns-vault-contract/AGENTS.md"));
    assert.ok(body.includes("/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md"));
    assert.ok(body.includes("byte-for-byte"));
    assert.ok(body.includes("Story 28.1"));
  });

  it("keeps protected AGENTS updates out of Vault IO mutators", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("Do not call Vault IO mutators for AGENTS.md"));
    assert.ok(body.includes("PROTECTED_PATH"));
    assert.ok(body.includes("filesystem edits"));
    assert.ok(body.includes("vault_read"));
    assert.ok(body.includes("vault_search"));
    for (const forbidden of ["vault_create_note", "vault_update_frontmatter", "vault_append_daily", "vault_log_action"]) {
      assert.ok(body.includes(forbidden), `missing forbidden mutator ${forbidden}`);
    }
  });

  it("defines export and NotebookLM fan-out semantics", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("bash scripts/export-vault-for-notebooklm.sh"));
    assert.ok(body.includes("CNS_VAULT_ROOT"));
    assert.ok(body.includes("scripts/output/vault-export-for-notebooklm.md"));
    assert.ok(body.includes("03-Resources/notebooklm-project-map.md"));
    assert.ok(body.includes("Status"));
    assert.ok(body.includes("Include"));
    assert.ok(body.includes("Skip this entire step in dry-run mode"));
    assert.ok(body.includes("notebook_id"));
    assert.ok(body.includes("source_name"));
    assert.ok(body.includes("My Knowledge Base"));
    assert.ok(body.includes("source_type"));
    assert.ok(body.includes("file"));
    assert.ok(body.includes("file_path"));
    assert.ok(body.includes("per-notebook"));
  });

  it("documents /session-close trigger exclusivity and config binding", () => {
    const body = readFileSync(triggerPatternPath, "utf8");
    assert.ok(body.includes("/session-close"));
    assert.ok(body.includes("--dry-run"));
    assert.ok(body.includes("#hermes"));
    assert.ok(body.includes("channel_skill_bindings"));
    assert.ok(body.includes("triage"));
    assert.ok(body.includes("hermes-url-ingest-vault"));
  });

  it("operator guide documents session-close and version history", () => {
    const body = readFileSync(operatorGuidePath, "utf8");
    assert.ok(body.includes("28-1-automate-agents-md-section-8-via-hermes-session-close"));
    assert.ok(body.includes("### 15.4 Session close (`/session-close`, Epic 28)"));
    assert.ok(body.includes("Section 8"));
    assert.ok(body.includes("NotebookLM"));
    assert.ok(body.includes("session-close"));
    assert.ok(body.includes("Do not use Vault IO mutators for `AI-Context/AGENTS.md`"));
  });
});
