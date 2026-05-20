/**
 * Story 37-1: 03-Resources E2E fixture delete + stale-pending stamp.
 * Part A: rm -f + vaultLogAction per file (surface story-37-1).
 * Part B: vaultUpdateFrontmatter on remaining Rule-3 queue paths.
 */
import fs from "node:fs";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";
import { CnsError } from "../src/errors.js";
import { vaultLogAction } from "../src/tools/vault-log-action.js";
import { vaultReadFile } from "../src/tools/vault-read.js";
import { vaultUpdateFrontmatter } from "../src/tools/vault-update-frontmatter.js";

const SURFACE = "story-37-1";
const RUN_DATE = "2026-05-21";
const MODIFIED = RUN_DATE;
const PREFIX = "03-Resources/";

const DELETE_PATHS = [
  "03-Resources/e2e-epic30-dedup-test.md",
  "03-Resources/epic-33-2-e2e-graduate-fixture-controlled-story-33-2-cursor-dev.md",
  "03-Resources/vault-graduate-confirmed-working-via-discord-gateway-slash-less-invocation-uses-skill-name-form.md",
  "03-Resources/weapons-check-epic-30-e2e-synthesis-test-cursor-dev-2026-05-16.md",
  "03-Resources/_e2e-27-7-disposable.md",
];

type StampRow = {
  path: string;
  decision: "verified" | "disputed";
  daysPending: number;
  rationale?: string;
};

const STAMP_QUEUE: StampRow[] = [
  {
    path: "03-Resources/AI-Shared-Brain-Architecture.md",
    decision: "verified",
    daysPending: 30,
    rationale: "Durable architecture reference (Nexus/docs guide links).",
  },
  {
    path: "03-Resources/Obsidian-Claude-Code-Personal-OS.md",
    decision: "verified",
    daysPending: 51,
    rationale: "Durable PKM reference.",
  },
  {
    path: "03-Resources/building-with-gemini-embedding-2-agentic-multimodal-rag-and-beyond.md",
    decision: "verified",
    daysPending: 16,
    rationale: "Live URL ingest artifact; summary still useful for embedding/RAG work.",
  },
];

/** Rule 3 governed scope per vault-lint.md (01/02/03 only). */
const RULE3_GOVERNED_PREFIXES = ["01-Projects/", "02-Areas/", "03-Resources/"];

