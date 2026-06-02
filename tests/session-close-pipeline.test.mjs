import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, URL } from "node:url";
import { promisify } from "node:util";

import {
  parseApplySection8Argv,
  recordSection8Failure,
  runApplySection8,
} from "../scripts/session-close/apply-section8.mjs";
import {
  applySection8ToAgentsText,
  bumpPatchVersion,
  normalizeSection8Draft,
  replaceSection8InAgents,
} from "../scripts/session-close/lib/apply-section8-body.mjs";

import { buildContextPack } from "../scripts/session-close/prepare-context.mjs";
import {
  buildCloseReport,
  buildNotebookHealthRows,
  enrichNotebooklmTargets,
  ensurePhaseAComplete,
  evaluatePhaseACompletion,
  mapFanoutTargetToHealthFields,
  parseKeyValueEnv,
  parseVitestTestsSummary,
  pushNotebookHealthSnapshot,
  runDeterministicPipeline,
} from "../scripts/session-close/run-deterministic.mjs";
import { runRefreshDailyRhythm } from "../scripts/session-close/refresh-daily-rhythm.mjs";
import {
  formatNlmAuthWarning,
  mergeNlmAuthIntoCloseReport,
  resolveNlmCommand,
  runNlmAuthWatchdog,
} from "../scripts/session-close/lib/nlm-auth-watchdog.mjs";
import { replaceAuto, applyAutoMarkers } from "../scripts/session-close/lib/replace-auto.mjs";
import {
  AUTO_MARKER_TAGS,
  buildAutoMarkerValues,
  buildSprintNarrative,
} from "../scripts/session-close/lib/rhythm-markers.mjs";
import { buildMemoryMarkdown } from "../scripts/session-close/lib/write-memory-body.mjs";
import { runWriteMemory } from "../scripts/session-close/write-memory.mjs";
import {
  buildActiveEpics,
  excerptStoryBullet,
  notebookTargetsFromWatchRegistry,
  parseAgentsSection8,
  parseDevelopmentStatus,
  readNotebookLmTargets,
} from "../scripts/session-close/lib/read-sources.mjs";
import {
  enforceTokenBudget,
  estimateTokens,
  PACK_TOKEN_LIMIT,
  SECTION8_DRAFT_TOKEN_LIMIT,
  SECTION8_EXCERPT_LIMIT,
  truncateToTokens,
} from "../scripts/session-close/lib/token-estimate.mjs";

const execFileAsync = promisify(execFile);
const TEST_ROOT = fileURLToPath(new URL("..", import.meta.url));
const NLM_AUTH_WATCHDOG_SCRIPT = join(TEST_ROOT, "scripts/session-close/lib/nlm-auth-watchdog.mjs");
const NLM_AUTH_WATCHDOG_WRAPPER = join(TEST_ROOT, "scripts/session-close/hermes-run-nlm-auth-watchdog.sh");

const REQUIRED_PACK_KEYS = [
  "generated_at",
  "mode",
  "repo_root",
  "vault_root",
  "agents",
  "sprint",
  "recent_stories",
  "deterministic",
  "notebooklm_targets",
  "token_budget",
];

const SAMPLE_AGENTS = `# AGENTS

> Version: 9.9.9 | Last updated: 2026-01-01

## 8. Current Focus

> intro

### Project Status

- epic-1: in-progress

### Current Priorities

1. Reconcile sprint state for Epic 48.
2. Ship session-close SC-3 scripts.

### Recent Session Context

- 48-1-session-close: context pack scaffold shipped.
- 48-2-session-close: deterministic orchestrator shipped.
- 43-1-cns-daily-rhythm: AUTO blocks via session-close shipped.

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
  48-2-session-close-deterministic-orchestrator: ready-for-dev
  epic-37: done
`;

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

