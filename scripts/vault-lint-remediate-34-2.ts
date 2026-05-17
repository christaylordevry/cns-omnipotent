/**
 * Story 34-2: critical vault-lint remediation (Rule 1 delete + Rule 4 frontmatter).
 * Uses vaultUpdateFrontmatter pipeline (WriteGate, PAKE, audit).
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import { vaultUpdateFrontmatter } from "../src/tools/vault-update-frontmatter.js";

const RUN_DATE = "2026-05-17";
const REPORT_REL = "_meta/reports/vault-lint-2026-05-17.md";
const DELETE_REL = "03-Resources/e2e-epic30-20260516-cursor-dev.md";

const STATUS_MAP: Record<string, string> = {
  parked: "draft",
  operational: "in-progress",
  reference: "reviewed",
  active: "in-progress",
  approved: "reviewed",
};

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PAKE_TYPES = new Set([
  "SourceNote",
  "InsightNote",
  "HookSetNote",
  "WeaponsCheckNote",
  "SynthesisNote",
  "WorkflowNote",
  "ValidationNote",
]);

const VALID_STATUSES = new Set(["draft", "in-progress", "reviewed", "archived"]);
const VALID_VERIFICATION = new Set(["pending", "verified", "disputed"]);
const VALID_CREATION_METHOD = new Set(["human", "ai", "hybrid"]);

function resolveVaultRoot(): string {
  const env = process.env.CNS_VAULT_ROOT?.trim();
  if (env) return path.resolve(env);
  throw new Error("CNS_VAULT_ROOT is not set");
}

function parseRule4Paths(reportText: string): string[] {
  const start = reportText.indexOf("### Rule 4 — Missing required frontmatter");
  const end = reportText.indexOf("\n## WARNINGS", start);
  const section = reportText.slice(start, end);
  const paths: string[] = [];
  const re = /Fix: \{"tool":"vault_update_frontmatter","arguments":\{"path":"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    paths.push(m[1]);
  }
  return paths;
}

function inferPakeType(vaultRel: string): string {
  if (vaultRel.startsWith("03-Resources/")) return "SourceNote";
  return "WorkflowNote";
}

function deriveTitle(fm: Record<string, unknown>, body: string, vaultRel: string): string {
  const t = fm.title;
  if (typeof t === "string" && t.trim()) return t.trim();
  const heading = body.match(/^#\s+(.+)$/m);
  if (heading?.[1]) return heading[1].trim();
  return path.basename(vaultRel, ".md");
}

function toYmd(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

function deriveCreated(fm: Record<string, unknown>, absPath: string): string {
  return (
    toYmd(fm.created) ??
    toYmd(fm.date) ??
    toYmd(fm.modified) ??
    formatMtime(absPath) ??
    RUN_DATE
  );
}

function formatMtime(absPath: string): string | undefined {
  try {
    const st = fs.statSync(absPath);
    return st.mtime.toISOString().slice(0, 10);
  } catch {
    return undefined;
  }
}

function normalizeTags(fm: Record<string, unknown>): string[] {
  const tags = fm.tags;
  if (Array.isArray(tags) && tags.length > 0) {
    return tags.map(String);
  }
  if (typeof tags === "string" && tags.trim()) {
    return [tags.trim()];
  }
  return ["lint-auto"];
}

function mapStatus(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "draft";
  const key = raw.trim().toLowerCase();
  if (["draft", "in-progress", "reviewed", "archived"].includes(key)) return key;
  return STATUS_MAP[key] ?? "draft";
}

const OPERATOR_VERIFIED_DOCS = new Set([
  "03-Resources/CNS-Workflow-Map.md",
  "03-Resources/Nexus-Discord-Obsidian-Bridge-Full-Guide.md",
  "03-Resources/Nexus-Discord-Obsidian-Bridge-Operator-Guide.md",
  "03-Resources/Operator-Profile.md",
]);

function defaultVerificationStatus(vaultRel: string): string {
  return OPERATOR_VERIFIED_DOCS.has(vaultRel) ? "verified" : "pending";
}

function statusNeedsUpdate(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return "draft";
  const key = raw.trim().toLowerCase();
  if (VALID_STATUSES.has(key)) return undefined;
  return mapStatus(raw);
}

function verificationStatusNeedsUpdate(
  vaultRel: string,
  fm: Record<string, unknown>,
): string | undefined {
  const vs = fm.verification_status;
  if (typeof vs === "string" && vs.trim()) {
    const t = vs.trim().toLowerCase();
    if (t === "approved") return "verified";
    if (VALID_VERIFICATION.has(t)) return undefined;
  }
  return defaultVerificationStatus(vaultRel);
}

function confidenceScoreNeedsUpdate(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return 0.7;
  if (typeof raw === "number") {
    if (raw >= 0 && raw <= 1) return undefined;
    return 0.7;
  }
  if (typeof raw === "string") {
    const n = Number(raw.trim());
    if (Number.isFinite(n) && n >= 0 && n <= 1) return undefined;
    return 0.7;
  }
  return 0.7;
}

function buildUpdates(
  vaultRel: string,
  fm: Record<string, unknown>,
  body: string,
  absPath: string,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  const pakeId = fm.pake_id;
  if (typeof pakeId !== "string" || !UUID_V4.test(pakeId.trim())) {
    updates.pake_id = randomUUID();
  }

  if (typeof fm.pake_type !== "string" || !PAKE_TYPES.has(fm.pake_type.trim())) {
    updates.pake_type = inferPakeType(vaultRel);
  }

  if (typeof fm.title !== "string" || !fm.title.trim()) {
    updates.title = deriveTitle(fm, body, vaultRel);
  }

  if (!toYmd(fm.created)) {
    updates.created = deriveCreated(fm, absPath);
  }

  if (!toYmd(fm.modified)) {
    updates.modified = RUN_DATE;
  }

  const statusFix = statusNeedsUpdate(fm.status);
  if (statusFix !== undefined) updates.status = statusFix;

  const csFix = confidenceScoreNeedsUpdate(fm.confidence_score);
  if (csFix !== undefined) updates.confidence_score = csFix;

  const vsFix = verificationStatusNeedsUpdate(vaultRel, fm);
  if (vsFix !== undefined) updates.verification_status = vsFix;

  if (
    typeof fm.creation_method !== "string" ||
    !VALID_CREATION_METHOD.has(fm.creation_method.trim())
  ) {
    updates.creation_method = "hybrid";
  }

  const tags = normalizeTags(fm);
  if (!Array.isArray(fm.tags) || (Array.isArray(fm.tags) && fm.tags.length === 0)) {
    updates.tags = tags;
  }

  return updates;
}

function asYmd(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return toYmd(value);
}

/** Vault-lint Rule 4 critical-field checks (matches task-prompt §7). */
function rule4Findings(fm: Record<string, unknown>): string[] {
  const findings: string[] = [];
  const STATUSES = VALID_STATUSES;
  const VS = VALID_VERIFICATION;
  const CM = VALID_CREATION_METHOD;

  if (typeof fm.pake_id !== "string" || !fm.pake_id.trim()) findings.push("missing_pake_id");
  if (typeof fm.pake_type !== "string" || !PAKE_TYPES.has(fm.pake_type)) findings.push("missing_pake_type");
  if (typeof fm.title !== "string" || !fm.title.trim()) findings.push("missing_title");
  if (!asYmd(fm.created)) findings.push("missing_created");
  if (!asYmd(fm.modified)) findings.push("missing_modified");
  if (typeof fm.status !== "string" || !STATUSES.has(fm.status)) findings.push("missing_status");
  const cs = fm.confidence_score;
  if (typeof cs !== "number" || cs < 0 || cs > 1) findings.push("missing_confidence_score");
  if (typeof fm.verification_status !== "string" || !VS.has(fm.verification_status)) {
    findings.push("missing_verification_status");
  }
  if (typeof fm.creation_method !== "string" || !CM.has(fm.creation_method)) {
    findings.push("missing_creation_method");
  }
  const tags = fm.tags;
  if (!Array.isArray(tags) || tags.length === 0) findings.push("missing_tags");
  return findings;
}

