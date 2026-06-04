import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string | null}
 */
function resolveHermesHome(env) {
  const explicit = env.HERMES_HOME;
  if (typeof explicit === "string" && explicit.trim()) {
    return explicit.trim();
  }

  const home = env.HOME;
  if (typeof home === "string") {
    const match = home.match(/^(.*\/\.hermes)\/home(?:\/.*)?$/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

/** Resolve at call time so tests can isolate via HOME and HERMES_HOME. */
export function defaultSessionCloseEnvPath(env = process.env) {
  const hermesHome = resolveHermesHome(env);
  if (hermesHome) {
    return join(hermesHome, "session-close.env");
  }
  return join(homedir(), ".hermes", "session-close.env");
}

const ENV_KEY_RE = /^[A-Z][A-Z0-9_]*$/;

/**
 * Parse KEY=value lines from session-close.env (comments and export prefix supported).
 * @param {string} raw
 * @returns {Record<string, string>}
 */
export function parseSessionCloseEnvFile(raw) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }
    const key = match[1];
    if (!ENV_KEY_RE.test(key)) {
      continue;
    }
    let value = (match[2] ?? "").trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    out[key] = value;
  }
  return out;
}

/**
 * Read a session-close env var from process.env, then ~/.hermes/session-close.env.
 * @param {string} key
 * @param {{ envPath?: string; env?: NodeJS.ProcessEnv }} [opts]
 */
export async function readSessionCloseEnvVar(key, opts = {}) {
  const env = opts.env ?? process.env;
  const fromProcess = env[key];
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return fromProcess.trim();
  }

  const envPath = opts.envPath ?? defaultSessionCloseEnvPath(env);
  try {
    const raw = await readFile(envPath, "utf8");
    const parsed = parseSessionCloseEnvFile(raw);
    const fromFile = parsed[key];
    if (typeof fromFile === "string" && fromFile.trim()) {
      return fromFile.trim();
    }
  } catch {
    // missing env file is normal
  }
  return "";
}

/**
 * OAuth credentials for Google Drive Doc overwrite (REST API, not MCP).
 * Set in ~/.hermes/session-close.env:
 *   GOOGLE_CLIENT_ID=
 *   GOOGLE_CLIENT_SECRET=
 *   GOOGLE_REFRESH_TOKEN=
 * @param {{ envPath?: string; env?: NodeJS.ProcessEnv }} [opts]
 */
export async function hasGoogleOAuthCredentials(opts = {}) {
  const keys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"];
  const values = await Promise.all(keys.map((key) => readSessionCloseEnvVar(key, opts)));
  return values.every((value) => value.length > 0);
}

/**
 * @param {{ envPath?: string; env?: NodeJS.ProcessEnv }} [opts]
 */
export async function readNotebooklmDriveDocId(opts = {}) {
  return readSessionCloseEnvVar("NOTEBOOKLM_DRIVE_DOC_ID", opts);
}

/**
 * @typedef {'drive-sync' | 'legacy-source-add'} VaultExportFanoutMode
 */

/**
 * @param {{ envPath?: string; env?: NodeJS.ProcessEnv }} [opts]
 * @returns {Promise<{ mode: VaultExportFanoutMode; driveDocId: string; oauthReady: boolean; oauthSetupRequired: boolean }>}
 */
export async function resolveVaultExportFanoutMode(opts = {}) {
  const driveDocId = await readNotebooklmDriveDocId(opts);
  const oauthReady = await hasGoogleOAuthCredentials(opts);
  if (!driveDocId) {
    return {
      mode: "legacy-source-add",
      driveDocId: "",
      oauthReady: false,
      oauthSetupRequired: false,
    };
  }
  if (!oauthReady) {
    return {
      mode: "legacy-source-add",
      driveDocId,
      oauthReady: false,
      oauthSetupRequired: true,
    };
  }
  return {
    mode: "drive-sync",
    driveDocId,
    oauthReady: true,
    oauthSetupRequired: false,
  };
}
