#!/usr/bin/env node
/**
 * Phase A session-close orchestrator (FR-17, SC-2).
 *
 * Operator contract: OMNIPOTENT_REPO must point at the same Omnipotent.md tree where
 * this script is installed. Export and npm steps resolve paths from the script install
 * root (OMNIPOTENT_INSTALL_ROOT), not a secondary clone. Hermes should set
 * OMNIPOTENT_REPO to the absolute repo path before invoking this entrypoint.
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { buildContextPack, writeContextPack } from "./prepare-context.mjs";
import { runRefreshDailyRhythm } from "./refresh-daily-rhythm.mjs";
import { DEFAULT_REGISTRY_PATH, readRegistry } from "./sync-notebooks.mjs";
import {
  evaluatePhaseACompletion,
  formatPhaseAGateError,
  recordPhaseAGateFailure,
} from "./lib/phase-a-completion-gate.mjs";
import { resolvePaths } from "./lib/paths.mjs";
import { formatPriorFanoutSummary } from "./lib/update-memory-cns-state.mjs";
import { runWriteMemory } from "./write-memory.mjs";

export { evaluatePhaseACompletion, PHASE_A_REQUIRED_PACK_KEYS } from "./lib/phase-a-completion-gate.mjs";

/**
 * SC-3 / ADR: MEMORY and daily rhythm run after apply-section8 in the full Hermes
 * close (steps 6–7). This orchestrator invokes them after test capture on real
 * close so AGENTS_VERSION and MEMORY reflect vault AGENTS as of Phase A; SC-5
 * skill ordering may re-run post-apply-section8 when SC-4 ships.
 */

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OMNIPOTENT_INSTALL_ROOT = dirname(dirname(SCRIPT_DIR));
const NPM_ENV_SH = join(SCRIPT_DIR, "lib", "npm-env.sh");
const NOTEBOOK_HEALTH_MUTATION_PATH = "notebookHealth:upsertNotebookHealthSnapshot";
const DEFAULT_TREND_INGEST_ENV_PATH = join(homedir(), ".hermes", "trend-ingest.env");

const FAST_SCAN_ROW_RE = /^(SRC|INS|SYN|DLY|OTH)\s/;

/**
 * @param {unknown} row
 * @returns {string | null}
 */
function getNotebookLastUpdated(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }
  const record = /** @type {{ last_updated?: unknown; updated_at?: unknown }} */ (row);
  if (typeof record.last_updated === "string") {
    return record.last_updated;
  }
  if (typeof record.updated_at === "string") {
    return record.updated_at;
  }
  return null;
}

/**
 * @param {unknown} row
 * @returns {{ id: string; title: string } | null}
 */
function parseRoutingNotebook(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return null;
  }
  const record = /** @type {{ id?: unknown; notebook_id?: unknown; title?: unknown }} */ (row);
  const id =
    typeof record.id === "string"
      ? record.id
      : typeof record.notebook_id === "string"
        ? record.notebook_id
        : "";
  if (!id) {
    return null;
  }
  return {
    id,
    title: typeof record.title === "string" && record.title ? record.title : id,
  };
}

/**
 * @typedef {'success' | 'error' | 'unknown'} NotebookFanoutHealthStatus
 */

/**
 * @typedef {{
 *   lastFanoutStatus: NotebookFanoutHealthStatus;
 *   lastErrorClass: string | null;
 *   lastFanoutAt: number | null;
 * }} NotebookFanoutHealthFields
 */

/**
 * @param {unknown} target
 * @param {string | null | undefined} reportGeneratedAt
 * @returns {NotebookFanoutHealthFields}
 */
