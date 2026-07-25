import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/awareness-sync");
const skillPath = join(skillDir, "SKILL.md");
const taskPromptPath = join(skillDir, "references/task-prompt.md");
const triggerPatternPath = join(skillDir, "references/trigger-pattern.md");
const examplePromptsPath = join(skillDir, "references/example-prompts.md");
const configSnippetPath = join(skillDir, "references/config-snippet.md");
const installScriptPath = join(root, "scripts/install-hermes-skill-awareness-sync.sh");
const bindingsPath = join(root, "scripts/hermes-skill-bindings-expected.json");

const SECRET_LIKE =
  /sk-ant-[a-zA-Z0-9_-]+|fc-[a-zA-Z0-9_-]{20,}|apify_api_[a-zA-Z0-9_-]+|Bearer [A-Za-z0-9._\-+/=]{20,}|[A-Za-z0-9_]{20,}=[A-Za-z0-9_\-/+]{20,}/;

describe("Story 77-4 Hermes awareness-sync skill mirror", () => {
  it("SKILL.md exists with Hermes frontmatter, terminal toolset, and env name-only policy", () => {
    assert.ok(existsSync(skillDir));
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(installScriptPath));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: awareness-sync"));
    assert.ok(body.includes("version: 1.0.0"));
    assert.ok(body.includes("requires_toolsets: [terminal]"));
    assert.match(body, /REFERENCE ONLY|invocation already confirmed/i);
    assert.ok(body.includes("OMNIPOTENT_REPO"));
    assert.ok(body.includes("CONVEX_URL"));
    assert.ok(body.includes("HERMES_CONVEX_READ_KEY"));
    assert.ok(body.includes("terminal()"));
    assert.ok(body.includes("scripts/hermes-awareness-pull.ts"));
    assert.ok(body.includes("awareness-pull.env"));
    assert.ok(body.includes("No vault mutations"));
    assert.ok(body.includes("metadata.hermes.tags") || body.includes("tags: [cns"));
    assert.doesNotMatch(body, SECRET_LIKE);
  });

  it("trigger-pattern documents awareness-sync, --cache-only, and natural-language hooks", () => {
    assert.ok(existsSync(triggerPatternPath));
    const body = readFileSync(triggerPatternPath, "utf8");

    assert.ok(body.includes("awareness-sync"));
    assert.ok(body.includes("--cache-only"));
    assert.ok(body.includes("--json"));
    assert.ok(body.includes("What's the run-chain status?"));
    assert.ok(body.includes("investigate-trend"));
    assert.ok(body.includes("morning-digest"));
  });

  it("task-prompt documents REFERENCE ONLY block, terminal pull, cache read, and stale template", () => {
    assert.ok(existsSync(taskPromptPath));
    const body = readFileSync(taskPromptPath, "utf8");

    assert.match(body, /## 0\) REFERENCE ONLY — invocation already confirmed/);
    assert.match(body, /Do not re-check/i);
    assert.ok(body.includes("source \"${HOME}/.hermes/awareness-pull.env\""));
    assert.ok(body.includes("npx tsx scripts/hermes-awareness-pull.ts"));
    assert.ok(body.includes("OMNIPOTENT_REPO"));
    assert.ok(body.includes("awareness-snapshot.json"));
    assert.ok(body.includes("HERMES_AWARENESS_CACHE_PATH"));
    assert.ok(body.includes("STALE — pull failed"));
    assert.ok(body.includes("pulledAt"));
    assert.ok(body.includes("snapshot.chain"));
    assert.ok(body.includes("snapshot.digest"));
    assert.ok(body.includes("snapshot.mcps"));
    assert.ok(body.includes("snapshot.investigations"));
    assert.ok(body.includes("snapshot.trends"));
    assert.ok(body.includes("HERMES_CONVEX_READ_KEY"));
    assert.ok(body.includes("401"));
    assert.doesNotMatch(body, SECRET_LIKE);
  });

  it("example-prompts documents AC5 operator examples", () => {
    assert.ok(existsSync(examplePromptsPath));
    const body = readFileSync(examplePromptsPath, "utf8");

    assert.ok(body.includes("awareness-sync"));
    assert.ok(body.includes("What's the run-chain status?"));
    assert.ok(body.includes("How did the morning digest go?"));
    assert.ok(body.includes("Any trend anomalies?"));
    assert.ok(body.includes("Investigation board summary"));
    assert.ok(body.includes("MCP health check"));
    assert.ok(body.includes("snapshot.chain"));
    assert.ok(body.includes("snapshot.digest"));
    assert.ok(body.includes("snapshot.trends"));
  });

  it("config-snippet documents binding and awareness-pull.env note", () => {
    assert.ok(existsSync(configSnippetPath));
    const body = readFileSync(configSnippetPath, "utf8");

    assert.ok(body.includes("awareness-sync"));
    assert.ok(body.includes("OMNIPOTENT_REPO"));
    assert.ok(body.includes("awareness-pull.env"));
    assert.ok(body.includes("investigate-trend"));
    assert.ok(body.includes("morning-digest"));
    assert.doesNotMatch(body, SECRET_LIKE);
  });

  it("install script source dir exists and names awareness-sync destination", () => {
    const body = readFileSync(installScriptPath, "utf8");
    assert.ok(body.includes("hermes-skill-examples/awareness-sync"));
    assert.ok(body.includes(".hermes/skills/cns/awareness-sync"));
  });

  it("bindings expected JSON lists awareness-sync after investigate-trend before morning-digest", () => {
    const bindings = JSON.parse(readFileSync(bindingsPath, "utf8"));
    const hermes = bindings.channel_skill_bindings.find((c) => c.id === "1500733488897462382");
    assert.ok(hermes);
    const skills = hermes.skills;
    const trendIdx = skills.indexOf("investigate-trend");
    const syncIdx = skills.indexOf("awareness-sync");
    const digestIdx = skills.indexOf("morning-digest");
    assert.ok(trendIdx >= 0);
    assert.ok(syncIdx >= 0);
    assert.ok(digestIdx >= 0);
    assert.ok(syncIdx > trendIdx);
    assert.ok(syncIdx < digestIdx);
    assert.ok(!bindings.parity_skills.includes("awareness-sync"));
  });
});
