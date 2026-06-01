import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/investigate-trend");
const skillPath = join(skillDir, "SKILL.md");
const taskPromptPath = join(skillDir, "references/task-prompt.md");
const triggerPatternPath = join(skillDir, "references/trigger-pattern.md");

describe("Story 49-4 Hermes investigate-trend skill mirror", () => {
  it("SKILL.md exists and declares name, trigger, tools, timeout, and no-vault-writes policy", () => {
    assert.ok(existsSync(skillDir));
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-investigate-trend.sh")));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: investigate-trend"));
    assert.ok(body.includes("version: 1.0.1"));
    assert.ok(body.includes("Trigger"));
    assert.match(body, /REFERENCE ONLY|invocation already confirmed/i);
    assert.ok(body.includes("investigate-trend keyword:"));
    assert.ok(body.includes("mcp__perplexity__search"));
    assert.ok(body.includes("30 seconds"));
    assert.ok(body.includes("No vault writes"));
    assert.ok(body.includes("No dashboard relay"));
  });

  it("trigger-pattern documents the canonical 4-line payload and quoted keyword requirement", () => {
    assert.ok(existsSync(triggerPatternPath));
    const body = readFileSync(triggerPatternPath, "utf8");

    assert.ok(body.includes("Canonical payload grammar"));
    assert.ok(body.includes('investigate-trend keyword: "<keyword>"'));
    assert.ok(body.includes("topicSlug: <topicSlug>"));
    assert.ok(body.includes("context: <context>"));
    assert.ok(body.includes("request: <request>"));
    assert.ok(body.includes("single ASCII double-quoted"));
    assert.ok(body.includes("GROWING"));
    assert.ok(body.includes("ai-agent-orchestration"));
  });

  it("task-prompt parses keyword/topicSlug/context/request, enforces a 30s hard cap, and defines the exact response template", () => {
    assert.ok(existsSync(taskPromptPath));
    const body = readFileSync(taskPromptPath, "utf8");

    for (const field of ["keyword", "topicSlug", "context", "request"]) {
      assert.ok(body.includes(field), `missing parse field: ${field}`);
    }

    assert.ok(body.includes("Timeout"));
    assert.ok(body.includes("30s hard cap") || body.includes("30 seconds"));
    assert.ok(body.includes("timeout (30s)"));
    assert.ok(body.includes("Perplexity sweep"));
    assert.ok(body.includes("mcp__perplexity__search"));
    assert.ok(body.includes("bad-payload"));

    assert.ok(body.includes('🔍 **investigate-trend: "<keyword>"**'));
    assert.ok(body.includes("**Context:** <context line verbatim>"));
    assert.ok(body.includes("**Signals:**"));
    assert.ok(body.includes("**Momentum:**"));
    assert.ok(body.includes("**Recommendation:** WATCH | IGNORE | ESCALATE"));
    assert.ok(body.includes("exactly 3"));
  });

  it("install script source dir exists", () => {
    assert.ok(existsSync(skillDir));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-investigate-trend.sh")));
  });
});