const SAMPLE_DEFERRED = `# Deferred work

## Summary table

| Item (short) | Class |
|--------------|-------|
| Vault-lint Rule 2 filename-stem matching | (b) Phase 2 backlog |
| normalizeAbsolute duplicated | (b) Phase 2 hygiene |
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

describe("session-close token estimate", () => {
  it("uses ceil(length/4) consistent with fast-scan", () => {
    assert.equal(estimateTokens("abcd"), 1);
    assert.equal(estimateTokens("a".repeat(8)), 2);
  });

  it("truncates section8 excerpt to 1200 tokens before pack enforcement", () => {
    const long = "x".repeat(SECTION8_EXCERPT_LIMIT * 4 + 100);
    const truncated = truncateToTokens(long, SECTION8_EXCERPT_LIMIT);
    assert.ok(estimateTokens(truncated) <= SECTION8_EXCERPT_LIMIT);
    assert.ok(truncated.length < long.length);
  });

  it("drops section8 before sprint epics when pack exceeds limit", () => {
    const pack = {
      agents: { section8_excerpt: "s".repeat(20_000), version: "1.0.0" },
      sprint: {
        active_epics: [{ id: "epic-48", status: "in-progress", stories: ["48-1 ready-for-dev"] }],
        project_status_line: "Phase 6 complete",
      },
      recent_stories: [{ basename: "48-1-x", title: "T", status: "ready-for-dev", bullet: "b".repeat(8000) }],
      deterministic: {},
      notebooklm_targets: [],
    };
    const beforeEpics = JSON.parse(JSON.stringify(pack.sprint.active_epics));
    const enforced = enforceTokenBudget(pack, 500);
    assert.equal(enforced.agents.section8_excerpt, "");
    assert.deepEqual(enforced.sprint.active_epics, beforeEpics);
    assert.ok(enforced.token_budget.pack_tokens <= 500);
    assert.ok(enforced.recent_stories[0].bullet.length < 8000);
  });

  it("guarantees pack_tokens <= PACK_TOKEN_LIMIT under adversarial notebooklm payload", () => {
    const pack = {
      agents: { section8_excerpt: "x".repeat(5000), version: "1.0.0", changelog_anchor_row: null },
      sprint: {
        active_epics: [{ id: "epic-48", status: "in-progress", stories: ["48-1 review"] }],
        project_status_line: "Phase 6 complete; Epics 48 in progress",
      },
      recent_stories: [
        { basename: "48-1-x", title: "T", status: "review", bullet: "b".repeat(500) },
      ],
      deterministic: {
        export_path: "/very/long/path/scripts/output/vault-export-for-notebooklm.md",
        hermes_provider: "provider / model-name",
        vault_lint: { scanned: 1, clean: 1, errors: 0, warnings: 0, stale: false },
      },
      notebooklm_targets: Array.from({ length: 80 }, (_, i) => ({
        notebook_id: "00000000-0000-4000-8000-000000000001",
        title: `Notebook ${"title ".repeat(20)}${i}`,
      })),
      token_budget: { pack_tokens: 0, pack_limit: PACK_TOKEN_LIMIT },
    };
    const beforeEpics = JSON.parse(JSON.stringify(pack.sprint.active_epics));
    const enforced = enforceTokenBudget(pack, PACK_TOKEN_LIMIT);
    assert.deepEqual(enforced.sprint.active_epics, beforeEpics);
    assert.ok(enforced.token_budget.pack_tokens <= PACK_TOKEN_LIMIT);
  });
});

describe("session-close read-sources", () => {
  it("parses development_status in file order", () => {
    const entries = parseDevelopmentStatus(SAMPLE_SPRINT);
    assert.deepEqual(entries.map((e) => e.key), [
      "epic-48",
      "48-1-session-close-context-pack-scaffold",
      "48-2-session-close-deterministic-orchestrator",
      "epic-37",
    ]);
  });

  it("builds active epics with notable story keys", () => {
    const active = buildActiveEpics(parseDevelopmentStatus(SAMPLE_SPRINT));
    assert.equal(active.length, 1);
    assert.equal(active[0].id, "epic-48");
    assert.ok(active[0].stories.some((s) => s.includes("48-1-session-close")));
    assert.ok(active[0].stories.some((s) => s.includes("ready-for-dev")));
  });

  it("extracts section8 between ## 8. and ## 9.", () => {
    const { version, section8, changelogAnchorRow } = parseAgentsSection8(SAMPLE_AGENTS);
    assert.equal(version, "9.9.9");
    assert.ok(section8.startsWith("## 8."));
    assert.ok(!section8.includes("## 9."));
    assert.ok(changelogAnchorRow?.includes("9.9.9"));
  });

  it("caps story bullets at 200 characters", () => {
    const raw = `# Story\n\nStatus: review\n\n${"word ".repeat(80)}`;
    const bullet = excerptStoryBullet(raw, 200);
    assert.ok(bullet.length <= 200);
  });

  it("reads NotebookLM env file targets with upload file metadata", async () => {
    const oldHome = process.env.HOME;
    const oldIds = process.env.NOTEBOOKLM_NOTEBOOK_IDS;
    const home = await mkdtemp(join(tmpdir(), "session-close-home-"));

    try {
      delete process.env.NOTEBOOKLM_NOTEBOOK_IDS;
      process.env.HOME = home;
      await mkdir(join(home, ".hermes"), { recursive: true });
      await writeFile(
        join(home, ".hermes", "session-close.env"),
        [
          "NOTEBOOKLM_NOTEBOOK_IDS=981466f0-de1c-4551-93a9-f3bc2a24b184,dc6abf1a-99d2-428d-af63-107591ff2c2e,f037c741-f7e1-4a90-880f-d2d38986767b",
          "",
        ].join("\n"),
        "utf8",
      );

      const targets = await readNotebookLmTargets("/fake/vault", "/fake/export.md");
      assert.deepEqual(targets, [
        {
          notebook_id: "981466f0-de1c-4551-93a9-f3bc2a24b184",
          source_name: "CNS Vault Export",
          source_type: "file",
          file_path: "/fake/export.md",
        },
        {
          notebook_id: "dc6abf1a-99d2-428d-af63-107591ff2c2e",
          source_name: "CNS Vault Export",
          source_type: "file",
          file_path: "/fake/export.md",
        },
        {
          notebook_id: "f037c741-f7e1-4a90-880f-d2d38986767b",
          source_name: "CNS Vault Export",
          source_type: "file",
          file_path: "/fake/export.md",
        },
      ]);
    } finally {
      if (oldHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = oldHome;
      }
      if (oldIds === undefined) {
        delete process.env.NOTEBOOKLM_NOTEBOOK_IDS;
      } else {
        process.env.NOTEBOOKLM_NOTEBOOK_IDS = oldIds;
      }
      await rm(home, { recursive: true, force: true });
    }
  });

  it("uses watch:true registry entries when env IDs are unset", async () => {
    const oldHome = process.env.HOME;
    const oldIds = process.env.NOTEBOOKLM_NOTEBOOK_IDS;
    const dir = await mkdtemp(join(tmpdir(), "notebook-registry-fanout-"));
    const home = await mkdtemp(join(tmpdir(), "session-close-home-"));
    const registryPath = join(dir, "notebook-registry.json");
    const watchedId = "981466f0-de1c-4551-93a9-f3bc2a24b184";
    const unwatchedId = "dc6abf1a-99d2-428d-af63-107591ff2c2e";

    try {
      delete process.env.NOTEBOOKLM_NOTEBOOK_IDS;
      process.env.HOME = home;
      await writeFile(
        registryPath,
        `${JSON.stringify(
          [
            {
              id: watchedId,
              title: "CNS Vault Architecture",
              watch: true,
              domain: "cns-brain",
              last_updated: null,
            },
            {
              id: unwatchedId,
              title: "Other notebook",
              watch: false,
              domain: "general",
              last_updated: null,
            },
          ],
          null,
          2,
        )}\n`,
        "utf8",
      );

      const targets = await readNotebookLmTargets("/fake/vault", "/fake/export.md", {
        registryPath,
      });

      assert.deepEqual(targets, [
        {
          notebook_id: watchedId,
          title: "CNS Vault Architecture",
          source_name: "CNS Vault Export",
          source_type: "file",
          file_path: "/fake/export.md",
        },
      ]);
    } finally {
      if (oldHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = oldHome;
      }
      if (oldIds === undefined) {
        delete process.env.NOTEBOOKLM_NOTEBOOK_IDS;
      } else {
        process.env.NOTEBOOKLM_NOTEBOOK_IDS = oldIds;
      }
      await rm(dir, { recursive: true, force: true });
      await rm(home, { recursive: true, force: true });
    }
  });

  it("falls back to project map when registry has no watch:true rows", async () => {
    const oldHome = process.env.HOME;
    const oldIds = process.env.NOTEBOOKLM_NOTEBOOK_IDS;
    const dir = await mkdtemp(join(tmpdir(), "notebook-registry-fanout-"));
    const home = await mkdtemp(join(tmpdir(), "session-close-home-"));
    const vault = join(dir, "vault");
    const registryPath = join(dir, "notebook-registry.json");
    const mapId = "f037c741-f7e1-4a90-880f-d2d38986767b";

    try {
      delete process.env.NOTEBOOKLM_NOTEBOOK_IDS;
      process.env.HOME = home;
      await mkdir(join(vault, "03-Resources"), { recursive: true });
      await writeFile(
        join(vault, "03-Resources/NotebookLM-Project-Map.md"),
        [
          "| Project | Notebook |",
          "| --- | --- |",
          `| CNS | CNS Vault ${mapId} |`,
          "",
        ].join("\n"),
        "utf8",
      );
      await writeFile(
        registryPath,
        `${JSON.stringify([
          {
            id: "981466f0-de1c-4551-93a9-f3bc2a24b184",
            title: "Unwatched",
            watch: false,
            domain: "general",
            last_updated: null,
          },
        ])}\n`,
        "utf8",
      );

      const targets = await readNotebookLmTargets(vault, "/fake/export.md", {
        registryPath,
      });

      assert.equal(targets.length, 1);
      assert.equal(
        /** @type {{ notebook_id?: string }} */ (targets[0]).notebook_id,
        mapId,
      );
    } finally {
      if (oldHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = oldHome;
      }
      if (oldIds === undefined) {
        delete process.env.NOTEBOOKLM_NOTEBOOK_IDS;
      } else {
        process.env.NOTEBOOKLM_NOTEBOOK_IDS = oldIds;
      }
      await rm(dir, { recursive: true, force: true });
      await rm(home, { recursive: true, force: true });
    }
  });

  it("notebookTargetsFromWatchRegistry returns null when nothing is watched", () => {
    assert.equal(
      notebookTargetsFromWatchRegistry(
        [{ id: "a", title: "t", watch: false, domain: "general", last_updated: null }],
        "/export.md",
      ),
      null,
    );
  });
});

