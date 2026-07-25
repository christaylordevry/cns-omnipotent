import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/run-chain");
const skillPath = join(skillDir, "SKILL.md");
const taskPromptPath = join(skillDir, "references/task-prompt.md");
const triggerPatternPath = join(skillDir, "references/trigger-pattern.md");
const configSnippetPath = join(skillDir, "references/config-snippet.md");
const installScriptPath = join(root, "scripts/install-hermes-skill-run-chain.sh");

describe("Story 75-3 Hermes run-chain skill mirror", () => {
  it("SKILL.md exists with Hermes frontmatter, terminal toolset, and env name-only policy", () => {
    assert.ok(existsSync(skillDir));
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(installScriptPath));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: run-chain"));
    assert.ok(body.includes("version: 1.0.0"));
    assert.ok(body.includes("requires_toolsets: [terminal]"));
    assert.match(body, /REFERENCE ONLY|invocation already confirmed/i);
    assert.ok(body.includes(".env.live-chain"));
    assert.ok(body.includes("OMNIPOTENT_REPO"));
    assert.ok(body.includes("FIRECRAWL_API_KEY"));
    assert.ok(body.includes("ANTHROPIC_API_KEY"));
    assert.ok(body.includes("APIFY_API_TOKEN"));
    assert.ok(body.includes("terminal()"));
    assert.ok(body.includes("scripts/run-chain.ts"));
    assert.ok(body.includes("75-4"));
    assert.ok(body.includes("validate-anthropic-key.ts"));
    assert.ok(body.includes("No vault mutations"));
    assert.doesNotMatch(
      body,
      /sk-ant-[a-zA-Z0-9_-]+|fc-[a-zA-Z0-9_-]{20,}|apify_api_[a-zA-Z0-9_-]+|[A-Za-z0-9_]{20,}=[A-Za-z0-9_\-/+]{20,}/,
    );
  });

  it("trigger-pattern documents canonical run-chain topic/query/depth grammar", () => {
    assert.ok(existsSync(triggerPatternPath));
    const body = readFileSync(triggerPatternPath, "utf8");

    assert.ok(body.includes('run-chain topic: "<topic>"'));
    assert.ok(body.includes('query: "<primary query>"'));
    assert.ok(body.includes("depth: shallow"));
    assert.ok(body.includes("depth: deep"));
    assert.ok(body.includes("bad-payload"));
    assert.ok(body.includes("default **`deep`**"));
  });

  it("task-prompt documents REFERENCE ONLY block, terminal command, and failure templates", () => {
    assert.ok(existsSync(taskPromptPath));
    const body = readFileSync(taskPromptPath, "utf8");

    assert.match(body, /## 0\) REFERENCE ONLY — invocation already confirmed/);
    assert.match(body, /Do not re-check/i);
    assert.ok(body.includes("source .env.live-chain"));
    assert.ok(body.includes("npx tsx scripts/run-chain.ts"));
    assert.ok(body.includes("--raw-json"));
    assert.ok(body.includes("OMNIPOTENT_REPO"));
    assert.ok(body.includes("run-chain: bad-payload"));
    assert.ok(body.includes("## Run-chain failed (preflight)"));
    assert.ok(body.includes("Missing required environment variables"));
    assert.ok(body.includes("## Run-chain failed (credentials)"));
    assert.ok(body.includes("401"));
    assert.ok(body.includes("ANTHROPIC_API_KEY"));
    assert.ok(body.includes("validate-anthropic-key.ts"));
    assert.ok(body.includes("## Run-chain complete"));
    assert.ok(body.includes("synthesis.insight_note.vault_path"));
    assert.ok(body.includes("AI-Context/modules/run-chain.md"));
    assert.doesNotMatch(
      body,
      /sk-ant-[a-zA-Z0-9_-]+|fc-[a-zA-Z0-9_-]{20,}|apify_api_[a-zA-Z0-9_-]+|[A-Za-z0-9_]{20,}=[A-Za-z0-9_\-/+]{20,}/,
    );
  });

  it("config-snippet documents optional channel binding and env passthrough names only", () => {
    assert.ok(existsSync(configSnippetPath));
    const body = readFileSync(configSnippetPath, "utf8");

    assert.ok(body.includes("channel_skill_bindings"));
    assert.ok(body.includes("run-chain"));
    assert.ok(body.includes("OMNIPOTENT_REPO"));
    assert.ok(body.includes("source .env.live-chain"));
    assert.doesNotMatch(
      body,
      /sk-ant-[a-zA-Z0-9_-]+|fc-[a-zA-Z0-9_-]{20,}|apify_api_[a-zA-Z0-9_-]+|[A-Za-z0-9_]{20,}=[A-Za-z0-9_\-/+]{20,}/,
    );
  });

  it("install script source dir exists and names run-chain destination", () => {
    assert.ok(existsSync(skillDir));
    const body = readFileSync(installScriptPath, "utf8");
    assert.ok(body.includes("hermes-skill-examples/run-chain"));
    assert.ok(body.includes(".hermes/skills/cns/run-chain"));
  });
});
