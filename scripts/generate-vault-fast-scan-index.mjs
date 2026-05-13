#!/usr/bin/env node
/**
 * Story 29-9: Build AI-Context/vault-fast-scan-index.md from governed folders
 * (01-Projects, 02-Areas, 03-Resources). Operator FS output; not a Vault IO mutator.
 *
 * Env: CNS_VAULT_ROOT — vault root (default: repo Knowledge-Vault-ACTIVE).
 */
import { readdir, readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { join, relative, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const GOVERNED = ["01-Projects", "02-Areas", "03-Resources"];

const HEADER = `# Vault Fast-Scan Index (auto — /session-close)
# Format: [TYPE] [path] | [title] | [created]
# Token budget: ≤2,000 tokens | Cap: 100 most-recently-modified notes

`;

const TYPE_MAP = {
  SourceNote: "SRC",
  InsightNote: "INS",
  SynthesisNote: "SYN",
  DailyNote: "DLY",
};

function vaultRoot() {
  const env = process.env.CNS_VAULT_ROOT?.trim();
  if (env) return env;
  return join(root, "Knowledge-Vault-ACTIVE");
}

function parseYmd(s) {
  if (!s || typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return Number.isFinite(t) ? t : null;
}

function ymdFromMs(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function typeCode(pakeType) {
  if (!pakeType) return "OTH";
  return TYPE_MAP[pakeType] ?? "OTH";
}

function normalizeTitle(t, basename) {
  let s = typeof t === "string" ? t.trim() : "";
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  if (!s) s = basename.replace(/\.md$/i, "");
  return s.replaceAll("|", " - ").slice(0, 240);
}

function pickCreated(fm, mtimeMs) {
  const raw = fm.created ?? fm.date ?? fm.modified;
  const parsed = parseYmd(typeof raw === "string" ? raw : "");
  if (parsed != null) return ymdFromMs(parsed);
  return ymdFromMs(mtimeMs);
}

async function walkMarkdown(dir, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      await walkMarkdown(p, out);
    } else if (ent.isFile() && ent.name.endsWith(".md")) {
      out.push(p);
    }
  }
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function buildBody(rows, cap) {
  const slice = rows.slice(0, cap);
  const lines = slice.map(
    (r) => `${r.code} ${r.rel} | ${r.title} | ${r.created}`,
  );
  return HEADER + lines.join("\n") + "\n";
}

function fitCap(rows) {
  let cap = Math.min(100, rows.length);
  if (cap === 0) {
    const text = HEADER + "\n";
    return { text, cap: 0 };
  }
  while (cap > 0) {
    const text = buildBody(rows, cap);
    if (estimateTokens(text) <= 2000) return { text, cap };
    cap -= 5;
  }
  const text = HEADER + "\n";
  return { text, cap: 0 };
}

async function main() {
  const vRoot = vaultRoot();
  const paths = [];
  for (const g of GOVERNED) {
    await walkMarkdown(join(vRoot, g), paths);
  }

  const rows = [];
  for (const abs of paths) {
    let st;
    let raw;
    try {
      [st, raw] = await Promise.all([stat(abs), readFile(abs, "utf8")]);
    } catch {
      continue;
    }
    const rel = relative(vRoot, abs).split(sep).join("/");
    const { data: fm } = matter(raw);
    const mtimeMs = st.mtimeMs;
    const modMs = parseYmd(fm.modified) ?? mtimeMs;
    rows.push({
      rel,
      code: typeCode(fm.pake_type),
      title: normalizeTitle(fm.title, rel.split("/").pop() ?? rel),
      created: pickCreated(fm, mtimeMs),
      sortMs: modMs,
    });
  }

  rows.sort((a, b) => b.sortMs - a.sortMs);

  const { text } = fitCap(rows);

  const outDir = join(vRoot, "AI-Context");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "vault-fast-scan-index.md");
  await writeFile(outPath, text, "utf8");
  process.stdout.write(
    `Wrote ${outPath} (${text.length} chars, est. ${estimateTokens(text)} tokens, cap applied internally)\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
