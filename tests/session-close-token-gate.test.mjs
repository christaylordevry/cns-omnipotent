import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

describe("session-close phase B token gate", () => {
  it("evaluatePhaseBDraftTokens PASSED within limit", () => {
    const draft = "short section8 fragment\n";
    const result = evaluatePhaseBDraftTokens(draft);
    assert.equal(result.status, "PASSED");
    assert.ok(result.tokens <= SECTION8_DRAFT_TOKEN_LIMIT);
  });

  it("evaluatePhaseBDraftTokens ABORTED over limit", () => {
    const huge = "word ".repeat(SECTION8_DRAFT_TOKEN_LIMIT * 4 + 200);
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
    await seedMinimalSessionCloseFixture(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    await copyFile(draftFixture, draftPath);
    await writeFile(reportPath, `${JSON.stringify({ mode: "real" })}\n`, "utf8");

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
    await seedMinimalSessionCloseFixture(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    await copyFile(draftFixture, join(fixtureRoot, ".session-close", "section8-draft.md"));
    await writeFile(reportPath, `${JSON.stringify({ mode: "real" })}\n`, "utf8");

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
    await seedMinimalSessionCloseFixture(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    await copyFile(draftFixture, join(fixtureRoot, ".session-close", "section8-draft.md"));
    await writeFile(
      join(fixtureRoot, ".session-close", "close-report.json"),
      `${JSON.stringify({ mode: "real" })}\n`,
      "utf8",
    );

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
    await seedMinimalSessionCloseFixture(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    const huge = "word ".repeat(SECTION8_DRAFT_TOKEN_LIMIT * 4 + 200);
    await writeFile(join(fixtureRoot, ".session-close", "section8-draft.md"), huge, "utf8");
    await writeFile(
      join(fixtureRoot, ".session-close", "close-report.json"),
      `${JSON.stringify({ mode: "real" })}\n`,
      "utf8",
    );

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

  it("runGateApplySection8 ABORTED skips apply and records check", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-gate-abort-"));
    const vault = join(fixtureRoot, "vault");
    const draftPath = join(fixtureRoot, ".session-close", "section8-draft.md");
    const reportPath = join(fixtureRoot, ".session-close", "close-report.json");
    await seedMinimalSessionCloseFixture(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    const huge = "word ".repeat(SECTION8_DRAFT_TOKEN_LIMIT * 4 + 200);
    await writeFile(draftPath, huge, "utf8");
    await writeFile(reportPath, `${JSON.stringify({ mode: "real" })}\n`, "utf8");

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
      assert.equal(report.failure_class, undefined);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
