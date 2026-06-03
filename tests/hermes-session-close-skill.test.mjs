import assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { estimateTokens } from "../scripts/session-close/lib/token-estimate.mjs";
import { SECTION8_INPUT_TOKEN_LIMIT } from "../scripts/session-close/prepare-section8-input.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillDir = join(root, "scripts/hermes-skill-examples/session-close");
const skillPath = join(skillDir, "SKILL.md");
const section8SynthesisPath = join(skillDir, "references/section8-synthesis.md");
const discordReplyTemplatePath = join(skillDir, "references/discord-reply-template.md");
const taskPromptLegacyPath = join(skillDir, "references/task-prompt.legacy.md");
const triggerPatternPath = join(skillDir, "references/trigger-pattern.md");
const dailyRhythmStaticPath = join(skillDir, "references/daily-rhythm-static-rows.md");
const fanoutDiagnosticsPath = join(skillDir, "references/fanout-diagnostics.md");
const driveExportSyncPath = join(skillDir, "references/drive-export-sync.md");
const operatorGuidePath = join(root, "Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md");


describe("Story 28.1 Hermes session-close skill mirror", () => {
  it("defines the slim skill package and install helper", () => {
    assert.ok(existsSync(skillPath));
    assert.ok(existsSync(triggerPatternPath));
    assert.ok(existsSync(section8SynthesisPath));
    assert.ok(existsSync(discordReplyTemplatePath));
    assert.ok(existsSync(taskPromptLegacyPath));
    assert.ok(existsSync(join(root, "scripts/install-hermes-skill-session-close.sh")));
    assert.ok(existsSync(join(root, "scripts/session-close/hermes-run-render-discord-reply.sh")));

    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("name: session-close"));
    assert.ok(body.includes("/session-close"));
    assert.ok(body.includes("requires_toolsets: [terminal]"));
    assert.ok(body.includes("hermes-run-session-close.sh"));
    assert.ok(
      body.includes("run-deterministic.mjs") || body.includes("hermes-run-session-close.sh"),
      "Phase A gate must reference run-deterministic entrypoint",
    );
    assert.ok(body.includes(".session-close/section8-input.json"));
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
    assert.ok(body.includes("hermes-run-render-discord-reply.sh"));
    assert.ok(body.includes("Real close"));
    assert.ok(body.includes("Dry-run"));
    assert.ok(
      body.includes("skipped in dry-run") || body.includes("skip"),
      "dry-run must skip fan-out writes",
    );
    const readOnlySection = body.slice(body.indexOf("Read **only**"), body.indexOf("**Do not read:**"));
    assert.ok(readOnlySection.includes("section8-input.json"));
    assert.ok(
      !readOnlySection.includes("task-prompt"),
      "router must not load legacy task prompt on activation",
    );
    assert.ok(
      !readOnlySection.includes("context-pack.json"),
      "full context pack must not be listed as LLM read target",
    );
    assert.ok(body.includes("Do not read:"));
    assert.ok(body.includes("AGENTS.md"));
    assert.ok(body.includes("task-prompt.legacy.md"));

    const lineCount = body.split("\n").length;
    assert.ok(lineCount <= 80, `SKILL.md has ${lineCount} lines; expected ≤80`);

    const installScript = readFileSync(join(root, "scripts/install-hermes-skill-session-close.sh"), "utf8");
    assert.ok(installScript.includes("rsync -a --delete"), "install must mirror with rsync --delete");
    assert.ok(
      installScript.includes('rm -f "$DEST_DIR/references/task-prompt.md"'),
      "cp fallback must prune stale task-prompt.md",
    );
  });

  it("documents bounded Section 8 synthesis and reply template", () => {
    const synth = readFileSync(section8SynthesisPath, "utf8");
    assert.ok(synth.includes("section8-input.json"));
    assert.ok(synth.includes("Do not read"));
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
    const fanOut = body.indexOf("Phase C");
    const watchdog = body.indexOf("nlm-auth-watchdog");
    const reply = body.indexOf("## Discord reply");
    assert.ok(fanOut >= 0, "Phase C instruction missing");
    assert.ok(watchdog > fanOut, "watchdog must be ordered after Phase C");
    assert.ok(watchdog < reply, "watchdog must run before Discord reply rendering");
    assert.ok(body.includes("best-effort"));
    assert.ok(body.includes("hermes-run-nlm-auth-watchdog.sh"));
    assert.ok(body.includes("${OMNIPOTENT_REPO:-/home/christ/ai-factory/projects/Omnipotent.md}") || body.includes("${OMNIPOTENT_REPO}/scripts/session-close/hermes-run-nlm-auth-watchdog.sh"));
    assert.ok(body.includes("--dry-run"));

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

  it("delegates fan-out to script wrappers without loading reference markdown on activation", () => {
    assert.ok(existsSync(fanoutDiagnosticsPath));
    assert.ok(existsSync(driveExportSyncPath));
    const body = readFileSync(skillPath, "utf8");
    assert.ok(body.includes("hermes-run-record-notebooklm-fanout-mode.sh"));
    assert.ok(body.includes("hermes-run-write-vault-export-to-drive.sh"));
    assert.ok(body.includes("hermes-run-sync-vault-export-drive.sh"));
    assert.ok(body.includes("hermes-run-merge-notebooklm-fanout.sh"));
    assert.ok(body.includes("drive-sync"));
    assert.ok(!body.includes("references/fanout-diagnostics.md"));
    assert.ok(!body.includes("references/drive-export-sync.md"));

    const diagnostics = readFileSync(fanoutDiagnosticsPath, "utf8");
    assert.ok(diagnostics.includes("merge-notebooklm-fanout"));
    assert.ok(diagnostics.includes("error_class"));

    const driveSync = readFileSync(driveExportSyncPath, "utf8");
    assert.ok(driveSync.includes("NOTEBOOKLM_DRIVE_DOC_ID"));

    const template = readFileSync(discordReplyTemplatePath, "utf8");
    assert.ok(template.includes("error_class"));
    assert.ok(template.includes("notebooklm_fanout_mode"));
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

describe("Story 59-1 session-close context reduction", () => {
  it("section8-input fixture stays within synthesis token cap", () => {
    const fixturePath = join(root, "tests/fixtures/session-close/section8-input-fixture.json");
    const raw = readFileSync(fixturePath, "utf8");
    assert.ok(estimateTokens(raw) <= SECTION8_INPUT_TOKEN_LIMIT);
  });

  it("SKILL body token estimate stays within 1200", () => {
    const body = readFileSync(skillPath, "utf8");
    const frontmatterEnd = body.indexOf("---", 3);
    const skillContent = frontmatterEnd >= 0 ? body.slice(frontmatterEnd + 3) : body;
    assert.ok(estimateTokens(skillContent.trim()) <= 1200);
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
