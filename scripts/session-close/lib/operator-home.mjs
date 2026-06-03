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
 * Return the operator's real HOME, even when Hermes has profile-isolated
 * the process under {HERMES_HOME}/home. Falls back to the input HOME if
 * getent is unavailable or returns nothing.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {Promise<string>}
 */
export async function resolveOperatorHome(env = process.env) {
  const home = (env.HOME || homedir()).trim();
  const hermesHome = (env.HERMES_HOME || "").trim();
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