/** @param {string} root @param {string} vault */
async function seedSessionCloseFixture(root, vault) {
  const artifacts = join(root, "_bmad-output", "implementation-artifacts");
  const planning = join(root, "_bmad-output", "planning-artifacts");
  const specsAgents = join(root, "specs/cns-vault-contract");
  const skillRefs = join(
    root,
    "scripts/hermes-skill-examples/session-close/references",
  );
  await mkdir(join(vault, "AI-Context"), { recursive: true });
  await mkdir(join(vault, "_meta", "reports"), { recursive: true });
  await mkdir(join(root, "scripts"), { recursive: true });
  await mkdir(artifacts, { recursive: true });
  await mkdir(planning, { recursive: true });
  await mkdir(specsAgents, { recursive: true });
  await mkdir(skillRefs, { recursive: true });
  await writeFile(join(vault, "AI-Context", "AGENTS.md"), SAMPLE_AGENTS, "utf8");
  await writeFile(join(specsAgents, "AGENTS.md"), SAMPLE_AGENTS, "utf8");
  await writeFile(join(vault, "AI-Context", "CNS-Daily-Rhythm.md"), RHYTHM_FIXTURE, "utf8");
  await writeFile(join(artifacts, "sprint-status.yaml"), SAMPLE_SPRINT, "utf8");
  await writeFile(join(artifacts, "deferred-work.md"), SAMPLE_DEFERRED, "utf8");
  await writeFile(join(skillRefs, "daily-rhythm-static-rows.md"), SAMPLE_STATIC_ROWS, "utf8");
  await writeFile(
    join(vault, "_meta", "reports", "vault-lint-2026-05-20.md"),
    "## Summary\n\n- Scanned: 42\n- Clean: 42\n- Errors: 0\n- Warnings: 0\n",
    "utf8",
  );
  await writeFile(join(root, "scripts", "export-vault-for-notebooklm.sh"), "#!/bin/bash\n", "utf8");
  await writeFile(
    join(root, "CLAUDE.md"),
    "## Phase Status\nPhase 6 complete. Epics 48 in progress.\n",
    "utf8",
  );
  await writeFile(
    join(planning, "epics.md"),
    "### Epic 48: Session-close context reduction\n",
    "utf8",
  );
  await writeFile(
    join(artifacts, "48-1-session-close-context-pack-scaffold.md"),
    "# Story 48.1\n\nStatus: ready-for-dev\n\nShort completion note.\n",
    "utf8",
  );
}