function resolveVaultRoot(): string {
  const env = process.env.CNS_VAULT_ROOT?.trim();
  if (env) return path.resolve(env);
  throw new Error("CNS_VAULT_ROOT is not set");
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(createdYmd: string, todayYmd: string): number {
  const a = new Date(`${createdYmd}T00:00:00Z`).getTime();
  const b = new Date(`${todayYmd}T00:00:00Z`).getTime();
  return Math.floor((b - a) / 86_400_000);
}

function parseRule3Paths(reportText: string, prefix: string): string[] {
  const start = reportText.indexOf("### Rule 3");
  const end = reportText.indexOf("### Rule 4", start);
  const section = end < 0 ? reportText.slice(start) : reportText.slice(start, end);
  const paths: string[] = [];
  const re = /Stale pending: `([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    if (m[1].startsWith(prefix)) paths.push(m[1]);
  }
  return paths;
}

function formatVerificationStatus(fm: Record<string, unknown>): string {
  const vs = typeof fm.verification_status === "string" ? fm.verification_status.trim() : "";
  return vs || "(missing)";
}

/** Rule 3 stale-pending scan (vault-lint.md governed scope: 01/02/03). */
function scanRule3StalePending(vaultRoot: string, todayYmd: string): { path: string; pakeType: string; days: number }[] {
  const out: { path: string; pakeType: string; days: number }[] = [];

  function walk(dir: string): void {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!ent.name.endsWith(".md") || ent.name === "_README.md") continue;
      const rel = path.relative(vaultRoot, abs).split(path.sep).join("/");
      if (!RULE3_GOVERNED_PREFIXES.some((p) => rel.startsWith(p))) continue;

      const raw = fs.readFileSync(abs, "utf8");
      const fm = matter(raw).data as Record<string, unknown>;
      const vs = typeof fm.verification_status === "string" ? fm.verification_status.trim() : "";
      if (vs !== "pending") continue;
      const created = typeof fm.created === "string" ? fm.created.trim() : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(created)) continue;
      const days = daysBetween(created, todayYmd);
      if (days <= 14) continue;
      const pakeType = typeof fm.pake_type === "string" ? fm.pake_type : "unknown";
      out.push({ path: rel, pakeType, days });
    }
  }

  for (const prefix of RULE3_GOVERNED_PREFIXES) {
    const base = path.join(vaultRoot, prefix);
    if (fs.existsSync(base)) walk(base);
  }

  return out.sort((a, b) => a.path.localeCompare(b.path));
}

async function assertNotFound(vaultRoot: string, rel: string): Promise<void> {
  try {
    await vaultReadFile(vaultRoot, rel);
    throw new Error(`Expected NOT_FOUND after delete: ${rel}`);
  } catch (e) {
    if (e instanceof CnsError && e.code === "NOT_FOUND") return;
    throw e;
  }
}

async function main(): Promise<void> {
  const vaultRoot = resolveVaultRoot();
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const todayYmd = utcToday();
  const reportPath = path.join(vaultRoot, "_meta/reports/vault-lint-2026-05-18.md");
  const reportText = fs.existsSync(reportPath) ? await readFile(reportPath, "utf8") : "";
  const rule3Before = reportText ? parseRule3Paths(reportText, PREFIX) : [];

  const deleteRows: string[] = [];
  const verifyRows: string[] = [];

  for (const rel of DELETE_PATHS) {
    const abs = path.join(vaultRoot, rel);
    const existed = fs.existsSync(abs);
    if (!existed) {
      throw new Error(`Pre-delete check failed — missing: ${rel}`);
    }
    const preFm = matter(fs.readFileSync(abs, "utf8")).data as Record<string, unknown>;
    deleteRows.push(`| \`${rel}\` | yes | ${formatVerificationStatus(preFm)} |`);

    const rmTs = new Date().toISOString();
    fs.rmSync(abs, { force: true });
    const log = await vaultLogAction(
      vaultRoot,
      {
        action: "delete",
        tool_used: "operator_fs",
        target_path: rel,
        details: "story-37-1 e2e_fixture_epic37_1",
      },
      { surface: SURFACE },
    );

    await assertNotFound(vaultRoot, rel);
    verifyRows.push(
      `| \`${rel}\` | \`rm -f\` | ${rmTs} | \`${log.logged_at}\` | NOT_FOUND confirmed |`,
    );
  }

  const stampRows: string[] = [];
  let verified = 0;
  let disputed = 0;

  for (const row of STAMP_QUEUE) {
    const abs = path.join(vaultRoot, row.path);
    if (!fs.existsSync(abs)) {
      throw new Error(`Stamp target missing: ${row.path}`);
    }
    const before = matter(fs.readFileSync(abs, "utf8")).data as Record<string, unknown>;
    const pakeType = typeof before.pake_type === "string" ? before.pake_type : "unknown";
    const created = typeof before.created === "string" ? before.created.trim() : "";
    const days =
      /^\d{4}-\d{2}-\d{2}$/.test(created) ? daysBetween(created, todayYmd) : row.daysPending;

    const ts = new Date().toISOString();
    await vaultUpdateFrontmatter(
      vaultRoot,
      row.path,
      { verification_status: row.decision, modified: MODIFIED },
      { surface: SURFACE },
    );

    if (row.decision === "verified") verified += 1;
    else disputed += 1;

    stampRows.push(
      `| \`${row.path}\` | ${pakeType} | ${days} | ${row.decision} | vault_update_frontmatter | ${ts} |`,
    );
  }

  const rule3After = scanRule3StalePending(vaultRoot, todayYmd);
  const rule3After03 = rule3After.filter((r) => r.path.startsWith(PREFIX));

  const evidencePath = path.join(
    repoRoot,
    "_bmad-output/implementation-artifacts/epic-37-03-resources-cleanup-evidence.md",
  );

  const disputedTable =
    STAMP_QUEUE.filter((r) => r.decision === "disputed" && r.rationale)
      .map((r) => `| \`${r.path}\` | ${r.rationale} |`)
      .join("\n") || "| — | none |";

  const evidence = `# Epic 37 — 03-Resources cleanup evidence (Story 37-1)

| Field | Value |
|-------|--------|
| **Story** | 37-1-test-artifact-cleanup-03-resources-stale-pending-stamp |
| **Run date** | ${RUN_DATE} (UTC) |
| **Vault root** | \`CNS_VAULT_ROOT\` → live Knowledge-Vault-ACTIVE |
| **Lint baseline** | \`_meta/reports/vault-lint-2026-05-18.md\` |
| **Gateway** | MCP-only batch (Hermes optional for operator \`/vault-lint\` refresh) |

## Part A — E2E fixture deletes

**Pre-delete existence (all five confirmed on live vault):**

| Path | Existed | verification_status (pre) |
|------|---------|----------------------------|
${deleteRows.join("\n")}

**Deletes + audit (\`operator_fs\` + \`vault_log_action\`, surface \`${SURFACE}\`):**

| Path | Method | Delete UTC | logged_at | Post-delete |
|------|--------|------------|-----------|-------------|
${verifyRows.join("\n")}

## Part B — Stale pending stamp

**Skipped:** \`03-Resources/_e2e-27-7-disposable.md\` (deleted in Part A; delete takes priority).

| Path | pake_type | Days pending | Decision | Method | UTC time |
|------|-----------|--------------|----------|--------|----------|
${stampRows.join("\n")}

**Summary:** ${STAMP_QUEUE.length}/${STAMP_QUEUE.length} stamped — **${verified}** \`verified\`, **${disputed}** \`disputed\`.

**Disputed rationale:**

| Path | Rationale |
|------|-----------|
${disputedTable}

## Post-run Rule 3 (\`03-Resources/\` cluster)

Equivalent scan per \`vault-lint.md\` Rule 3 (\`days_pending > 14\`, \`verification_status: pending\`):

| Metric | Before (2026-05-18 report, 03-Resources only) | After (${RUN_DATE} scan) |
|--------|---------------------------------------------:|-------------------------:|
| Rule 3 stale-pending — \`03-Resources/\` | **${rule3Before.length}** | **${rule3After03.length}** |
| Rule 3 stale-pending — vault-wide (01/02/03 scan) | **4** (post-36-3 report) | **${rule3After.length}** |

**Before paths (baseline report):**

${rule3Before.map((p) => `- \`${p}\``).join("\n") || "- (none parsed)"}

**After paths (03-Resources only):**

${rule3After03.map((r) => `- \`${r.path}\` (${r.pakeType}, ${r.days} days)`).join("\n") || "- **0** — AC satisfied for 03-Resources/ Rule 3 stale-pending class"}

**Operator:** Run \`/vault-lint\` in \`#hermes\` to refresh on-disk report; expect Rule 3 **0** for \`03-Resources/\` stale-pending queue.

**Audit:** \`${SURFACE}\` lines in \`_meta/logs/agent-log.md\` (5 delete + ${STAMP_QUEUE.length} frontmatter updates).
`;

  await writeFile(evidencePath, evidence, "utf8");

  console.log(`Deleted ${DELETE_PATHS.length} E2E fixtures`);
  console.log(`Stamped ${STAMP_QUEUE.length} notes (${verified} verified, ${disputed} disputed)`);
  console.log(`Rule 3 — 03-Resources after scan: ${rule3After03.length}; vault-wide: ${rule3After.length}`);
  console.log(`Evidence: ${evidencePath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
