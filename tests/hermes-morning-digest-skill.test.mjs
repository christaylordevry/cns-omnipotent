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
const pickSignalScriptPath = join(
  skillDir,
  "scripts/pick-signal-notebook.mjs",
);
const queryNotebookScriptPath = join(
  root,
  "scripts/hermes-skill-examples/notebook-query/scripts/query-notebook.mjs",
);

describe("Story 49-6 Hermes morning-digest skill mirror", () => {
  it("SKILL.md exists and declares name, triggers, sources, and no-vault-writes policy", () => {
    assert.ok(existsSync(skillDir));
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-morning-digest.sh")));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: morning-digest"));
    assert.ok(body.includes("version: 1.2.3"));
    assert.ok(body.includes("requires_toolsets: [terminal, perplexity]"));
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
    assert.ok(body.includes("pick-signal-notebook.mjs"));
    assert.ok(body.includes("query-notebook.mjs"));
    assert.ok(body.includes("**Vault context**"));
    assert.ok(body.includes("No vault writes"));
    assert.ok(body.includes("no NotebookLM MCP") || body.includes("not the NotebookLM MCP"));
    assert.ok(body.includes("process.env.TZ"));
    assert.ok(!body.includes("Australia/Sydney"));
    assert.ok(!body.includes("python3 - <<'PY'"));
  });

  it("trigger-pattern documents manual morning-digest and cron pseudo-trigger", () => {
    assert.ok(existsSync(triggerPatternPath));
    const body = readFileSync(triggerPatternPath, "utf8");

    assert.ok(body.includes("morning-digest"));
    assert.ok(body.includes("cron:morning-digest"));
    assert.ok(body.includes("case-sensitive"));
  });

  it("trigger pattern is strict and unambiguous (Story 55-1)", () => {
    const triggerBody = readFileSync(triggerPatternPath, "utf8");
    const skillBody = readFileSync(skillPath, "utf8");

    assert.ok(
      triggerBody.includes("Canonical manual trigger grammar") ||
        triggerBody.includes("first non-empty line"),
    );
    assert.ok(
      triggerBody.includes("must begin") ||
        triggerBody.includes("first non-empty line") ||
        triggerBody.includes("trigger line"),
    );
    assert.ok(triggerBody.includes("case-sensitive"));
    assert.ok(triggerBody.includes("cron:<label>"));
    assert.ok(triggerBody.includes("morning-digest cron:manual"));
    assert.ok(
      !triggerBody.includes("entire message** must match (case-insensitive)") &&
        !triggerBody.includes("entire message** must match"),
      "must not use whole-message equality as the only rule",
    );
    assert.ok(triggerBody.includes("substring"));
    assert.ok(
      triggerBody.includes("Negative") || triggerBody.includes("must not run digest"),
    );
    assert.ok(
      triggerBody.includes("Morning-Digest") || triggerBody.includes("Case mismatch"),
    );
    assert.ok(skillBody.includes('skill_view("morning-digest", "references/task-prompt.md")'));
    assert.ok(skillBody.includes("morning-digest cron:<label>"));
    assert.ok(
      skillBody.includes("Before any source collection") ||
        skillBody.includes("skill_view"),
    );
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
    assert.ok(body.includes("**Vault context**"));
    assert.ok(body.includes("pick-signal-notebook.mjs"));
    assert.ok(body.includes("query-notebook.mjs"));
    assert.ok(body.includes("Source 4"));
    assert.ok(body.includes("shellQuote(value)"));
    assert.ok(body.includes("QUERY_SCRIPT=<shellQuote(query_script)>"));
    assert.ok(!body.includes("SIGNALS_JSON='<json-array>'"));
    assert.ok(!body.includes("NOTEBOOK_QUERY='Morning digest context for: <winning_signal>"));
    assert.ok(body.includes("No vault writes"));
    assert.ok(!body.includes("No NotebookLM fan-out"));
    assert.ok(body.includes("mcp__notebooklm__notebook_query"));
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
    assert.ok(
      body.includes("pick-signal-notebook.mjs") && body.includes("query-notebook.mjs"),
    );
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

  it("cron-snippet documents 07:00 Sydney schedule, install script, and 26-7 migration (Story 55-3)", () => {
    assert.ok(existsSync(cronSnippetPath));
    const body = readFileSync(cronSnippetPath, "utf8");

    assert.ok(body.includes("0 7"));
    assert.ok(body.includes("MORNING_DIGEST_CRON"));
    assert.ok(body.includes("morning_digest.cron") || body.includes("morning_digest:"));
    assert.ok(body.includes("--skill morning-digest"));
    assert.ok(body.includes("install-morning-digest-cron.sh"));
    assert.ok(body.includes("run-morning-digest-cron.sh"));
    assert.ok(body.includes("cns-morning-digest-skill"));
    assert.ok(body.includes("CRON_TZ=Australia/Sydney"));
    assert.ok(body.includes("hermes-morning-digest.sh"));
    assert.ok(!body.includes("0 8 * * *"));
  });

  it("config-snippet documents morning_digest.cron with Sydney default (Story 55-3)", () => {
    assert.ok(existsSync(configSnippetPath));
    const body = readFileSync(configSnippetPath, "utf8");

    assert.ok(body.includes("morning_digest"));
    assert.ok(body.includes("0 7"));
    assert.ok(body.includes("Australia/Sydney"));
    assert.ok(body.includes("install-morning-digest-cron.sh"));
    assert.ok(body.includes("channel_skill_bindings"));
    assert.ok(body.includes("channel_prompts"));
    assert.ok(body.includes('skill_view("morning-digest", "references/task-prompt.md")'));
    assert.ok(body.includes("morning-digest cron:<label>"));
    assert.ok(body.includes("<hermes-channel-id>"));
    assert.ok(body.includes("do not wipe") || body.includes("do **not** replace"));
    assert.ok(!body.includes("1500733488897462382"));
  });

  it("cron install + runner scripts exist with contract defaults (Story 55-3)", () => {
    const installPath = join(root, "scripts/install-morning-digest-cron.sh");
    const runPath = join(root, "scripts/run-morning-digest-cron.sh");
    assert.ok(existsSync(installPath));
    assert.ok(existsSync(runPath));
    assert.ok((statSync(installPath).mode & 0o111) !== 0);
    assert.ok((statSync(runPath).mode & 0o111) !== 0);

    const installBody = readFileSync(installPath, "utf8");
    const runBody = readFileSync(runPath, "utf8");

    assert.ok(installBody.includes("cns-morning-digest-skill"));
    assert.ok(installBody.includes('grep -v "$CRON_TAG"'));
    assert.ok(installBody.includes("0 7 * * *"));
    assert.ok(installBody.includes("CRON_TZ=Australia/Sydney"));
    assert.ok(installBody.includes("MORNING_DIGEST_CRON"));
    assert.ok(installBody.includes("--skill morning-digest"));
    assert.ok(installBody.includes("--name"));
    assert.ok(installBody.includes("--deliver discord"));
    assert.ok(installBody.includes("0 0 1 1 *"));
    assert.ok(installBody.includes(".env.live-chain"));
    assert.ok(installBody.includes("morning-digest-skill-cron-job-id"));
    assert.ok(installBody.includes("install_wsl_crontab_line"));
    assert.ok(installBody.includes("chmod +x"));

    assert.ok(runBody.includes("gateway is running"));
    assert.ok(runBody.includes("hermes cron run"));
    assert.ok(runBody.includes("hermes cron tick"));
    assert.ok(runBody.includes("morning-digest-skill-cron-job-id"));
    assert.ok(!runBody.includes("hermes-morning-digest-"));
  });

  it("SKILL.md forbids aborting digest on single-source failure", () => {
    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("Never abort") || body.includes("never abort"));
  });

  it("SKILL.md inline fallback preserves exact Vault context fallback variants", () => {
    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("**Vault context** (NotebookLM)"));
    assert.ok(body.includes("- (source unavailable: no watched notebook matched today's signals)"));
    assert.ok(body.includes("For ROUTED query failure, use exactly"));
    assert.ok(body.includes("**Vault context** (NotebookLM — <route.title>)"));
  });

  it("install script source dir exists", () => {
    assert.ok(existsSync(skillDir));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-morning-digest.sh")));
  });

  it("pick-signal script exists and query-notebook path is referenced (Story 52-1)", () => {
    assert.ok(existsSync(pickSignalScriptPath));
    assert.ok(existsSync(queryNotebookScriptPath));
    const taskBody = readFileSync(taskPromptPath, "utf8");
    assert.ok(taskBody.includes("notebook-query/scripts/query-notebook.mjs"));
  });

  it("task-prompt documents post-post Convex log for successful Vault context (Story 52-2, 54-2)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const postPost = taskBody.slice(
      taskBody.indexOf("## Post-post — Log Vault context to Convex"),
    );
    assert.ok(postPost.includes("log-notebook-query.mjs"));
    assert.ok(postPost.includes("**After** posting"));
    assert.ok(postPost.includes("Do not edit or retract the Discord digest"));
    assert.ok(postPost.includes("NOTEBOOK_QUERY=<shellQuote(winning_signal)>"));
    assert.ok(postPost.includes("NOTEBOOK_ANSWER=<shellQuote(answer_full)>"));
    assert.ok(postPost.includes("answer_full"));
    assert.ok(postPost.includes("before Discord 500-char truncation"));
    assert.ok(postPost.includes("NO_ROUTE"));
    assert.ok(postPost.includes("source unavailable"));
    assert.ok(postPost.includes("timeout=15"));
    assert.ok(postPost.includes("workdir=resolved_repo_root"));
    assert.ok(postPost.includes("notebook_query_log"));
    assert.ok(postPost.includes("skipped — missing CONVEX_URL"));
    assert.ok(postPost.includes("Convex push failed"));
    assert.ok(
      postPost.includes("Notebook history log failed"),
    );
    assert.ok(postPost.includes("Await"));
    assert.ok(!postPost.includes("fire-and-forget"));
  });

  it("SKILL.md v1.2.3 documents awaited Vault context Convex log (Story 52-2, 54-2)", () => {
    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("version: 1.2.3"));
    assert.ok(body.includes("log-notebook-query.mjs"));
    assert.ok(body.includes("No trend Convex push"));
    assert.ok(body.includes("Vault context Convex log"));
    assert.ok(body.includes("notebook_query_log"));
    assert.ok(body.includes("timeout=15"));
    assert.ok(!body.includes("fire-and-forget"));
    assert.ok(body.includes("trend-ingest.py"));
  });
});