function lintRule4Errors(vaultRoot: string): { path: string; issues: string[] }[] {
  const governed = ["01-Projects", "02-Areas", "03-Resources"];
  const errors: { path: string; issues: string[] }[] = [];

  for (const top of governed) {
    const dir = path.join(vaultRoot, top);
    if (!fs.existsSync(dir)) continue;
    walkMd(dir, top, (rel) => {
      if (path.basename(rel) === "_README.md") return;
      const abs = path.join(vaultRoot, rel);
      let raw: string;
      try {
        raw = fs.readFileSync(abs, "utf8");
      } catch {
        return;
      }
      let fm: Record<string, unknown>;
      try {
        const parsed = matter(raw);
        fm =
          parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
            ? (parsed.data as Record<string, unknown>)
            : {};
      } catch {
        errors.push({ path: rel, issues: ["unparseable_yaml"] });
        return;
      }
      const issues = rule4Findings(fm);
      if (issues.length) errors.push({ path: rel, issues });
    });
  }
  return errors;
}

function walkMd(dir: string, relPrefix: string, onFile: (rel: string) => void): void {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = `${relPrefix}/${ent.name}`;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) walkMd(abs, rel, onFile);
    else if (ent.isFile() && ent.name.endsWith(".md")) onFile(rel);
  }
}

