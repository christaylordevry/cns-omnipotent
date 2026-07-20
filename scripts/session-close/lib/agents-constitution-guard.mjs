/**
 * Pre-propagation guards for AGENTS.md (OPS-4).
 * Refuse dual-target writes when source is structurally corrupt, stale vs mirror,
 * or would mint a changelog version already present in source ∪ mirror.
 */
import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { readSessionCloseEnvVar } from "./load-session-close-env.mjs";
import { normalizeLf } from "./sync-vault-modules.mjs";

export const PAKE_ROUTING_TYPES = Object.freeze([
  "SourceNote",
  "InsightNote",
  "SynthesisNote",
  "WorkflowNote",
  "ValidationNote",
  "HookSetNote",
  "WeaponsCheckNote",
]);

export const ADJACENT_TOKEN_ALLOWLIST = new Set(["had had", "that that"]);

/** @typedef {"passed" | "failed" | "not_applicable"} GuardCheckStatus */

/**
 * @param {string} text
 * @param {string} startHeading e.g. "## 2."
 * @param {string} endHeading e.g. "## 4."
 * @returns {string}
 */
export function extractSectionRange(text, startHeading, endHeading) {
  const start = text.indexOf(startHeading);
  if (start === -1) {
    throw new Error(
      `constitution-guard: structural: missing heading ${startHeading}`,
    );
  }
  const end = text.indexOf(endHeading, start + startHeading.length);
  if (end === -1 || end <= start) {
    throw new Error(
      `constitution-guard: structural: missing end heading ${endHeading} after ${startHeading}`,
    );
  }
  return text.slice(start, end);
}

/**
 * §2 routing-table row labels must each appear exactly once (line-start `| Type |`).
 * @param {string} section2Text
 */
export function assertRoutingRowsOnce(section2Text) {
  /** @type {string[]} */
  const problems = [];
  for (const type of PAKE_ROUTING_TYPES) {
    const re = new RegExp(`^\\|\\s*${type}\\s*\\|`, "gm");
    const matches = section2Text.match(re);
    const count = matches ? matches.length : 0;
    if (count !== 1) {
      problems.push(`${type} appears ${count} time(s) (expected 1)`);
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `constitution-guard: structural: routing-table row labels must appear exactly once: ${problems.join("; ")}`,
    );
  }
}

/**
 * Tokenize a line for adjacent-duplicate detection.
 * Keeps decimal literals (e.g. 0.0) as one token so `0.0 to 1.0` is not `0 0`.
 * @param {string} line
 * @returns {string[]}
 */
function tokenizeLine(line) {
  return line.match(/\d+\.\d+|\b[A-Za-z0-9_]+\b/g) ?? [];
}

/**
 * Case-insensitive adjacent duplicate tokens within §2∪§3, with allowlist.
 * Checked per line (not cross-line) so prose→table header `pake_type` is not a hit,
 * while same-line corruption like `governed governed` still fails closed.
 * @param {string} section2And3Text
 * @param {Set<string>} [allowlist]
 */
export function assertNoDoubledAdjacentTokens(
  section2And3Text,
  allowlist = ADJACENT_TOKEN_ALLOWLIST,
) {
  /** @type {string[]} */
  const hits = [];
  for (const line of section2And3Text.split("\n")) {
    const tokens = tokenizeLine(line);
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const a = tokens[i];
      const b = tokens[i + 1];
      if (a.toLowerCase() !== b.toLowerCase()) {
        continue;
      }
      const key = `${a.toLowerCase()} ${b.toLowerCase()}`;
      if (allowlist.has(key)) {
        continue;
      }
      hits.push(`${a} ${b}`);
    }
  }
  if (hits.length > 0) {
    const unique = [...new Set(hits)];
    throw new Error(
      `constitution-guard: structural: adjacent duplicate tokens in §2–§3: ${unique.join(", ")}`,
    );
  }
}

/**
 * @param {string} text
 * @returns {string}
 */
export function parseAgentsHeaderVersion(text) {
  const match = text.match(/>\s*Version:\s*([0-9.]+)/);
  if (!match) {
    throw new Error(
      "constitution-guard: structural: AGENTS.md missing > Version: header",
    );
  }
  return match[1];
}

/**
 * Changelog version column values (markdown table rows under ## Changelog).
 * @param {string} text
 * @returns {string[]}
 */
export function listChangelogVersions(text) {
  const idx = text.indexOf("## Changelog");
  if (idx === -1) {
    return [];
  }
  const tail = text.slice(idx);
  /** @type {string[]} */
  const versions = [];
  for (const line of tail.split("\n")) {
    const m = line.match(/^\|\s*\d{4}-\d{2}-\d{2}\s*\|\s*([0-9.]+)\s*\|/);
    if (m) {
      versions.push(m[1]);
    }
  }
  return versions;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {-1 | 0 | 1}
 */
export function compareSemver(a, b) {
  const pa = a.split(".").map((p) => Number.parseInt(p, 10));
  const pb = b.split(".").map((p) => Number.parseInt(p, 10));
  if (
    pa.length !== 3 ||
    pb.length !== 3 ||
    pa.some((n) => Number.isNaN(n)) ||
    pb.some((n) => Number.isNaN(n))
  ) {
    throw new Error(`constitution-guard: invalid semver compare: ${a} vs ${b}`);
  }
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] < pb[i]) {
      return -1;
    }
    if (pa[i] > pb[i]) {
      return 1;
    }
  }
  return 0;
}

