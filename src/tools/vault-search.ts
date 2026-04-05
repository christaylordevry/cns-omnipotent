import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import ignore from "ignore";
import { CnsError } from "../errors.js";
import { resolveVaultPath } from "../paths.js";
import { getRealVaultRoot, resolveReadTargetCanonical } from "../read-boundary.js";

export type VaultSearchHit = {
  path: string;
  matched_snippet: string;
  frontmatter_summary: string;
};

export type VaultSearchResult = {
  query: string;
  scope: string;
  hits: VaultSearchHit[];
};

const SNIPPET_MAX = 240;
const SUMMARY_MAX = 400;

function normalizeVaultRel(p: string): string {
  const s = p.replace(/\\/g, "/").replace(/^(\.\/)+/, "").replace(/\/+$/, "");
  return s.length === 0 ? "." : s;
}

/** True when search scope is `_meta/logs` or nested under it (search inside logs allowed). */
export function scopeAllowsMetaLogs(scopeVaultRel: string): boolean {
  const s = normalizeVaultRel(scopeVaultRel);
  return s === "_meta/logs" || s.startsWith("_meta/logs/");
}

function isUnderMetaLogs(vaultRel: string): boolean {
  const s = normalizeVaultRel(vaultRel);
  return s === "_meta/logs" || s.startsWith("_meta/logs/");
}

function shouldSkipMetaLogsPath(vaultRel: string, allowLogs: boolean): boolean {
  if (allowLogs) return false;
  return isUnderMetaLogs(vaultRel);
}

async function loadGitignore(vaultRoot: string, realVaultRoot: string): Promise<ReturnType<typeof ignore>> {
  const ig = ignore();
  let lexical: string;
  try {
    lexical = resolveVaultPath(vaultRoot, ".gitignore");
  } catch {
    return ig;
  }
  try {
    const canonical = await resolveReadTargetCanonical(realVaultRoot, lexical, {
      path: ".gitignore",
      notFoundMessage: "No file at vault path: .gitignore",
    });
    const raw = await readFile(canonical, "utf8");
    ig.add(raw);
  } catch (e) {
    if (e instanceof CnsError && e.code === "NOT_FOUND") return ig;
    throw e;
  }
  return ig;
}

function truncateSnippet(line: string): string {
  const t = line.replace(/\r?\n/g, " ").trim();
  if (t.length <= SNIPPET_MAX) return t;
  return `${t.slice(0, SNIPPET_MAX - 1)}…`;
}

function buildFrontmatterSummary(fileText: string): string {
  try {
    const { data } = matter(fileText);
    if (data === null || data === undefined || typeof data !== "object" || Array.isArray(data)) {
      return "{}";
    }
    const rec = data as Record<string, unknown>;
    const pick: Record<string, unknown> = {};
    for (const key of ["title", "pake_type", "status", "tags"]) {
      if (key in rec) pick[key] = rec[key];
    }
    const s = JSON.stringify(pick);
    if (s.length <= SUMMARY_MAX) return s;
    return `${s.slice(0, SUMMARY_MAX - 1)}…`;
  } catch {
    return "{}";
  }
}

export function resolveEffectiveSearchScope(
  scopeArg: string | undefined,
  defaultSearchScope: string | undefined,
): string {
  const trimmed = scopeArg?.trim();
  if (trimmed && trimmed.length > 0) return trimmed;
  const d = defaultSearchScope?.trim();
  if (d && d.length > 0) return d;
  throw new CnsError(
    "UNSUPPORTED",
    "vault_search requires `scope` when CNS_VAULT_DEFAULT_SEARCH_SCOPE is unset (whole-vault search is not allowed).",
    { hint: "Set CNS_VAULT_DEFAULT_SEARCH_SCOPE or pass scope." },
  );
}

