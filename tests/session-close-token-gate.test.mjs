import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, it } from "node:test";

import {
  resolveGateDraftPath,
  runGateApplySection8,
} from "../scripts/session-close/gate-apply-section8.mjs";
import {
  evaluatePhaseBDraftTokens,
  PHASE_B_ABORT_REASON,
  recordPhaseBTokenCheck,
} from "../scripts/session-close/lib/phase-b-token-gate.mjs";
import { SECTION8_DRAFT_TOKEN_LIMIT } from "../scripts/session-close/lib/token-estimate.mjs";
import { runDeterministicPipeline } from "../scripts/session-close/run-deterministic.mjs";

const RHYTHM_FIXTURE = `# CNS Daily Rhythm (fixture)

<!-- AUTO:PROVIDER -->seed-provider<!-- /AUTO:PROVIDER -->
<!-- AUTO:VAULT_NOTES -->0<!-- /AUTO:VAULT_NOTES -->
<!-- AUTO:VAULT_HEALTH -->seed-health<!-- /AUTO:VAULT_HEALTH -->
<!-- AUTO:SPRINT -->seed-sprint<!-- /AUTO:SPRINT -->
<!-- AUTO:AGENTS_VERSION -->v0.0.0<!-- /AUTO:AGENTS_VERSION -->
<!-- AUTO:SKILLS_COUNT -->0 available<!-- /AUTO:SKILLS_COUNT -->
<!-- AUTO:TESTS -->seed-tests<!-- /AUTO:TESTS -->
<!-- AUTO:LAST_SESSION -->1970-01-01<!-- /AUTO:LAST_SESSION -->
<!-- AUTO:ACTIVE_PROJECTS -->
| Project | Status | Next action |
|---|---|---|
| Seed | seed | seed |
<!-- /AUTO:ACTIVE_PROJECTS -->
<!-- AUTO:DEFERRED_SUMMARY -->
| Item | Priority | Class |
|---|---|---|
| Seed | P9 | (b) seed |
<!-- /AUTO:DEFERRED_SUMMARY -->
<!-- AUTO:ROADMAP -->
| Epic | Theme | Status |
|---|---|---|
| 38 | Seed | seed |
<!-- /AUTO:ROADMAP -->

*Last auto-update: 1970-01-01 | AGENTS.md 0.0.0 | Provider: seed/seed*
`;

const SAMPLE_STATIC_ROWS = `# static

## Active projects — operator business rows

| Project | Status | Next action |
|---|---|---|
| LinkedIn Profile System | ready | Deploy |

## Roadmap — epic theme fallbacks

| Epic key | Theme fallback | Status fallback |
|---|---|---|
| epic-39 | VPS Deployment | deferred |
`;

const SAMPLE_DEFERRED = `# Deferred work

## Summary table

| Item (short) | Class |
|--------------|-------|
| Vault-lint Rule 2 filename-stem matching | (b) Phase 2 backlog |
`;

const SAMPLE_AGENTS = `# AGENTS

> Version: 9.9.9 | Last updated: 2026-01-01

## 8. Current Focus

> intro

### Project Status

- epic-1: in-progress

### Current Priorities

1. Reconcile sprint state for Epic 48.

## 9. Agent Behavior Guidelines

rules

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-01-01 | 9.9.9 | fixture row |
`;

const SAMPLE_SPRINT = `development_status:
  epic-48: in-progress
  48-1-session-close-context-pack-scaffold: ready-for-dev
`;

const execFileAsync = promisify(execFile);

async function seedMinimalSessionCloseFixture(root, vault) {
  const artifacts = join(root, "_bmad-output", "implementation-artifacts");
  const specsAgents = join(root, "specs/cns-vault-contract");
  await mkdir(join(vault, "AI-Context"), { recursive: true });
  await mkdir(artifacts, { recursive: true });
  await mkdir(specsAgents, { recursive: true });
  await mkdir(join(root, "scripts"), { recursive: true });
  await writeFile(join(vault, "AI-Context", "AGENTS.md"), SAMPLE_AGENTS, "utf8");
  await writeFile(join(specsAgents, "AGENTS.md"), SAMPLE_AGENTS, "utf8");
  await writeFile(join(artifacts, "sprint-status.yaml"), SAMPLE_SPRINT, "utf8");
  await writeFile(join(root, "scripts", "export-vault-for-notebooklm.sh"), "#!/bin/bash\n", "utf8");
}

