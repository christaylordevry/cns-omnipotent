import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/unified-loop");
const skillPath = join(skillDir, "SKILL.md");
const taskPromptPath = join(skillDir, "references/task-prompt.md");
const triggerPatternPath = join(skillDir, "references/trigger-pattern.md");
const cronSnippetPath = join(skillDir, "references/cron-snippet.md");
const configSnippetPath = join(skillDir, "references/config-snippet.md");
const writerPath = join(skillDir, "scripts/write-discover-artifact.mjs");
const installSkillPath = join(root, "scripts/install-hermes-skill-unified-loop.sh");
const installCronPath = join(root, "scripts/install-unified-loop-discover-cron.sh");
const runCronPath = join(root, "scripts/run-unified-loop-discover-cron.sh");

const FORBIDDEN_ROWS = [
  ["1", "`vault_create_note`", "MCP tool call"],
  ["2", "`vault_move`", "MCP tool call"],
  ["3", "`vault_append_daily`", "MCP tool call"],
  ["4", "`vault_update_frontmatter`", "MCP tool call"],
  ["5", "`vault_log_action`", "MCP tool call"],
  [
    "6",
    "Worktree-exiting merges (git merge/rebase/checkout that leaves isolated worktree)",
    "terminal / git",
  ],
  [
    "7",
    "session-close apply paths (any mutation that applies session-close drafts to vault/repo)",
    "terminal / MCP",
  ],
];

const SECRET_LIKE =
  /sk-ant-[a-zA-Z0-9_-]+|fc-[a-zA-Z0-9_-]{20,}|apify_api_[a-zA-Z0-9_-]+|Bearer [A-Za-z0-9._\-+/=]{20,}|[A-Za-z0-9_]{20,}=[A-Za-z0-9_\-/+]{20,}/;

describe("Story 84-1 Hermes unified-loop skill mirror", () => {
  it("SKILL.md exists with Hermes frontmatter, terminal toolset, and discover tags", () => {
    assert.ok(existsSync(skillDir));
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(installSkillPath));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: unified-loop"));
    assert.ok(body.includes("version: 1.0.0"));
    assert.ok(body.includes("requires_toolsets: [terminal]"));
    assert.match(body, /REFERENCE ONLY|invocation already confirmed/i);
    assert.ok(body.includes('skill_view("unified-loop", "references/task-prompt.md")') || body.includes("references/task-prompt.md"));
    assert.ok(body.includes("OMNIPOTENT_REPO"));
    assert.ok(body.includes("terminal()"));
    assert.ok(body.includes("collect-internal-dev-state.ts"));
    assert.ok(body.includes("~/.hermes/artifacts/unified-loop/discover.json"));
    assert.ok(body.includes("unified-loop approve-build"));
    assert.ok(body.includes("tags: [cns, unified-loop, read-only, discover]") || body.includes("unified-loop, read-only, discover"));
    assert.doesNotMatch(body, SECRET_LIKE);
  });

  it("trigger-pattern documents unified-loop, cron:discover, approve-build, and negative continue", () => {
    assert.ok(existsSync(triggerPatternPath));
    const body = readFileSync(triggerPatternPath, "utf8");

    assert.ok(body.includes("unified-loop"));
    assert.ok(body.includes("unified-loop cron:discover"));
    assert.ok(body.includes("unified-loop approve-build"));
    assert.ok(body.includes("unified-loop continue"));
    assert.ok(body.includes("case-sensitive") || body.includes("Case-sensitive"));
    assert.ok(body.includes("cron:discover"));
  });

  it("task-prompt documents Discover pause, artifact path, repoRoot rule, and native approval terminal-only", () => {
    assert.ok(existsSync(taskPromptPath));
    const body = readFileSync(taskPromptPath, "utf8");

    assert.match(body, /## 0\) REFERENCE ONLY — invocation already confirmed/);
    assert.ok(body.includes("unified-loop approve-build"));
    assert.ok(body.includes("unified-loop continue"));
    assert.ok(body.includes("~/.hermes/artifacts/unified-loop/discover.json"));
    assert.ok(body.includes("repoRoot"));
    assert.ok(body.includes("absolute"));
    assert.ok(body.includes("collect-internal-dev-state.ts"));
    assert.ok(body.includes("write-discover-artifact.mjs"));
    assert.ok(body.includes("violation = skill failure"));
    assert.ok(body.includes("does **not** intercept MCP"));
    assert.ok(body.includes("approval.py"));
    assert.ok(body.includes("check_dangerous_command()"));
    assert.doesNotMatch(body, SECRET_LIKE);
  });

  it("task-prompt enumerates all seven forbidden rows verbatim", () => {
    const body = readFileSync(taskPromptPath, "utf8");
    for (const [num, forbidden, detection] of FORBIDDEN_ROWS) {
      assert.ok(
        body.includes(`| ${num} | ${forbidden} | ${detection} |`),
        `missing forbidden row ${num}`,
      );
    }
  });

  it("cron-snippet documents cns-unified-loop-discover tag, dummy schedule, and log path", () => {
    assert.ok(existsSync(cronSnippetPath));
    const body = readFileSync(cronSnippetPath, "utf8");

    assert.ok(body.includes("cns-unified-loop-discover"));
    assert.ok(body.includes("0 0 1 1 *"));
    assert.ok(body.includes("unified-loop-discover-cron-job-id"));
    assert.ok(body.includes("unified-loop-discover-cron.log"));
    assert.ok(body.includes("--skill unified-loop"));
    assert.ok(body.includes("install-unified-loop-discover-cron.sh"));
    assert.ok(body.includes("run-unified-loop-discover-cron.sh"));
  });

  it("config-snippet documents binding and optional unified_loop block", () => {
    assert.ok(existsSync(configSnippetPath));
    const body = readFileSync(configSnippetPath, "utf8");

    assert.ok(body.includes("unified-loop"));
    assert.ok(body.includes("install-hermes-skill-unified-loop.sh"));
    assert.ok(body.includes("unified_loop:"));
    assert.doesNotMatch(body, SECRET_LIKE);
  });

  it("install script rsyncs mirror to ~/.hermes/skills/cns/unified-loop", () => {
    const body = readFileSync(installSkillPath, "utf8");
    assert.ok(body.includes("hermes-skill-examples/unified-loop"));
    assert.ok(body.includes(".hermes/skills/cns/unified-loop"));
    assert.ok(body.includes("rsync"));
  });

  it("cron install and runner reference --skill unified-loop and cron tag", () => {
    const installBody = readFileSync(installCronPath, "utf8");
    const runBody = readFileSync(runCronPath, "utf8");

    assert.ok(installBody.includes("cns-unified-loop-discover"));
    assert.ok(installBody.includes("--skill unified-loop"));
    assert.ok(installBody.includes("unified-loop-discover-cron-job-id"));
    assert.ok(installBody.includes("0 0 1 1 *"));
    assert.ok(installBody.includes("run-unified-loop-discover-cron.sh"));

    assert.ok(runBody.includes("hermes cron run"));
    assert.ok(runBody.includes("hermes cron tick"));
    assert.ok(runBody.includes("unified-loop-discover-cron-job-id"));
    assert.ok(!runBody.includes('echo "unified-loop"'));
  });

  it("write-discover-artifact.mjs exists and references collector module", () => {
    assert.ok(existsSync(writerPath));
    const body = readFileSync(writerPath, "utf8");
    assert.ok(body.includes("collect-internal-dev-state.ts"));
    assert.ok(body.includes("awaiting-operator-approval"));
    assert.ok(body.includes("schemaVersion"));
  });
});