async function* walkMarkdownFiles(
  realVaultRoot: string,
  dirAbs: string,
  vaultRelDir: string,
  ig: ReturnType<typeof ignore>,
  allowLogs: boolean,
  visitedDirs = new Set<string>(),
): AsyncGenerator<{ abs: string; vaultRel: string }> {
  const displayRel = normalizeVaultRel(vaultRelDir);
  const canonicalDir = await resolveReadTargetCanonical(realVaultRoot, dirAbs, {
    path: displayRel === "." ? "." : displayRel,
    notFoundMessage: `No directory at vault path: ${displayRel === "." ? "." : displayRel}`,
  });
  if (visitedDirs.has(canonicalDir)) return;
  visitedDirs.add(canonicalDir);

  let entries;
  try {
    entries = await readdir(canonicalDir, { withFileTypes: true });
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") {
      throw new CnsError("NOT_FOUND", `No directory at vault path: ${vaultRelDir || "."}`, {
        path: vaultRelDir || ".",
      });
    }
    throw new CnsError("IO_ERROR", `Failed to read directory: ${vaultRelDir || "."}`, { path: vaultRelDir || "." });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const ent of entries) {
    if (ent.name === "." || ent.name === "..") continue;
    const base = vaultRelDir === "." ? "" : vaultRelDir;
    const vaultRel = base ? `${base}/${ent.name}`.replace(/\/+/g, "/") : ent.name;

    if (shouldSkipMetaLogsPath(vaultRel, allowLogs)) continue;

    const childLexical = path.join(canonicalDir, ent.name);
    const childCanonical = await resolveReadTargetCanonical(realVaultRoot, childLexical, {
      path: vaultRel,
      notFoundMessage: `No entry at vault path: ${vaultRel}`,
    });

    let st;
    try {
      st = await stat(childCanonical);
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
      if (code === "ENOENT") {
        throw new CnsError("NOT_FOUND", `No entry at vault path: ${vaultRel}`, { path: vaultRel });
      }
      throw new CnsError("IO_ERROR", `Failed to stat path: ${vaultRel}`, { path: vaultRel });
    }

    if (st.isDirectory()) {
      if (ig.ignores(vaultRel + "/")) continue;
      yield* walkMarkdownFiles(realVaultRoot, childCanonical, vaultRel, ig, allowLogs, visitedDirs);
    } else if (st.isFile() && ent.name.endsWith(".md")) {
      if (ig.ignores(vaultRel)) continue;
      yield { abs: childCanonical, vaultRel };
    }
  }
}

async function searchNodeScanner(
  realVaultRoot: string,
  scopeAbs: string,
  scopeVaultRel: string,
  query: string,
  maxResults: number,
  ig: ReturnType<typeof ignore>,
  allowLogs: boolean,
): Promise<VaultSearchHit[]> {
  const hits: VaultSearchHit[] = [];
  const summaryCache = new Map<string, string>();

  for await (const { abs, vaultRel } of walkMarkdownFiles(
    realVaultRoot,
    scopeAbs,
    normalizeVaultRel(scopeVaultRel),
    ig,
    allowLogs,
  )) {
    let text: string;
    try {
      text = await readFile(abs, "utf8");
    } catch {
      continue;
    }
    const summary = summaryCache.get(abs) ?? buildFrontmatterSummary(text);
    summaryCache.set(abs, summary);

    const lines = text.split(/\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(query)) {
        hits.push({
          path: vaultRel,
          matched_snippet: truncateSnippet(lines[i]),
          frontmatter_summary: summary,
        });
        if (hits.length >= maxResults) return hits;
      }
    }
  }

  return hits;
}

type RgJsonLine = {
  type: string;
  data?: {
    path?: { text: string };
    lines?: { text: string };
  };
};

/**
 * Run ripgrep JSON mode from vault root; return hits or `null` to fall back to Node scanner.
 * Paths in JSON are vault-relative (POSIX). Respects `.gitignore` via ripgrep when present.
 */
