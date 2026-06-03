#!/usr/bin/env node
/**
 * Story 50-1: Refresh scripts/session-close/lib/notebook-registry.json from `nlm list notebooks --json`.
 */
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { alertStaleNotebooks } from "./lib/notebook-stale-alert.mjs";
import { resolveNlmEnv } from "./lib/nlm-auth-watchdog.mjs";
import { mergeNotebookRegistry } from "./lib/sync-notebook-registry.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REGISTRY_PATH = join(__dirname, "lib", "notebook-registry.json");

const NLM_HINT =
  "Install notebooklm-mcp-cli and authenticate: nlm login (see https://github.com/jacob-bd/notebooklm-mcp-cli)";

/**
 * @param {import('node:child_process').execFile} [execFileFn]
 * @returns {(args?: string[]) => Promise<string>}
 */
export function createRunNlm(execFileFn = execFile) {
  const run = promisify(execFileFn);
  return async function runNlm() {
    const nlmEnv = await resolveNlmEnv();
    const { stdout } = await run("nlm", ["list", "notebooks", "--json"], {
      env: nlmEnv,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout;
  };
}

/** @type {() => Promise<string>} */
let runNlm = createRunNlm();

/**
 * @param {() => Promise<string>} fn
 */
export function setRunNlmForTests(fn) {
  runNlm = fn;
}

/**
 * @param {string} stdout
 * @returns {import('./lib/sync-notebook-registry.mjs').NlmNotebookRow[]}
 */
export function parseNlmNotebookList(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const wrapped = new Error(`nlm output is not valid JSON: ${message}`);
    if (err instanceof Error) {
      wrapped.cause = err;
    }
    throw wrapped;
  }

  if (!Array.isArray(parsed)) {
    throw new Error("nlm output must be a JSON array of notebooks");
  }

  return parsed.map((row) => ({
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  }));
}

/**
 * @param {unknown} row
 * @returns {import('./lib/sync-notebook-registry.mjs').NotebookRegistryEntry | null}
 */
export function sanitizeRegistryEntry(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) {
    return null;
  }

  const lastUpdated = row.last_updated;
  return {
    id,
    title: typeof row.title === "string" ? row.title : String(row.title ?? ""),
    watch: Boolean(row.watch),
    domain: typeof row.domain === "string" ? row.domain : "",
    last_updated:
      lastUpdated === null || typeof lastUpdated === "string" ? lastUpdated : null,
  };
}

/**
 * @param {string} [registryPath]
 * @returns {Promise<import('./lib/sync-notebook-registry.mjs').NotebookRegistryEntry[]>}
 */
export async function readRegistry(registryPath = DEFAULT_REGISTRY_PATH) {
  try {
    const raw = await readFile(registryPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("registry file must be a JSON array");
    }
    return parsed
      .map((row) => sanitizeRegistryEntry(row))
      .filter((row) => row !== null);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

/**
 * @param {import('./lib/sync-notebook-registry.mjs').NotebookRegistryEntry[]} entries
 * @param {string} registryPath
 */
export async function writeRegistry(entries, registryPath) {
  const body = `${JSON.stringify(entries, null, 2)}\n`;
  await writeFile(registryPath, body, "utf8");
}

/**
 * @param {{ registryPath?: string, runNlmFn?: () => Promise<string> }} [options]
 * @returns {Promise<import('./lib/sync-notebook-registry.mjs').NotebookRegistryEntry[]>}
 */
export async function syncNotebookRegistry(options = {}) {
  const registryPath = options.registryPath ?? DEFAULT_REGISTRY_PATH;
  const fetchNlm = options.runNlmFn ?? runNlm;

  const existing = await readRegistry(registryPath);
  const stdout = await fetchNlm();
  const nlmRows = parseNlmNotebookList(stdout);
  const merged = mergeNotebookRegistry(existing, nlmRows);
  await writeRegistry(merged, registryPath);
  return merged;
}

function printError(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write(`${NLM_HINT}\n`);
}

/**
 * @param {{
 *   registryPath?: string,
 *   runNlmFn?: () => Promise<string>,
 *   alertStaleNotebooksFn?: typeof alertStaleNotebooks,
 *   fetchFn?: typeof fetch,
 *   env?: NodeJS.ProcessEnv,
 * }} [options]
 */
export async function runSyncNotebooksCli(options = {}) {
  const registryPath = options.registryPath ?? DEFAULT_REGISTRY_PATH;
  const alertFn = options.alertStaleNotebooksFn ?? alertStaleNotebooks;

  try {
    const merged = await syncNotebookRegistry({
      registryPath,
      runNlmFn: options.runNlmFn,
    });
    process.stdout.write(
      `Wrote ${merged.length} notebook(s) to ${registryPath}\n`,
    );
    try {
      await alertFn(merged, {
        registryPath,
        fetchFn: options.fetchFn ?? globalThis.fetch,
        env: options.env ?? process.env,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[stale-alerts] unexpected error: ${message}\n`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      printError("nlm command not found.");
    } else if (err && typeof err === "object" && "code" in err && err.code === 127) {
      printError("nlm command not found.");
    } else {
      printError(`sync-notebooks failed: ${message}`);
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await runSyncNotebooksCli();
}
