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
const arxivWrapperPath = join(root, "scripts/session-close/hermes-run-arxiv.sh");
const hnWrapperPath = join(root, "scripts/session-close/hermes-run-hn.sh");
const githubWrapperPath = join(root, "scripts/session-close/hermes-run-github.sh");
const redditWrapperPath = join(root, "scripts/session-close/hermes-run-reddit.sh");
const rssWrapperPath = join(root, "scripts/session-close/hermes-run-rss.sh");
const producthuntWrapperPath = join(root, "scripts/session-close/hermes-run-producthunt.sh");
const xWrapperPath = join(root, "scripts/session-close/hermes-run-x.sh");
const blueskyWrapperPath = join(root, "scripts/session-close/hermes-run-bluesky.sh");
const fetchArxivScriptPath = join(skillDir, "scripts/fetch-arxiv-rss.mjs");
const fetchHnScriptPath = join(skillDir, "scripts/fetch-hn-rss.mjs");
const fetchRssScriptPath = join(skillDir, "scripts/fetch-rss-signals.mjs");
const fetchProductHuntScriptPath = join(skillDir, "scripts/fetch-producthunt-launches.mjs");
const fetchXScriptPath = join(skillDir, "scripts/fetch-x-signals.mjs");
const fetchBlueskyScriptPath = join(skillDir, "scripts/fetch-bluesky-signals.mjs");
const fetchNewsapiScriptPath = join(skillDir, "scripts/fetch-newsapi-headlines.mjs");
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
    assert.ok(body.includes("version: 1.4.7"));
    assert.ok(body.includes("**arXiv Preprints**"));
    assert.ok(body.includes("**HackerNews**"));
    assert.ok(body.includes("hermes-run-arxiv.sh"));
    assert.ok(body.includes("hermes-run-hn.sh"));
    assert.ok(body.includes("## Pitfalls"));
    assert.ok(body.includes("pick-signal-routing.md"));
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

  it("task-prompt defines output contract, all three sources, and Sydney civil date", () => {
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
    assert.ok(body.includes("Australia/Sydney"));
    assert.ok(body.includes("Intl.DateTimeFormat"));
    assert.ok(!body.includes("```bash"));
    assert.ok(!body.includes("run_terminal_cmd"));

    assert.ok(body.includes("🌅 **Morning Digest**"));
    assert.ok(body.includes("**Trending Now**"));
    assert.ok(body.includes("**Headlines**"));
    assert.ok(body.includes("**Deep Signal**"));
    assert.ok(body.includes("**arXiv Preprints**"));
    assert.ok(body.includes("**HackerNews**"));
    assert.ok(body.includes("hackernews"));
    assert.ok(body.includes("**Recommended focus:**"));
    assert.ok(body.includes("**Vault context**"));
    assert.ok(body.includes("pick-signal-notebook.mjs"));
    assert.ok(body.includes("query-notebook.mjs"));
    assert.ok(body.includes("Source 4"));
    assert.ok(body.includes("DIGEST_SOURCES_JSON"));
    assert.ok(body.includes("buildDigestSignals"));
    assert.ok(body.includes("perplexityText"));
    assert.ok(body.includes("digest_sources"));
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
    assert.ok(
      body.includes(
        'terminal(command="bash scripts/session-close/hermes-run-arxiv.sh"',
      ),
    );
    assert.ok(
      body.includes(
        'terminal(command="bash scripts/session-close/hermes-run-hn.sh"',
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
    assert.ok(existsSync(arxivWrapperPath));
    assert.ok(existsSync(hnWrapperPath));
    assert.ok(existsSync(fetchArxivScriptPath));
    assert.ok(existsSync(fetchHnScriptPath));
    assert.ok(existsSync(fetchNewsapiScriptPath));

    assert.ok((statSync(trendIngestWrapperPath).mode & 0o111) !== 0);
    assert.ok((statSync(newsapiWrapperPath).mode & 0o111) !== 0);
    assert.ok((statSync(arxivWrapperPath).mode & 0o111) !== 0);
    assert.ok((statSync(hnWrapperPath).mode & 0o111) !== 0);

    const trendIngestWrapper = readFileSync(trendIngestWrapperPath, "utf8");
    const newsapiWrapper = readFileSync(newsapiWrapperPath, "utf8");
    const arxivWrapper = readFileSync(arxivWrapperPath, "utf8");
    const hnWrapper = readFileSync(hnWrapperPath, "utf8");
    assert.ok(trendIngestWrapper.includes("--dry-run"));
    assert.ok(trendIngestWrapper.includes("--sources google_trends"));
    assert.ok(newsapiWrapper.includes("$HOME/.hermes/trend-ingest.env"));
    assert.ok(newsapiWrapper.includes("NEWSAPI_API_KEY"));
    assert.ok(newsapiWrapper.includes("fetch-newsapi-headlines.mjs"));
    assert.ok(!newsapiWrapper.includes("python3 - <<'PY'"));
    assert.ok(arxivWrapper.includes("fetch-arxiv-rss.mjs"));
    assert.ok(arxivWrapper.includes(".hermes/home"));
    assert.ok(arxivWrapper.includes('export HOME="$OPERATOR_HOME"'));
    assert.ok(hnWrapper.includes("fetch-hn-rss.mjs"));
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
    assert.ok(installBody.includes("cns-push-digest-watchdog"));
    assert.ok(installBody.includes('grep -v "$CRON_TAG"'));
    assert.ok(installBody.includes('grep -v "$WATCHDOG_CRON_TAG"'));
    assert.ok(installBody.includes("0 7 * * *"));
    assert.ok(installBody.includes("15 7 * * *"));
    assert.ok(installBody.includes("0 13 * * *"));
    assert.ok(installBody.includes("30 18 * * *"));
    assert.ok(installBody.includes("cns-push-digest-watchdog-afternoon"));
    assert.ok(installBody.includes("cns-push-digest-watchdog-evening"));
    assert.ok(installBody.includes("CRON_TZ=Australia/Sydney"));
    assert.ok(installBody.includes("MORNING_DIGEST_CRON"));
    assert.ok(installBody.includes("run-push-digest-watchdog-cron.sh"));
    assert.ok(installBody.includes("push-digest-watchdog.log"));
    assert.ok(installBody.includes("--skill morning-digest"));
    assert.ok(installBody.includes("--name"));
    assert.ok(installBody.includes("--deliver discord"));
    assert.ok(installBody.includes("0 0 1 1 *"));
    assert.ok(installBody.includes(".env.live-chain"));
    assert.ok(installBody.includes("morning-digest-skill-cron-job-id"));
    assert.ok(installBody.includes("install_wsl_crontab_lines"));
    assert.ok(installBody.includes("chmod +x"));

    assert.ok(runBody.includes("gateway service is running|gateway is running"));
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
    const installPath = join(root, "scripts/install-hermes-skill-morning-digest.sh");
    assert.ok(existsSync(installPath));
    const installBody = readFileSync(installPath, "utf8");
    assert.ok(installBody.includes("rsync -a --delete"), "install must mirror with rsync --delete");
    assert.ok(existsSync(join(skillDir, "references/pick-signal-routing.md")));
  });

  it("pick-signal script exists and query-notebook path is referenced (Story 52-1)", () => {
    assert.ok(existsSync(pickSignalScriptPath));
    assert.ok(existsSync(queryNotebookScriptPath));
    const taskBody = readFileSync(taskPromptPath, "utf8");
    assert.ok(taskBody.includes("notebook-query/scripts/query-notebook.mjs"));
  });

  it("task-prompt Source 4 arXiv, Source 5 HackerNews, Source 7 GitHub, Source 8 Reddit, Source 9 RSS (Story 61-1, 61-4, 65-1, 65-3, 65-4)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const source4End = taskBody.indexOf("## Source 5");
    const source4 = taskBody.slice(taskBody.indexOf("## Source 4"), source4End);
    assert.ok(source4.includes("hermes-run-arxiv.sh"));
    assert.ok(source4.includes("fetch-arxiv-rss.mjs") || source4.includes("papers[]"));
    assert.ok(source4.includes("**arXiv Preprints**"));

    const source5End = taskBody.indexOf("## Source 7");
    const source5 = taskBody.slice(source4End, source5End);
    assert.ok(source5.includes("hermes-run-hn.sh"));
    assert.ok(source5.includes("**HackerNews**"));
    assert.ok(source5.includes("stories[]"));

    const source7End = taskBody.indexOf("## Source 8");
    const source7 = taskBody.slice(source5End, source7End);
    assert.ok(source7.includes("hermes-run-github.sh"));
    assert.ok(source7.includes("**GitHub**"));
    assert.ok(source7.includes("repos[]"));
    assert.ok(source7.includes("continue** to Source 8"));

    const source8End = taskBody.indexOf("## Source 9");
    const source8 = taskBody.slice(source7End, source8End);
    assert.ok(source8.includes("hermes-run-reddit.sh"));
    assert.ok(source8.includes("**Reddit**"));
    assert.ok(source8.includes("posts[]"));
    assert.ok(source8.includes("sourceMetadata.upvotes"));
    assert.ok(source8.includes("continue** to Source 9"));

    const source9End = taskBody.indexOf("## Source 10");
    const source9 = taskBody.slice(source8End, source9End);
    assert.ok(source9.includes("hermes-run-rss.sh"));
    assert.ok(source9.includes("**Newsletters / RSS**"));
    assert.ok(source9.includes("entries[]"));
    assert.ok(source9.includes("sourceMetadata.publishedAt"));
    assert.ok(source9.includes("continue** to Source 10"));

    const source10End = taskBody.indexOf("## Source 11");
    const source10 = taskBody.slice(source9End, source10End);
    assert.ok(source10.includes("hermes-run-producthunt.sh"));
    assert.ok(source10.includes("**Product Hunt**"));
    assert.ok(source10.includes("launches[]"));
    assert.ok(source10.includes("sourceMetadata.upvotes"));
    assert.ok(source10.includes("continue** to Source 11"));

    const source11End = taskBody.indexOf("## Source 12");
    const source11 = taskBody.slice(source10End, source11End);
    assert.ok(source11.includes("hermes-run-x.sh"));
    assert.ok(source11.includes("**X / Twitter**"));
    assert.ok(source11.includes("posts[]"));
    assert.ok(source11.includes("sourceMetadata.likes"));
    assert.ok(source11.includes("continue** to Source 12"));

    const source12End = taskBody.indexOf("## Source 6");
    const source12 = taskBody.slice(source11End, source12End);
    assert.ok(source12.includes("hermes-run-bluesky.sh"));
    assert.ok(source12.includes("**Bluesky**"));
    assert.ok(source12.includes("posts[]"));
    assert.ok(source12.includes("sourceMetadata.likes"));
    assert.ok(source12.includes("continue** to Source 6"));

    const source6 = taskBody.slice(source12End);
    assert.ok(source6.includes("DIGEST_SOURCES_JSON=<shellQuote"));
    assert.ok(source6.includes("buildDigestSignals"));
    assert.ok(source6.includes("perplexityText"));
    assert.ok(source6.includes('"arxiv"'));
    assert.ok(source6.includes('"hackernews"'));
    assert.ok(source6.includes('"reddit"'));
    assert.ok(source6.includes('"rss"'));
    assert.ok(source6.includes('"producthunt"'));
    assert.ok(source6.includes('"twitter"'));
    assert.ok(source6.includes('"bluesky"'));
    assert.ok(source6.includes("RSS title (up to 1,"));
    assert.ok(source6.includes("Product Hunt launch titles (up to 2,"));
    assert.ok(source6.includes("X / Twitter post titles (up to 2,"));
    assert.ok(source6.includes("Bluesky post titles (up to 2,"));
    assert.ok(source6.includes('"trends"'));
    assert.ok(source6.includes('"headlines"'));
    assert.ok(source6.includes("arXiv titles (up to 3)"));
    assert.ok(source6.includes("HackerNews titles (up to 3)"));
    assert.ok(
      source6.includes("Do **not** hand-build a `SIGNALS_JSON` array"),
    );
    const skillBody = readFileSync(skillPath, "utf8");
    assert.ok(skillBody.includes("DIGEST_SOURCES_JSON"));
    assert.ok(skillBody.includes("arxiv"));
    assert.ok(skillBody.includes("hackernews"));
    assert.ok(skillBody.includes("hermes-run-rss.sh"));
    assert.ok(skillBody.includes("entries[]"));
  });

  it("task-prompt documents imperative HN stdout parsing (Story 65-6)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const source5End = taskBody.indexOf("## Source 7");
    const source5 = taskBody.slice(taskBody.indexOf("## Source 5"), source5End);
    assert.ok(source5.includes("stories[]"));
    assert.ok(source5.includes("hn_json") || source5.includes("hn_stdout"));
    assert.ok(source5.includes("JSON.parse"));
    assert.ok(
      /anti-pattern|Do not read.*repos/i.test(source5),
      "must anti-pattern repos/posts/entries for HN",
    );
    assert.ok(source5.includes("continue** to Source 7"));
    assert.ok(!source5.includes("continue** to Source 6"));
    const skillBody = readFileSync(skillPath, "utf8");
    assert.ok(skillBody.includes("HackerNews stdout threading"));
    assert.ok(skillBody.includes("hn_json.stories"));
  });

  it("task-prompt documents imperative GitHub stdout parsing (Story 65-7)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const source7End = taskBody.indexOf("## Source 8");
    const source7 = taskBody.slice(taskBody.indexOf("## Source 7"), source7End);
    assert.ok(source7.includes("repos[]"));
    assert.ok(source7.includes("gh_json") || source7.includes("gh_stdout"));
    assert.ok(source7.includes("JSON.parse"));
    assert.ok(
      /anti-pattern|Do not read.*stories/i.test(source7),
      "must anti-pattern stories/posts/entries for GitHub",
    );
    assert.ok(source7.includes("continue** to Source 8"));
    const skillBody = readFileSync(skillPath, "utf8");
    assert.ok(skillBody.includes("GitHub stdout threading"));
    assert.ok(skillBody.includes("gh_json.repos"));
  });

  it("task-prompt documents imperative Reddit stdout parsing (Story 65-7)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const source8End = taskBody.indexOf("## Source 9");
    const source8 = taskBody.slice(taskBody.indexOf("## Source 8"), source8End);
    assert.ok(source8.includes("posts[]"));
    assert.ok(source8.includes("rd_json") || source8.includes("rd_stdout"));
    assert.ok(source8.includes("JSON.parse"));
    assert.ok(
      /anti-pattern|Do not read.*repos/i.test(source8),
      "must anti-pattern wrong keys for Reddit",
    );
    assert.ok(source8.includes("continue** to Source 9"));
    const skillBody = readFileSync(skillPath, "utf8");
    assert.ok(skillBody.includes("Reddit stdout threading"));
    assert.ok(skillBody.includes("rd_json.posts"));
  });

  it("task-prompt documents imperative RSS stdout parsing (Story 65-7)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const source9End = taskBody.indexOf("## Source 10");
    const source9 = taskBody.slice(taskBody.indexOf("## Source 9"), source9End);
    assert.ok(source9.includes("entries[]"));
    assert.ok(source9.includes("rss_json") || source9.includes("rss_stdout"));
    assert.ok(source9.includes("JSON.parse"));
    assert.ok(
      /anti-pattern|Do not read.*stories/i.test(source9),
      "must anti-pattern wrong keys for RSS",
    );
    assert.ok(source9.includes("continue** to Source 10"));
    const skillBody = readFileSync(skillPath, "utf8");
    assert.ok(skillBody.includes("RSS stdout threading"));
    assert.ok(skillBody.includes("rss_json.entries"));
  });

  it("task-prompt documents imperative Product Hunt stdout parsing (Story 67-5)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const source10End = taskBody.indexOf("## Source 11");
    const source10 = taskBody.slice(taskBody.indexOf("## Source 10"), source10End);
    assert.ok(source10.includes("launches[]"));
    assert.ok(source10.includes("ph_json") || source10.includes("ph_stdout"));
    assert.ok(source10.includes("JSON.parse"));
    assert.ok(
      /anti-pattern|Do not read.*repos/i.test(source10),
      "must anti-pattern wrong keys for Product Hunt",
    );
    assert.ok(source10.includes("continue** to Source 11"));
  });

  it("task-prompt documents imperative X / Twitter stdout parsing (Story 68-6)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const source11End = taskBody.indexOf("## Source 12");
    const source11 = taskBody.slice(taskBody.indexOf("## Source 11"), source11End);
    assert.ok(source11.includes("posts[]"));
    assert.ok(source11.includes("x_json") || source11.includes("x_stdout"));
    assert.ok(source11.includes("JSON.parse"));
    assert.ok(
      /anti-pattern|Do not read.*launches/i.test(source11),
      "must anti-pattern wrong keys for X / Twitter",
    );
    assert.ok(source11.includes("continue** to Source 12"));
    const skillBody = readFileSync(skillPath, "utf8");
    assert.ok(skillBody.includes("X / Twitter stdout threading"));
    assert.ok(skillBody.includes("x_json.posts"));
  });

  it("task-prompt documents imperative Bluesky stdout parsing (Story 68-5)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const source12End = taskBody.indexOf("## Source 6");
    const source12 = taskBody.slice(taskBody.indexOf("## Source 12"), source12End);
    assert.ok(source12.includes("posts[]"));
    assert.ok(source12.includes("bsky_json") || source12.includes("bsky_stdout"));
    assert.ok(source12.includes("JSON.parse"));
    assert.ok(
      /anti-pattern|Do not read.*launches/i.test(source12),
      "must anti-pattern wrong keys for Bluesky",
    );
    assert.ok(source12.includes("continue** to Source 6"));
    const skillBody = readFileSync(skillPath, "utf8");
    assert.ok(skillBody.includes("Bluesky stdout threading"));
    assert.ok(skillBody.includes("bsky_json.posts"));
  });

  it("config-snippet documents RSS env keys (Story 65-4)", () => {
    const body = readFileSync(configSnippetPath, "utf8");
    assert.ok(body.includes("MORNING_DIGEST_RSS_FEEDS"));
    assert.ok(body.includes("MORNING_DIGEST_RSS_MAX_PER_FEED"));
    assert.ok(body.includes("MORNING_DIGEST_RSS_MAX_TOTAL"));
  });

  it("wrapper scripts include GitHub, Reddit, RSS, Product Hunt, X, and Bluesky session-close runners (Story 65-1, 65-3, 65-4, 67-5, 68-5, 68-6)", () => {
    assert.ok(existsSync(githubWrapperPath));
    assert.ok(existsSync(redditWrapperPath));
    assert.ok(existsSync(rssWrapperPath));
    assert.ok(existsSync(producthuntWrapperPath));
    assert.ok(existsSync(xWrapperPath));
    assert.ok(existsSync(blueskyWrapperPath));
    assert.ok(existsSync(fetchRssScriptPath));
    assert.ok(existsSync(fetchProductHuntScriptPath));
    assert.ok(existsSync(fetchXScriptPath));
    assert.ok(existsSync(fetchBlueskyScriptPath));
    assert.ok((statSync(rssWrapperPath).mode & 0o111) !== 0);
    assert.ok((statSync(producthuntWrapperPath).mode & 0o111) !== 0);
    assert.ok((statSync(xWrapperPath).mode & 0o111) !== 0);
    assert.ok((statSync(blueskyWrapperPath).mode & 0o111) !== 0);
    const rssWrapper = readFileSync(rssWrapperPath, "utf8");
    assert.ok(rssWrapper.includes("fetch-rss-signals.mjs"));
    const producthuntWrapper = readFileSync(producthuntWrapperPath, "utf8");
    assert.ok(producthuntWrapper.includes("fetch-producthunt-launches.mjs"));
    assert.ok(producthuntWrapper.includes(".hermes/home"));
    const xWrapper = readFileSync(xWrapperPath, "utf8");
    assert.ok(xWrapper.includes("fetch-x-signals.mjs"));
    assert.ok(xWrapper.includes(".hermes/home"));
    const blueskyWrapper = readFileSync(blueskyWrapperPath, "utf8");
    assert.ok(blueskyWrapper.includes("fetch-bluesky-signals.mjs"));
    assert.ok(blueskyWrapper.includes(".hermes/home"));
  });

  it("config-snippet documents arXiv env keys (Story 61-1)", () => {
    const body = readFileSync(configSnippetPath, "utf8");
    assert.ok(body.includes("MORNING_DIGEST_ARXIV_CATEGORIES"));
    assert.ok(body.includes("MORNING_DIGEST_ARXIV_MAX_PER_CATEGORY"));
    assert.ok(body.includes("cs.AI,cs.LG,stat.ML"));
  });

  it("task-prompt documents post-post Convex log for successful Vault context (Story 52-2, 54-2)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const logStart = taskBody.indexOf("## Post-post — Log Vault context to Convex");
    const digestPushStart = taskBody.indexOf("## Post-post — Push digest entities to Convex");
    const postPost = taskBody.slice(logStart, digestPushStart > logStart ? digestPushStart : undefined);
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

  it("config-snippet documents NotebookLM title map (Story 61-2)", () => {
    const body = readFileSync(configSnippetPath, "utf8");
    assert.ok(body.includes("NOTEBOOKLM_NOTEBOOK_TITLES"));
    assert.ok(body.includes("981466f0:CNS Vault Architecture"));
    assert.ok(body.includes("dc6abf1a:AI Factory Blueprint"));
    assert.ok(body.includes("f037c741:Nexus Discord Bridge"));
    assert.ok(body.includes("trend-ingest.env"));
  });

  it("task-prompt Source 2 NewsAPI tightening (Story 64-6)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const source2End = taskBody.indexOf("## Source 3");
    const source2 = taskBody.slice(taskBody.indexOf("## Source 2"), source2End);

    assert.ok(source2.includes("fetch-newsapi-headlines.mjs"));
    assert.ok(source2.includes("searchIn=title,description"));
    assert.ok(source2.includes("MORNING_DIGEST_NEWSAPI_WINDOW_HOURS"));
    assert.ok(source2.includes('"url"'));
    assert.ok(source2.includes("isOnTopicHeadline"));
    assert.ok(!source2.includes('automation) AND NOT sports'));
  });

  it("config-snippet documents NewsAPI env keys (Story 64-6)", () => {
    const body = readFileSync(configSnippetPath, "utf8");
    assert.ok(body.includes("MORNING_DIGEST_NEWSAPI_WINDOW_HOURS"));
    assert.ok(body.includes("MORNING_DIGEST_NEWSAPI_MAX_HEADLINES"));
    assert.ok(body.includes("MORNING_DIGEST_NEWSAPI_PAGE_SIZE"));
    assert.ok(body.includes("MORNING_DIGEST_NEWSAPI_QUERY"));
    assert.ok(body.includes("MORNING_DIGEST_NEWSAPI_ENABLED"));
    assert.ok(body.includes("newsapi disabled"));
  });

  it("config-snippet documents HN env keys (Story 61-4)", () => {
    const body = readFileSync(configSnippetPath, "utf8");
    assert.ok(body.includes("MORNING_DIGEST_HN_MAX_STORIES"));
    assert.ok(body.includes("MORNING_DIGEST_HN_ENABLED"));
    assert.ok(body.includes("hackernews disabled"));
  });

  it("config-snippet documents X session cookies and --check (Story 68-7)", () => {
    const body = readFileSync(configSnippetPath, "utf8");
    assert.ok(body.includes("X_AUTH_TOKEN"));
    assert.ok(body.includes("X_CT0"));
    assert.ok(body.includes("MORNING_DIGEST_X_ENABLED"));
    assert.ok(body.includes("fetch-x-signals.mjs --check"));
    assert.ok(body.includes("hermes-run-x-check.sh"));
    assert.ok(body.includes("§15.11.1"));
  });

  it("task-prompt documents post-post digest Convex push (Story 61-5)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const postPost = taskBody.slice(
      taskBody.indexOf("## Post-post — Push digest entities to Convex"),
    );
    assert.ok(postPost.includes("push-digest-convex.mjs"));
    assert.ok(postPost.includes("DIGEST_PUSH_JSON"));
    assert.ok(postPost.includes("digest_push_payload"));
    assert.ok(postPost.includes("fire-and-forget"));
    assert.ok(postPost.includes("timeout=45"));
    assert.ok(postPost.includes("digest_convex_push"));
    assert.ok(postPost.includes("google_trends"));
    assert.ok(postPost.includes("hackernews"));
    assert.ok(!postPost.includes("Notebook history log failed"));
  });

  it("task-prompt documents post-post scoring before digest push (Story 64-5)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const preDiscord = taskBody.slice(
      taskBody.indexOf("## Pre-Discord — Build, score, and persist digest push payload"),
    );
    assert.ok(preDiscord.includes("score-digest-signals.mjs"));
    assert.ok(preDiscord.includes("DIGEST_SIGNALS_JSON"));
    assert.ok(preDiscord.includes("DIGEST_RUN_AT"));
    assert.ok(preDiscord.includes("Score signals before push"));
    assert.ok(preDiscord.includes("DIGEST_NOVELTY_HISTORY_JSON"));
    assert.ok(preDiscord.includes("rankScore"));
    assert.ok(preDiscord.includes("timeout=30"));
  });

  it("task-prompt documents cross-source dedup before scoring (Story 68-1)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const preDiscord = taskBody.slice(
      taskBody.indexOf("## Pre-Discord — Build, score, and persist digest push payload"),
      taskBody.indexOf("## Output contract (post to `#hermes`)"),
    );
    const dedupeIdx = preDiscord.indexOf("Dedupe signals before scoring");
    const scoringIdx = preDiscord.indexOf("Score signals before push");
    const artifactIdx = preDiscord.indexOf("### Persist digest push artifact");

    assert.ok(preDiscord.includes("dedupe-digest-signals.mjs"));
    assert.ok(preDiscord.includes("deduped_signals"));
    assert.ok(preDiscord.includes("digest_push_payload.signals = deduped_signals"));
    assert.ok(
      preDiscord.includes("adapters → §9 map → **dedup** → score → artifact → Discord → push"),
    );
    assert.ok(dedupeIdx >= 0 && scoringIdx > dedupeIdx);
    assert.ok(artifactIdx > scoringIdx);
    assert.ok(preDiscord.includes("dedupe-digest-signals:"));

    const skillBody = readFileSync(skillPath, "utf8");
    assert.ok(skillBody.includes("dedupe-digest-signals.mjs"));
    assert.ok(skillBody.includes("Dedupe stdout threading"));
  });

  it("task-prompt documents §9 map gate before dedupe (Story 68-9)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const preDiscord = taskBody.slice(
      taskBody.indexOf("## Pre-Discord — Build, score, and persist digest push payload"),
      taskBody.indexOf("## Output contract (post to `#hermes`)"),
    );
    const mapIdx = preDiscord.indexOf("Build `digest_push_payload.signals` from §9 map");
    const dedupeIdx = preDiscord.indexOf("Dedupe signals before scoring");

    assert.ok(mapIdx >= 0);
    assert.ok(dedupeIdx > mapIdx);
    assert.ok(preDiscord.includes("Do not invoke `dedupe-digest-signals.mjs` until"));
    assert.ok(preDiscord.includes("non-negotiable"));
    assert.ok(preDiscord.includes("adapters → Source 6 → **§9 map"));
  });

  it("task-prompt and SKILL.md invoke pick-signal-notebook with node not bash (Story 68-9)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const skillBody = readFileSync(skillPath, "utf8");

    assert.ok(taskBody.includes("PICK_SCRIPT"));
    assert.ok(taskBody.includes('node \\"$PICK_SCRIPT\\"') || taskBody.includes('node "$PICK_SCRIPT"'));
    assert.ok(!taskBody.match(/bash scripts[^\n]*pick-signal-notebook\.mjs/i));
    assert.ok(skillBody.includes("`.mjs` scripts require `node`") || skillBody.includes("Never invoke `.mjs` scripts with `bash`"));
    assert.ok(skillBody.includes('node "$PICK_SCRIPT"'));
    assert.ok(!skillBody.match(/bash scripts[^\n]*pick-signal-notebook\.mjs/i));
  });

  it("pick-signal-notebook.mjs has node shebang (Story 68-9)", () => {
    const head = readFileSync(pickSignalScriptPath, "utf8").split("\n", 2).join("\n");
    assert.ok(head.startsWith("#!/usr/bin/env node"));
  });

  it("task-prompt documents imperative scoring stdout threading (Story 64-8)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const preDiscord = taskBody.slice(
      taskBody.indexOf("## Pre-Discord — Build, score, and persist digest push payload"),
      taskBody.indexOf("## Output contract (post to `#hermes`)"),
    );
    const postPost = taskBody.slice(
      taskBody.indexOf("## Post-post — Push digest entities to Convex"),
    );
    assert.ok(preDiscord.includes("scored_signals"));
    assert.ok(preDiscord.includes("digest_push_payload.signals = scored_signals"));
    assert.ok(preDiscord.includes("JSON.parse"));
    assert.ok(preDiscord.includes("score_stdout"));
    assert.ok(
      preDiscord.includes(
        "Do not pass pre-scoring `digest_push_payload.signals` to `push-digest-convex.mjs`",
      ),
    );
    const scoringIdx = preDiscord.indexOf("Score signals before push");
    const artifactIdx = preDiscord.indexOf("### Persist digest push artifact");
    const pushIdx = postPost.indexOf("push-digest-convex.mjs");
    const dedupeIdx = preDiscord.indexOf("Dedupe signals before scoring");
    assert.ok(dedupeIdx >= 0 && scoringIdx > dedupeIdx);
    assert.ok(scoringIdx >= 0 && artifactIdx > scoringIdx);
    assert.ok(pushIdx >= 0);
    assert.ok(postPost.includes("keyword candidates terminal (same post-scoring payload)"));
  });

  it("SKILL.md documents scoring stdout threading guardrail (Story 64-8)", () => {
    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("Scoring stdout threading"));
    assert.ok(body.includes("digest_push_payload.signals = scored_signals"));
    assert.ok(body.includes("score-digest-signals.mjs"));
  });

  it("task-prompt §9 documents non-improvisable push-digest-convex terminal (Story 67-7)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const postPost = taskBody.slice(
      taskBody.indexOf("## Post-post — Push digest entities to Convex"),
      taskBody.indexOf("## Post-post — Push keyword candidates to Convex"),
    );
    const pushTerminalBlock = postPost.slice(
      postPost.indexOf("### Terminal invocation (REQUIRED — part 1 of 2 completion gate"),
      postPost.indexOf("**After terminal returns**"),
    );

    assert.ok(/DO NOT improvise/i.test(postPost));
    assert.ok(/direct.*fetch.*Convex/i.test(postPost));
    assert.ok(/MCP Convex/i.test(postPost));
    assert.ok(/hand-rolled.*node -e/i.test(postPost));
    assert.ok(/Do not push digest entities by any path other than/i.test(postPost));

    assert.match(
      pushTerminalBlock,
      /terminal\(\s*\n\s*command="PUSH_SCRIPT=<shellQuote\(push_script\)> DIGEST_PUSH_JSON=<shellQuote\(JSON\.stringify\(digest_push_payload\)\)> node \\"\$PUSH_SCRIPT\\""/,
    );
    assert.match(pushTerminalBlock, /workdir=resolved_repo_root,\s*\n\s*timeout=45/);
    assert.doesNotMatch(
      pushTerminalBlock,
      /command="DIGEST_PUSH_JSON=.*node push-digest-convex\.mjs"/,
    );
  });

  it("task-prompt Sources 9-12 terminal-fire gates (Story 67-7, 68-5, 68-6)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const checklistEnd = taskBody.indexOf("## Hard constraints");
    const checklist = taskBody.slice(
      taskBody.indexOf("## REQUIRED SOURCES — terminal checklist"),
      checklistEnd,
    );
    const source9End = taskBody.indexOf("## Source 10");
    const source9 = taskBody.slice(taskBody.indexOf("## Source 9"), source9End);
    const source10End = taskBody.indexOf("## Source 11");
    const source10 = taskBody.slice(taskBody.indexOf("## Source 10"), source10End);
    const source11End = taskBody.indexOf("## Source 12");
    const source11 = taskBody.slice(taskBody.indexOf("## Source 11"), source11End);
    const source12End = taskBody.indexOf("## Source 6");
    const source12 = taskBody.slice(source11End, source12End);
    const source6End = taskBody.indexOf("### Build `digest_sources`");
    const source6Lead = taskBody.slice(
      taskBody.indexOf("## Source 6"),
      source6End,
    );

    assert.ok(checklist.includes("hermes-run-rss.sh"));
    assert.ok(checklist.includes("hermes-run-producthunt.sh"));
    assert.ok(checklist.includes("hermes-run-x.sh"));
    assert.ok(checklist.includes("hermes-run-bluesky.sh"));
    assert.ok(
      (checklist.match(/MUST fire before Source 6/g) ?? []).length >= 4,
      "checklist rows 9, 10, 11, and 12 must all require MUST fire before Source 6",
    );
    assert.ok(
      checklist.includes("Steps 9–12 gate") &&
        checklist.includes("invalidates the run"),
    );
    assert.ok(
      source9.includes("hermes-run-rss.sh") &&
        source9.includes("has not fired, do not proceed to Source 10 or Source 6"),
    );
    assert.ok(
      source10.includes("hermes-run-producthunt.sh") &&
        source10.includes("has not fired, do not proceed to Source 11 or Source 6"),
    );
    assert.ok(
      source11.includes("hermes-run-x.sh") &&
        source11.includes("has not fired, do not proceed to Source 12 or Source 6"),
    );
    assert.ok(
      source12.includes("hermes-run-bluesky.sh") &&
        source12.includes("has not fired, do not proceed to Source 6"),
    );
    assert.ok(
      source6Lead.includes("Prerequisite:") &&
        source6Lead.includes("Do not run `pick-signal-notebook.mjs` until all four terminals complete"),
    );
  });

  it("task-prompt GitHub Discord bullets not bare URLs (Story 67-7)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const source7End = taskBody.indexOf("## Source 8");
    const source7 = taskBody.slice(taskBody.indexOf("## Source 7"), source7End);
    const outputContract = taskBody.slice(taskBody.indexOf("## Output contract"));

    assert.ok(source7.includes("DO NOT post bare URLs or link previews"));
    assert.ok(source7.includes("- owner/repo — N stars, M forks"));
    assert.ok(source7.includes("stars") && source7.includes("forks"));
    assert.ok(outputContract.includes("DO NOT post bare URLs or link previews"));
    assert.ok(outputContract.includes("- owner/repo — N stars, M forks"));
  });

  it("SKILL.md documents Story 67-7 execution guardrails", () => {
    const body = readFileSync(skillPath, "utf8");
    const executionRule = body.slice(
      body.indexOf("## Execution rule"),
      body.indexOf("## Inline task contract"),
    );
    const outputTemplate = body.slice(
      body.indexOf("Output exactly:"),
      body.indexOf("For NO_ROUTE"),
    );

    assert.ok(executionRule.includes("1 → 2 → 3 → 4 → 5 → 7 → 8 → 9 → 10 → 11 → 12 → 6"));
    assert.ok(body.includes("hermes-run-producthunt.sh"));
    assert.ok(body.includes("hermes-run-x.sh"));
    assert.ok(body.includes("hermes-run-bluesky.sh"));
    assert.ok(body.includes("§9 push — DO NOT improvise"));
    assert.ok(body.includes("hand-rolled `node -e`"));
    assert.ok(body.includes("DO NOT post bare URLs or link previews"));
    assert.ok(body.includes("Product Hunt stdout threading"));
    assert.ok(body.includes("X / Twitter stdout threading"));
    assert.ok(body.includes("Bluesky stdout threading"));
    assert.ok(body.includes("Sources 9–12 terminal-fire gate"));
    assert.ok(outputTemplate.includes("**GitHub** (trending repos)"));
    assert.ok(outputTemplate.includes("**Reddit** (hot posts)"));
    assert.ok(outputTemplate.includes("**Newsletters / RSS**"));
    assert.ok(outputTemplate.includes("**Product Hunt** (daily launches)"));
    assert.ok(outputTemplate.includes("**X / Twitter**"));
    assert.ok(outputTemplate.includes("**Bluesky**"));
    assert.ok(outputTemplate.includes("- <title> — <stars> stars, <forks> forks"));
  });

  it("task-prompt documents persist digest push artifact before Discord post (Story 67-10)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const preDiscord = taskBody.slice(
      taskBody.indexOf("## Pre-Discord — Build, score, and persist digest push payload"),
      taskBody.indexOf("## Output contract (post to `#hermes`)"),
    );
    const artifactIdx = preDiscord.indexOf("### Persist digest push artifact");
    const dedupeIdx = preDiscord.indexOf("Dedupe signals before scoring");
    const scoringIdx = preDiscord.indexOf("### Score signals before push");
    const outputIdx = taskBody.indexOf("## Output contract (post to `#hermes`)");
    const digestPushIdx = taskBody.indexOf("## Post-post — Push digest entities to Convex");

    assert.ok(dedupeIdx >= 0);
    assert.ok(scoringIdx > dedupeIdx, "dedupe must precede scoring");
    assert.ok(artifactIdx > scoringIdx, "scoring must precede artifact write");
    assert.ok(outputIdx > artifactIdx, "artifact section must appear before Output contract");
    assert.ok(digestPushIdx > outputIdx);
    assert.ok(taskBody.includes("digest-push-"));
    assert.ok(taskBody.includes("write-digest-push-artifact.mjs"));
    assert.ok(taskBody.includes("before Discord post"));
    assert.ok(
      taskBody.includes("Do not") && taskBody.includes("post to `#hermes` until this terminal returns"),
    );
    assert.ok(taskBody.includes("resolveOperatorHome"));
    assert.ok(taskBody.includes("Australia/Sydney"));
    const preDiscordIdx = taskBody.indexOf(
      "## Pre-Discord — Build, score, and persist digest push payload",
    );
    assert.ok(preDiscordIdx >= 0 && preDiscordIdx < outputIdx);
  });

  it("task-prompt documents post-post keyword candidates push after digest push (Story 62-1)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const digestIdx = taskBody.indexOf("## Post-post — Push digest entities to Convex");
    const candidatesIdx = taskBody.indexOf("## Post-post — Push keyword candidates to Convex");
    assert.ok(digestIdx >= 0);
    assert.ok(candidatesIdx > digestIdx);
    const candidatesSection = taskBody.slice(candidatesIdx);
    assert.ok(candidatesSection.includes("push-keyword-candidates.mjs"));
    assert.ok(candidatesSection.includes("DIGEST_PUSH_JSON"));
    assert.ok(candidatesSection.includes("digest_push_payload"));
    assert.ok(candidatesSection.includes("keyword_candidates_push"));
    assert.ok(candidatesSection.includes("timeout=45"));
  });

  it("trend-ingest.env.example documents arXiv env keys (Story 64-7)", () => {
    const body = readFileSync(join(root, "scripts/trend-ingest.env.example"), "utf8");
    assert.ok(body.includes("MORNING_DIGEST_ARXIV_CATEGORIES"));
    assert.ok(body.includes("MORNING_DIGEST_ARXIV_MAX_PER_CATEGORY"));
    assert.ok(body.includes("MORNING_DIGEST_ARXIV_ENABLED"));
    assert.ok(body.includes("cs.AI,cs.LG,stat.ML"));
  });

  it("task-prompt Source 4 documents arXiv defaults and escape hatch (Story 64-7)", () => {
    const taskBody = readFileSync(taskPromptPath, "utf8");
    const source4End = taskBody.indexOf("## Source 5");
    const source4 = taskBody.slice(taskBody.indexOf("## Source 4"), source4End);
    assert.ok(source4.includes("cs.AI,cs.LG,stat.ML"));
    assert.ok(source4.includes("MORNING_DIGEST_ARXIV_USE_DEFAULTS=0"));
    assert.ok(source4.includes("categories not configured"));
  });

  it("SKILL.md v1.3.0 documents six sources, digest entity push, keyword candidates push, and awaited Vault context log (Story 61-5, 62-1, 61-4, 52-2)", () => {
    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("version: 1.4.7"));
    assert.ok(body.includes("**arXiv Preprints**"));
    assert.ok(body.includes("**HackerNews**"));
    assert.ok(body.includes("hermes-run-arxiv.sh"));
    assert.ok(body.includes("hermes-run-hn.sh"));
    assert.ok(body.includes("## Pitfalls"));
    assert.ok(body.includes("pick-signal-routing.md"));
    assert.ok(body.includes("log-notebook-query.mjs"));
    assert.ok(body.includes("No trend-ingest Convex push"));
    assert.ok(body.includes("Digest entity push"));
    assert.ok(body.includes("push-digest-convex.mjs"));
    assert.ok(body.includes("push-keyword-candidates.mjs"));
    assert.ok(body.includes("keywordCandidates"));
    assert.ok(body.includes("keyword_candidates_push"));
    assert.ok(body.includes("Keyword candidates push"));
    assert.ok(body.includes("digestRuns"));
    assert.ok(body.includes("digestSignals"));
    assert.ok(body.includes("fire-and-forget"));
    assert.ok(body.includes("Vault context Convex log"));
    assert.ok(body.includes("notebook_query_log"));
    assert.ok(body.includes("timeout=15"));
    assert.ok(body.includes("digest_convex_push"));
    assert.ok(body.includes("NOTEBOOKLM_NOTEBOOK_TITLES"));
    assert.ok(body.includes("trend-ingest.py"));
  });
});
