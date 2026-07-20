/**
 * Pre-propagation guards for AGENTS.md (OPS-4).
 * Refuse dual-target writes when source is structurally corrupt, stale vs mirror,
 * or would mint a changelog version already present in source ∪ mirror.
 */
import { existsSync, realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

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

/** Sentinel so table-cell / row boundaries never count as adjacent tokens. */
const TOKEN_BOUNDARY = "\u0000";

/** @typedef {"passed" | "failed" | "not_applicable"} GuardCheckStatus */

/**
 * @param {string} text
 * @param {string} headingPrefix e.g. "## 2."
 * @param {number} [fromIndex]
 * @returns {number}
 */
function findLineHeadingIndex(text, headingPrefix, fromIndex = 0) {
  const escaped = headingPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}`, "gm");
  re.lastIndex = fromIndex;
  const match = re.exec(text);
  return match ? match.index : -1;
}

/**
 * @param {string} text
 * @param {string} startHeading e.g. "## 2."
 * @param {string} endHeading e.g. "## 4."
 * @returns {string}
 */
export function extractSectionRange(text, startHeading, endHeading) {
  const start = findLineHeadingIndex(text, startHeading);
  if (start === -1) {
    throw new Error(
      `constitution-guard: structural: missing heading ${startHeading}`,
    );
  }
  const end = findLineHeadingIndex(
    text,
    endHeading,
    start + startHeading.length,
  );
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
 * Tokenize text for adjacent-duplicate detection.
 * Keeps decimal literals (e.g. 0.0) as one token so `0.0 to 1.0` is not `0 0`.
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeText(text) {
  return text.match(/\d+\.\d+|\b[A-Za-z0-9_]+\b/g) ?? [];
}

/**
 * Drop fenced code so §3 yaml/markdown examples cannot false-positive.
 * @param {string} text
 * @returns {string}
 */
function stripFencedCode(text) {
  return text.replace(/```[\s\S]*?```/g, "\n");
}

/**
 * Replace wikilinks with the target path only (drop display alias).
 * `[[Note|Note]]` → one token stream from `Note`, not `Note Note`.
 * @param {string} text
 * @returns {string}
 */
function stripWikilinkAliases(text) {
  // Keep target (and optional #heading); drop |display alias so [[A|A]] is one token.
  return text.replace(
    /\[\[([^\]|#]+)(?:#[^|\]]+)?(?:\|[^\]]+)?\]\]/g,
    " $1 ",
  );
}

/**
 * Build a token stream across the whole §2–§3 span (cross-line), after
 * fence/wikilink softening. Table cells are tokenized independently so
 * adjacent cells with the same value are not adjacent in the stream.
 * @param {string} section2And3Text
 * @returns {string[]}
 */
export function buildAdjacentTokenStream(section2And3Text) {
  const cleaned = stripWikilinkAliases(stripFencedCode(section2And3Text));
  /** @type {string[]} */
  const tokens = [];

  /** @param {string[]} next */
  const pushSegment = (next) => {
    if (next.length === 0) {
      return;
    }
    if (tokens.length > 0 && tokens[tokens.length - 1] !== TOKEN_BOUNDARY) {
      tokens.push(TOKEN_BOUNDARY);
    }
    tokens.push(...next);
  };

  for (const line of cleaned.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      const cells = trimmed.split("|").slice(1, -1);
      for (const cell of cells) {
        pushSegment(tokenizeText(cell));
      }
      if (tokens.length > 0 && tokens[tokens.length - 1] !== TOKEN_BOUNDARY) {
        tokens.push(TOKEN_BOUNDARY);
      }
      continue;
    }
    // Prose: append into the continuous cross-line stream (no boundary).
    tokens.push(...tokenizeText(line));
  }

  return tokens;
}

/**
 * Case-insensitive adjacent duplicate tokens within §2∪§3, with allowlist.
 * Softened for fences / wikilink aliases / per-cell tables, then scanned as one
 * span including across line breaks (OPS-4 review: coupled soften + cross-line).
 * Allowlist permits exactly one adjacent pair (`had had`), not a triple run.
 * @param {string} section2And3Text
 * @param {Set<string>} [allowlist]
 */
export function assertNoDoubledAdjacentTokens(
  section2And3Text,
  allowlist = ADJACENT_TOKEN_ALLOWLIST,
) {
  const tokens = buildAdjacentTokenStream(section2And3Text);
  /** @type {string[]} */
  const hits = [];

  let i = 0;
  while (i < tokens.length) {
    if (tokens[i] === TOKEN_BOUNDARY) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (
      j < tokens.length &&
      tokens[j] !== TOKEN_BOUNDARY &&
      tokens[j].toLowerCase() === tokens[i].toLowerCase()
    ) {
      j += 1;
    }
    const runLen = j - i;
    if (runLen >= 2) {
      const key = `${tokens[i].toLowerCase()} ${tokens[i].toLowerCase()}`;
      const allowOnePair = runLen === 2 && allowlist.has(key);
      if (!allowOnePair) {
        hits.push(`${tokens[i]} ${tokens[i]}`);
      }
    }
    i = j;
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
  const idx = findLineHeadingIndex(text, "## Changelog");
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
    return resolve(path);
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
  const sourceChangelog = listChangelogVersions(sourceNorm);
  const mirrorChangelog = listChangelogVersions(mirrorNorm);
  if (sourceChangelog.length === 0 || mirrorChangelog.length === 0) {
    throw new Error(
      "constitution-guard: version-collision: empty or missing changelog on source or mirror (cannot validate union)",
    );
  }
  const changelogVersions = new Set([
    ...sourceChangelog,
    ...mirrorChangelog,
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
