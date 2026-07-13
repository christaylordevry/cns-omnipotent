import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
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
import { isTimeoutError } from "../scripts/session-close/lib/nlm-auth-watchdog.mjs";
import { resolveOperatorHome } from "../scripts/session-close/lib/operator-home.mjs";
import { mergeFanoutIntoCloseReport } from "../scripts/session-close/merge-notebooklm-fanout.mjs";
import { recordNotebooklmFanoutMode } from "../scripts/session-close/record-notebooklm-fanout-mode.mjs";
import {
  appendDriveSyncFailureLogs,
  matchGoogleDocsSourceFallback,
  matchWordDocVaultExportFallback,
  NLM_EXEC_TIMEOUT_MS,
  parseNlmDriveSourceList,
  runSyncVaultExportDrive,
  syncNotebookDriveSource,
  VAULT_EXPORT_SOURCE_TITLE,
} from "../scripts/session-close/sync-vault-export-drive.mjs";
import { runWriteVaultExportToDrive } from "../scripts/session-close/write-vault-export-to-drive.mjs";
import {
  escapeHtmlForPdf,
  wrapMarkdownAsPrintHtml,
} from "../scripts/session-close/lib/render-vault-export-pdf.mjs";
import { overwriteDrivePdfContent } from "../scripts/session-close/lib/google-drive-pdf-write.mjs";

/** Obviously fake — never a production NotebookLM notebook id. */
const FIXTURE_NOTEBOOK = "00000000-0000-4000-a000-ffffffffffff";
const FIXTURE_NOTEBOOK_2 = "00000000-0000-4000-a000-fffffffffffe";
const FIXTURE_NOTEBOOK_3 = "00000000-0000-4000-a000-fffffffffffd";
const FIXTURE_DRIVE_DOC = "1AbCdEfGhIjKlMnOpQrStUvWxYz";
const PRODUCTION_NOTEBOOK_IDS = new Set([
  "981466f0-de1c-4551-93a9-f3bc2a24b184",
  "dc6abf1a-99d2-428d-af63-107591ff2c2e",
  "f037c741-f7e1-4a90-880f-d2d38986767b",
]);

/**
 * @param {string} dir
 */
function tmpDriveSyncLogPath(dir) {
  return join(dir, "session-close-drive-sync.log");
}

/**
 * @returns {Error & { killed: boolean; signal: string; code: string }}
 */
function makeTimeoutError(message = "timed out") {
  const err = /** @type {Error & { killed: boolean; signal: string; code: string }} */ (
    new Error(message)
  );
  err.killed = true;
  err.signal = "SIGTERM";
  err.code = "ETIMEDOUT";
  return err;
}

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

/** Spike-shaped PDF payload: type word_doc, no drive_doc_id/url. */
const DRIVE_SOURCE_LIST_PDF_WORD_DOC_FIXTURE = [
  {
    id: "src-old-doc",
    title: "vault-export-for-notebooklm",
    type: "google_docs",
    drive_doc_id: "legacy-doc-id-should-not-match-pdf-id",
  },
  {
    id: "src-unrelated-pdf",
    title: "random-other.pdf",
    type: "word_doc",
    url: null,
    is_stale: false,
  },
  {
    id: "src-vault-pdf",
    title: "vault-export-for-notebooklm.pdf",
    type: "word_doc",
    url: null,
    is_stale: true,
  },
];