export function mapFanoutTargetToHealthFields(target, reportGeneratedAt) {
  const record =
    target && typeof target === "object" && !Array.isArray(target)
      ? /** @type {{ fanout_status?: unknown; error_class?: unknown }} */ (target)
      : null;
  const status = record?.fanout_status;
  let lastFanoutStatus = /** @type {NotebookFanoutHealthStatus} */ ("unknown");
  if (status === "ok") {
    lastFanoutStatus = "success";
  } else if (status === "failed") {
    lastFanoutStatus = "error";
  }
  const lastErrorClass =
    lastFanoutStatus === "error" && typeof record?.error_class === "string"
      ? record.error_class
      : null;
  let lastFanoutAt = null;
  if (lastFanoutStatus !== "unknown" && typeof reportGeneratedAt === "string") {
    const parsed = Date.parse(reportGeneratedAt);
    if (!Number.isNaN(parsed)) {
      lastFanoutAt = parsed;
    }
  }
  return { lastFanoutStatus, lastErrorClass, lastFanoutAt };
}

/**
 * @param {unknown[]} fanoutTargets
 * @returns {Map<string, unknown>}
 */
function indexFanoutTargetsByNotebookId(fanoutTargets) {
  const byId = new Map();
  for (const target of fanoutTargets) {
    if (!target || typeof target !== "object" || Array.isArray(target)) {
      continue;
    }
    const notebookId = /** @type {{ notebook_id?: unknown }} */ (target).notebook_id;
    if (typeof notebookId === "string" && notebookId) {
      byId.set(notebookId, target);
    }
  }
  return byId;
}

/**
 * @param {string} closeReportPath
 * @returns {Promise<{ fanoutTargets: unknown[]; reportGeneratedAt: string | null }>}
 */
export async function loadFanoutTargetsFromCloseReport(closeReportPath) {
  try {
    const parsed = JSON.parse(await readFile(closeReportPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { fanoutTargets: [], reportGeneratedAt: null };
    }
    const report = /** @type {{ notebooklm_targets?: unknown; generated_at?: unknown }} */ (parsed);
    const fanoutTargets = Array.isArray(report.notebooklm_targets) ? report.notebooklm_targets : [];
    const reportGeneratedAt =
      typeof report.generated_at === "string" ? report.generated_at : null;
    return { fanoutTargets, reportGeneratedAt };
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return { fanoutTargets: [], reportGeneratedAt: null };
    }
    return { fanoutTargets: [], reportGeneratedAt: null };
  }
}

/**
 * @param {import('./lib/sync-notebook-registry.mjs').NotebookRegistryEntry[]} registry
 * @param {unknown[]} routingNotebooks
 * @param {unknown[]} [fanoutTargets]
 * @param {string | null} [reportGeneratedAt]
 * @returns {{
 *   notebookId: string;
 *   title: string;
 *   domain: string;
 *   watch: boolean;
 *   lastUpdated: string | null;
 *   lastFanoutStatus: NotebookFanoutHealthStatus;
 *   lastErrorClass: string | null;
 *   lastFanoutAt: number | null;
 * }[]}
 */
export function buildNotebookHealthRows(
  registry,
  routingNotebooks = [],
  fanoutTargets = [],
  reportGeneratedAt = null,
) {
  const fanoutById = indexFanoutTargetsByNotebookId(fanoutTargets);

  const rows = registry
    .filter((notebook) => notebook.watch)
    .map((notebook) => ({
      notebookId: notebook.id,
      title: notebook.title,
      domain: notebook.domain || "unknown",
      watch: true,
      lastUpdated: getNotebookLastUpdated(notebook),
    }));

  const seen = new Set(rows.map((row) => row.notebookId));
  for (const notebook of routingNotebooks) {
    const parsed = parseRoutingNotebook(notebook);
    if (!parsed || seen.has(parsed.id)) {
      continue;
    }
    rows.push({
      notebookId: parsed.id,
      title: parsed.title,
      domain: "unknown",
      watch: false,
      lastUpdated: null,
    });
    seen.add(parsed.id);
  }

  return rows.map((row) => ({
    ...row,
    ...mapFanoutTargetToHealthFields(fanoutById.get(row.notebookId), reportGeneratedAt),
  }));
}

/**
 * @param {string} convexUrl
 */
function normalizeConvexUrl(convexUrl) {
  return convexUrl.replace(/\/$/, "");
}

/**
 * @param {string} value
 * @returns {string}
 */
function stripEnvQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * @param {string} raw
 * @returns {Record<string, string>}
 */
