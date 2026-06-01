import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  flattenBoundSkills,
  parseChannelSkillBindings,
} from "./hermes-config-bindings.mjs";
import { PARITY_SKILLS } from "./hermes-skill-bindings-expected.mjs";

export { PARITY_SKILLS };

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} [scriptDir] defaults to scripts/
 */
export function resolveRepoRoot(scriptDir) {
  const scriptsDir = scriptDir ?? join(__dirname, "..");
  if (process.env.OMNIPOTENT_REPO) {
    return process.env.OMNIPOTENT_REPO;
  }
  return join(scriptsDir, "..");
}

/**
 * @param {{ hermesHome?: string, repoRoot?: string, skipEnv?: boolean }} [opts]
 * @returns {{ skipped: boolean, message?: string }}
 */
export function runHermesSkillInstallGate(opts = {}) {
  if (process.env.HERMES_SKIP_SKILL_INSTALL_GATE === "1") {
    return {
      skipped: true,
      message: "(skip) HERMES_SKIP_SKILL_INSTALL_GATE=1",
    };
  }

  const hermesHome = opts.hermesHome ?? process.env.HERMES_HOME ?? join(homedir(), ".hermes");
  const repoRoot = opts.repoRoot ?? resolveRepoRoot();
  const configPath = join(hermesHome, "config.yaml");

  if (!existsSync(configPath)) {
    return {
      skipped: true,
      message: `(skip) Hermes config not found at ${configPath}`,
    };
  }

  const configText = readFileSync(configPath, "utf8");
  const bindings = parseChannelSkillBindings(configText);
  const bound = flattenBoundSkills(bindings);
  const skillsRoot = join(hermesHome, "skills", "cns");
  const errors = [];

  for (const { skill, channelId } of bound) {
    const skillMd = join(skillsRoot, skill, "SKILL.md");
    if (!existsSync(skillMd)) {
      errors.push(
        `missing skill "${skill}" (channel ${channelId}): expected ${skillMd}`,
      );
    }
  }

  for (const skill of PARITY_SKILLS) {
    const repoMirror = join(repoRoot, "scripts", "hermes-skill-examples", skill);
    const installed = join(skillsRoot, skill);
    if (!existsSync(repoMirror)) {
      errors.push(`repo mirror missing: ${repoMirror}`);
      continue;
    }
    if (!existsSync(installed)) {
      errors.push(`installed skill tree missing: ${installed}`);
      continue;
    }
    try {
      execSync(`diff -rq "${repoMirror}" "${installed}"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (e) {
      const err = /** @type {{ stdout?: string, stderr?: string }} */ (e);
      const diffOut = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
      errors.push(
        `parity drift for "${skill}" (diff -rq scripts/hermes-skill-examples/${skill} vs ${installed}):\n${diffOut}`,
      );
    }
  }

  if (errors.length > 0) {
    const msg = errors.join("\n\n");
    const err = new Error(msg);
    err.name = "HermesSkillInstallGateError";
    throw err;
  }

  return { skipped: false };
}