function lintRule1Errors(vaultRoot: string): string[] {
  const byUri = new Map<string, { path: string; created: string }[]>();
  const governed = ["01-Projects", "02-Areas", "03-Resources"];

  for (const top of governed) {
    const dir = path.join(vaultRoot, top);
    if (!fs.existsSync(dir)) continue;
    walkMd(dir, top, (rel) => {
      if (path.basename(rel) === "_README.md") return;
      const abs = path.join(vaultRoot, rel);
      let raw: string;
      try {
        raw = fs.readFileSync(abs, "utf8");
      } catch {
        return;
      }
      let fm: Record<string, unknown>;
      try {
        const parsed = matter(raw);
        fm =
          parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
            ? (parsed.data as Record<string, unknown>)
            : {};
      } catch {
        return;
      }
      if (fm.pake_type !== "SourceNote") return;
      const uri =
        (typeof fm.source_uri === "string" && fm.source_uri.trim()) ||
        (typeof fm.source_url === "string" && fm.source_url.trim()) ||
        "";
      if (!uri) return;
      const created = toYmd(fm.created) ?? "unknown";
      const list = byUri.get(uri) ?? [];
      list.push({ path: rel, created });
      byUri.set(uri, list);
    });
  }

  const dupGroups: string[] = [];
  for (const [uri, notes] of byUri) {
    if (notes.length >= 2) dupGroups.push(`${uri} (${notes.map((n) => n.path).join(", ")})`);
  }
  return dupGroups;
}

