import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  defaultSessionCloseEnvPath,
  hasGoogleOAuthCredentials,
  parseSessionCloseEnvFile,
  readNotebooklmDriveDocId,
  readSessionCloseEnvVar,
  resolveVaultExportFanoutMode,
} from "../scripts/session-close/lib/load-session-close-env.mjs";
import {
  extractDriveDocIdFromSource,
  matchDriveSourceByDocId,
} from "../scripts/session-close/lib/match-drive-source.mjs";
import { mergeFanoutIntoCloseReport } from "../scripts/session-close/merge-notebooklm-fanout.mjs";
import { recordNotebooklmFanoutMode } from "../scripts/session-close/record-notebooklm-fanout-mode.mjs";
import {
  appendDriveSyncFailureLogs,
  parseNlmDriveSourceList,
  runSyncVaultExportDrive,
  syncNotebookDriveSource,
} from "../scripts/session-close/sync-vault-export-drive.mjs";

const FIXTURE_NOTEBOOK = "981466f0-de1c-4551-93a9-f3bc2a24b184";
const FIXTURE_DRIVE_DOC = "1AbCdEfGhIjKlMnOpQrStUvWxYz";

const DRIVE_SOURCE_LIST_FIXTURE = [
  {
    id: "src-other",
    title: "Other Doc",
    type: "google_docs",
    drive_doc_id: "other-id-999",
  },
  {
    id: "src-vault",
    title: "vault-export-for-notebooklm",
    type: "google_docs",
    drive_doc_id: FIXTURE_DRIVE_DOC,
    can_sync: true,
  },
];

const DRIVE_SOURCE_LIST_WITHOUT_DOC_ID_FIXTURE = [
  {
    id: "src-vault-google-doc",
    title: "vault-export-for-notebooklm",
    type: "google_docs",
    can_sync: true,
  },
];

/**
 * @param {Record<string, string | undefined>} overrides
 * @param {(opts: { env: NodeJS.ProcessEnv; envPath: string }) => Promise<void>} fn
 */