const DRIVE_SOURCE_LIST_PDF_ONLY_FIXTURE = [
  {
    id: "src-unrelated-pdf",
    title: "CNS-SPIKE-other.pdf",
    type: "word_doc",
    url: null,
  },
  {
    id: "src-vault-pdf",
    title: VAULT_EXPORT_SOURCE_TITLE,
    type: "word_doc",
    url: null,
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

describe("render-vault-export-pdf helpers (58-3)", () => {
  it("escapeHtmlForPdf escapes markup and wrapMarkdownAsPrintHtml embeds text", () => {
    assert.equal(escapeHtmlForPdf("a <b> & c"), "a &lt;b&gt; &amp; c");
    const html = wrapMarkdownAsPrintHtml("# Title\n");
    assert.match(html, /# Title/);
    assert.match(html, /white-space:pre-wrap/);
  });

  it("renderVaultExportPdf with mock chromium writes %PDF magic", async () => {
    const { renderVaultExportPdf } = await import(
      "../scripts/session-close/lib/render-vault-export-pdf.mjs"
    );
    const dir = await mkdtemp(join(tmpdir(), "render-pdf-"));
    const outPath = join(dir, "out.pdf");
    const fakePdf = Buffer.from("%PDF-1.4 mock extractable text");
    const chromium = {
      launch: async () => ({
        newPage: async () => ({
          setContent: async () => {},
          pdf: async () => fakePdf,
        }),
        close: async () => {},
      }),
    };
    const result = await renderVaultExportPdf({
      markdown: "# hello\n",
      outputPath: outPath,
      chromium,
    });
    assert.equal(result.bytes.slice(0, 5).toString("utf8"), "%PDF-");
    assert.ok(result.bytes.length > 8);
  });
});

describe("google-drive-pdf-write (58-3)", () => {
  it("overwriteDrivePdfContent PATCHes uploadType=media with application/pdf", async () => {
    /** @type {Array<{ url: string; init?: RequestInit }>} */
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: "test-token" }),
        };
      }
      return { ok: true, status: 200, text: async () => "{}" };
    };
    const pdfBytes = Buffer.from("%PDF-1.4 test");
    await overwriteDrivePdfContent({
      fileId: FIXTURE_DRIVE_DOC,
      pdfBytes,
      clientId: "id",
      clientSecret: "secret",
      refreshToken: "refresh",
      fetchFn,
    });
    const media = calls.find((c) => String(c.url).includes("uploadType=media"));
    assert.ok(media);
    assert.equal(media.init?.method, "PATCH");
    assert.match(String(media.url), /upload\/drive\/v3\/files\//);
    assert.equal(
      /** @type {Record<string, string>} */ (media.init?.headers)?.["Content-Type"],
      "application/pdf",
    );
    assert.equal(media.init?.body, pdfBytes);
  });
});

