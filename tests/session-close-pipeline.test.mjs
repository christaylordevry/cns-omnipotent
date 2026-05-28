import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { buildContextPack } from "../scripts/session-close/prepare-context.mjs";
import {
  buildCloseReport,
  enrichNotebooklmTargets,
  parseVitestTestsSummary,
  runDeterministicPipeline,
} from "../scripts/session-close/run-deterministic.mjs";
import {
  buildActiveEpics,
  excerptStoryBullet,
  parseAgentsSection8,
  parseDevelopmentStatus,
} from "../scripts/session-close/lib/read-sources.mjs";
import {
  enforceTokenBudget,
  estimateTokens,
  PACK_TOKEN_LIMIT,
  SECTION8_EXCERPT_LIMIT,
  truncateToTokens,
} from "../scripts/session-close/lib/token-estimate.mjs";

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
});

/** @param {string} root @param {string} vault */
async function seedSessionCloseFixture(root, vault) {
  const artifacts = join(root, "_bmad-output", "implementation-artifacts");
  await mkdir(join(vault, "AI-Context"), { recursive: true });
  await mkdir(join(vault, "_meta", "reports"), { recursive: true });
  await mkdir(join(root, "scripts"), { recursive: true });
  await mkdir(artifacts, { recursive: true });
  await writeFile(join(vault, "AI-Context", "AGENTS.md"), SAMPLE_AGENTS, "utf8");
  await writeFile(join(artifacts, "sprint-status.yaml"), SAMPLE_SPRINT, "utf8");
  await writeFile(join(root, "scripts", "export-vault-for-notebooklm.sh"), "#!/bin/bash\n", "utf8");
  await writeFile(
    join(root, "CLAUDE.md"),
    "## Phase Status\nPhase 6 complete. Epics 48 in progress.\n",
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
    });
    assert.equal(report.failure_class, "export");
    assert.equal(report.deterministic.export_bytes, 42);
    assert.equal(report.notebooklm_targets[0].export_path, "/p");
    assert.ok(!JSON.stringify(report).includes("api_key"));
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