describe("session-close run-deterministic", () => {
  it("parses vitest summary into passing count", () => {
    const out = parseVitestTestsSummary("Tests 609 passed (609)\n", "", 0);
    assert.equal(out.tests, "609 passing");
    assert.equal(out.failureClass, null);
  });

  it("marks tests failed on non-zero exit or missing regex", () => {
    const failed = parseVitestTestsSummary("no summary\n", "", 1);
    assert.equal(failed.tests, "FAILED (see session-close log)");
    assert.equal(failed.failureClass, "tests");
    const noMatch = parseVitestTestsSummary("ok\n", "", 0);
    assert.equal(noMatch.failureClass, "tests");
  });

  it("dry-run orchestrator includes memory and daily_rhythm previews", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-sc3-dry-"));
    const vault = join(fixtureRoot, "vault");
    await seedSessionCloseFixture(fixtureRoot, vault);

    try {
      const { report } = await runDeterministicPipeline({
        dryRun: true,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
      });
      assert.equal(report.steps.memory.status, "skipped");
      assert.equal(report.steps.daily_rhythm.status, "skipped");
      assert.ok(report.memory_preview);
      assert.ok(report.memory_preview.length <= 2000);
      assert.ok(report.daily_rhythm_preview);
      for (const tag of AUTO_MARKER_TAGS) {
        assert.ok(tag in report.daily_rhythm_preview, `missing preview ${tag}`);
      }
      const rhythmOnDisk = await readFile(
        join(vault, "AI-Context", "CNS-Daily-Rhythm.md"),
        "utf8",
      );
      assert.ok(rhythmOnDisk.includes("seed-provider"));
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("dry-run orchestrator writes close-report with skip flags and context pack", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-orch-dry-"));
    const vault = join(fixtureRoot, "vault");
    const reportPath = join(fixtureRoot, ".session-close", "close-report.json");
    const packPath = join(fixtureRoot, ".session-close", "context-pack.json");
    await seedSessionCloseFixture(fixtureRoot, vault);

    try {
      const { report, pack } = await runDeterministicPipeline({
        dryRun: true,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
      });

      assert.equal(report.mode, "dry-run");
      assert.equal(report.steps.export.status, "skipped");
      assert.ok(report.steps.export.message.includes("dry-run"));
      assert.equal(report.steps.fast_scan.status, "skipped");
      assert.equal(report.steps.tests.status, "skipped");
      assert.equal(report.failure_class, null);
      assert.ok("prepare_context" in report.steps);
      assert.ok(Array.isArray(report.notebooklm_targets));
      for (const row of report.notebooklm_targets) {
        assert.ok(row.export_path);
        assert.ok(!("body" in row));
      }
      assert.ok(report.deterministic.export_path);
      assert.equal(pack.mode, "dry-run");

      const onDiskReport = JSON.parse(await readFile(reportPath, "utf8"));
      const onDiskPack = JSON.parse(await readFile(packPath, "utf8"));
      assert.equal(onDiskReport.steps.export.status, "skipped");
      assert.deepEqual(onDiskReport.convex_push, {
        status: "skipped",
        rows: 0,
        reason: "dry-run",
      });
      assert.equal(onDiskPack.mode, "dry-run");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("enrichNotebooklmTargets uses pack.deterministic.export_path", () => {
    const pack = {
      deterministic: {
        export_path: "/install/scripts/output/vault-export-for-notebooklm.md",
      },
      notebooklm_targets: [{ notebook_id: "id", title: "T" }],
    };
    const enriched = enrichNotebooklmTargets(pack);
    assert.equal(enriched[0].export_path, pack.deterministic.export_path);
  });

  it("buildCloseReport omits secrets and includes failure_class", () => {
    const report = buildCloseReport({
      mode: "real",
      repoRoot: "/repo",
      vaultRoot: "/vault",
      contextPackPath: "/repo/.session-close/context-pack.json",
      steps: { export: { status: "failed", message: "boom" } },
      failureClass: "export",
      deterministic: { export_bytes: 42, tests: "609 passing" },
      notebooklm_targets: [
        { notebook_id: "00000000-0000-4000-8000-000000000001", title: "T", export_path: "/p" },
      ],
      convex_push: { status: "skipped", rows: 0, reason: "dry-run" },
    });
    assert.equal(report.failure_class, "export");
    assert.equal(report.deterministic.export_bytes, 42);
    assert.equal(report.notebooklm_targets[0].export_path, "/p");
    assert.equal(report.convex_push.status, "skipped");
    assert.ok(!JSON.stringify(report).includes("api_key"));
  });

  it("buildNotebookHealthRows includes watched and routed notebooks", () => {
    const rows = buildNotebookHealthRows(
      [
        {
          id: "watched-1",
          title: "Watched Notebook",
          watch: true,
          domain: "cns-brain",
          last_updated: "2026-05-28T15:52:05Z",
        },
        {
          id: "ignored-1",
          title: "Ignored Notebook",
          watch: false,
          domain: "learning",
          last_updated: "2026-05-28T15:52:00Z",
        },
      ],
      [
        { id: "watched-1", title: "Watched Notebook" },
        { id: "routed-1", title: "Routed Notebook" },
      ],
    );

    assert.deepEqual(rows, [
      {
        notebookId: "watched-1",
        title: "Watched Notebook",
        domain: "cns-brain",
        watch: true,
        lastUpdated: "2026-05-28T15:52:05Z",
        lastFanoutStatus: "unknown",
        lastErrorClass: null,
        lastFanoutAt: null,
      },
      {
        notebookId: "routed-1",
        title: "Routed Notebook",
        domain: "unknown",
        watch: false,
        lastUpdated: null,
        lastFanoutStatus: "unknown",
        lastErrorClass: null,
        lastFanoutAt: null,
      },
    ]);
  });

  it("mapFanoutTargetToHealthFields maps close-report fanout_status values", () => {
    const generatedAt = "2026-06-01T12:00:00.000Z";
    const at = Date.parse(generatedAt);
    assert.deepEqual(mapFanoutTargetToHealthFields({ fanout_status: "ok" }, generatedAt), {
      lastFanoutStatus: "success",
      lastErrorClass: null,
      lastFanoutAt: at,
    });
    assert.deepEqual(
      mapFanoutTargetToHealthFields(
        { fanout_status: "failed", error_class: "size_limit" },
        generatedAt,
      ),
      {
        lastFanoutStatus: "error",
        lastErrorClass: "size_limit",
        lastFanoutAt: at,
      },
    );
    assert.deepEqual(mapFanoutTargetToHealthFields(undefined, generatedAt), {
      lastFanoutStatus: "unknown",
      lastErrorClass: null,
      lastFanoutAt: null,
    });
  });

  it("buildNotebookHealthRows merges fan-out targets by notebook_id", () => {
    const generatedAt = "2026-06-01T12:00:00.000Z";
    const at = Date.parse(generatedAt);
    const rows = buildNotebookHealthRows(
      [
        {
          id: "nb-ok",
          title: "OK Notebook",
          watch: true,
          domain: "cns-brain",
          last_updated: null,
        },
        {
          id: "nb-fail",
          title: "Failed Notebook",
          watch: true,
          domain: "learning",
          last_updated: null,
        },
        {
          id: "nb-none",
          title: "No Fanout",
          watch: true,
          domain: "learning",
          last_updated: null,
        },
      ],
      [],
      [
        { notebook_id: "nb-ok", fanout_status: "ok" },
        { notebook_id: "nb-fail", fanout_status: "failed", error_class: "auth_error" },
      ],
      generatedAt,
    );

    assert.deepEqual(rows[0], {
      notebookId: "nb-ok",
      title: "OK Notebook",
      domain: "cns-brain",
      watch: true,
      lastUpdated: null,
      lastFanoutStatus: "success",
      lastErrorClass: null,
      lastFanoutAt: at,
    });
    assert.deepEqual(rows[1], {
      notebookId: "nb-fail",
      title: "Failed Notebook",
      domain: "learning",
      watch: true,
      lastUpdated: null,
      lastFanoutStatus: "error",
      lastErrorClass: "auth_error",
      lastFanoutAt: at,
    });
    assert.equal(rows[2].lastFanoutStatus, "unknown");
    assert.equal(rows[2].lastErrorClass, null);
    assert.equal(rows[2].lastFanoutAt, null);
  });

  it("pushNotebookHealthSnapshot posts Convex mutation payload when configured", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "notebook-health-push-"));
    const registryPath = join(fixtureRoot, "notebook-registry.json");
    const calls = [];
    await writeFile(
      registryPath,
      `${JSON.stringify(
        [
          {
            id: "watched-1",
            title: "Watched Notebook",
            watch: true,
            domain: "cns-brain",
            last_updated: "2026-05-28T15:52:05Z",
          },
        ],
        null,
        2,
      )}\n`,
      "utf8",
    );

    try {
      const result = await pushNotebookHealthSnapshot({
        dryRun: false,
        registryPath,
        pack: {
          notebooklm_routing: {
            notebooks: [{ id: "routed-1", title: "Routed Notebook" }],
          },
        },
        env: {
          CONVEX_URL: "https://example.convex.cloud/",
          CONVEX_DEPLOY_KEY: "deploy-key-secret",
        },
        fetchFn: async (url, init) => {
          calls.push({ url, init });
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({ status: "success" }),
          };
        },
      });

      assert.deepEqual(result, { status: "ok", rows: 2, reason: "pushed" });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://example.convex.cloud/api/mutation");
      assert.equal(calls[0].init.headers.Authorization, "Convex deploy-key-secret");
      assert.deepEqual(JSON.parse(calls[0].init.body), {
        path: "notebookHealth:upsertNotebookHealthSnapshot",
        args: {
          rows: [
            {
              notebookId: "watched-1",
              title: "Watched Notebook",
              domain: "cns-brain",
              watch: true,
              lastUpdated: "2026-05-28T15:52:05Z",
              lastFanoutStatus: "unknown",
              lastErrorClass: null,
              lastFanoutAt: null,
            },
            {
              notebookId: "routed-1",
              title: "Routed Notebook",
              domain: "unknown",
              watch: false,
              lastUpdated: null,
              lastFanoutStatus: "unknown",
              lastErrorClass: null,
              lastFanoutAt: null,
            },
          ],
        },
        format: "json",
      });
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("pushNotebookHealthSnapshot includes fan-out fields from prior close-report", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "notebook-health-fanout-"));
    const registryPath = join(fixtureRoot, "notebook-registry.json");
    const closeReportPath = join(fixtureRoot, "close-report.json");
    const generatedAt = "2026-06-01T18:30:00.000Z";
    const fanoutAt = Date.parse(generatedAt);
    const calls = [];

    await writeFile(
      registryPath,
      `${JSON.stringify([
        {
          id: "watched-1",
          title: "Watched Notebook",
          watch: true,
          domain: "cns-brain",
          last_updated: null,
        },
      ])}\n`,
      "utf8",
    );
    await writeFile(
      closeReportPath,
      `${JSON.stringify({
        generated_at: generatedAt,
        notebooklm_targets: [
          { notebook_id: "watched-1", fanout_status: "failed", error_class: "size_limit" },
        ],
      })}\n`,
      "utf8",
    );

    try {
      const result = await pushNotebookHealthSnapshot({
        dryRun: false,
        registryPath,
        closeReportPath,
        pack: {},
        env: {
          CONVEX_URL: "https://example.convex.cloud",
          CONVEX_DEPLOY_KEY: "deploy-key-secret",
        },
        fetchFn: async (url, init) => {
          calls.push({ url, init });
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({ status: "success" }),
          };
        },
      });

      assert.deepEqual(result, { status: "ok", rows: 1, reason: "pushed" });
      const body = JSON.parse(calls[0].init.body);
      assert.deepEqual(body.args.rows[0], {
        notebookId: "watched-1",
        title: "Watched Notebook",
        domain: "cns-brain",
        watch: true,
        lastUpdated: null,
        lastFanoutStatus: "error",
        lastErrorClass: "size_limit",
        lastFanoutAt: fanoutAt,
      });
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("pushNotebookHealthSnapshot skips dry-run and missing Convex env", async () => {
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ status: "success" }),
      };
    };

    const dryRunResult = await pushNotebookHealthSnapshot({
      dryRun: true,
      pack: {},
      env: {
        CONVEX_URL: "https://example.convex.cloud",
        CONVEX_DEPLOY_KEY: "deploy-key-secret",
      },
      fetchFn,
    });
    const missingEnvResult = await pushNotebookHealthSnapshot({
      dryRun: false,
      pack: {},
      env: {
        CONVEX_URL: "https://example.convex.cloud",
        TREND_INGEST_ENV: "/tmp/session-close-missing-trend-ingest.env",
      },
      fetchFn,
    });

    assert.deepEqual(dryRunResult, { status: "skipped", rows: 0, reason: "dry-run" });
    assert.deepEqual(missingEnvResult, {
      status: "skipped",
      rows: 0,
      reason: "missing-convex-env",
    });
    assert.equal(calls.length, 0);
  });

  it("pushNotebookHealthSnapshot falls back to trend-ingest env file", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "notebook-health-env-"));
    const registryPath = join(fixtureRoot, "notebook-registry.json");
    const envPath = join(fixtureRoot, "trend-ingest.env");
    const calls = [];
    await writeFile(
      registryPath,
      `${JSON.stringify([
        {
          id: "watched-1",
          title: "Watched Notebook",
          watch: true,
          domain: "cns-brain",
          last_updated: null,
        },
      ])}\n`,
      "utf8",
    );
    await writeFile(
      envPath,
      "CONVEX_URL=https://fallback.convex.cloud\nCONVEX_DEPLOY_KEY='fallback-key'\n",
      "utf8",
    );

    try {
      const result = await pushNotebookHealthSnapshot({
        dryRun: false,
        registryPath,
        pack: {},
        env: { TREND_INGEST_ENV: envPath },
        fetchFn: async (url, init) => {
          calls.push({ url, init });
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({ status: "success" }),
          };
        },
      });

      assert.deepEqual(result, { status: "ok", rows: 1, reason: "pushed" });
      assert.equal(calls[0].url, "https://fallback.convex.cloud/api/mutation");
      assert.equal(calls[0].init.headers.Authorization, "Convex fallback-key");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("pushNotebookHealthSnapshot reports empty rows without calling fetch", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "notebook-health-empty-"));
    const registryPath = join(fixtureRoot, "notebook-registry.json");
    const calls = [];
    await writeFile(registryPath, "[]\n", "utf8");

    try {
      const result = await pushNotebookHealthSnapshot({
        dryRun: false,
        registryPath,
        pack: {},
        env: {
          CONVEX_URL: "https://example.convex.cloud",
          CONVEX_DEPLOY_KEY: "deploy-key-secret",
        },
        fetchFn: async (url, init) => {
          calls.push({ url, init });
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({ status: "success" }),
          };
        },
      });

      assert.deepEqual(result, {
        status: "skipped",
        rows: 0,
        reason: "no-notebook-health-rows",
      });
      assert.equal(calls.length, 0);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("parseKeyValueEnv supports export and quoted values", () => {
    assert.deepEqual(
      parseKeyValueEnv("export CONVEX_URL=https://x.convex.cloud\nCONVEX_DEPLOY_KEY='a|b'\n"),
      {
        CONVEX_URL: "https://x.convex.cloud",
        CONVEX_DEPLOY_KEY: "a|b",
      },
    );
  });

  it("evaluatePhaseACompletion PASSED after dry-run pipeline", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-phase-a-pass-"));
    const vault = join(fixtureRoot, "vault");
    await seedSessionCloseFixture(fixtureRoot, vault);

    try {
      await runDeterministicPipeline({
        dryRun: true,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
      });
      const result = await evaluatePhaseACompletion({
        contextPackPath: join(fixtureRoot, ".session-close", "context-pack.json"),
        closeReportPath: join(fixtureRoot, ".session-close", "close-report.json"),
      });
      assert.equal(result.status, "PASSED");
      assert.equal(result.reasons.length, 0);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("evaluatePhaseACompletion INCOMPLETE when context-pack missing", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-phase-a-missing-"));
    const packPath = join(fixtureRoot, ".session-close", "context-pack.json");
    const reportPath = join(fixtureRoot, ".session-close", "close-report.json");

    try {
      const result = await evaluatePhaseACompletion({
        contextPackPath: packPath,
        closeReportPath: reportPath,
      });
      assert.equal(result.status, "INCOMPLETE");
      assert.ok(result.reasons.some((r) => r.includes("context-pack.json missing")));
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("ensurePhaseAComplete retries Phase A when artifacts missing", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-phase-a-retry-"));
    const vault = join(fixtureRoot, "vault");
    await seedSessionCloseFixture(fixtureRoot, vault);

    try {
      const result = await ensurePhaseAComplete({
        dryRun: true,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
      });
      assert.equal(result.status, "PASSED");
      await access(join(fixtureRoot, ".session-close", "context-pack.json"));
      await access(join(fixtureRoot, ".session-close", "close-report.json"));
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("ensurePhaseAComplete aborts when prepare_context failed", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-phase-a-fail-"));
    const vault = join(fixtureRoot, "vault");
    const reportPath = join(fixtureRoot, ".session-close", "close-report.json");
    const packPath = join(fixtureRoot, ".session-close", "context-pack.json");
    await seedSessionCloseFixture(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    await writeFile(
      reportPath,
      `${JSON.stringify({
        mode: "real",
        failure_class: "pipeline",
        steps: { prepare_context: { status: "failed", message: "boom" } },
      })}\n`,
      "utf8",
    );
    await writeFile(
      packPath,
      `${JSON.stringify({
        generated_at: new Date().toISOString(),
        mode: "real",
        repo_root: fixtureRoot,
        vault_root: vault,
        agents: {},
        sprint: {},
        recent_stories: [],
        deterministic: {},
        notebooklm_targets: [],
        token_budget: {},
      })}\n`,
      "utf8",
    );

    try {
      await assert.rejects(
        () =>
          ensurePhaseAComplete({
            repoRoot: fixtureRoot,
            vaultRoot: vault,
            retry: false,
          }),
        /Phase A failed: cannot proceed to Phase B/,
      );
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      assert.equal(report.phase_a_gate.status, "ABORTED");
      assert.equal(report.failure_class, "pipeline");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});

describe("session-close nlm auth watchdog", () => {
  it("resolves NLM_BIN before PATH and operator-local fallback", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "nlm-auth-path-"));
    const customDir = join(fixtureRoot, "custom-bin");
    const pathDir = join(fixtureRoot, "path-bin");
    const localDir = join(fixtureRoot, "local-bin");
    await mkdir(customDir, { recursive: true });
    await mkdir(pathDir, { recursive: true });
    await mkdir(localDir, { recursive: true });
    await writeFile(join(customDir, "nlm"), "#!/bin/sh\n", { mode: 0o755 });
    await writeFile(join(pathDir, "nlm"), "#!/bin/sh\n", { mode: 0o755 });
    await writeFile(join(localDir, "nlm"), "#!/bin/sh\n", { mode: 0o755 });

    try {
      assert.equal(
        await resolveNlmCommand({
          env: { NLM_BIN: join(customDir, "nlm"), PATH: pathDir },
          localNlmPath: join(localDir, "nlm"),
        }),
        join(customDir, "nlm"),
      );
      assert.equal(
        await resolveNlmCommand({ env: { PATH: pathDir }, localNlmPath: join(localDir, "nlm") }),
        join(pathDir, "nlm"),
      );
      assert.equal(
        await resolveNlmCommand({ env: { PATH: "" }, localNlmPath: join(localDir, "nlm") }),
        join(localDir, "nlm"),
      );
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("falls through stale NLM_BIN to PATH", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "nlm-auth-stale-bin-"));
    const pathDir = join(fixtureRoot, "path-bin");
    await mkdir(pathDir, { recursive: true });
    await writeFile(join(pathDir, "nlm"), "#!/bin/sh\n", { mode: 0o755 });

    try {
      assert.equal(
        await resolveNlmCommand({
          env: { NLM_BIN: join(fixtureRoot, "missing-nlm"), PATH: pathDir },
          localNlmPath: join(fixtureRoot, "missing-local-nlm"),
        }),
        join(pathDir, "nlm"),
      );
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("treats exit 0 as authenticated", async () => {
    let capturedArgs = null;
    let capturedTimeout = null;
    const result = await runNlmAuthWatchdog({
      runCommand: async (_command, args, opts) => {
        capturedArgs = args;
        capturedTimeout = opts.timeout;
        return { stdout: "Authenticated\n", stderr: "" };
      },
      resolveCommand: async () => "nlm",
    });
    assert.deepEqual(result, {
      status: "authenticated",
      reason: "ok",
      message: "nlm auth check passed",
    });
    assert.deepEqual(capturedArgs, ["login", "--check"]);
    assert.equal(capturedTimeout, 10_000);
  });

  it("does not false-fail authenticated output that mentions non-stale cache state", async () => {
    const result = await runNlmAuthWatchdog({
      runCommand: async () => ({ stdout: "Authenticated; cache not stale\n", stderr: "" }),
      resolveCommand: async () => "nlm",
    });
    assert.equal(result.status, "authenticated");
    assert.equal(result.reason, "ok");
  });

  it("treats non-zero unauthenticated output as unauthenticated", async () => {
    const result = await runNlmAuthWatchdog({
      runCommand: async () => {
        const err = new Error("exit 1");
        err.code = 1;
        err.stdout = "Please login: user@example.com expired";
        err.stderr = "";
        throw err;
      },
      resolveCommand: async () => "nlm",
    });
    assert.equal(result.status, "unauthenticated");
    assert.equal(result.reason, "unauthenticated");
    assert.ok(!JSON.stringify(result).includes("user@example.com"));
  });

  it("does not persist raw diagnostics for check-failed output", async () => {
    const result = await runNlmAuthWatchdog({
      runCommand: async () => {
        const err = new Error("exit 2");
        err.code = 2;
        err.stdout = "";
        err.stderr = "Authorization: Bearer secret-token refresh_token=secret user@example.com";
        throw err;
      },
      resolveCommand: async () => "nlm",
    });
    assert.equal(result.status, "unknown");
    assert.equal(result.reason, "check-failed");
    assert.equal(result.message, "nlm auth check failed");
    assert.ok(!JSON.stringify(result).includes("secret-token"));
    assert.ok(!JSON.stringify(result).includes("refresh_token"));
    assert.ok(!JSON.stringify(result).includes("user@example.com"));
  });

  it("reports missing CLI without falling back to uvx", async () => {
    const result = await runNlmAuthWatchdog({
      resolveCommand: async () => null,
      runCommand: async () => {
        throw new Error("should not run");
      },
    });
    assert.equal(result.status, "unknown");
    assert.equal(result.reason, "missing-cli");
  });

  it("reports timeout as unknown", async () => {
    const result = await runNlmAuthWatchdog({
      runCommand: async () => {
        const err = new Error("timed out");
        err.killed = true;
        err.signal = "SIGTERM";
        throw err;
      },
      resolveCommand: async () => "nlm",
    });
    assert.equal(result.status, "unknown");
    assert.equal(result.reason, "timeout");
  });

  it("formats a tiny redacted Discord warning", () => {
    const warning = formatNlmAuthWarning({
      status: "unauthenticated",
      reason: "unauthenticated",
      message: "user@example.com SAPISID=secret",
    });
    assert.ok(warning.includes("nlm auth warning"));
    assert.ok(warning.includes("unauthenticated"));
    assert.ok(warning.includes("run nlm login"));
    assert.ok(!warning.includes("user@example.com"));
    assert.ok(!warning.includes("secret"));
  });

  it("dry-run skips the watchdog", async () => {
    const result = await runNlmAuthWatchdog({
      dryRun: true,
      runCommand: async () => {
        throw new Error("should not run");
      },
      resolveCommand: async () => "nlm",
    });
    assert.deepEqual(result, {
      status: "skipped",
      reason: "skipped-dry-run",
      message: "nlm_auth: skipped in dry-run",
    });
  });

  it("merges nlm_auth without changing failure_class", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "nlm-auth-report-"));
    const reportPath = join(fixtureRoot, "close-report.json");
    await writeFile(
      reportPath,
      `${JSON.stringify({ mode: "real", failure_class: "tests", steps: {} }, null, 2)}\n`,
      "utf8",
    );

    try {
      const merged = await mergeNlmAuthIntoCloseReport(reportPath, {
        status: "unknown",
        reason: "missing-cli",
        message: "nlm CLI not found",
      });
      assert.equal(merged.failure_class, "tests");
      assert.equal(merged.nlm_auth.reason, "missing-cli");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("CLI exits zero and emits nlm_auth when report merge fails", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "nlm-auth-cli-"));
    const missingReport = join(fixtureRoot, "missing", "close-report.json");

    try {
      const result = await execFileAsync(process.execPath, [
        NLM_AUTH_WATCHDOG_SCRIPT,
        "--dry-run",
        "--report",
        missingReport,
      ]);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.status, "skipped");
      assert.equal(payload.reason, "skipped-dry-run");
      assert.match(result.stderr, /could not update close-report\.json/);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("Hermes wrapper supplies repo fallback under a clean environment", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "nlm-auth-wrapper-"));
    const reportPath = join(fixtureRoot, "close-report.json");
    await writeFile(
      reportPath,
      `${JSON.stringify({ mode: "dry-run", failure_class: null, steps: {} }, null, 2)}\n`,
      "utf8",
    );

    try {
      const result = await execFileAsync("env", [
        "-i",
        `HOME=${process.env.HOME ?? "/home/christ"}`,
        "PATH=/usr/bin:/bin",
        NLM_AUTH_WATCHDOG_WRAPPER,
        "--dry-run",
        "--report",
        reportPath,
      ]);
      const payload = JSON.parse(result.stdout);
      assert.equal(payload.status, "skipped");
      assert.equal(payload.reason, "skipped-dry-run");
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      assert.equal(report.failure_class, null);
      assert.equal(report.nlm_auth.reason, "skipped-dry-run");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});

describe("session-close SC-3 memory and daily rhythm", () => {
  it("replaceAuto swaps inner content only", () => {
    const text = "<!-- AUTO:TESTS -->old<!-- /AUTO:TESTS -->";
    const next = replaceAuto(text, "TESTS", "609 passing");
    assert.ok(next.includes("<!-- AUTO:TESTS -->609 passing<!-- /AUTO:TESTS -->"));
    assert.ok(!next.includes("old"));
  });

  it("buildMemoryMarkdown stays under 2000 chars and uses section 8 excerpts", () => {
    const body = buildMemoryMarkdown({
      agentsText: SAMPLE_AGENTS,
      sprintYaml: SAMPLE_SPRINT,
      projectStatusLine: "Phase 6 complete. Epics 48 in progress.",
      vaultRoot: "/tmp/fixture-vault",
    });
    assert.ok(body.length <= 2000);
    assert.ok(body.includes("## CNS State"));
    assert.ok(body.includes("Epic 48 in-progress"));
    assert.ok(body.includes("## Next Session"));
    assert.ok(body.includes("Reconcile sprint state"));
    assert.ok(body.includes("Vault: /tmp/fixture-vault/"));
  });

  it("buildAutoMarkerValues covers all eleven AUTO tags", () => {
    const markers = buildAutoMarkerValues({
      agentsText: SAMPLE_AGENTS,
      sprintYaml: SAMPLE_SPRINT,
      testsLine: "609 passing",
      sessionDate: "2026-05-28",
      realClose: true,
      staticRowsMd: SAMPLE_STATIC_ROWS,
      deferredMd: SAMPLE_DEFERRED,
      epicsMd: "### Epic 48: Session-close context reduction\n",
      vaultLint: { scanned: 42, clean: 42, errors: 0, warnings: 0, stale: false },
      providerLine: "openai-codex / gpt-5.5",
      skillsCount: 12,
    });
    for (const tag of AUTO_MARKER_TAGS) {
      assert.ok(markers[tag], `missing marker ${tag}`);
      assert.ok(!String(markers[tag]).includes("seed-"), `stale seed in ${tag}`);
    }
    assert.equal(markers.AGENTS_VERSION, "v9.9.9");
    assert.equal(markers.VAULT_NOTES, "42");
    assert.ok(markers.SPRINT.includes("Epic 48"));
    assert.equal(markers.LAST_SESSION, "2026-05-28");
  });

  it("buildAutoMarkerValues surfaces stale vault-lint in VAULT_HEALTH", () => {
    const markers = buildAutoMarkerValues({
      agentsText: SAMPLE_AGENTS,
      sprintYaml: SAMPLE_SPRINT,
      testsLine: "609 passing",
      sessionDate: "2026-05-28",
      realClose: true,
      staticRowsMd: "",
      deferredMd: "",
      epicsMd: "",
      vaultLint: { scanned: 10, clean: 8, errors: 1, warnings: 1, stale: true },
      providerLine: "p / m",
      skillsCount: 0,
    });
    assert.ok(markers.VAULT_HEALTH.includes("STALE REPORT"));
    assert.ok(markers.VAULT_HEALTH.includes("/vault-lint"));
  });

  it("write-memory prefers context-pack project_status_line when pack present", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-memory-pack-"));
    const vault = join(fixtureRoot, "vault");
    await seedSessionCloseFixture(fixtureRoot, vault);
    const packPath = join(fixtureRoot, ".session-close", "context-pack.json");
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    await writeFile(
      packPath,
      `${JSON.stringify({ sprint: { project_status_line: "From context-pack only." } })}\n`,
      "utf8",
    );

    try {
      const result = await runWriteMemory({
        dryRun: true,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
      });
      assert.equal(result.usedContextPack, true);
      assert.ok(result.body.includes("From context-pack only."));
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("refresh-daily-rhythm replaces all eleven markers on fixture rhythm file", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-rhythm-"));
    const vault = join(fixtureRoot, "vault");
    const rhythmPath = join(vault, "AI-Context", "CNS-Daily-Rhythm.md");
    await seedSessionCloseFixture(fixtureRoot, vault);
    const before = await readFile(rhythmPath, "utf8");

    try {
      const result = await runRefreshDailyRhythm({
        dryRun: false,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
        testsLine: "609 passing",
      });
      assert.equal(result.written, true);
      const after = await readFile(rhythmPath, "utf8");
      assert.notEqual(after, before);
      for (const tag of AUTO_MARKER_TAGS) {
        assert.ok(after.includes(`<!-- AUTO:${tag} -->`), tag);
      }
      assert.ok(!after.includes("seed-provider"));
      assert.ok(!after.includes("seed-tests"));
      assert.ok(!after.includes("1970-01-01"));
      assert.ok(after.includes("*Last auto-update: "));
      assert.ok(after.includes("v9.9.9") || after.includes("9.9.9"));

      const second = await runRefreshDailyRhythm({
        dryRun: false,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
        testsLine: "609 passing",
      });
      const afterAgain = await readFile(rhythmPath, "utf8");
      assert.equal(second.updated, afterAgain);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("refresh-daily-rhythm dry-run does not write rhythm file", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-rhythm-dry-"));
    const vault = join(fixtureRoot, "vault");
    const rhythmPath = join(vault, "AI-Context", "CNS-Daily-Rhythm.md");
    await seedSessionCloseFixture(fixtureRoot, vault);
    const before = await readFile(rhythmPath, "utf8");

    try {
      const result = await runRefreshDailyRhythm({
        dryRun: true,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
        testsLine: "609 passing",
      });
      assert.equal(result.written, false);
      const onDisk = await readFile(rhythmPath, "utf8");
      assert.equal(onDisk, before);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("write-memory dry-run skips vault write", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-memory-dry-"));
    const vault = join(fixtureRoot, "vault");
    const memoryPath = join(vault, "AI-Context", "MEMORY.md");
    await seedSessionCloseFixture(fixtureRoot, vault);

    try {
      const result = await runWriteMemory({
        dryRun: true,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
      });
      assert.equal(result.written, false);
      await assert.rejects(() => access(memoryPath), { code: "ENOENT" });
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("write-memory real close writes MEMORY.md under 2000 chars", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-memory-"));
    const vault = join(fixtureRoot, "vault");
    await seedSessionCloseFixture(fixtureRoot, vault);

    try {
      const first = await runWriteMemory({
        dryRun: false,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
      });
      assert.equal(first.written, true);
      assert.ok(first.body.length <= 2000);
      const second = await runWriteMemory({
        dryRun: false,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
      });
      assert.equal(first.body, second.body);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("buildSprintNarrative truncates to 120 characters", () => {
    const entries = [{ key: "epic-48", status: "in-progress" }];
    for (let i = 0; i < 20; i += 1) {
      entries.push({
        key: `48-${i}-very-long-story-name-for-truncation-test`,
        status: "ready-for-dev",
      });
    }
    const line = buildSprintNarrative(entries);
    assert.ok(line.length <= 120);
  });

  it("idempotent applyAutoMarkers on unchanged marker map", () => {
    const markers = {
      PROVIDER: "p / m",
      TESTS: "1 passing",
    };
    const base = "<!-- AUTO:PROVIDER -->x<!-- /AUTO:PROVIDER -->\n<!-- AUTO:TESTS -->y<!-- /AUTO:TESTS -->";
    const once = applyAutoMarkers(base, markers);
    const twice = applyAutoMarkers(once, markers);
    assert.equal(once, twice);
  });
});

describe("session-close SC-4 apply-section8", () => {
  it("bumpPatchVersion increments patch segment", () => {
    assert.equal(bumpPatchVersion("9.9.9"), "9.9.10");
    assert.equal(bumpPatchVersion("2.1.12"), "2.1.13");
  });

  it("normalizeSection8Draft accepts fragment or strips ## 8. header", () => {
    const fragment = "### Project Status\n\n- epic-48: in-progress\n";
    const fromFragment = normalizeSection8Draft(fragment);
    assert.ok(fromFragment.startsWith("## 8. Current Focus"));
    assert.ok(fromFragment.includes("### Project Status"));

    const withHeader = normalizeSection8Draft(`## 8. Current Focus\n\n${fragment}`);
    assert.equal(fromFragment, withHeader);
  });

  it("replaceSection8InAgents leaves ## 9. and changelog tail intact", () => {
    const draft = normalizeSection8Draft("### Project Status\n\n- epic-48: done\n");
    const next = replaceSection8InAgents(SAMPLE_AGENTS, draft);
    assert.ok(next.includes("## 9. Agent Behavior Guidelines"));
    assert.ok(next.includes("rules\n"));
    assert.ok(next.includes("## Changelog"));
    assert.ok(next.includes("| 2026-01-01 | 9.9.9 | fixture row |"));
    assert.ok(!next.includes("Reconcile sprint state for Epic 48."));
    assert.ok(next.includes("epic-48: done"));
  });

  it("golden apply produces expected version bump and changelog row", async () => {
    const draftPath = join(import.meta.dirname, "fixtures/session-close/section8-draft-fragment.md");
    const draft = await readFile(draftPath, "utf8");
    const { text, newVersion } = applySection8ToAgentsText(SAMPLE_AGENTS, draft, {
      dateStr: "2026-05-28",
    });
    assert.equal(newVersion, "9.9.10");
    assert.ok(text.includes("> Version: 9.9.10 | Last updated: 2026-05-28"));
    assert.ok(text.includes("| 2026-05-28 | 9.9.10 |"));
    assert.ok(text.includes("Ship session-close SC-4"));
    const section9Idx = text.indexOf("## 9. Agent Behavior Guidelines");
    const changelogIdx = text.indexOf("## Changelog");
    assert.ok(section9Idx > 0 && changelogIdx > section9Idx);
    assert.equal(
      text.slice(section9Idx, changelogIdx),
      SAMPLE_AGENTS.slice(
        SAMPLE_AGENTS.indexOf("## 9."),
        SAMPLE_AGENTS.indexOf("## Changelog"),
      ),
    );
    assert.ok(text.includes("| 2026-05-28 | 9.9.10 |"));
    assert.ok(text.includes("| 2026-01-01 | 9.9.9 | fixture row |"));
  });

  it("runApplySection8 byte-syncs repo and vault AGENTS copies", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-apply-"));
    const vault = join(fixtureRoot, "vault");
    const draftPath = join(fixtureRoot, ".session-close", "section8-draft.md");
    const draftFixture = join(
      import.meta.dirname,
      "fixtures/session-close/section8-draft-fragment.md",
    );
    await seedSessionCloseFixture(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    await copyFile(draftFixture, draftPath);

    const repoAgents = join(fixtureRoot, "specs/cns-vault-contract/AGENTS.md");
    const vaultAgents = join(vault, "AI-Context", "AGENTS.md");
    const beforeRepo = await readFile(repoAgents, "utf8");

    try {
      const result = await runApplySection8({
        draftPath,
        dryRun: false,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
        dateStr: "2026-05-28",
      });
      assert.equal(result.written, true);
      const repoAfter = await readFile(repoAgents, "utf8");
      const vaultAfter = await readFile(vaultAgents, "utf8");
      assert.equal(repoAfter, vaultAfter);
      assert.notEqual(repoAfter, beforeRepo);
      assert.ok(repoAfter.includes("9.9.10"));
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("dry-run writes preview only and does not mutate AGENTS", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-apply-dry-"));
    const vault = join(fixtureRoot, "vault");
    const draftPath = join(fixtureRoot, ".session-close", "section8-draft.md");
    const draftFixture = join(
      import.meta.dirname,
      "fixtures/session-close/section8-draft-fragment.md",
    );
    await seedSessionCloseFixture(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    await copyFile(draftFixture, draftPath);

    const repoAgents = join(fixtureRoot, "specs/cns-vault-contract/AGENTS.md");
    const before = await readFile(repoAgents, "utf8");

    try {
      const result = await runApplySection8({
        draftPath,
        dryRun: true,
        repoRoot: fixtureRoot,
        vaultRoot: vault,
        dateStr: "2026-05-28",
      });
      assert.equal(result.written, false);
      assert.ok(result.previewPath);
      const onDisk = await readFile(repoAgents, "utf8");
      assert.equal(onDisk, before);
      const preview = await readFile(result.previewPath, "utf8");
      assert.ok(preview.includes("9.9.10"));
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("rejects oversize draft before mutating AGENTS", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-apply-big-"));
    const vault = join(fixtureRoot, "vault");
    const draftPath = join(fixtureRoot, ".session-close", "section8-draft.md");
    const reportPath = join(fixtureRoot, ".session-close", "close-report.json");
    await seedSessionCloseFixture(fixtureRoot, vault);
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    const huge = "word ".repeat(SECTION8_DRAFT_TOKEN_LIMIT * 4 + 200);
    await writeFile(draftPath, huge, "utf8");
    const repoAgents = join(fixtureRoot, "specs/cns-vault-contract/AGENTS.md");
    const before = await readFile(repoAgents, "utf8");

    try {
      await assert.rejects(
        () =>
          runApplySection8({
            draftPath,
            dryRun: false,
            repoRoot: fixtureRoot,
            vaultRoot: vault,
          }),
        /exceeds 1500 tokens/,
      );
      const after = await readFile(repoAgents, "utf8");
      assert.equal(after, before);
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      assert.equal(report.failure_class, "section8");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("recordSection8Failure sets failure_class on close-report.json", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-apply-fail-"));
    const reportPath = join(fixtureRoot, ".session-close", "close-report.json");
    await mkdir(join(fixtureRoot, ".session-close"), { recursive: true });
    await writeFile(
      reportPath,
      `${JSON.stringify({ mode: "real", steps: { export: { status: "ok" } } })}\n`,
      "utf8",
    );

    try {
      await recordSection8Failure(reportPath, "regex drift");
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      assert.equal(report.failure_class, "section8");
      assert.equal(report.steps.export.status, "ok");
      assert.equal(report.steps.section8.status, "failed");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("parseApplySection8Argv reads --draft and --dry-run", () => {
    const parsed = parseApplySection8Argv([
      "node",
      "apply-section8.mjs",
      "--draft",
      ".session-close/section8-draft.md",
      "--dry-run",
    ]);
    assert.equal(parsed.draftPath, ".session-close/section8-draft.md");
    assert.equal(parsed.dryRun, true);
  });
});

describe("session-close prepare-context integration", () => {
  it("emits normative schema and respects pack token limit on golden fixture repo", async () => {
    const root = await mkdtemp(join(tmpdir(), "session-close-pack-"));
    const vault = join(root, "vault");
    await seedSessionCloseFixture(root, vault);

    const pack = await buildContextPack({
      repoRoot: root,
      vaultRoot: vault,
      dryRun: false,
    });

    for (const key of REQUIRED_PACK_KEYS) {
      assert.ok(key in pack, `missing key ${key}`);
    }
    assert.equal(pack.mode, "real");
    assert.ok(Array.isArray(pack.sprint.active_epics));
    assert.ok(pack.sprint.active_epics.length >= 1);
    assert.ok(pack.token_budget.pack_tokens <= PACK_TOKEN_LIMIT);
    assert.ok(pack.agents.section8_excerpt.length > 0);
    assert.equal(pack.token_budget.pack_limit, PACK_TOKEN_LIMIT);
  });

  it("writes context-pack.json when invoked via CLI on isolated fixture repo", async () => {
    const omnipotentRoot = join(import.meta.dirname, "..");
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-cli-"));
    const vault = join(fixtureRoot, "vault");
    const packPath = join(fixtureRoot, ".session-close", "context-pack.json");
    await seedSessionCloseFixture(fixtureRoot, vault);

    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    try {
      await execFileAsync("node", ["scripts/session-close/prepare-context.mjs"], {
        cwd: omnipotentRoot,
        env: {
          ...process.env,
          OMNIPOTENT_REPO: fixtureRoot,
          CNS_VAULT_ROOT: vault,
        },
      });
      const onDisk = JSON.parse(await readFile(packPath, "utf8"));
      for (const key of REQUIRED_PACK_KEYS) {
        assert.ok(key in onDisk, `missing key ${key}`);
      }
      assert.equal(onDisk.mode, "real");
      assert.ok(onDisk.token_budget.pack_tokens <= PACK_TOKEN_LIMIT);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("does not write context-pack.json when CLI runs with --dry-run", async () => {
    const omnipotentRoot = join(import.meta.dirname, "..");
    const fixtureRoot = await mkdtemp(join(tmpdir(), "session-close-dry-"));
    const vault = join(fixtureRoot, "vault");
    const packPath = join(fixtureRoot, ".session-close", "context-pack.json");
    await seedSessionCloseFixture(fixtureRoot, vault);

    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    try {
      await execFileAsync(
        "node",
        ["scripts/session-close/prepare-context.mjs", "--dry-run"],
        {
          cwd: omnipotentRoot,
          env: {
            ...process.env,
            OMNIPOTENT_REPO: fixtureRoot,
            CNS_VAULT_ROOT: vault,
          },
        },
      );
      await assert.rejects(() => access(packPath), { code: "ENOENT" });
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