async function main(): Promise<void> {
  const vaultRoot = resolveVaultRoot();
  const reportPath = path.join(vaultRoot, REPORT_REL);
  const reportText = await readFile(reportPath, "utf8");
  const paths = parseRule4Paths(reportText);

  if (paths.length !== 77) {
    throw new Error(`Expected 77 Rule 4 paths, got ${paths.length}`);
  }

  const EXTRA_STATUS_FIXES: [string, Record<string, unknown>][] = [
    [
      "03-Resources/CNS-Operator-Guide.md",
      { status: "reviewed", created: "2026-04-05", modified: RUN_DATE },
    ],
    [
      "03-Resources/Vault-Intelligence-Discovery-Workflow.md",
      { status: "reviewed", created: "2026-04-05", modified: RUN_DATE },
    ],
  ];

  console.log(`Vault root: ${vaultRoot}`);
  console.log(`Rule 4 paths to patch: ${paths.length}`);

  const deleteAbs = path.join(vaultRoot, DELETE_REL);
  if (fs.existsSync(deleteAbs)) {
    fs.unlinkSync(deleteAbs);
    console.log(`Deleted: ${DELETE_REL}`);
  } else {
    console.log(`Already absent: ${DELETE_REL}`);
  }

  let ok = 0;
  let fail = 0;
  const statusMappings: string[] = [];

  for (const [vaultRel, extra] of EXTRA_STATUS_FIXES) {
    const absPath = path.join(vaultRoot, vaultRel);
    let raw: string;
    try {
      raw = await readFile(absPath, "utf8");
    } catch (e) {
      fail++;
      console.error(`\nFAIL extra read ${vaultRel}:`, e);
      continue;
    }
    const { data } = matter(raw);
    const fm =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};
    const needed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(extra)) {
      if (fm[key] !== value) needed[key] = value;
    }
    if (Object.keys(needed).length === 0) {
      console.log(`Skip extra (already applied): ${vaultRel}`);
      continue;
    }
    try {
      await vaultUpdateFrontmatter(vaultRoot, vaultRel, needed, { surface: "story-34-2" });
      if (typeof fm.status === "string" && fm.status !== needed.status) {
        statusMappings.push(`${vaultRel}: ${fm.status} -> ${needed.status}`);
      }
      ok++;
    } catch (e) {
      fail++;
      console.error(`\nFAIL extra ${vaultRel}:`, e);
    }
  }

  let skipped = 0;
  for (const vaultRel of paths) {
    const absPath = path.join(vaultRoot, vaultRel);
    const raw = await readFile(absPath, "utf8");
    const { data, content } = matter(raw);
    const fm =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};

    const oldStatus = fm.status;
    const updates = buildUpdates(vaultRel, fm, content, absPath);
    if (Object.keys(updates).length === 0) {
      skipped++;
      continue;
    }
    if (
      "status" in updates &&
      typeof oldStatus === "string" &&
      oldStatus !== updates.status
    ) {
      statusMappings.push(`${vaultRel}: ${oldStatus} -> ${updates.status}`);
    }

    try {
      await vaultUpdateFrontmatter(vaultRoot, vaultRel, updates, { surface: "story-34-2" });
      ok++;
      process.stdout.write(".");
    } catch (e) {
      fail++;
      console.error(`\nFAIL ${vaultRel}:`, e);
    }
  }

  console.log(`\nPatched: ${ok} ok, ${skipped} skipped (already compliant), ${fail} failed`);

  const rule1 = lintRule1Errors(vaultRoot);
  const rule4All = lintRule4Errors(vaultRoot);
  const remediatedSet = new Set(paths);
  const rule4Remediated = rule4All.filter((e) => remediatedSet.has(e.path));

  console.log("\n=== Post-remediation lint (Rule 1 + Rule 4 ERROR classes) ===");
  console.log(`Rule 1 duplicate groups: ${rule1.length}`);
  if (rule1.length) rule1.forEach((g) => console.log(`  - ${g}`));
  console.log(`Rule 4 errors on remediated paths (expect 0): ${rule4Remediated.length}`);
  if (rule4Remediated.length) {
    for (const e of rule4Remediated) {
      console.log(`  - ${e.path}: ${e.issues.join(", ")}`);
    }
  }
  console.log(`Rule 4 errors vault-wide (informational): ${rule4All.length}`);
  if (rule4All.length && rule4All.length !== rule4Remediated.length) {
    for (const e of rule4All.filter((x) => !remediatedSet.has(x.path)).slice(0, 10)) {
      console.log(`  - ${e.path}: ${e.issues.join(", ")}`);
    }
  }

  if (statusMappings.length) {
    console.log("\nStatus mappings:");
    statusMappings.forEach((m) => console.log(`  ${m}`));
  }

  if (fail > 0 || rule1.length > 0 || rule4Remediated.length > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
