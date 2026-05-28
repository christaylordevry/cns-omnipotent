import assert from "node:assert";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/morning-digest");
const skillPath = join(skillDir, "SKILL.md");
const taskPromptPath = join(skillDir, "references/task-prompt.md");
const triggerPatternPath = join(skillDir, "references/trigger-pattern.md");
const cronSnippetPath = join(skillDir, "references/cron-snippet.md");
const configSnippetPath = join(skillDir, "references/config-snippet.md");
const trendIngestWrapperPath = join(root, "scripts/session-close/hermes-run-trend-ingest.sh");
const newsapiWrapperPath = join(root, "scripts/session-close/hermes-run-newsapi.sh");

describe("Story 49-6 Hermes morning-digest skill mirror", () => {
  it("SKILL.md exists and declares name, triggers, sources, and no-vault-writes policy", () => {
    assert.ok(existsSync(skillDir));
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-morning-digest.sh")));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: morning-digest"));
    assert.ok(body.includes("version: 1.0.4"));
    assert.ok(body.includes("requires_toolsets: [terminal]"));
    assert.ok(body.includes("morning-digest"));
    assert.ok(body.includes("explicit `terminal(...)` calls"));
    assert.ok(body.includes("execute the digest immediately"));
    assert.ok(body.includes("Do not summarize this skill"));
    assert.ok(body.includes('skill_view("morning-digest", "references/task-prompt.md")'));
    assert.ok(body.includes("Never invent trends or headlines"));
    assert.ok(body.includes("## Inline task contract"));
    assert.ok(body.includes("Parse stdout JSON only"));
    assert.ok(body.includes("do not fabricate substitute data"));
    assert.ok(body.includes("Do not wrap the final digest in a code fence"));
    assert.ok(body.includes("Sample headline"));
    assert.ok(body.includes("trend-ingest.py"));
    assert.ok(body.includes("hermes-run-trend-ingest.sh"));
    assert.ok(body.includes("hermes-run-newsapi.sh"));
    assert.ok(body.includes("mcp__perplexity__search"));
    assert.ok(body.includes("No vault writes"));
    assert.ok(body.includes("process.env.TZ"));
    assert.ok(!body.includes("Australia/Sydney"));
    assert.ok(!body.includes("python3 - <<'PY'"));
  });

  it("trigger-pattern documents manual morning-digest and cron pseudo-trigger", () => {
    assert.ok(existsSync(triggerPatternPath));
    const body = readFileSync(triggerPatternPath, "utf8");

    assert.ok(body.includes("morning-digest"));
    assert.ok(body.includes("case-insensitive"));
    assert.ok(body.includes("cron:morning-digest"));
  });

  it("task-prompt defines output contract, all three sources, and machine-local date", () => {
    assert.ok(existsSync(taskPromptPath));
    const body = readFileSync(taskPromptPath, "utf8");

    assert.ok(body.includes("trend-ingest.py"));
    assert.ok(body.includes("--dry-run"));
    assert.ok(body.includes("no Convex push") || body.includes("does **not** call Convex"));
    assert.ok(body.includes("$HOME/.hermes/trend-ingest.env"));
    assert.ok(
      body.includes("continue") &&
        (body.includes("Source 2") || body.includes("Cross-source")),
    );
    assert.ok(body.includes("NEWSAPI"));
    assert.ok(body.includes("mcp__perplexity__search"));
    assert.ok(body.includes("process.env.TZ"));
    assert.ok(!body.includes("Australia/Sydney"));
    assert.ok(!body.includes("```bash"));
    assert.ok(!body.includes("run_terminal_cmd"));

    assert.ok(body.includes("🌅 **Morning Digest**"));
    assert.ok(body.includes("**Trending Now**"));
    assert.ok(body.includes("**Headlines**"));
    assert.ok(body.includes("**Deep Signal**"));
    assert.ok(body.includes("**Recommended focus:**"));
    assert.ok(body.includes("No vault writes"));
  });

  it("task-prompt requires explicit Hermes tool calls instead of passive shell snippets", () => {
    assert.ok(existsSync(taskPromptPath));
    const body = readFileSync(taskPromptPath, "utf8");

    assert.ok(body.includes("## Tool-call rule"));
    assert.ok(body.includes('terminal(command="node -e'));
    assert.ok(
      body.includes(
        'terminal(command="bash scripts/session-close/hermes-run-trend-ingest.sh"',
      ),
    );
    assert.ok(
      body.includes(
        'terminal(command="bash scripts/session-close/hermes-run-newsapi.sh"',
      ),
    );
    assert.ok(body.includes("Call `terminal` exactly once for NewsAPI"));
    assert.ok(body.includes("Call `mcp__perplexity__search` exactly once"));
    assert.ok(body.includes("| `terminal` | Machine-local date; `trend-ingest.py --dry-run`; NewsAPI fetch |"));
    assert.ok(!body.includes("python3 - <<'PY'"));
    assert.ok(!body.includes("export PATH="));
  });

  it("wrapper scripts exist and are executable", () => {
    assert.ok(existsSync(trendIngestWrapperPath));
    assert.ok(existsSync(newsapiWrapperPath));

    assert.ok((statSync(trendIngestWrapperPath).mode & 0o111) !== 0);
    assert.ok((statSync(newsapiWrapperPath).mode & 0o111) !== 0);

    const trendIngestWrapper = readFileSync(trendIngestWrapperPath, "utf8");
    const newsapiWrapper = readFileSync(newsapiWrapperPath, "utf8");
    assert.ok(trendIngestWrapper.includes("--dry-run"));
    assert.ok(trendIngestWrapper.includes("--sources google_trends"));
    assert.ok(newsapiWrapper.includes("$HOME/.hermes/trend-ingest.env"));
    assert.ok(newsapiWrapper.includes("NEWSAPI_API_KEY"));
  });

  it("cron-snippet documents 0 8 schedule, MORNING_DIGEST_CRON, and 26-7 migration", () => {
    assert.ok(existsSync(cronSnippetPath));
    const body = readFileSync(cronSnippetPath, "utf8");

    assert.ok(body.includes("0 8"));
    assert.ok(body.includes("MORNING_DIGEST_CRON"));
    assert.ok(body.includes("morning_digest.cron") || body.includes("morning_digest:"));
    assert.ok(body.includes("hermes-morning-digest.sh"));
    assert.ok(!body.includes("CRON_TZ=Australia/Sydney"));
  });

  it("config-snippet documents morning_digest.cron without hardcoded timezone", () => {
    assert.ok(existsSync(configSnippetPath));
    const body = readFileSync(configSnippetPath, "utf8");

    assert.ok(body.includes("morning_digest"));
    assert.ok(body.includes("channel_skill_bindings"));
    assert.ok(body.includes("do not wipe") || body.includes("do **not** replace"));
    assert.ok(!body.includes("Australia/Sydney"));
  });

  it("SKILL.md forbids aborting digest on single-source failure", () => {
    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("Never abort") || body.includes("never abort"));
  });

  it("install script source dir exists", () => {
    assert.ok(existsSync(skillDir));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-morning-digest.sh")));
  });
});