async function seedPhaseAArtifacts(root, vault) {
  await seedMinimalSessionCloseFixture(root, vault);
  const planning = join(root, "_bmad-output", "planning-artifacts");
  const skillRefs = join(root, "scripts/hermes-skill-examples/session-close/references");
  await mkdir(planning, { recursive: true });
  await mkdir(skillRefs, { recursive: true });
  await mkdir(join(vault, "_meta", "reports"), { recursive: true });
  await writeFile(join(vault, "AI-Context", "CNS-Daily-Rhythm.md"), RHYTHM_FIXTURE, "utf8");
  await writeFile(join(root, "CLAUDE.md"), "## Phase Status\nPhase 6 complete.\n", "utf8");
  await writeFile(join(planning, "epics.md"), "### Epic 48: Session-close\n", "utf8");
  await writeFile(join(root, "_bmad-output", "implementation-artifacts", "deferred-work.md"), SAMPLE_DEFERRED, "utf8");
  await writeFile(join(skillRefs, "daily-rhythm-static-rows.md"), SAMPLE_STATIC_ROWS, "utf8");
  await runDeterministicPipeline({
    dryRun: true,
    repoRoot: root,
    vaultRoot: vault,
  });
}

describe("session-close phase B token gate", () => {
  it("evaluatePhaseBDraftTokens PASSED within limit", () => {
    const draft = "short section8 fragment\n";
    const result = evaluatePhaseBDraftTokens(draft);
    assert.equal(result.status, "PASSED");
    assert.ok(result.tokens <= SECTION8_DRAFT_TOKEN_LIMIT);
  });

  it("evaluatePhaseBDraftTokens ABORTED over limit", () => {
    const huge = `### Oversized Draft\n\n${"word ".repeat(SECTION8_DRAFT_TOKEN_LIMIT * 4 + 200)}`;
    const result = evaluatePhaseBDraftTokens(huge);
    assert.equal(result.status, "ABORTED");
    assert.equal(result.reason, PHASE_B_ABORT_REASON);
    assert.ok(result.tokens > SECTION8_DRAFT_TOKEN_LIMIT);
  });

  it("recordPhaseBTokenCheck merges without clearing steps", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-gate-report-"));
    const reportPath = join(fixtureRoot, ".session-close", "close-report.json");
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    await writeFile(
      reportPath,
      `${JSON.stringify({ mode: "real", steps: { export: { status: "ok" } } })}\n`,
      "utf8",
    );

    try {
      await recordPhaseBTokenCheck(reportPath, { tokens: 42, status: "PASSED" });
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      assert.deepEqual(report.phase_b_token_check, { tokens: 42, status: "PASSED" });
      assert.equal(report.steps.export.status, "ok");
      assert.equal(report.failure_class, undefined);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("runGateApplySection8 PASSED applies AGENTS and records check", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-gate-pass-"));
    const vault = join(fixtureRoot, "vault");
    const draftPath = join(fixtureRoot, ".session-close", "section8-draft.md");
    const reportPath = join(fixtureRoot, ".session-close", "close-report.json");
    const draftFixture = join(
      import.meta.dirname,
      "fixtures/session-close/section8-draft-fragment.md",
    );
    await seedPhaseAArtifacts(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    await copyFile(draftFixture, draftPath);

    const repoAgents = join(fixtureRoot, "specs/cns-vault-contract/AGENTS.md");
    const before = await readFile(repoAgents, "utf8");

    try {
      const result = await runGateApplySection8({
        draftPath,
        dryRun: false,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
        closeReportPath: reportPath,
        dateStr: "2026-05-28",
      });
      assert.equal(result.check.status, "PASSED");
      assert.equal(result.applied, true);
      assert.equal(result.applyResult?.written, true);

      const after = await readFile(repoAgents, "utf8");
      assert.notEqual(after, before);
      assert.ok(after.includes("9.9.10"));

      const report = JSON.parse(await readFile(reportPath, "utf8"));
      assert.equal(report.phase_b_token_check.status, "PASSED");
      assert.ok(report.phase_b_token_check.tokens <= SECTION8_DRAFT_TOKEN_LIMIT);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("resolveGateDraftPath joins relative draft to repo root", () => {
    const repo = "/tmp/omnipotent-repo";
    assert.equal(
      resolveGateDraftPath(".session-close/section8-draft.md", repo),
      join(repo, ".session-close", "section8-draft.md"),
    );
    assert.equal(
      resolveGateDraftPath("/abs/section8-draft.md", repo),
      "/abs/section8-draft.md",
    );
  });

  it("runGateApplySection8 resolves relative --draft against repoRoot", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-gate-rel-draft-"));
    const vault = join(fixtureRoot, "vault");
    const reportPath = join(fixtureRoot, ".session-close", "close-report.json");
    const draftFixture = join(
      import.meta.dirname,
      "fixtures/session-close/section8-draft-fragment.md",
    );
    await seedPhaseAArtifacts(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    await copyFile(draftFixture, join(fixtureRoot, ".session-close", "section8-draft.md"));

    try {
      const result = await runGateApplySection8({
        draftPath: ".session-close/section8-draft.md",
        dryRun: false,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
        closeReportPath: reportPath,
        dateStr: "2026-05-28",
      });
      assert.equal(result.check.status, "PASSED");
      assert.equal(result.applied, true);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("gate CLI resolves --draft via OMNIPOTENT_REPO when cwd differs", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-gate-cli-cwd-"));
    const vault = join(fixtureRoot, "vault");
    const draftFixture = join(
      import.meta.dirname,
      "fixtures/session-close/section8-draft-fragment.md",
    );
    await seedPhaseAArtifacts(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    await copyFile(draftFixture, join(fixtureRoot, ".session-close", "section8-draft.md"));

    const gateScript = join(
      import.meta.dirname,
      "../scripts/session-close/gate-apply-section8.mjs",
    );
    const wrongCwd = await mkdtemp(join(tmpdir(), "session-close-gate-wrong-cwd-"));

    try {
      const { stdout } = await execFileAsync(
        "node",
        [gateScript, "--draft", ".session-close/section8-draft.md"],
        {
          cwd: wrongCwd,
          env: {
            ...process.env,
            OMNIPOTENT_REPO: fixtureRoot,
            CNS_VAULT_ROOT: vault,
          },
        },
      );
      assert.match(stdout, /phase B token check PASSED/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
      await rm(wrongCwd, { recursive: true, force: true });
    }
  });

  it("gate CLI exits 1 on ABORT with stderr message", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-gate-cli-abort-"));
    const vault = join(fixtureRoot, "vault");
    await seedPhaseAArtifacts(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    const huge = `### Oversized Draft\n\n${"word ".repeat(SECTION8_DRAFT_TOKEN_LIMIT * 4 + 200)}`;
    await writeFile(join(fixtureRoot, ".session-close", "section8-draft.md"), huge, "utf8");

    const gateScript = join(
      import.meta.dirname,
      "../scripts/session-close/gate-apply-section8.mjs",
    );

    try {
      await assert.rejects(
        () =>
          execFileAsync("node", [gateScript, "--draft", ".session-close/section8-draft.md"], {
            cwd: fixtureRoot,
            env: {
              ...process.env,
              OMNIPOTENT_REPO: fixtureRoot,
              CNS_VAULT_ROOT: vault,
            },
          }),
        (err) => {
          assert.equal(err.code, 1);
          assert.match(String(err.stderr), /phase B token check ABORTED/);
          return true;
        },
      );
      const report = JSON.parse(
        await readFile(join(fixtureRoot, ".session-close", "close-report.json"), "utf8"),
      );
      assert.equal(report.phase_b_token_check.status, "ABORTED");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("runGateApplySection8 auto-runs Phase A when artifacts missing", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-gate-retry-phase-a-"));
    const vault = join(fixtureRoot, "vault");
    const draftFixture = join(
      import.meta.dirname,
      "fixtures/session-close/section8-draft-fragment.md",
    );
    await seedPhaseAArtifacts(fixtureRoot, vault);
    await rm(join(fixtureRoot, ".session-close"), { recursive: true, force: true });
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    await copyFile(draftFixture, join(fixtureRoot, ".session-close", "section8-draft.md"));

    try {
      const result = await runGateApplySection8({
        draftPath: ".session-close/section8-draft.md",
        dryRun: true,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
      });
      assert.equal(result.check.status, "PASSED");
      assert.equal(result.applied, true);
      await access(join(fixtureRoot, ".session-close", "context-pack.json"));
      await access(join(fixtureRoot, ".session-close", "close-report.json"));
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("runGateApplySection8 ABORTED skips apply and records check", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-gate-abort-"));
    const vault = join(fixtureRoot, "vault");
    const draftPath = join(fixtureRoot, ".session-close", "section8-draft.md");
    const reportPath = join(fixtureRoot, ".session-close", "close-report.json");
    await seedPhaseAArtifacts(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    const huge = `### Oversized Draft\n\n${"word ".repeat(SECTION8_DRAFT_TOKEN_LIMIT * 4 + 200)}`;
    await writeFile(draftPath, huge, "utf8");

    const repoAgents = join(fixtureRoot, "specs/cns-vault-contract/AGENTS.md");
    const before = await readFile(repoAgents, "utf8");

    try {
      const result = await runGateApplySection8({
        draftPath,
        dryRun: false,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
        closeReportPath: reportPath,
      });
      assert.equal(result.check.status, "ABORTED");
      assert.equal(result.applied, false);
      assert.equal(result.applyResult, undefined);

      const after = await readFile(repoAgents, "utf8");
      assert.equal(after, before);

      const report = JSON.parse(await readFile(reportPath, "utf8"));
      assert.equal(report.phase_b_token_check.status, "ABORTED");
      assert.equal(report.phase_b_token_check.reason, PHASE_B_ABORT_REASON);
      assert.ok(report.phase_b_token_check.tokens > SECTION8_DRAFT_TOKEN_LIMIT);
      assert.ok(!report.failure_class);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