async function withIsolatedEnv(overrides, fn) {
  const dir = await mkdtemp(join(tmpdir(), "session-close-env-"));
  const envPath = join(dir, "session-close.env");
  const sessionCloseOpts = { env: process.env, envPath };
  const prior = {};
  for (const key of [
    "NOTEBOOKLM_DRIVE_DOC_ID",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
    "NOTEBOOKLM_NOTEBOOK_IDS",
  ]) {
    prior[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }
  try {
    await fn(sessionCloseOpts);
  } finally {
    for (const key of Object.keys(prior)) {
      if (prior[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prior[key];
      }
    }
  }
}

describe("load-session-close-env (58-1)", () => {
  it("parseSessionCloseEnvFile reads quoted and export-prefixed values", () => {
    const parsed = parseSessionCloseEnvFile(`
# comment
export NOTEBOOKLM_DRIVE_DOC_ID="doc-123"
GOOGLE_CLIENT_ID=abc
`);
    assert.equal(parsed.NOTEBOOKLM_DRIVE_DOC_ID, "doc-123");
    assert.equal(parsed.GOOGLE_CLIENT_ID, "abc");
  });

  it("readSessionCloseEnvVar prefers process env over env file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "session-close-env-"));
    const envPath = join(dir, "session-close.env");
    await writeFile(envPath, "NOTEBOOKLM_DRIVE_DOC_ID=from-file\n", "utf8");
    await withIsolatedEnv({ NOTEBOOKLM_DRIVE_DOC_ID: "from-process" }, async () => {
      assert.equal(await readSessionCloseEnvVar("NOTEBOOKLM_DRIVE_DOC_ID", { envPath }), "from-process");
      await withIsolatedEnv({ NOTEBOOKLM_DRIVE_DOC_ID: undefined }, async () => {
        assert.equal(await readSessionCloseEnvVar("NOTEBOOKLM_DRIVE_DOC_ID", { envPath }), "from-file");
      });
    });
  });

  it("readSessionCloseEnvVar reads HERMES_HOME session-close.env under profile HOME", async () => {
    const hermesHome = await mkdtemp(join(tmpdir(), "session-close-hermes-home-"));
    await writeFile(join(hermesHome, "session-close.env"), "NOTEBOOKLM_DRIVE_DOC_ID=from-hermes-home\n", "utf8");
    const env = {
      HOME: join(hermesHome, "home"),
      HERMES_HOME: hermesHome,
    };
    assert.equal(defaultSessionCloseEnvPath(env), join(hermesHome, "session-close.env"));
    assert.equal(
      await readNotebooklmDriveDocId({ env }),
      "from-hermes-home",
    );
  });

  it("readSessionCloseEnvVar infers Hermes home from profile HOME when HERMES_HOME is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "session-close-hermes-profile-"));
    const hermesHome = join(dir, ".hermes");
    await mkdir(hermesHome, { recursive: true });
    await writeFile(join(hermesHome, "session-close.env"), "NOTEBOOKLM_DRIVE_DOC_ID=from-profile-home\n", "utf8");
    const env = {
      HOME: join(hermesHome, "home"),
    };
    assert.equal(defaultSessionCloseEnvPath(env), join(hermesHome, "session-close.env"));
    assert.equal(
      await readNotebooklmDriveDocId({ env }),
      "from-profile-home",
    );
  });

  it("resolveVaultExportFanoutMode selects drive-sync when doc id and oauth present", async () => {
    await withIsolatedEnv(
      {
        NOTEBOOKLM_DRIVE_DOC_ID: FIXTURE_DRIVE_DOC,
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_REFRESH_TOKEN: "refresh",
      },
      async (opts) => {
        const resolved = await resolveVaultExportFanoutMode(opts);
        assert.equal(resolved.mode, "drive-sync");
        assert.equal(resolved.oauthSetupRequired, false);
      },
    );
  });

  it("resolveVaultExportFanoutMode falls back when doc id missing", async () => {
    await withIsolatedEnv(
      {
        NOTEBOOKLM_DRIVE_DOC_ID: undefined,
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_REFRESH_TOKEN: "refresh",
      },
      async (opts) => {
        const resolved = await resolveVaultExportFanoutMode(opts);
        assert.equal(resolved.mode, "legacy-source-add");
      },
    );
  });

  it("resolveVaultExportFanoutMode falls back when oauth missing", async () => {
    await withIsolatedEnv(
      {
        NOTEBOOKLM_DRIVE_DOC_ID: FIXTURE_DRIVE_DOC,
        GOOGLE_CLIENT_ID: undefined,
        GOOGLE_CLIENT_SECRET: undefined,
        GOOGLE_REFRESH_TOKEN: undefined,
      },
      async (opts) => {
        const resolved = await resolveVaultExportFanoutMode(opts);
        assert.equal(resolved.mode, "legacy-source-add");
        assert.equal(resolved.oauthSetupRequired, true);
        assert.equal(await hasGoogleOAuthCredentials(opts), false);
        assert.equal(await readNotebooklmDriveDocId(opts), FIXTURE_DRIVE_DOC);
      },
    );
  });
});

describe("match-drive-source (58-1)", () => {
  it("matchDriveSourceByDocId matches drive_doc_id not title", () => {
    const matched = matchDriveSourceByDocId(DRIVE_SOURCE_LIST_FIXTURE, FIXTURE_DRIVE_DOC);
    assert.ok(matched);
    assert.equal(matched.sourceId, "src-vault");
    assert.notEqual(matched.sourceId, "src-other");
  });

  it("extractDriveDocIdFromSource parses document URL", () => {
    const id = extractDriveDocIdFromSource({
      id: "x",
      url: `https://docs.google.com/document/d/${FIXTURE_DRIVE_DOC}/edit`,
    });
    assert.equal(id, FIXTURE_DRIVE_DOC);
  });
});

