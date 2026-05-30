import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/session-close");
const skillPath = join(skillDir, "SKILL.md");
const section8SynthesisPath = join(skillDir, "references/section8-synthesis.md");
const discordReplyTemplatePath = join(skillDir, "references/discord-reply-template.md");
const taskPromptLegacyPath = join(skillDir, "references/task-prompt.legacy.md");
const triggerPatternPath = join(skillDir, "references/trigger-pattern.md");
const dailyRhythmStaticPath = join(skillDir, "references/daily-rhythm-static-rows.md");
const operatorGuidePath = join(root, "Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md");


describe("Story 28.1 Hermes session-close skill mirror", () => {
  it("defines the slim skill package and install helper", () => {
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(triggerPatternPath));
    assert.ok(existsSync(section8SynthesisPath));
    assert.ok(existsSync(discordReplyTemplatePath));
    assert.ok(existsSync(taskPromptLegacyPath));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-session-close.sh")));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: session-close"));
    assert.ok(body.includes("/session-close"));
    assert.ok(body.includes("requires_toolsets: [terminal]"));
    assert.ok(body.includes("run-deterministic.mjs"));
    assert.ok(body.includes(".session-close/context-pack.json"));
    assert.ok(body.includes("section8-draft.md"));
    assert.ok(body.includes("gate-apply-section8.mjs"));
    assert.ok(body.includes("phase B token check ABORTED"));
    assert.ok(body.includes("phase_b_token_check"));
    assert.ok(body.includes("relative to `OMNIPOTENT_REPO`"));
    assert.ok(
      !body.includes("scripts/session-close/apply-section8.mjs"),
      "Phase B must invoke gate-apply-section8, not apply-section8 directly",
    );
    assert.ok(body.includes("close-report.json"));
    assert.ok(body.includes("title: \"My Knowledge Base\""));
    assert.ok(body.includes("Real close only"));
    assert.ok(body.includes("Dry-run must not call `source_add`"));
    assert.ok(!body.includes("references/task-prompt"), "router must not load legacy task prompt on activation");

    const installScript = readFileSync(join(root, "scripts/install-hermes-skill-session-close.sh"), "utf8");
    assert.ok(installScript.includes("references/discord-reply-template.md"));
  });

  it("documents bounded Section 8 synthesis and reply template", () => {
    const synth = readFileSync(section8SynthesisPath, "utf8");
    assert.ok(synth.includes("context-pack.json"));
    assert.ok(synth.includes("section8-draft.md"));
    assert.ok(synth.includes("≤ 1,500"));
    assert.ok(synth.includes("Do not invent epics"));

    const reply = readFileSync(discordReplyTemplatePath, "utf8");
    assert.ok(reply.includes("close-report.json"));
    assert.ok(reply.includes("Session close complete"));
    assert.ok(reply.includes("NotebookLM targets"));
  });

  it("documents nlm auth watchdog after NotebookLM fan-out as non-blocking", () => {
    const body = readFileSync(skillPath, "utf8");
    const fanOut = body.indexOf("Real close only: for NotebookLM");
    const watchdog = body.indexOf("nlm auth watchdog");
    const reply = body.indexOf("Render the Discord reply");
    assert.ok(fanOut >= 0, "NotebookLM fan-out instruction missing");
    assert.ok(watchdog > fanOut, "watchdog must be ordered after NotebookLM fan-out");
    assert.ok(watchdog < reply, "watchdog result must be recorded before final reply rendering");
    assert.ok(body.includes("non-blocking"));
    assert.ok(body.includes("hermes-run-nlm-auth-watchdog.sh"));
    assert.ok(body.includes("${OMNIPOTENT_REPO:-/home/christ/ai-factory/projects/Omnipotent.md}"));
    assert.ok(body.includes("--dry-run"));
    assert.ok(body.includes("Treat NotebookLM fan-out as best-effort"));
    assert.ok(body.includes("always continue to the auth watchdog"));
    assert.ok(body.includes("partial or failed"));

    const template = readFileSync(discordReplyTemplatePath, "utf8");
    assert.ok(template.includes("nlm_auth"));
    assert.ok(template.includes("nlm auth warning"));
    assert.ok(template.includes("run nlm login"));
    assert.ok(template.includes("missing-cli"));
    assert.ok(template.includes("timeout"));
    assert.ok(template.includes("unauthenticated"));
    assert.ok(template.includes("check-failed"));
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
    assert.ok(body.includes("### 15.4 Session close (`/session-close`, Epic 48)"));
    assert.ok(body.includes("Section 8"));
    assert.ok(body.includes("NotebookLM"));
    assert.ok(body.includes("session-close"));
    assert.ok(body.includes("Do not use Vault IO mutators for `AI-Context/AGENTS.md`"));
  });
});

describe("Story 43.1 CNS-Daily-Rhythm AUTO blocks via session-close", () => {
  it("defines Step 6.7, static rows, and all AUTO markers", () => {
    assert.ok(existsSync(dailyRhythmStaticPath));
    const staticBody = readFileSync(dailyRhythmStaticPath, "utf8");
    assert.ok(staticBody.includes("## Active projects — operator business rows"));
    assert.ok(staticBody.includes("LinkedIn Profile System"));
    assert.ok(staticBody.includes("## Roadmap — epic theme fallbacks"));

    // Step 6.7 is now enforced by scripts/session-close tests, not by a monolithic skill prompt.
  });

  it("forbids Vault IO mutators for CNS-Daily-Rhythm path", () => {
    const body = readFileSync(taskPromptLegacyPath, "utf8");
    const step67 = body.slice(body.indexOf("## Step 6.7"), body.indexOf("## Step 7:"));
    assert.ok(step67.includes("Do **not** call `vault_create_note`"));
    for (const forbidden of ["vault_create_note", "vault_update_frontmatter", "vault_append_daily", "vault_log_action"]) {
      assert.ok(step67.includes(forbidden), `Step 6.7 must forbid ${forbidden}`);
    }
  });

  it("SKILL.md does not include retired Step 6.7 generation prose", () => {
    const body = readFileSync(skillPath, "utf8");
    assert.ok(!body.includes("## Step 6.7"));
    assert.ok(!body.includes("AUTO:xxx"));
    assert.ok(!body.includes("hermes_tools.read_file"));
  });

  it("operator guide documents Step 6.7 and no git commit in session-close", () => {
    const body = readFileSync(operatorGuidePath, "utf8");
    assert.ok(body.includes("43-1-cns-daily-rhythm-auto-blocks-via-session-close"));
    assert.ok(body.includes("Step 6.7"));
    assert.ok(body.includes("CNS-Daily-Rhythm.md"));
    assert.ok(body.includes("does **not** run `git commit`"));
  });
});
