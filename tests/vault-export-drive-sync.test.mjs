import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
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
  parseNlmDriveSourceList,
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

/**
 * @param {Record<string, string | undefined>} overrides
 * @param {() => Promise<void>} fn
 */
async function withIsolatedEnv(overrides, fn) {
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
    await fn();
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

  it("resolveVaultExportFanoutMode selects drive-sync when doc id and oauth present", async () => {
    await withIsolatedEnv(
      {
        NOTEBOOKLM_DRIVE_DOC_ID: FIXTURE_DRIVE_DOC,
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_REFRESH_TOKEN: "refresh",
      },
      async () => {
        const resolved = await resolveVaultExportFanoutMode();
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
      async () => {
        const resolved = await resolveVaultExportFanoutMode();
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
      async () => {
        const resolved = await resolveVaultExportFanoutMode();
        assert.equal(resolved.mode, "legacy-source-add");
        assert.equal(resolved.oauthSetupRequired, true);
        assert.equal(await hasGoogleOAuthCredentials(), false);
        assert.equal(await readNotebooklmDriveDocId(), FIXTURE_DRIVE_DOC);
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
    await withIsolatedEnv({ NOTEBOOKLM_DRIVE_DOC_ID: undefined }, async () => {
      const resolved = await recordNotebooklmFanoutMode(reportPath);
      assert.equal(resolved.mode, "legacy-source-add");
      const saved = JSON.parse(await readFile(reportPath, "utf8"));
      assert.equal(saved.notebooklm_fanout_mode, "legacy-source-add");
      assert.equal(saved.legacy_fanout_deprecation, true);
    });
  });
});
