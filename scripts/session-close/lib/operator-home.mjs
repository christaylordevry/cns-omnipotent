import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * True when HOME is Hermes per-profile isolation ({HERMES_HOME}/home).
 *
 * Both HOME and HERMES_HOME must be set; otherwise we cannot prove this is
 * a Hermes-spawned subprocess and we keep HOME as-is.
 *
 * @param {string} home
 * @param {string} hermesHome
 */
export function isHermesProfileHome(home, hermesHome) {
  if (!home || !hermesHome) {
    return false;
  }
  const profileRoot = join(hermesHome, "home");
  return home === profileRoot || home.startsWith(`${profileRoot}/`);
}

/**
 * Infer HERMES_HOME from a HOME that matches the Hermes profile-isolation
 * pattern (.hermes/home or .hermes/home/...). Returns null if HOME does
 * not look isolated.
 *
 * @param {string} home
 * @returns {string | null}
 */
export function inferHermesHomeFromHome(home) {
  if (!home) return null;
  const m = home.match(/^(.*\/\.hermes)\/home(\/.*)?$/);
  return m ? m[1] : null;
}

/**
 * Infer the operator's real HOME directly from Hermes profile-isolated HOME.
 *
 * @param {string} home
 * @returns {string | null}
 */
export function inferOperatorHomeFromHome(home) {
  if (!home) return null;
  const m = home.match(/^(.*?)\/\.hermes\/home(\/.*)?$/);
  return m?.[1] ? m[1] : null;
}

/**
 * Return the operator's real HOME, even when Hermes has profile-isolated
 * the process under {HERMES_HOME}/home. Falls back to the input HOME if
 * getent is unavailable or returns nothing.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<string>}
 */
export async function resolveOperatorHome(env = process.env) {
  const home = (env.HOME || homedir()).trim();
  const directInference = inferOperatorHomeFromHome(home);
  if (directInference) {
    return directInference;
  }
  let hermesHome = (env.HERMES_HOME || "").trim();
  if (!hermesHome) {
    hermesHome = inferHermesHomeFromHome(home) || "";
  }
  if (!isHermesProfileHome(home, hermesHome)) {
    return home || homedir();
  }
  const user = (env.USER || env.LOGNAME || "").trim();
  if (!user) {
    return home || homedir();
  }
  try {
    const { stdout } = await execFileAsync("getent", ["passwd", user], {
      encoding: "utf8",
      maxBuffer: 64 * 1024,
    });
    const line = stdout.trim().split("\n")[0] ?? "";
    const passwdHome = line.split(":")[5]?.trim();
    if (passwdHome) {
      return passwdHome;
    }
  } catch {
    // getent unavailable — fall through to profile HOME.
  }
  return home || homedir();
}