export function parseKeyValueEnv(raw) {
  const values = {};
  for (const rawLine of raw.split("\n")) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    if (line.startsWith("export ")) {
      line = line.slice("export ".length).trim();
    }
    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    if (!key) {
      continue;
    }
    values[key] = stripEnvQuotes(line.slice(separator + 1));
  }
  return values;
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
function trendIngestEnvPath(env) {
  const override = env.TREND_INGEST_ENV?.trim();
  return override || DEFAULT_TREND_INGEST_ENV_PATH;
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {Promise<{ convexUrl: string; convexDeployKey: string } | null>}
 */
async function resolveConvexPushEnv(env) {
  const convexUrl = env.CONVEX_URL?.trim();
  const convexDeployKey = env.CONVEX_DEPLOY_KEY?.trim();
  if (convexUrl && convexDeployKey) {
    return { convexUrl, convexDeployKey };
  }

  try {
    const parsed = parseKeyValueEnv(await readFile(trendIngestEnvPath(env), "utf8"));
    const fallbackUrl = convexUrl || parsed.CONVEX_URL?.trim();
    const fallbackKey = convexDeployKey || parsed.CONVEX_DEPLOY_KEY?.trim();
    if (fallbackUrl && fallbackKey) {
      return { convexUrl: fallbackUrl, convexDeployKey: fallbackKey };
    }
  } catch (err) {
    if (!(err && typeof err === "object" && "code" in err && err.code === "ENOENT")) {
      throw err;
    }
  }

  return null;
}

/**
 * @param {{
 *   dryRun: boolean;
 *   pack: Record<string, unknown>;
 *   env?: Record<string, string | undefined>;
 *   fetchFn?: typeof fetch;
 *   registryPath?: string;
 *   closeReportPath?: string;
 *   repoRoot?: string;
 *   fanoutTargets?: unknown[];
 *   reportGeneratedAt?: string | null;
 * }} opts
 */
export async function pushNotebookHealthSnapshot(opts) {
  if (opts.dryRun) {
    return { status: "skipped", rows: 0, reason: "dry-run" };
  }

  const env = opts.env ?? process.env;
  const convexEnv = await resolveConvexPushEnv(env);
  if (!convexEnv) {
    return { status: "skipped", rows: 0, reason: "missing-convex-env" };
  }

  const registry = await readRegistry(opts.registryPath ?? DEFAULT_REGISTRY_PATH);
  const routing =
    opts.pack.notebooklm_routing &&
    typeof opts.pack.notebooklm_routing === "object" &&
    !Array.isArray(opts.pack.notebooklm_routing)
      ? /** @type {{ notebooks?: unknown }} */ (opts.pack.notebooklm_routing).notebooks
      : [];
  const routingNotebooks = Array.isArray(routing) ? routing : [];

  let fanoutTargets = opts.fanoutTargets;
  let reportGeneratedAt = opts.reportGeneratedAt ?? null;
  if (fanoutTargets === undefined) {
    const closeReportPath =
      opts.closeReportPath ??
      resolvePaths({ repoRoot: opts.repoRoot }).closeReportPath;
    const loaded = await loadFanoutTargetsFromCloseReport(closeReportPath);
    fanoutTargets = loaded.fanoutTargets;
    reportGeneratedAt = loaded.reportGeneratedAt;
  }

  const rows = buildNotebookHealthRows(
    registry,
    routingNotebooks,
    fanoutTargets,
    reportGeneratedAt,
  );
  if (rows.length === 0) {
    return { status: "skipped", rows: 0, reason: "no-notebook-health-rows" };
  }

  const fetchFn = opts.fetchFn ?? globalThis.fetch;
  const response = await fetchFn(`${normalizeConvexUrl(convexEnv.convexUrl)}/api/mutation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${convexEnv.convexDeployKey}`,
    },
    body: JSON.stringify({
      path: NOTEBOOK_HEALTH_MUTATION_PATH,
      args: { rows },
      format: "json",
    }),
  });

  if (!response.ok) {
    throw new Error(`Convex HTTP ${response.status}: ${response.statusText}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Convex mutation response was not valid JSON");
  }
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const payloadRecord = /** @type {{ status?: unknown; errorMessage?: unknown }} */ (payload);
    const status = payloadRecord.status;
    const errorMessage =
      typeof payloadRecord.errorMessage === "string"
        ? payloadRecord.errorMessage
        : "Convex mutation failed";
    if (status === "error") {
      throw new Error(errorMessage);
    }
    if (status !== "success") {
      throw new Error("Convex mutation returned unexpected status");
    }
  }

  return { status: "ok", rows: rows.length, reason: "pushed" };
}

/**
 * @param {string} stdout
 * @param {string} stderr
 * @param {number} exitCode
 */
export function parseVitestTestsSummary(stdout, stderr, exitCode) {
  const combined = `${stdout}\n${stderr}`;
  const match = /Tests\s+(\d+)\s+passed/.exec(combined);
  if (exitCode === 0 && match) {
    return { tests: `${match[1]} passing`, failureClass: null };
  }
  return { tests: "FAILED (see session-close log)", failureClass: "tests" };
}

/**
 * @param {string} vaultRoot
 * @returns {Promise<number | null>}
 */
export async function countFastScanRows(vaultRoot) {
  const indexPath = join(vaultRoot, "AI-Context", "vault-fast-scan-index.md");
  try {
    const text = await readFile(indexPath, "utf8");
    return text.split("\n").filter((line) => FAST_SCAN_ROW_RE.test(line)).length;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} pack
 */
export function enrichNotebooklmTargets(pack) {
  const exportPath =
    pack.deterministic &&
    typeof pack.deterministic === "object" &&
    !Array.isArray(pack.deterministic) &&
    typeof /** @type {{ export_path?: unknown }} */ (pack.deterministic).export_path === "string"
      ? /** @type {{ export_path: string }} */ (pack.deterministic).export_path
      : "";
  const targets = Array.isArray(pack.notebooklm_targets) ? pack.notebooklm_targets : [];
  return targets.map((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      return { ...row, export_path: exportPath };
    }
    return row;
  });
}

/**
 * @param {{
 *   mode: string;
 *   repoRoot: string;
 *   vaultRoot: string;
 *   contextPackPath: string;
 *   steps: Record<string, { status: string; message?: string }>;
 *   failureClass: string | null;
 *   deterministic: Record<string, unknown>;
 *   notebooklm_targets: unknown[];
 *   notebooklm_routing?: import('./lib/read-sources.mjs').NotebookRoutingMeta | null;
 *   memory_preview?: string | null;
 *   daily_rhythm_preview?: Record<string, string> | null;
 *   convex_push?: { status: string; rows: number; reason: string } | null;
 * }} input
 */
export function buildCloseReport(input) {
  return {
    generated_at: new Date().toISOString(),
    mode: input.mode,
    repo_root: input.repoRoot,
    vault_root: input.vaultRoot,
    context_pack_path: input.contextPackPath,
    steps: input.steps,
    failure_class: input.failureClass,
    deterministic: input.deterministic,
    notebooklm_targets: input.notebooklm_targets,
    notebooklm_routing: input.notebooklm_routing ?? null,
    memory_preview: input.memory_preview ?? null,
    daily_rhythm_preview: input.daily_rhythm_preview ?? null,
    convex_push: input.convex_push ?? null,
  };
}

/**
 * @param {string} targetRepoRoot
 * @param {Record<string, string>} env
 * @param {boolean} dryRun
 */
async function runPrepareContextStep(targetRepoRoot, env, dryRun) {
  const args = [join(OMNIPOTENT_INSTALL_ROOT, "scripts/session-close/prepare-context.mjs")];
  if (dryRun) {
    args.push("--dry-run");
  }
  await execFileAsync("node", args, {
    cwd: OMNIPOTENT_INSTALL_ROOT,
    env: { ...env, OMNIPOTENT_REPO: targetRepoRoot },
  });
}

/**
 * @param {string} repoRoot
 * @param {string} vaultRoot
 * @param {Record<string, string>} env
 */
async function runVaultExport(repoRoot, vaultRoot, env) {
  const exportScript = join(OMNIPOTENT_INSTALL_ROOT, "scripts/export-vault-for-notebooklm.sh");
  await execFileAsync("bash", [exportScript], {
    cwd: OMNIPOTENT_INSTALL_ROOT,
    env: { ...env, CNS_VAULT_ROOT: vaultRoot },
  });
  const exportPath = join(OMNIPOTENT_INSTALL_ROOT, "scripts/output/vault-export-for-notebooklm.md");
  const fileStat = await stat(exportPath);
  return { exportPath, exportBytes: fileStat.size };
}

/**
 * @param {string} repoRoot
 * @param {string} vaultRoot
 * @param {Record<string, string>} env
 */
async function runFastScan(repoRoot, vaultRoot, env) {
  const cmd = `source "${NPM_ENV_SH}" && npm run -s vault:fast-scan`;
  await execFileAsync("bash", ["-c", cmd], {
    cwd: OMNIPOTENT_INSTALL_ROOT,
    env: { ...env, CNS_VAULT_ROOT: vaultRoot },
  });
  const rows = await countFastScanRows(vaultRoot);
  return { fastScanRows: rows };
}

/**
 * @param {string} repoRoot
 * @param {Record<string, string>} env
 */
async function runNpmTest(repoRoot, env) {
  const cmd = `source "${NPM_ENV_SH}" && npm test`;
  try {
    const { stdout, stderr } = await execFileAsync("bash", ["-c", cmd], {
      cwd: OMNIPOTENT_INSTALL_ROOT,
      env,
      maxBuffer: 16 * 1024 * 1024,
    });
    return parseVitestTestsSummary(stdout, stderr, 0);
  } catch (err) {
    const e = /** @type {NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number }} */ (
      err
    );
    const stdout = e.stdout ?? "";
    const stderr = e.stderr ?? "";
    const exitCode = typeof e.code === "number" ? e.code : 1;
    return parseVitestTestsSummary(stdout, stderr, exitCode);
  }
}

/**
 * @param {{ dryRun?: boolean; repoRoot?: string; vaultRoot?: string }} [opts]
 */
export async function runDeterministicPipeline(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const OMNIPOTENT_REPO =
    process.env.OMNIPOTENT_REPO || "/home/christ/ai-factory/projects/Omnipotent.md";
  const CNS_VAULT_ROOT =
    process.env.CNS_VAULT_ROOT || "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE";
  const paths = resolvePaths({
    repoRoot: opts.repoRoot ?? OMNIPOTENT_REPO,
    vaultRoot: opts.vaultRoot ?? CNS_VAULT_ROOT,
  });

  /** @type {Record<string, string>} */
  const env = {
    ...process.env,
    OMNIPOTENT_REPO: paths.repoRoot,
    CNS_VAULT_ROOT: paths.vaultRoot,
  };

  /** @type {Record<string, { status: string; message: string }>} */
  const steps = {};
  /** @type {string | null} */
  let failureClass = null;

  const setFailure = (klass) => {
    if (!failureClass) {
      failureClass = klass;
    }
  };

  const priorFanoutLoaded = await loadFanoutTargetsFromCloseReport(paths.closeReportPath);
  const priorFanoutSummary = formatPriorFanoutSummary(priorFanoutLoaded.fanoutTargets);

  try {
    await runPrepareContextStep(paths.repoRoot, env, dryRun);
    steps.prepare_context = { status: "ok", message: "prepare-context complete" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    steps.prepare_context = { status: "failed", message };
    failureClass = "pipeline";

    /** @type {Record<string, unknown>} */
    let pack;
    try {
      pack = await buildContextPack({
        dryRun,
        repoRoot: paths.repoRoot,
        vaultRoot: paths.vaultRoot,
      });
    } catch {
      pack = {
        deterministic: {
          export_path: join(paths.repoRoot, "scripts/output/vault-export-for-notebooklm.md"),
          export_bytes: null,
          fast_scan_rows: null,
          tests: null,
        },
        notebooklm_targets: [],
      };
    }

    await mkdir(paths.sessionCloseDir, { recursive: true });
    const pipelineFailureReport = buildCloseReport({
      mode: dryRun ? "dry-run" : "real",
      repoRoot: paths.repoRoot,
      vaultRoot: paths.vaultRoot,
      contextPackPath: paths.contextPackPath,
      steps,
      failureClass,
      deterministic: { .../** @type {{ deterministic: Record<string, unknown> }} */ (pack).deterministic },
      notebooklm_targets: enrichNotebooklmTargets(pack),
      notebooklm_routing: null,
      memory_preview: null,
      daily_rhythm_preview: null,
    });
    await writeFile(
      paths.closeReportPath,
      `${JSON.stringify(pipelineFailureReport, null, 2)}\n`,
      "utf8",
    );

    throw new Error(`prepare-context failed: ${message}`, { cause: err });
  }

  let pack = await buildContextPack({
    dryRun,
    repoRoot: paths.repoRoot,
    vaultRoot: paths.vaultRoot,
  });

  const exportPath = join(paths.repoRoot, "scripts/output/vault-export-for-notebooklm.md");

  if (dryRun) {
    steps.export = { status: "skipped", message: "export: skipped (dry-run)" };
    pack.deterministic.export_path = exportPath;
    pack.deterministic.export_bytes = null;
  } else {
    try {
      const exported = await runVaultExport(paths.repoRoot, paths.vaultRoot, env);
      steps.export = { status: "ok", message: "export complete" };
      pack.deterministic.export_path = exported.exportPath;
      pack.deterministic.export_bytes = exported.exportBytes;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.export = { status: "failed", message };
      setFailure("export");
      pack.deterministic.export_path = exportPath;
      pack.deterministic.export_bytes = null;
    }
  }

  if (dryRun) {
    const existingRows = await countFastScanRows(paths.vaultRoot);
    steps.fast_scan = { status: "skipped", message: "fast-scan: skipped (dry-run)" };
    pack.deterministic.fast_scan_rows = existingRows;
  } else {
    try {
      const scanned = await runFastScan(paths.repoRoot, paths.vaultRoot, env);
      steps.fast_scan = { status: "ok", message: "fast-scan complete" };
      pack.deterministic.fast_scan_rows = scanned.fastScanRows;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.fast_scan = { status: "failed", message };
      setFailure("fast_scan");
      pack.deterministic.fast_scan_rows = await countFastScanRows(paths.vaultRoot);
    }
  }

  let testsLine = null;
  if (dryRun) {
    steps.tests = { status: "skipped", message: "tests: skipped (dry-run)" };
    pack.deterministic.tests = null;
  } else {
    const testResult = await runNpmTest(paths.repoRoot, env);
    testsLine = testResult.tests;
    pack.deterministic.tests = testResult.tests;
    if (testResult.failureClass) {
      steps.tests = { status: "failed", message: testResult.tests };
      setFailure(testResult.failureClass);
    } else {
      steps.tests = { status: "ok", message: testResult.tests };
    }
  }

  /** @type {string | null} */
  let memoryPreview = null;
  /** @type {Record<string, string> | null} */
  let dailyRhythmPreview = null;

  if (dryRun) {
    steps.memory = { status: "skipped", message: "memory: skipped (dry-run)" };
    steps.daily_rhythm = { status: "skipped", message: "daily_rhythm: preview-only (dry-run)" };
    try {
      const memory = await runWriteMemory({
        dryRun: true,
        repoRoot: paths.repoRoot,
        vaultRoot: paths.vaultRoot,
        contextPack: pack,
      });
      memoryPreview = memory.body;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.memory = { status: "failed", message };
      setFailure("memory");
    }
    try {
      const rhythm = await runRefreshDailyRhythm({
        dryRun: true,
        repoRoot: paths.repoRoot,
        vaultRoot: paths.vaultRoot,
        testsLine,
      });
      dailyRhythmPreview = rhythm.markers;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.daily_rhythm = { status: "failed", message };
      setFailure("daily_rhythm");
    }
  } else {
    try {
      const memory = await runWriteMemory({
        dryRun: false,
        repoRoot: paths.repoRoot,
        vaultRoot: paths.vaultRoot,
        contextPack: pack,
      });
      steps.memory = {
        status: "ok",
        message: `MEMORY written (${memory.body.length} chars)`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.memory = { status: "failed", message };
      setFailure("memory");
    }

    try {
      const rhythm = await runRefreshDailyRhythm({
        dryRun: false,
        repoRoot: paths.repoRoot,
        vaultRoot: paths.vaultRoot,
        testsLine,
      });
      steps.daily_rhythm = { status: "ok", message: "daily rhythm AUTO blocks updated" };
      dailyRhythmPreview = rhythm.markers;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.daily_rhythm = { status: "failed", message };
      setFailure("daily_rhythm");
    }
  }

  await mkdir(paths.sessionCloseDir, { recursive: true });
  await writeContextPack(pack, paths.contextPackPath, { dryRun: false });

  let convexPush;
  try {
    convexPush = await pushNotebookHealthSnapshot({
      dryRun,
      pack,
      env: process.env,
      fetchFn: globalThis.fetch,
      registryPath: DEFAULT_REGISTRY_PATH,
      closeReportPath: paths.closeReportPath,
      repoRoot: paths.repoRoot,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[knowledge-pulse] Convex push failed (non-fatal):", message);
    convexPush = { status: "error", rows: 0, reason: message };
  }

  const reportTargets = enrichNotebooklmTargets(pack);
  pack.deterministic.prior_fanout_summary = priorFanoutSummary;
  const report = buildCloseReport({
    mode: dryRun ? "dry-run" : "real",
    repoRoot: paths.repoRoot,
    vaultRoot: paths.vaultRoot,
    contextPackPath: paths.contextPackPath,
    steps,
    failureClass,
    deterministic: { ...pack.deterministic },
    notebooklm_targets: reportTargets,
    notebooklm_routing: pack.notebooklm_routing ?? null,
    memory_preview: memoryPreview,
    daily_rhythm_preview: dailyRhythmPreview,
    convex_push: convexPush,
  });

  await writeFile(paths.closeReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return { pack, report, paths };
}

/**
 * Hard gate before Phase B: require Phase A artifacts; retry Phase A once when incomplete.
 *
 * @param {{
 *   dryRun?: boolean;
 *   repoRoot?: string;
 *   vaultRoot?: string;
 *   contextPackPath?: string;
 *   closeReportPath?: string;
 *   retry?: boolean;
 * }} [opts]
 */
export async function ensurePhaseAComplete(opts = {}) {
  const paths = resolvePaths({
    repoRoot: opts.repoRoot,
    vaultRoot: opts.vaultRoot,
  });
  const contextPackPath = opts.contextPackPath ?? paths.contextPackPath;
  const closeReportPath = opts.closeReportPath ?? paths.closeReportPath;
  const dryRun = Boolean(opts.dryRun);
  const allowRetry = opts.retry !== false;

  let result = await evaluatePhaseACompletion({ contextPackPath, closeReportPath });
  if (result.status === "PASSED") {
    return result;
  }

  if (result.status === "INCOMPLETE" && allowRetry) {
    await runDeterministicPipeline({
      dryRun,
      repoRoot: paths.repoRoot,
      vaultRoot: paths.vaultRoot,
    });
    result = await evaluatePhaseACompletion({ contextPackPath, closeReportPath });
    if (result.status === "PASSED") {
      return result;
    }
  }

  await recordPhaseAGateFailure(closeReportPath, result);
  const retryHint = `node scripts/session-close/run-deterministic.mjs${dryRun ? " --dry-run" : ""}`;
  throw new Error(`${formatPhaseAGateError(result)}. Re-run Phase A: ${retryHint}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  try {
    const { report, paths } = await runDeterministicPipeline({ dryRun });
    const summary = report.failure_class
      ? `partial close (${report.failure_class})`
      : "deterministic phase complete";
    process.stdout.write(
      `session-close: ${summary} → ${paths.closeReportPath}\n`,
    );
    if (report.failure_class) {
      process.exit(1);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: run-deterministic failed: ${message}\n`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`session-close: run-deterministic failed: ${message}\n`);
    process.exit(1);
  });
}