describe("write-vault-export-to-drive (58-3)", () => {
  it("runWriteVaultExportToDrive renders PDF then media-uploads (not Docs batchUpdate)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "write-drive-hermes-cwd-"));
    const repoRoot = join(dir, "repo");
    const exportPath = join(repoRoot, "scripts/output/vault-export-for-notebooklm.md");
    const reportPath = join(repoRoot, ".session-close", "close-report.json");
    await mkdir(dirname(exportPath), { recursive: true });
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(exportPath, "# vault export\n", "utf8");
    await writeFile(
      reportPath,
      `${JSON.stringify({
        repo_root: repoRoot,
        deterministic: { export_path: exportPath, export_bytes: 18 },
      })}\n`,
      "utf8",
    );

    const fetchCalls = [];
    const fetchFn = async (url, init) => {
      fetchCalls.push({ url: String(url), method: init?.method });
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ access_token: "test-token" }),
        };
      }
      if (String(url).includes("uploadType=media")) {
        return { ok: true, status: 200, text: async () => "{}" };
      }
      return { ok: false, status: 500, text: async () => "unexpected" };
    };

    const fakePdf = Buffer.from("%PDF-1.4 mock");
    const chromium = {
      launch: async () => ({
        newPage: async () => ({
          setContent: async () => {},
          pdf: async () => fakePdf,
        }),
        close: async () => {},
      }),
    };

    const result = await runWriteVaultExportToDrive({
      reportPath,
      docId: FIXTURE_DRIVE_DOC,
      env: {
        HOME: join(dir, ".hermes", "home"),
        HERMES_HOME: join(dir, ".hermes"),
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_REFRESH_TOKEN: "refresh",
        NOTEBOOKLM_DRIVE_DOC_ID: FIXTURE_DRIVE_DOC,
      },
      fetchFn,
      chromium,
    });

    assert.equal(result.ok, true);
    assert.equal(result.message, "drive pdf overwritten");
    assert.ok(fetchCalls.some((c) => c.url.includes("uploadType=media") && c.method === "PATCH"));
    assert.ok(!fetchCalls.some((c) => c.url.includes(":batchUpdate")));
    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(saved.steps.drive_write.status, "ok");
    assert.equal(saved.steps.drive_write.message, "drive pdf overwritten");
  });

  it("runWriteVaultExportToDrive skips empty export with a clear message", async () => {
    const dir = await mkdtemp(join(tmpdir(), "write-drive-empty-export-"));
    const repoRoot = join(dir, "repo");
    const exportPath = join(repoRoot, "scripts/output/vault-export-for-notebooklm.md");
    const reportPath = join(repoRoot, ".session-close", "close-report.json");
    await mkdir(dirname(exportPath), { recursive: true });
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(exportPath, "", "utf8");
    await writeFile(
      reportPath,
      `${JSON.stringify({
        deterministic: { export_path: exportPath, export_bytes: 0 },
      })}\n`,
      "utf8",
    );

    const result = await runWriteVaultExportToDrive({
      reportPath,
      docId: FIXTURE_DRIVE_DOC,
      env: {
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_REFRESH_TOKEN: "refresh",
        NOTEBOOKLM_DRIVE_DOC_ID: FIXTURE_DRIVE_DOC,
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.reason, "export-empty");
    assert.match(result.message, /export markdown empty/);
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

  it("matchWordDocVaultExportFallback anchors to vault-export title not first word_doc", () => {
    const matched = matchWordDocVaultExportFallback(DRIVE_SOURCE_LIST_PDF_WORD_DOC_FIXTURE);
    assert.ok(matched);
    assert.equal(matched.sourceId, "src-vault-pdf");
    assert.notEqual(matched.sourceId, "src-unrelated-pdf");
  });

  it("match cascade: drive_doc_id first, then google_docs, then title-anchored word_doc", () => {
    assert.equal(
      matchDriveSourceByDocId(DRIVE_SOURCE_LIST_PDF_WORD_DOC_FIXTURE, FIXTURE_DRIVE_DOC),
      null,
    );
    const byDocs = matchGoogleDocsSourceFallback(DRIVE_SOURCE_LIST_PDF_WORD_DOC_FIXTURE);
    assert.equal(byDocs?.sourceId, "src-old-doc");
    const byWord = matchWordDocVaultExportFallback(DRIVE_SOURCE_LIST_PDF_ONLY_FIXTURE);
    assert.equal(byWord?.sourceId, "src-vault-pdf");
  });

  it("syncNotebookDriveSource falls back to title-anchored word_doc for PDF sources", async () => {
    const calls = [];
    const runNlm = async (_cmd, args) => {
      calls.push(args.join(" "));
      if (args.includes("list")) {
        return { stdout: JSON.stringify(DRIVE_SOURCE_LIST_PDF_ONLY_FIXTURE) };
      }
      return { stdout: "{}" };
    };
    const result = await syncNotebookDriveSource(FIXTURE_NOTEBOOK, FIXTURE_DRIVE_DOC, runNlm);
    assert.equal(result.status, "ok");
    assert.equal(result.driveSourceId, "src-vault-pdf");
    assert.ok(calls.some((c) => c.includes("source sync") && c.includes("src-vault-pdf")));
  });

  it("syncNotebookDriveSource prefers google_docs over word_doc during migration", async () => {
    const result = await syncNotebookDriveSource(
      FIXTURE_NOTEBOOK,
      FIXTURE_DRIVE_DOC,
      async (_cmd, args) => {
        if (args.includes("list")) {
          return { stdout: JSON.stringify(DRIVE_SOURCE_LIST_PDF_WORD_DOC_FIXTURE) };
        }
        return { stdout: "{}" };
      },
    );
    assert.equal(result.status, "ok");
    assert.equal(result.driveSourceId, "src-old-doc");
  });

  it("syncNotebookDriveSource migration-miss message mentions PDF", async () => {
    const result = await syncNotebookDriveSource(
      FIXTURE_NOTEBOOK,
      FIXTURE_DRIVE_DOC,
      async (_cmd, args) => {
        if (args.includes("list")) {
          return {
            stdout: JSON.stringify([
              { id: "x", title: "unrelated.pdf", type: "word_doc", url: null },
            ]),
          };
        }
        return { stdout: "{}" };
      },
    );
    assert.equal(result.status, "failed");
    assert.match(result.stderr ?? "", /PDF/);
    assert.match(result.stderr ?? "", /vault-export-for-notebooklm/);
  });

  it("runSyncVaultExportDrive marks targets drive_write_error when drive write failed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sync-drive-write-fail-"));
    const reportPath = join(dir, "close-report.json");
    const logPath = tmpDriveSyncLogPath(dir);
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
    const result = await runSyncVaultExportDrive(reportPath, {
      driveDocId: FIXTURE_DRIVE_DOC,
      driveSyncLogPath: logPath,
    });
    assert.equal(result.reason, "drive-write-failed");
    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    const row = saved.notebooklm_targets[0];
    assert.equal(row.fanout_status, "failed");
    assert.equal(row.error_class, "drive_write_error");
    assert.equal(row.drive_doc_id, FIXTURE_DRIVE_DOC);
    assert.equal(saved.notebooklm_fanout_mode, "drive-sync");
    assert.ok(!saved.drive_sync_phase);
  });

  it("runSyncVaultExportDrive skips sync when steps.drive_write is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sync-drive-write-missing-"));
    const reportPath = join(dir, "close-report.json");
    const logPath = tmpDriveSyncLogPath(dir);
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
    const result = await runSyncVaultExportDrive(reportPath, {
      driveDocId: FIXTURE_DRIVE_DOC,
      driveSyncLogPath: logPath,
    });
    assert.equal(result.reason, "drive-write-failed");
    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(saved.notebooklm_targets[0].error_class, "drive_write_error");
  });

  it("runSyncVaultExportDrive persists drive_source_id on successful sync", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sync-drive-ok-"));
    const reportPath = join(dir, "close-report.json");
    const logPath = tmpDriveSyncLogPath(dir);
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
      driveSyncLogPath: logPath,
    });
    assert.equal(result.synced, 1);
    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    const row = saved.notebooklm_targets[0];
    assert.equal(row.fanout_status, "ok");
    assert.equal(row.drive_source_id, "src-vault");
    assert.equal(row.drive_doc_id, FIXTURE_DRIVE_DOC);
    assert.ok(typeof saved.drive_sync_phase?.started_at === "string");
    assert.ok(typeof saved.drive_sync_phase?.finished_at === "string");
  });

  it("appendDriveSyncFailureLogs writes full stderr before close-report sanitization", async () => {
    const dir = await mkdtemp(join(tmpdir(), "drive-sync-log-"));
    const logPath = tmpDriveSyncLogPath(dir);
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
    const logPath = tmpDriveSyncLogPath(dir);
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

  it("fixture notebook ids are never production notebook UUIDs", () => {
    assert.ok(!PRODUCTION_NOTEBOOK_IDS.has(FIXTURE_NOTEBOOK));
    assert.ok(!PRODUCTION_NOTEBOOK_IDS.has(FIXTURE_NOTEBOOK_2));
    assert.ok(!PRODUCTION_NOTEBOOK_IDS.has(FIXTURE_NOTEBOOK_3));
    assert.equal(NLM_EXEC_TIMEOUT_MS, 25_000);
  });

  it("default drive-sync log path resolves into sandbox HOME (never real operator HOME)", async () => {
    const sandboxHome = await mkdtemp(join(tmpdir(), "drive-sync-sandbox-home-"));
    const env = { HOME: sandboxHome };
    const resolvedHome = await resolveOperatorHome(env);
    assert.equal(resolvedHome, sandboxHome);
    const defaultLogPath = join(sandboxHome, ".hermes", "logs", "session-close-drive-sync.log");

    const reportPath = join(sandboxHome, "close-report.json");
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

    // Intentionally omit driveSyncLogPath — default must use opts.env HOME.
    await runSyncVaultExportDrive(reportPath, {
      driveDocId: FIXTURE_DRIVE_DOC,
      env,
    });

    const logged = await readFile(defaultLogPath, "utf8");
    assert.ok(logged.includes("Google OAuth token refresh failed"));
    assert.ok(defaultLogPath.startsWith(sandboxHome));

    // Ok-path with default log under same sandbox (no driveSyncLogPath).
    const okReportPath = join(sandboxHome, "close-report-ok.json");
    await writeFile(
      okReportPath,
      `${JSON.stringify({
        steps: {
          export: { status: "ok" },
          drive_write: { status: "ok", message: "drive pdf overwritten" },
        },
        deterministic: { export_bytes: 100 },
        notebooklm_targets: [
          { notebook_id: FIXTURE_NOTEBOOK, title: "Test", export_path: "/tmp/export.md" },
        ],
      })}\n`,
      "utf8",
    );
    const fingerprintBefore = await stat(defaultLogPath);
    await runSyncVaultExportDrive(okReportPath, {
      driveDocId: FIXTURE_DRIVE_DOC,
      env,
      runNlm: async (_cmd, args) => {
        if (args.includes("list")) {
          return { stdout: JSON.stringify(DRIVE_SOURCE_LIST_FIXTURE) };
        }
        return { stdout: "{}" };
      },
    });
    const fingerprintAfter = await stat(defaultLogPath);
    assert.equal(fingerprintAfter.size, fingerprintBefore.size);
    assert.equal(fingerprintAfter.mtimeMs, fingerprintBefore.mtimeMs);
  });

  it("incremental merge stamps notebook 1 before notebook 2 finishes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sync-drive-incremental-"));
    const reportPath = join(dir, "close-report.json");
    const logPath = tmpDriveSyncLogPath(dir);
    await writeFile(
      reportPath,
      `${JSON.stringify({
        steps: {
          export: { status: "ok" },
          drive_write: { status: "ok", message: "drive pdf overwritten" },
        },
        deterministic: { export_bytes: 100 },
        notebooklm_targets: [
          { notebook_id: FIXTURE_NOTEBOOK, title: "NB1", export_path: "/tmp/export.md" },
          { notebook_id: FIXTURE_NOTEBOOK_2, title: "NB2", export_path: "/tmp/export.md" },
        ],
      })}\n`,
      "utf8",
    );

    /** @type {(() => void) | undefined} */
    let releaseNb2;
    const nb2Gate = new Promise((resolve) => {
      releaseNb2 = resolve;
    });

    const runNlm = async (_cmd, args) => {
      const notebookId = args[2];
      if (args.includes("list")) {
        if (notebookId === FIXTURE_NOTEBOOK_2) {
          await nb2Gate;
        }
        return { stdout: JSON.stringify(DRIVE_SOURCE_LIST_FIXTURE) };
      }
      return { stdout: "{}" };
    };

    const syncPromise = runSyncVaultExportDrive(reportPath, {
      driveDocId: FIXTURE_DRIVE_DOC,
      runNlm,
      driveSyncLogPath: logPath,
    });

    let observedMidRun = false;
    for (let i = 0; i < 100; i += 1) {
      await delay(20);
      const mid = JSON.parse(await readFile(reportPath, "utf8"));
      const nb1 = mid.notebooklm_targets.find((r) => r.notebook_id === FIXTURE_NOTEBOOK);
      const nb2 = mid.notebooklm_targets.find((r) => r.notebook_id === FIXTURE_NOTEBOOK_2);
      if (nb1?.fanout_status === "ok" && !nb2?.fanout_status) {
        assert.ok(typeof mid.drive_sync_phase?.started_at === "string");
        assert.equal(mid.drive_sync_phase?.finished_at, undefined);
        observedMidRun = true;
        releaseNb2?.();
        break;
      }
    }
    assert.equal(observedMidRun, true, "expected notebook 1 stamped before notebook 2");
    await syncPromise;

    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(saved.notebooklm_targets[0].fanout_status, "ok");
    assert.equal(saved.notebooklm_targets[1].fanout_status, "ok");
    assert.ok(typeof saved.drive_sync_phase.finished_at === "string");
  });

  it("list timeout maps to nlm_list_timeout and sync timeout to nlm_sync_timeout", async () => {
    assert.equal(isTimeoutError(makeTimeoutError()), true);

    const listResult = await syncNotebookDriveSource(
      FIXTURE_NOTEBOOK,
      FIXTURE_DRIVE_DOC,
      async (_cmd, args) => {
        if (args.includes("list")) {
          throw makeTimeoutError("nlm source list timed out");
        }
        return { stdout: "{}" };
      },
    );
    assert.equal(listResult.status, "failed");
    assert.equal(listResult.errorClass, "nlm_list_timeout");

    const syncResult = await syncNotebookDriveSource(
      FIXTURE_NOTEBOOK,
      FIXTURE_DRIVE_DOC,
      async (_cmd, args) => {
        if (args.includes("list")) {
          return { stdout: JSON.stringify(DRIVE_SOURCE_LIST_FIXTURE) };
        }
        throw makeTimeoutError("nlm source sync timed out");
      },
    );
    assert.equal(syncResult.status, "failed");
    assert.equal(syncResult.errorClass, "nlm_sync_timeout");
    assert.equal(syncResult.driveSourceId, "src-vault");

    const dir = await mkdtemp(join(tmpdir(), "sync-drive-list-timeout-"));
    const reportPath = join(dir, "close-report.json");
    const logPath = tmpDriveSyncLogPath(dir);
    await writeFile(
      reportPath,
      `${JSON.stringify({
        steps: {
          export: { status: "ok" },
          drive_write: { status: "ok", message: "drive pdf overwritten" },
        },
        deterministic: { export_bytes: 100 },
        notebooklm_targets: [
          { notebook_id: FIXTURE_NOTEBOOK, title: "Test", export_path: "/tmp/export.md" },
        ],
      })}\n`,
      "utf8",
    );
    await runSyncVaultExportDrive(reportPath, {
      driveDocId: FIXTURE_DRIVE_DOC,
      driveSyncLogPath: logPath,
      runNlm: async (_cmd, args) => {
        if (args.includes("list")) {
          throw makeTimeoutError("list timeout");
        }
        return { stdout: "{}" };
      },
    });
    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(saved.notebooklm_targets[0].error_class, "nlm_list_timeout");
  });

  it("concurrent notebooks all stamp under parallel merges", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sync-drive-concurrent-"));
    const reportPath = join(dir, "close-report.json");
    const logPath = tmpDriveSyncLogPath(dir);
    const ids = [FIXTURE_NOTEBOOK, FIXTURE_NOTEBOOK_2, FIXTURE_NOTEBOOK_3];
    await writeFile(
      reportPath,
      `${JSON.stringify({
        steps: {
          export: { status: "ok" },
          drive_write: { status: "ok", message: "drive pdf overwritten" },
        },
        deterministic: { export_bytes: 100 },
        notebooklm_targets: ids.map((notebook_id, i) => ({
          notebook_id,
          title: `NB${i + 1}`,
          export_path: "/tmp/export.md",
        })),
      })}\n`,
      "utf8",
    );

    /** @type {Map<string, number>} */
    const listStarts = new Map();
    const runNlm = async (_cmd, args) => {
      const notebookId = args[2];
      if (args.includes("list")) {
        listStarts.set(notebookId, Date.now());
        await delay(30);
        return { stdout: JSON.stringify(DRIVE_SOURCE_LIST_FIXTURE) };
      }
      return { stdout: "{}" };
    };

    const result = await runSyncVaultExportDrive(reportPath, {
      driveDocId: FIXTURE_DRIVE_DOC,
      runNlm,
      driveSyncLogPath: logPath,
    });
    assert.equal(result.synced, 3);
    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    for (const id of ids) {
      const row = saved.notebooklm_targets.find((r) => r.notebook_id === id);
      assert.equal(row.fanout_status, "ok");
      assert.equal(row.drive_source_id, "src-vault");
    }
    assert.ok(typeof saved.drive_sync_phase.started_at === "string");
    assert.ok(typeof saved.drive_sync_phase.finished_at === "string");
    assert.ok(listStarts.size === 3);
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