/**
 * @param {string} path
 * @returns {string}
 */
function resolveRealpath(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/**
 * Structural invariants on source (AC2). Throws on violation.
 * @param {string} sourceText already normalizeLf'd preferred
 */
export function assertAgentsStructuralInvariants(sourceText) {
  const normalized = normalizeLf(sourceText);
  const section2 = extractSectionRange(normalized, "## 2.", "## 3.");
  assertRoutingRowsOnce(section2);
  const section2And3 = extractSectionRange(normalized, "## 2.", "## 4.");
  assertNoDoubledAdjacentTokens(section2And3);
}

/**
 * @param {{
 *   sourcePath: string;
 *   mirrorPath: string;
 *   sourceText: string;
 *   mirrorText: string | null | undefined;
 *   newVersion: string;
 * }} args
 * @returns {{
 *   structural: GuardCheckStatus;
 *   stale: GuardCheckStatus;
 *   collision: GuardCheckStatus;
 *   reason?: string;
 * }}
 */
export function assertAgentsPropagationAllowed({
  sourcePath,
  mirrorPath,
  sourceText,
  mirrorText,
  newVersion,
}) {
  if (mirrorText == null) {
    throw new Error(
      `constitution-guard: mirror-unreadable: ${mirrorPath}`,
    );
  }

  const sourceNorm = normalizeLf(sourceText);
  const mirrorNorm = normalizeLf(mirrorText);

  assertAgentsStructuralInvariants(sourceNorm);

  const sourceReal = resolveRealpath(sourcePath);
  const mirrorReal = resolveRealpath(mirrorPath);
  const samePath = sourceReal === mirrorReal;

  if (samePath) {
    return {
      structural: "passed",
      stale: "not_applicable",
      collision: "not_applicable",
      reason: `source and mirror resolve to the same realpath: ${sourceReal}`,
    };
  }

  const vs = parseAgentsHeaderVersion(sourceNorm);
  const vm = parseAgentsHeaderVersion(mirrorNorm);

  // Collision before stale so the AC4 incident fixture (Vs 2.1.57 / Vm 2.1.58,
  // bump 2.1.58 already on mirror) surfaces version-collision (union), not only stale.
  const changelogVersions = new Set([
    ...listChangelogVersions(sourceNorm),
    ...listChangelogVersions(mirrorNorm),
  ]);
  if (changelogVersions.has(newVersion)) {
    throw new Error(
      `constitution-guard: version-collision: v${newVersion} already in source ∪ mirror changelog`,
    );
  }

  if (compareSemver(vs, vm) < 0) {
    throw new Error(
      `constitution-guard: stale: source v${vs} < mirror v${vm}`,
    );
  }

  return {
    structural: "passed",
    stale: "passed",
    collision: "passed",
  };
}

/**
 * @param {string} vaultText
 * @param {string} specsText
 * @returns {{ ok: boolean }}
 */
export function compareAgentsMirror(vaultText, specsText) {
  return {
    ok: normalizeLf(vaultText) === normalizeLf(specsText),
  };
}

/**
 * @param {{ ok: boolean }} diff
 * @param {{ vaultPath?: string; specsPath?: string }} [paths]
 * @returns {string}
 */
export function formatAgentsParityMessage(diff, paths = {}) {
  if (diff.ok) {
    return "Vault AGENTS.md matches specs mirror";
  }
  const vaultPath = paths.vaultPath ?? "vault AI-Context/AGENTS.md";
  const specsPath = paths.specsPath ?? "specs/cns-vault-contract/AGENTS.md";
  return [
    "Vault AGENTS.md drift vs specs mirror detected:",
    `  vault: ${vaultPath}`,
    `  specs: ${specsPath}`,
    "Refusing silent green. Align vault ↔ specs (do not run /session-close until constitution guard ships), then re-run tests.",
  ].join("\n");
}

/**
 * Resolve live vault AGENTS.md for parity tests (same env pattern as modules).
 * @param {{ env?: NodeJS.ProcessEnv; envPath?: string }} [opts]
 * @returns {Promise<string | null>}
 */
export async function resolveLiveVaultAgentsPath(opts = {}) {
  const vaultRoot = await readSessionCloseEnvVar("CNS_VAULT_ROOT", opts);
  if (!vaultRoot) {
    return null;
  }
  const agentsPath = join(vaultRoot, "AI-Context", "AGENTS.md");
  if (!existsSync(agentsPath)) {
    return null;
  }
  return agentsPath;
}

/**
 * Read and normalize a file for parity compares.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export async function readAgentsNormalized(filePath) {
  return normalizeLf(await readFile(filePath, "utf8"));
}

export { normalizeLf };