describe("sync-vault-export-drive (58-1)", () => {
  it("parseNlmDriveSourceList requires array JSON", () => {
    assert.deepEqual(parseNlmDriveSourceList("[]"), []);
    assert.throws(() => parseNlmDriveSourceList('{"id":"x"}'), /JSON array/);
  });

  it("syncNotebookDriveSource runs list then sync for matching drive_doc_id", async () => {
    const calls = [];
    const runNlm = async (_cmd, args) => {
      calls.push(args.join(" "));
      if (args.includes("list")) {
        return { stdout: JSON.stringify(DRIVE_SOURCE_LIST_FIXTURE) };
      }
      return { stdout: "{}" };
    };
    const result = await syncNotebookDriveSource(FIXTURE_NOTEBOOK, FIXTURE_DRIVE_DOC, runNlm);
    assert.equal(result.status, "ok");
    assert.equal(result.driveSourceId, "src-vault");
    assert.ok(calls.some((c) => c.includes("source list")));
    assert.ok(calls.some((c) => c.includes("source sync") && c.includes("src-vault")));
  });

  it("syncNotebookDriveSource falls back to google_docs source when drive_doc_id is absent", async () => {
    const calls = [];
    const runNlm = async (_cmd, args) => {
      calls.push(args.join(" "));
      if (args.includes("list")) {
        return { stdout: JSON.stringify(DRIVE_SOURCE_LIST_WITHOUT_DOC_ID_FIXTURE) };
      }
      return { stdout: "{}" };
    };
    const result = await syncNotebookDriveSource(FIXTURE_NOTEBOOK, FIXTURE_DRIVE_DOC, runNlm);
    assert.equal(result.status, "ok");
    assert.equal(result.driveSourceId, "src-vault-google-doc");
    assert.ok(
      calls.some((c) => c.includes("source sync") && c.includes("src-vault-google-doc")),
    );
  });

  it("runSyncVaultExportDrive marks targets drive_write_error when drive write failed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sync-drive-write-fail-"));
    const reportPath = join(dir, "close-report.json");
    await writeFile(
      reportPath,
      `${JSON.stringify({
        steps: {
          export: { status: "ok" },
          drive_write: { status: "failed", message: "Google OAuth token refresh failed" },
        },
        notebooklm_targets: [
          { notebook_id: FIXTURE_NOTEBOOK, title: "Test", export_path: "/tmp/export.md" },
        ],
      })}\n`,
      "utf8",
    );
    const result = await runSyncVaultExportDrive(reportPath, { driveDocId: FIXTURE_DRIVE_DOC });
    assert.equal(result.reason, "drive-write-failed");
    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    const row = saved.notebooklm_targets[0];
    assert.equal(row.fanout_status, "failed");
    assert.equal(row.error_class, "drive_write_error");
    assert.equal(row.drive_doc_id, FIXTURE_DRIVE_DOC);
    assert.equal(saved.notebooklm_fanout_mode, "drive-sync");
  });

  it("runSyncVaultExportDrive skips sync when steps.drive_write is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sync-drive-write-missing-"));
    const reportPath = join(dir, "close-report.json");
    await writeFile(
      reportPath,
      `${JSON.stringify({
        steps: { export: { status: "ok" } },
        notebooklm_targets: [
          { notebook_id: FIXTURE_NOTEBOOK, title: "Test", export_path: "/tmp/export.md" },
        ],
      })}\n`,
      "utf8",
    );
    const result = await runSyncVaultExportDrive(reportPath, { driveDocId: FIXTURE_DRIVE_DOC });
    assert.equal(result.reason, "drive-write-failed");
    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(saved.notebooklm_targets[0].error_class, "drive_write_error");
  });

  it("runSyncVaultExportDrive persists drive_source_id on successful sync", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sync-drive-ok-"));
    const reportPath = join(dir, "close-report.json");
    await writeFile(
      reportPath,
      `${JSON.stringify({
        steps: {
          export: { status: "ok" },
          drive_write: { status: "ok", message: "drive doc overwritten" },
        },
        deterministic: { export_bytes: 100 },
        notebooklm_targets: [
          { notebook_id: FIXTURE_NOTEBOOK, title: "Test", export_path: "/tmp/export.md" },
        ],
      })}\n`,
      "utf8",
    );
    const runNlm = async (_cmd, args) => {
      if (args.includes("list")) {
        return { stdout: JSON.stringify(DRIVE_SOURCE_LIST_FIXTURE) };
      }
      return { stdout: "{}" };
    };
    const result = await runSyncVaultExportDrive(reportPath, {
      driveDocId: FIXTURE_DRIVE_DOC,
      runNlm,
    });
    assert.equal(result.synced, 1);
    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    const row = saved.notebooklm_targets[0];
    assert.equal(row.fanout_status, "ok");
    assert.equal(row.drive_source_id, "src-vault");
    assert.equal(row.drive_doc_id, FIXTURE_DRIVE_DOC);
  });

  it("appendDriveSyncFailureLogs writes full stderr before close-report sanitization", async () => {
    const dir = await mkdtemp(join(tmpdir(), "drive-sync-log-"));
    const logPath = join(dir, "session-close-drive-sync.log");
    const longStderr = `Traceback (most recent call last):\n${"x".repeat(400)}`;

    await appendDriveSyncFailureLogs(
      [
        { notebook_id: FIXTURE_NOTEBOOK, status: "ok" },
        { notebook_id: "other", status: "failed", stderr: longStderr },
      ],
      { logPath },
    );

    const logged = await readFile(logPath, "utf8");
    assert.ok(logged.includes(`notebook_id=other`));
    assert.ok(logged.includes(longStderr));
    assert.ok(logged.length > 160);
  });

  it("runSyncVaultExportDrive logs full stderr and classifies nlm_cli_exception", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sync-drive-nlm-exc-"));
    const reportPath = join(dir, "close-report.json");
    const logPath = join(dir, "session-close-drive-sync.log");
    const longStderr = `╭─ Error ─────────────────────╮\n│ sync failed                 │\n╰─────────────────────────────╯\n${"y".repeat(300)}`;
    await writeFile(
      reportPath,
      `${JSON.stringify({
        steps: {
          export: { status: "ok" },
          drive_write: { status: "ok", message: "drive doc overwritten" },
        },
        deterministic: { export_bytes: 100 },
        notebooklm_targets: [
          { notebook_id: FIXTURE_NOTEBOOK, title: "Test", export_path: "/tmp/export.md" },
        ],
      })}\n`,
      "utf8",
    );
    const runNlm = async (_cmd, args) => {
      if (args.includes("list")) {
        return { stdout: JSON.stringify(DRIVE_SOURCE_LIST_FIXTURE) };
      }
      const err = /** @type {Error & { stderr?: string }} */ (new Error("nlm source sync failed"));
      err.stderr = longStderr;
      throw err;
    };

    await runSyncVaultExportDrive(reportPath, {
      driveDocId: FIXTURE_DRIVE_DOC,
      runNlm,
      driveSyncLogPath: logPath,
    });

    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    const row = saved.notebooklm_targets[0];
    assert.equal(row.fanout_status, "failed");
    assert.equal(row.error_class, "nlm_cli_exception");
    assert.ok(typeof row.error_snippet === "string");
    assert.ok(row.error_snippet.length <= 160);

    const logged = await readFile(logPath, "utf8");
    assert.ok(logged.includes(longStderr));
  });

  it("merge applies drive_write_error when explicit error_class set", async () => {
    const report = {
      deterministic: { export_bytes: 100 },
      notebooklm_targets: [
        { notebook_id: FIXTURE_NOTEBOOK, title: "Test", export_path: "/tmp/export.md" },
      ],
    };
    const { report: merged } = await mergeFanoutIntoCloseReport(report, {
      notebook_id: FIXTURE_NOTEBOOK,
      status: "failed",
      stderr: "Google Docs batchUpdate failed",
      error_class: "drive_write_error",
    });
    const row = merged.notebooklm_targets[0];
    assert.equal(row.fanout_status, "failed");
    assert.equal(row.error_class, "drive_write_error");
  });
});

describe("record-notebooklm-fanout-mode (58-1)", () => {
  it("patches close-report with legacy deprecation when doc id missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fanout-mode-"));
    const reportPath = join(dir, "close-report.json");
    await writeFile(
      reportPath,
      `${JSON.stringify({
        notebooklm_targets: [{ notebook_id: FIXTURE_NOTEBOOK }],
      })}\n`,
      "utf8",
    );
    await withIsolatedEnv({ NOTEBOOKLM_DRIVE_DOC_ID: undefined }, async (opts) => {
      const resolved = await recordNotebooklmFanoutMode(reportPath, opts);
      assert.equal(resolved.mode, "legacy-source-add");
      const saved = JSON.parse(await readFile(reportPath, "utf8"));
      assert.equal(saved.notebooklm_fanout_mode, "legacy-source-add");
      assert.equal(saved.legacy_fanout_deprecation, true);
    });
  });
});
