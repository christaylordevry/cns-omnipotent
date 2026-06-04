import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  readNotebookLmTargets,
  readNotebookLmTargetsWithMeta,
} from "../scripts/session-close/lib/read-sources.mjs";
import { enforceTokenBudget } from "../scripts/session-close/lib/token-estimate.mjs";
import { buildCloseReport } from "../scripts/session-close/run-deterministic.mjs";

function restoreEnv(key, prior) {
  if (prior === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = prior;
  }
}

async function mktmp(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

async function writeRegistry(dir, entries) {
  const registryPath = join(dir, "notebook-registry.json");
  await writeFile(registryPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  return registryPath;
}

async function createVaultWithMap(dir, mapId) {
  const vaultRoot = join(dir, "vault");
  await mkdir(join(vaultRoot, "03-Resources"), { recursive: true });
  await writeFile(
    join(vaultRoot, "03-Resources/NotebookLM-Project-Map.md"),
    ["| Project | Notebook |", "| --- | --- |", `| CNS | Fallback ${mapId} |`, ""].join("\n"),
    "utf8",
  );
  return vaultRoot;
}

async function withIsolatedEnv(smartRoutingValue, fn) {
  const priorHome = process.env.HOME;
  // HERMES_HOME takes precedence over HOME when resolving the session-close env
  // file (see load-session-close-env.mjs). The Hermes gateway subprocess sets it
  // to the real ~/.hermes, so it must be neutralized here or these tests read the
  // operator's real session-close.env instead of the isolated fixture.
  const priorHermesHome = process.env.HERMES_HOME;
  const priorIds = process.env.NOTEBOOKLM_NOTEBOOK_IDS;
  const priorFlag = process.env.NOTEBOOK_SMART_ROUTING;
  const fakeHome = await mktmp("routing-report-home-");
  try {
    process.env.HOME = fakeHome;
    delete process.env.HERMES_HOME;
    delete process.env.NOTEBOOKLM_NOTEBOOK_IDS;
    if (smartRoutingValue === null) {
      delete process.env.NOTEBOOK_SMART_ROUTING;
    } else {
      process.env.NOTEBOOK_SMART_ROUTING = smartRoutingValue;
    }
    await fn();
  } finally {
    restoreEnv("HOME", priorHome);
    restoreEnv("HERMES_HOME", priorHermesHome);
    restoreEnv("NOTEBOOKLM_NOTEBOOK_IDS", priorIds);
    restoreEnv("NOTEBOOK_SMART_ROUTING", priorFlag);
    await rm(fakeHome, { recursive: true, force: true });
  }
}

const CNS_ENTRY = {
  id: "cns-nb-001",
  title: "CNS Vault Architecture",
  watch: false,
  domain: "cns-brain",
  last_updated: null,
};

const HEALTH_ENTRY = {
  id: "health-nb-001",
  title: "Nutrition and Fitness",
  watch: false,
  domain: "health",
  last_updated: null,
};

const WATCHED_ENTRY = {
  id: "watched-nb-001",
  title: "Watched Notebook",
  watch: true,
  domain: "general",
  last_updated: null,
};

const CNS_CONTEXT_PACK = {
  recent_stories: [{ basename: "50-5-cns-vault-brain" }],
};

const NOMATCH_CONTEXT_PACK = {
  recent_stories: [{ basename: "99-9-widget-wizard" }],
};

const MAP_ID = "f037c741-f7e1-4a90-880f-d2d38986767b";
const EXPORT_PATH = "/fake/export.md";

describe("notebook routing report metadata", () => {
  it("captures env-override routing metadata without reason", async () => {
    await withIsolatedEnv("1", async () => {
      process.env.NOTEBOOKLM_NOTEBOOK_IDS = "abc-123";

      const { targets, routing } = await readNotebookLmTargetsWithMeta("/fake/vault", EXPORT_PATH);

      assert.equal(targets.length, 1);
      assert.equal(routing.method, "env-override");
      assert.deepEqual(routing.notebooks, [{ id: "abc-123", title: "abc-123" }]);
      assert.equal("reason" in routing, false);
    });
  });

  it("captures watch-flag routing metadata from registry entries", async () => {
    const dir = await mktmp("routing-report-watch-");
    try {
      await withIsolatedEnv(null, async () => {
        const registryPath = await writeRegistry(dir, [WATCHED_ENTRY]);

        const { targets, routing } = await readNotebookLmTargetsWithMeta("/fake/vault", EXPORT_PATH, {
          registryPath,
        });

        assert.equal(targets.length, 1);
        assert.equal(routing.method, "watch-flag");
        assert.deepEqual(routing.notebooks, [{ id: WATCHED_ENTRY.id, title: WATCHED_ENTRY.title }]);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("captures smart-route metadata including disambiguator reason", async () => {
    const dir = await mktmp("routing-report-smart-");
    try {
      await withIsolatedEnv("1", async () => {
        const registryPath = await writeRegistry(dir, [CNS_ENTRY]);

        const { targets, routing } = await readNotebookLmTargetsWithMeta("/fake/vault", EXPORT_PATH, {
          registryPath,
          contextPack: CNS_CONTEXT_PACK,
        });

        assert.equal(targets.length, 1);
        assert.equal(routing.method, "smart-route");
        assert.deepEqual(routing.notebooks, [{ id: CNS_ENTRY.id, title: CNS_ENTRY.title }]);
        assert.equal(routing.reason, "single-match");
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("falls through from smart-route NO_ROUTE to project-map metadata", async () => {
    const dir = await mktmp("routing-report-smart-fallback-");
    try {
      await withIsolatedEnv("1", async () => {
        const registryPath = await writeRegistry(dir, [HEALTH_ENTRY]);
        const vaultRoot = await createVaultWithMap(dir, MAP_ID);

        const { routing } = await readNotebookLmTargetsWithMeta(vaultRoot, EXPORT_PATH, {
          registryPath,
          contextPack: NOMATCH_CONTEXT_PACK,
        });

        assert.equal(routing.method, "project-map");
        assert.deepEqual(routing.notebooks, [{ id: MAP_ID, title: `Fallback ${MAP_ID}` }]);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("captures project-map routing metadata when no prior method wins", async () => {
    const dir = await mktmp("routing-report-map-");
    try {
      await withIsolatedEnv(null, async () => {
        const vaultRoot = await createVaultWithMap(dir, MAP_ID);

        const { targets, routing } = await readNotebookLmTargetsWithMeta(vaultRoot, EXPORT_PATH, {
          registryPath: join(dir, "missing-registry.json"),
        });

        assert.equal(targets.length, 1);
        assert.equal(routing.method, "project-map");
        assert.deepEqual(routing.notebooks, [{ id: MAP_ID, title: `Fallback ${MAP_ID}` }]);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("captures empty routing metadata when no targets resolve", async () => {
    const dir = await mktmp("routing-report-empty-");
    try {
      await withIsolatedEnv(null, async () => {
        const registryPath = await writeRegistry(dir, []);

        const { targets, routing } = await readNotebookLmTargetsWithMeta(dir, EXPORT_PATH, {
          registryPath,
        });

        assert.deepEqual(targets, []);
        assert.deepEqual(routing, { method: "empty", notebooks: [] });
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("keeps readNotebookLmTargets backward compatible as a plain array", async () => {
    await withIsolatedEnv("1", async () => {
      process.env.NOTEBOOKLM_NOTEBOOK_IDS = "plain-array-id";

      const targets = await readNotebookLmTargets("/fake/vault", EXPORT_PATH);

      assert.equal(Array.isArray(targets), true);
      assert.equal("targets" in targets, false);
      assert.equal(/** @type {any} */ (targets[0]).notebook_id, "plain-array-id");
    });
  });

  it("adds notebooklm_routing to close reports when provided", () => {
    const report = buildCloseReport({
      mode: "dry-run",
      repoRoot: "/repo",
      vaultRoot: "/vault",
      contextPackPath: "/repo/.session-close/context-pack.json",
      steps: {},
      failureClass: null,
      deterministic: {},
      notebooklm_targets: [],
      notebooklm_routing: { method: "watch-flag", notebooks: [] },
    });

    assert.equal(report.notebooklm_routing.method, "watch-flag");
  });

  it("nulls notebooklm_routing in close reports when omitted", () => {
    const report = buildCloseReport({
      mode: "dry-run",
      repoRoot: "/repo",
      vaultRoot: "/vault",
      contextPackPath: "/repo/.session-close/context-pack.json",
      steps: {},
      failureClass: null,
      deterministic: {},
      notebooklm_targets: [],
    });

    assert.equal(report.notebooklm_routing, null);
  });

  it("keeps routing notebooks synchronized when token pruning drops targets", () => {
    const pruned = enforceTokenBudget(
      {
        agents: { section8_excerpt: "x".repeat(1000) },
        sprint: { project_status_line: "x".repeat(200), active_epics: [] },
        recent_stories: [],
        deterministic: {},
        notebooklm_targets: [
          { notebook_id: "keep-nb-001", title: "Keep Notebook" },
          { notebook_id: "drop-nb-001", title: "Drop Notebook" },
        ],
        notebooklm_routing: {
          method: "watch-flag",
          notebooks: [
            { id: "keep-nb-001", title: "Keep Notebook" },
            { id: "drop-nb-001", title: "Drop Notebook" },
          ],
        },
        token_budget: { pack_tokens: 0, pack_limit: 1 },
      },
      1,
    );

    assert.deepEqual(pruned.notebooklm_targets, []);
    assert.deepEqual(pruned.notebooklm_routing.notebooks, []);
  });
});
