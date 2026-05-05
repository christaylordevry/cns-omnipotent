import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/triage");
const taskPromptPath = join(skillDir, "references/task-prompt.md");
const triggerPatternPath = join(skillDir, "references/trigger-pattern.md");
const operatorGuidePath = join(root, "Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md");

describe("Story 27.5–27.6 Hermes triage skill mirror", () => {
  it("SKILL.md declares scoped discovery, approvals, execution, and version bump", () => {
    const body = readFileSync(join(skillDir, "SKILL.md"), "utf8");
    assert.ok(body.includes("version: 1.5.0"));
    assert.ok(body.includes("recursive"));
    assert.ok(
      body.includes("vault_search") &&
        body.includes("00-Inbox/") &&
        body.includes("max_results"),
    );
    assert.ok(body.includes("vault_read_frontmatter"));
    assert.ok(body.includes("vault_search"));
    assert.ok(body.includes("routing suggestions"));
    assert.ok(body.includes("/approve"));
    assert.ok(body.includes("/execute-approved"));
    assert.ok(body.includes("vault_move"));
    assert.ok(body.includes("Stories 27.1 to 27.6"));
    assert.ok(body.includes("## Non-destructive guarantees (Story 27.6)"));
    assert.ok(body.includes("`vault_delete`"));
    assert.ok(body.includes("human-only"));
  });

  it("task-prompt mandates recursive vault_list and sort rules", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("recursive: true"));
    assert.ok(body.includes("`modified`"));
    assert.ok(body.includes("descending"));
    assert.ok(body.includes("`vaultPath`"));
    assert.ok(body.includes("ascending"));
    assert.ok(body.includes("**10** (same as Story 27.1"));
    assert.ok(body.includes("## Paging"));
    assert.ok(body.includes("matching_notes"));
  });

  it("task-prompt defines routing suggestion schema and deterministic heuristics", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("## Routing suggestions (Story 27.3)"));
    assert.ok(body.includes("routing_suggestion"));
    assert.ok(body.includes("pake_type"));
    assert.ok(body.includes("destination"));
    assert.ok(body.includes("confidence"));
    assert.ok(body.includes("reason"));
    assert.ok(body.includes("Age bucket rules"));
    assert.ok(body.includes("SourceNote"));
    assert.ok(body.includes("InsightNote"));
    assert.ok(body.includes("SynthesisNote"));
    assert.ok(body.includes("WorkflowNote"));
    assert.ok(body.includes("ValidationNote"));
    assert.ok(body.includes("03-Resources/"));
    assert.ok(body.includes("02-Areas/"));
    for (const pakeType of [
      "WorkflowNote",
      "SynthesisNote",
      "InsightNote",
      "ValidationNote",
      "SourceNote",
    ]) {
      assert.ok(
        body.includes(`filename/path matched ${pakeType} token \`<matched-token>\`; age=<bucket>`),
        `missing deterministic reason template for ${pakeType}`,
      );
    }
  });

  it("task-prompt forbids mutators and gates vault_search", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    for (const t of ["vault_create_note", "vault_update_frontmatter", "vault_append_daily", "vault_log_action"]) {
      assert.ok(body.includes(t), `missing forbidden tool ${t}`);
    }
    assert.ok(body.includes("The only allowed mutating tool in this skill is `vault_move`"));
    assert.ok(body.includes("vault_search` only if"));
    assert.ok(body.includes("max_results"));
    assert.ok(body.includes("50"));
  });

  it("trigger-pattern documents --offset and ambiguity refusal", () => {
    const body = readFileSync(triggerPatternPath, "utf8");
    assert.ok(body.includes("--offset"));
    assert.ok(body.includes("Ambiguous multi-query"));
    assert.ok(body.includes("/approve"));
    assert.ok(body.includes("/execute-approved"));
    assert.ok(body.includes("--to"));
  });

  it("task-prompt defines non-mutating approval parsing and validation", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("## Approval handling (Story 27.4, non-mutating)"));
    assert.ok(body.includes("## Approval recorded (no mutations)"));
    assert.ok(body.includes("## Approval input error"));
    assert.ok(body.includes("must start with `00-Inbox/`") || body.includes("must start with 00-Inbox/"));
    assert.ok(body.includes("protected prefixes"));
    assert.ok(body.includes("exactly four tokens: `/approve`, `source_path`, `--to`, `destination_dir`"));
  });

  it("task-prompt defines approved move execution via exactly one vault_move call", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("## Execute approved move handling (Story 27.5)"));
    assert.ok(body.includes("destination_path"));
    assert.ok(body.includes("basename(source_path)"));
    assert.ok(body.includes("Call **`vault_move`** exactly once"));
    assert.ok(body.includes("Do not call `vault_log_action`"));
    assert.ok(body.includes("## Approved move executed"));
    assert.ok(body.includes("vault_move emitted the audit line"));
    assert.ok(body.includes("exactly four tokens: `/execute-approved`, `source_path`, `--to`, `destination_dir`"));
  });

  it("task-prompt defines bounded execution failure posture", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("## Approved move failed"));
    assert.ok(body.includes("No fallback filesystem mutation was attempted."));
    assert.ok(body.includes("Do not retry with raw filesystem writes"));
  });

  it("trigger-pattern documents execute-approved grammar", () => {
    const body = readFileSync(triggerPatternPath, "utf8");
    assert.ok(body.includes("/execute-approved <source_path> --to <destination_dir>/"));
    assert.ok(body.includes("/execute-approved 00-Inbox/some-capture.md --to 03-Resources/"));
    assert.ok(body.includes("Derive `destination_path` as `<destination_dir>/<basename(source_path)>`"));
    assert.ok(body.includes("Reject any extra text before or after the grammar."));
  });

  it("task-prompt separates syntactic offset refusal from offset past end after discovery", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("### Early invalid input (no tools run)"));
    assert.ok(body.includes("No vault tools were run; no actions taken."));
    assert.ok(body.includes("For syntactically invalid offsets specifically"));
    assert.ok(body.includes("### D) Offset past end after discovery"));
    assert.ok(body.includes("Discovery ran under `00-Inbox/`; no note previews were read; no actions taken."));
    assert.ok(body.includes("Then stop. Do not call `vault_read` or `vault_read_frontmatter`."));
    assert.ok(
      !body.includes("total matching markdown count** after discovery filters"),
      "offset past end must not be described as a no-tools early parse failure",
    );
  });

  it("task-prompt enforces exact vault_search scope under 00-Inbox", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("set **`scope` exactly to `00-Inbox/`**"));
    assert.ok(body.includes('Call **`vault_search`** with `query`, **`scope: "00-Inbox/"`**, and `max_results` at most **50**.'));
  });

  it("task-prompt preserves listing-only discovery when no query is provided", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("If there is **no** query, use **listing-only** discovery (no `vault_search`)."));
    assert.ok(body.includes("If **`query`** is empty: set **`candidate_paths = inventory_paths`** (same order)."));
  });

  it("install script source dir exists", () => {
    assert.ok(existsSync(skillDir));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-triage.sh")));
  });

  it("Story 27.6 discard safety and guarantees appear in task-prompt", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    assert.ok(body.includes("## Discard / delete / archive safety (Story 27.6)"));
    assert.ok(body.includes("vault_trash"));
    assert.ok(body.includes("Human-only") || body.includes("human-only"));
    assert.ok(body.includes("### Story 27.6 addition: discard safety and non-destructive guarantees"));
    assert.ok(body.includes("this branch takes precedence over keyword checks"));
    assert.ok(body.includes("permanent removal is **human-only** outside this skill."));
  });

  it("Story 27.6 operator-visible discard copy appears in trigger-pattern", () => {
    const body = readFileSync(triggerPatternPath, "utf8");
    assert.ok(body.includes("### Discard / delete / archive (Story 27.6, operator-visible)"));
    assert.ok(body.includes("vault_delete"));
    assert.ok(body.includes("Stories 27.1 to 27.6"));
  });

  it("Story 27.6 operator guide AC7 documents discard safety and version history", () => {
    const body = readFileSync(operatorGuidePath, "utf8");
    assert.ok(body.includes("27-6-discard-policy-and-non-destructive-guarantees"));
    assert.ok(body.includes("### 15.3 Inbox triage (`/triage`, Epic 27)"));
    assert.ok(body.includes("**Discard / delete / archive vocabulary is safety-mapped.**"));
    assert.ok(body.includes("governed relocation"));
    assert.ok(body.includes("calls exactly one `vault_move`"));
    assert.ok(body.includes("Permanent removal is human-only outside Hermes."));
    assert.ok(body.includes("Clean up the original inbox capture only through a safe path"));
    assert.ok(!body.includes("6. Delete or archive the original inbox capture."));
  });
});
