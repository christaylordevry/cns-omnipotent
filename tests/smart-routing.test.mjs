import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { readNotebookLmTargets } from "../scripts/session-close/lib/read-sources.mjs";

/** Restore env var to its prior state. */
function restoreEnv(key, prior) {
  if (prior === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = prior;
  }
}

/** Create a temp directory under system tmpdir. */
async function mktmp(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

/** Write a registry JSON file to `dir`. Returns the registry path. */
async function writeRegistry(dir, entries) {
  const registryPath = join(dir, "notebook-registry.json");
  await writeFile(registryPath, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
  return registryPath;
}

/** Create a minimal vault with a project-map containing one UUID. Returns vaultRoot. */
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

/**
 * Run `fn` with isolated HOME, NOTEBOOKLM_NOTEBOOK_IDS, and NOTEBOOK_SMART_ROUTING.
 * Restores all three after fn completes (or throws).
 * @param {string} smartRoutingValue  value to set for NOTEBOOK_SMART_ROUTING (or null to delete)
 * @param {() => Promise<void>} fn
 */
async function withIsolatedEnv(smartRoutingValue, fn) {
  const priorHome = process.env.HOME;
  const priorIds = process.env.NOTEBOOKLM_NOTEBOOK_IDS;
  const priorFlag = process.env.NOTEBOOK_SMART_ROUTING;
  const fakeHome = await mktmp("sr-home-");
  try {
    process.env.HOME = fakeHome;
    delete process.env.NOTEBOOKLM_NOTEBOOK_IDS;
    if (smartRoutingValue === null) {
      delete process.env.NOTEBOOK_SMART_ROUTING;
    } else {
      process.env.NOTEBOOK_SMART_ROUTING = smartRoutingValue;
    }
    await fn();
  } finally {
    restoreEnv("HOME", priorHome);
    restoreEnv("NOTEBOOKLM_NOTEBOOK_IDS", priorIds);
    restoreEnv("NOTEBOOK_SMART_ROUTING", priorFlag);
    await rm(fakeHome, { recursive: true, force: true });
  }
}

/** A registry entry with domain cns-brain (no watch flag). */
const CNS_ENTRY = {
  id: "cns-nb-001",
  title: "CNS Vault Architecture",
  watch: false,
  domain: "cns-brain",
  last_updated: null,
};

/** A registry entry with domain health (no watch flag). */
const HEALTH_ENTRY = {
  id: "health-nb-001",
  title: "Nutrition and Fitness",
  watch: false,
  domain: "health",
  last_updated: null,
};

/** A watched registry entry. */
const WATCHED_ENTRY = {
  id: "watched-nb-001",
  title: "Watched Notebook",
  watch: true,
  domain: "general",
  last_updated: null,
};

/**
 * contextPack whose recent story basename contains cns/vault/brain keywords.
 * extractScoringTopic → "cns vault brain" → F1 ≥ 0.75 against cns-brain domain.
 */
const CNS_CONTEXT_PACK = {
  recent_stories: [{ basename: "50-5-cns-vault-brain" }],
};

/**
 * contextPack whose topic won't match any registry domain.
 * extractScoringTopic → "widget wizard" → F1 < 0.75 everywhere.
 */
const NOMATCH_CONTEXT_PACK = {
  recent_stories: [{ basename: "99-9-widget-wizard" }],
};

const MAP_ID = "f037c741-f7e1-4a90-880f-d2d38986767b";
const EXPORT_PATH = "/fake/export.md";

// ─── Flag gate ────────────────────────────────────────────────────────────────

describe("smart routing — NOTEBOOK_SMART_ROUTING flag", () => {
  it("skips smart routing when flag is unset → project-map wins", async () => {
    const dir = await mktmp("notebook-sr-unset-");
    try {
      await withIsolatedEnv(null, async () => {
        const registryPath = await writeRegistry(dir, [CNS_ENTRY]);
        const vaultRoot = await createVaultWithMap(dir, MAP_ID);

        const targets = await readNotebookLmTargets(vaultRoot, EXPORT_PATH, {
          registryPath,
          contextPack: CNS_CONTEXT_PACK,
        });

        assert.equal(targets.length, 1);
        assert.equal(/** @type {any} */ (targets[0]).notebook_id, MAP_ID);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("skips smart routing when flag is '0'", async () => {
    const dir = await mktmp("notebook-sr-zero-");
    try {
      await withIsolatedEnv("0", async () => {
        const registryPath = await writeRegistry(dir, [CNS_ENTRY]);
        const vaultRoot = await createVaultWithMap(dir, MAP_ID);

        const targets = await readNotebookLmTargets(vaultRoot, EXPORT_PATH, {
          registryPath,
          contextPack: CNS_CONTEXT_PACK,
        });

        assert.equal(targets.length, 1);
        assert.equal(/** @type {any} */ (targets[0]).notebook_id, MAP_ID);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("skips smart routing when flag is '' (empty string)", async () => {
    const dir = await mktmp("notebook-sr-empty-");
    try {
      await withIsolatedEnv("", async () => {
        const registryPath = await writeRegistry(dir, [CNS_ENTRY]);
        const vaultRoot = await createVaultWithMap(dir, MAP_ID);

        const targets = await readNotebookLmTargets(vaultRoot, EXPORT_PATH, {
          registryPath,
          contextPack: CNS_CONTEXT_PACK,
        });

        assert.equal(targets.length, 1);
        assert.equal(/** @type {any} */ (targets[0]).notebook_id, MAP_ID);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("skips smart routing when flag is 'false'", async () => {
    const dir = await mktmp("notebook-sr-false-");
    try {
      await withIsolatedEnv("false", async () => {
        const registryPath = await writeRegistry(dir, [CNS_ENTRY]);
        const vaultRoot = await createVaultWithMap(dir, MAP_ID);

        const targets = await readNotebookLmTargets(vaultRoot, EXPORT_PATH, {
          registryPath,
          contextPack: CNS_CONTEXT_PACK,
        });

        assert.equal(targets.length, 1);
        assert.equal(/** @type {any} */ (targets[0]).notebook_id, MAP_ID);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ─── ROUTED path ──────────────────────────────────────────────────────────────

describe("smart routing — ROUTED path", () => {
  it("returns single ROUTED target when scorer matches and flag is '1'", async () => {
    const dir = await mktmp("notebook-sr-routed-");
    try {
      await withIsolatedEnv("1", async () => {
        const registryPath = await writeRegistry(dir, [CNS_ENTRY]);

        const targets = await readNotebookLmTargets("/fake/vault", EXPORT_PATH, {
          registryPath,
          contextPack: CNS_CONTEXT_PACK,
        });

        assert.equal(targets.length, 1);
        const t = /** @type {any} */ (targets[0]);
        assert.equal(t.notebook_id, CNS_ENTRY.id);
        assert.equal(t.title, CNS_ENTRY.title);
        assert.equal(t.source_name, "CNS Vault Export");
        assert.equal(t.source_type, "file");
        assert.equal(t.file_path, EXPORT_PATH);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("ROUTED target has all required shape fields", async () => {
    const dir = await mktmp("notebook-sr-fields-");
    try {
      await withIsolatedEnv("1", async () => {
        const registryPath = await writeRegistry(dir, [CNS_ENTRY]);

        const targets = await readNotebookLmTargets("/fake/vault", EXPORT_PATH, {
          registryPath,
          contextPack: CNS_CONTEXT_PACK,
        });

        const t = /** @type {any} */ (targets[0]);
        assert.ok("notebook_id" in t, "missing notebook_id");
        assert.ok("title" in t, "missing title");
        assert.ok("source_name" in t, "missing source_name");
        assert.ok("source_type" in t, "missing source_type");
        assert.ok("file_path" in t, "missing file_path");
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("ROUTED using sprint.active_epics (epic id tokens match domain)", async () => {
    const dir = await mktmp("notebook-sr-epics-");
    try {
      await withIsolatedEnv("1", async () => {
        const registryPath = await writeRegistry(dir, [CNS_ENTRY]);

        // P1: extractScoringTopic joins epic IDs → "epic-cns-vault-brain"
        // tokenize → ["epic", "cns", "vault", "brain"]
        // F1 against cns-brain domain tokens ["brain","cns","pake","vault"] = 6/8 = 0.75 → MATCH
        const contextPack = {
          sprint: {
            active_epics: [{ id: "epic-cns-vault-brain", stories: [] }],
          },
        };

        const targets = await readNotebookLmTargets("/fake/vault", EXPORT_PATH, {
          registryPath,
          contextPack,
        });

        assert.equal(targets.length, 1);
        assert.equal(/** @type {any} */ (targets[0]).notebook_id, CNS_ENTRY.id);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ─── NO_ROUTE fall-through ───────────────────────────────────────────────────

describe("smart routing — NO_ROUTE fall-through", () => {
  it("falls through to project-map when scorer returns NO_ROUTE", async () => {
    const dir = await mktmp("notebook-sr-noroute-");
    try {
      await withIsolatedEnv("1", async () => {
        // Health domain won't match "widget wizard" topic
        const registryPath = await writeRegistry(dir, [HEALTH_ENTRY]);
        const vaultRoot = await createVaultWithMap(dir, MAP_ID);

        const targets = await readNotebookLmTargets(vaultRoot, EXPORT_PATH, {
          registryPath,
          contextPack: NOMATCH_CONTEXT_PACK,
        });

        assert.equal(targets.length, 1);
        assert.equal(/** @type {any} */ (targets[0]).notebook_id, MAP_ID);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("falls through when contextPack is undefined (empty topic → NO_ROUTE)", async () => {
    const dir = await mktmp("notebook-sr-noctx-");
    try {
      await withIsolatedEnv("1", async () => {
        const registryPath = await writeRegistry(dir, [CNS_ENTRY]);
        const vaultRoot = await createVaultWithMap(dir, MAP_ID);

        // No contextPack → extractScoringTopic(undefined) → "" → scorer NO_ROUTE
        const targets = await readNotebookLmTargets(vaultRoot, EXPORT_PATH, { registryPath });

        assert.equal(targets.length, 1);
        assert.equal(/** @type {any} */ (targets[0]).notebook_id, MAP_ID);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("falls through when contextPack is null", async () => {
    const dir = await mktmp("notebook-sr-null-ctx-");
    try {
      await withIsolatedEnv("1", async () => {
        const registryPath = await writeRegistry(dir, [CNS_ENTRY]);
        const vaultRoot = await createVaultWithMap(dir, MAP_ID);

        const targets = await readNotebookLmTargets(vaultRoot, EXPORT_PATH, {
          registryPath,
          contextPack: null,
        });

        assert.equal(targets.length, 1);
        assert.equal(/** @type {any} */ (targets[0]).notebook_id, MAP_ID);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ─── Precedence — watch-list and env still win ────────────────────────────────

describe("smart routing — precedence", () => {
  it("watch-list wins over smart routing", async () => {
    const dir = await mktmp("notebook-sr-watch-wins-");
    try {
      await withIsolatedEnv("1", async () => {
        // WATCHED_ENTRY has watch:true → returned before smart routing step
        const registryPath = await writeRegistry(dir, [WATCHED_ENTRY, CNS_ENTRY]);

        const targets = await readNotebookLmTargets("/fake/vault", EXPORT_PATH, {
          registryPath,
          contextPack: CNS_CONTEXT_PACK,
        });

        assert.equal(targets.length, 1);
        assert.equal(/** @type {any} */ (targets[0]).notebook_id, WATCHED_ENTRY.id);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("env IDs win over smart routing", async () => {
    const envId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const priorHome = process.env.HOME;
    const priorIds = process.env.NOTEBOOKLM_NOTEBOOK_IDS;
    const priorFlag = process.env.NOTEBOOK_SMART_ROUTING;
    const fakeHome = await mktmp("sr-env-home-");
    const dir = await mktmp("notebook-sr-env-wins-");
    try {
      process.env.HOME = fakeHome;
      process.env.NOTEBOOK_SMART_ROUTING = "1";
      process.env.NOTEBOOKLM_NOTEBOOK_IDS = envId; // env override must win

      const registryPath = await writeRegistry(dir, [CNS_ENTRY]);

      const targets = await readNotebookLmTargets("/fake/vault", EXPORT_PATH, {
        registryPath,
        contextPack: CNS_CONTEXT_PACK,
      });

      assert.equal(targets.length, 1);
      assert.equal(/** @type {any} */ (targets[0]).notebook_id, envId);
    } finally {
      restoreEnv("HOME", priorHome);
      restoreEnv("NOTEBOOKLM_NOTEBOOK_IDS", priorIds);
      restoreEnv("NOTEBOOK_SMART_ROUTING", priorFlag);
      await rm(fakeHome, { recursive: true, force: true });
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ─── Error resilience ─────────────────────────────────────────────────────────

describe("smart routing — error resilience", () => {
  it("falls through gracefully when scorer throws (no crash)", async () => {
    const dir = await mktmp("notebook-sr-throws-");
    try {
      await withIsolatedEnv("1", async () => {
        // Write a registry file with invalid JSON so readRegistry throws,
        // leaving registry = [] for the smartRoute call — but that hits scorer NO_ROUTE.
        // To exercise the scorer-throw path we write a valid registry with a corrupted
        // entry that causes extractScoringTopic to receive a contextPack that makes
        // scoreNotebooks throw. We inject a contextPack with a getter that throws.
        const registryPath = await writeRegistry(dir, [CNS_ENTRY]);
        const vaultRoot = await createVaultWithMap(dir, MAP_ID);

        const throwingPack = Object.defineProperty({}, "recent_stories", {
          get() { throw new Error("simulated scorer input error"); },
          enumerable: true,
        });

        // Must not throw — falls through to project-map
        const targets = await readNotebookLmTargets(vaultRoot, EXPORT_PATH, {
          registryPath,
          contextPack: throwingPack,
        });

        assert.equal(targets.length, 1);
        assert.equal(/** @type {any} */ (targets[0]).notebook_id, MAP_ID);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("falls through when registry is empty (scorer NO_ROUTE, no entries)", async () => {
    const dir = await mktmp("notebook-sr-empty-reg-");
    try {
      await withIsolatedEnv("1", async () => {
        const registryPath = await writeRegistry(dir, []);
        const vaultRoot = await createVaultWithMap(dir, MAP_ID);

        const targets = await readNotebookLmTargets(vaultRoot, EXPORT_PATH, {
          registryPath,
          contextPack: CNS_CONTEXT_PACK,
        });

        assert.equal(targets.length, 1);
        assert.equal(/** @type {any} */ (targets[0]).notebook_id, MAP_ID);
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