async function searchRipgrep(
  realVaultRoot: string,
  scopeVaultRel: string,
  query: string,
  maxResults: number,
  allowLogs: boolean,
): Promise<VaultSearchHit[] | null> {
  const searchPath = normalizeVaultRel(scopeVaultRel) === "." ? "." : scopeVaultRel.replace(/\\/g, "/");
  const args = ["--json", "--fixed-strings", "--glob", "*.md", "-e", query, searchPath];
  if (!allowLogs) {
    args.splice(2, 0, "--glob", "!_meta/logs/**");
  }

  const pending: Array<{ absFile: string; vaultRel: string; lineText: string }> = [];

  const outcome = await new Promise<{ code: number; enoent: boolean }>((resolve) => {
    let settled = false;
    const finish = (o: { code: number; enoent: boolean }) => {
      if (settled) return;
      settled = true;
      resolve(o);
    };

    const proc = spawn("rg", args, { cwd: realVaultRoot, stdio: ["ignore", "pipe", "pipe"] });

    proc.on("error", (err) => {
      const code = err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
      finish({ code: -1, enoent: code === "ENOENT" });
    });

    const rl = createInterface({ input: proc.stdout });
    rl.on("line", (line) => {
      if (pending.length >= maxResults) return;
      let msg: RgJsonLine;
      try {
        msg = JSON.parse(line) as RgJsonLine;
      } catch {
        return;
      }
      if (msg.type !== "match" || !msg.data?.path?.text || msg.data.lines?.text === undefined) return;

      const vaultRel = msg.data.path.text.replace(/\\/g, "/");
      const lineText = msg.data.lines.text.replace(/\n$/, "");
      const absFile = path.join(realVaultRoot, ...vaultRel.split("/"));
      pending.push({ absFile, vaultRel, lineText });
    });

    proc.on("close", (code) => {
      finish({ code: code ?? -1, enoent: false });
    });
  });

  if (outcome.enoent) return null;
  if (outcome.code !== 0 && outcome.code !== 1) return null;

  const summaryCache = new Map<string, string>();
  const hits: VaultSearchHit[] = [];

  for (const row of pending.slice(0, maxResults)) {
    let summary = summaryCache.get(row.absFile);
    if (summary === undefined) {
      try {
        const canonicalFile = await resolveReadTargetCanonical(realVaultRoot, row.absFile, {
          path: row.vaultRel,
          notFoundMessage: `No file at vault path: ${row.vaultRel}`,
        });
        try {
          summary = buildFrontmatterSummary(await readFile(canonicalFile, "utf8"));
        } catch {
          summary = "{}";
        }
      } catch (e) {
        if (e instanceof CnsError) throw e;
        summary = "{}";
      }
      summaryCache.set(row.absFile, summary);
    }
    hits.push({
      path: row.vaultRel,
      matched_snippet: truncateSnippet(row.lineText),
      frontmatter_summary: summary,
    });
  }

  return hits;
}

export type VaultSearchOptions = {
  query: string;
  scope?: string | undefined;
  maxResults?: number;
  defaultSearchScope?: string | undefined;
  /** When true, skip ripgrep (for tests / deterministic Node path). */
  forceNodeScanner?: boolean;
};

/**
 * Full-text search under a scoped directory. Respects `.gitignore` at vault root; excludes `_meta/logs/` unless scope is under logs.
 */
export async function vaultSearch(vaultRoot: string, options: VaultSearchOptions): Promise<VaultSearchResult> {
  const scopeVaultRel = resolveEffectiveSearchScope(options.scope, options.defaultSearchScope);
  const maxResults = Math.min(50, Math.max(1, options.maxResults ?? 50));
  const query = options.query;
  if (!query || query.trim().length === 0) {
    throw new CnsError("IO_ERROR", "vault_search query must be a non-empty string.");
  }

  const realRoot = await getRealVaultRoot(vaultRoot);
  const scopeLexical = resolveVaultPath(vaultRoot, scopeVaultRel);
  const scopeCanonical = await resolveReadTargetCanonical(realRoot, scopeLexical, {
    path: scopeVaultRel,
    notFoundMessage: `No directory at vault path: ${scopeVaultRel}`,
  });

  let st;
  try {
    st = await stat(scopeCanonical);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
    if (code === "ENOENT") {
      throw new CnsError("NOT_FOUND", `No directory at vault path: ${scopeVaultRel}`, { path: scopeVaultRel });
    }
    throw new CnsError("IO_ERROR", `Failed to stat search scope: ${scopeVaultRel}`, { path: scopeVaultRel });
  }
  if (!st.isDirectory()) {
    throw new CnsError("IO_ERROR", `Search scope is not a directory: ${scopeVaultRel}`, { path: scopeVaultRel });
  }

  const allowLogs = scopeAllowsMetaLogs(scopeVaultRel);
  const ig = await loadGitignore(vaultRoot, realRoot);

  let hits: VaultSearchHit[];

  if (!options.forceNodeScanner) {
    const rgHits = await searchRipgrep(realRoot, scopeVaultRel, query, maxResults, allowLogs);
    if (rgHits !== null) {
      hits = rgHits;
    } else {
      hits = await searchNodeScanner(realRoot, scopeCanonical, scopeVaultRel, query, maxResults, ig, allowLogs);
    }
  } else {
    hits = await searchNodeScanner(realRoot, scopeCanonical, scopeVaultRel, query, maxResults, ig, allowLogs);
  }

  return { query, scope: scopeVaultRel, hits };
}
