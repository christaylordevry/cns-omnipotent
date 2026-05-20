/**
 * Story 37-2: 03-Resources topic hub indexes + orphan wiring.
 * Creates six Research topic hubs, merges Research/parent _README.md sections.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";
import { vaultCreateNoteFromMarkdown } from "../src/tools/vault-create-note.js";

const execFileAsync = promisify(execFile);
const RELATED_NOTES_HEADING = "## Related notes";

const SURFACE = "story-37-2";
const RUN_DATE = "2026-05-21";
const RESOURCES_PREFIX = "03-Resources/";

const HUB_CONTRACT = `---
purpose: Topic hub linking related perplexity research notes
schema_required: true
allowed_pake_types: SourceNote | InsightNote | SynthesisNote | ValidationNote
naming_convention: Topic-scoped hub; wikilink index in body
---
`;

type ClusterDef = {
  hubRel: string;
  heading: string;
  scope: string;
  pathPrefix: string;
};

const CLUSTERS: ClusterDef[] = [
  {
    hubRel: "03-Resources/Research/consulting-rates-hub.md",
    heading: "Consulting rates (Sydney)",
    scope: "Perplexity research on creative technologist consulting rates in Sydney (2026).",
    pathPrefix: "perplexity-creative-technologist-consulting-rates-sydney",
  },
  {
    hubRel: "03-Resources/Research/remote-roles-hub.md",
    heading: "Remote roles & positioning",
    scope: "Perplexity research on remote creative technologist roles and positioning (2026).",
    pathPrefix: "perplexity-creative-technologist-remote-roles",
  },
  {
    hubRel: "03-Resources/Research/day-rate-hub.md",
    heading: "Freelance day rate methodology",
    scope: "Perplexity research on freelance consulting day-rate calculation (2026).",
    pathPrefix: "perplexity-freelance-consulting-day-rate",
  },
  {
    hubRel: "03-Resources/Research/retainer-pricing-hub.md",
    heading: "Creative agency retainer pricing",
    scope: "Perplexity research on creative agency retainer fees and packages (2026).",
    pathPrefix: "perplexity-how-to-price-creative-agency-retainers",
  },
  {
    hubRel: "03-Resources/Research/obsidian-pkm-hub.md",
    heading: "Obsidian PKM workflows",
    scope: "Perplexity research on Obsidian personal knowledge management workflows (2026).",
    pathPrefix: "perplexity-obsidian-personal-knowledge-management",
  },
  {
    hubRel: "03-Resources/Research/ai-agent-orchestration-hub.md",
    heading: "AI agent orchestration (LangChain / LangGraph)",
    scope: "Perplexity research on LangChain and LangGraph agent orchestration frameworks (2026).",
    pathPrefix: "perplexity-ai-agent-orchestration-frameworks",
  },
];

const RESEARCH_README_REL = "03-Resources/Research/_README.md";
const PARENT_README_REL = "03-Resources/_README.md";

function resolveVaultRoot(): string {
  const env = process.env.CNS_VAULT_ROOT?.trim();
  if (env) return path.resolve(env);
  throw new Error("CNS_VAULT_ROOT is not set");
}

function extractReportSection(reportText: string, startHeading: string, endHeading: string): string {
  const start = reportText.indexOf(startHeading);
  if (start < 0) return "";
  const from = start + startHeading.length;
  const end = reportText.indexOf(endHeading, from);
  return end < 0 ? reportText.slice(from) : reportText.slice(from, end);
}

function parseOrphanPaths(reportText: string, prefix: string): string[] {
  const section =
    extractReportSection(reportText, "### Rule 2", "### Rule 3") ||
    extractReportSection(reportText, "### Rule 2 —", "### Rule 3");
  const paths: string[] = [];
  const patterns = [
    /\* Orphan note[^:]*: `([^`]+)`/g,
    /^- `([^`]+)` \(/gm,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(section)) !== null) {
      const p = m[1];
      if (p.startsWith(prefix) && !p.endsWith("_README.md") && !p.endsWith("-hub.md")) {
        paths.push(p);
      }
    }
  }
  return [...new Set(paths)].sort();
}

function noteTitle(fm: Record<string, unknown>, rel: string): string {
  const t = fm.title;
  if (typeof t === "string" && t.trim()) return t.trim();
  const base = path.basename(rel, ".md");
  return base.replace(/-/g, " ");
}

function wikilinkFor(rel: string, title: string): string {
  if (rel.includes("/") || title.length > 80 || /[[\]|]/.test(title)) {
    const short =
      title.length > 72 ? `${title.slice(0, 69)}…` : title.replace(/\s+/g, " ").trim();
    return `- [[${rel}|${short}]]`;
  }
  return `- [[${title}]]`;
}

function listNotesByPrefix(vaultRoot: string, prefix: string): { rel: string; title: string }[] {
  const base = path.join(vaultRoot, RESOURCES_PREFIX);
  const out: { rel: string; title: string }[] = [];

  function walk(dir: string): void {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!ent.name.endsWith(".md") || ent.name.endsWith("-hub.md")) continue;
      const rel = path.relative(vaultRoot, abs).split(path.sep).join("/");
      if (!rel.startsWith(RESOURCES_PREFIX)) continue;
      const slug = path.basename(rel);
      if (!slug.startsWith(prefix)) continue;
      const fm = matter(fs.readFileSync(abs, "utf8")).data as Record<string, unknown>;
      out.push({ rel, title: noteTitle(fm, rel) });
    }
  }

  walk(base);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

function buildRelatedNotesSection(notes: { rel: string; title: string }[]): string {
  const links = notes.map((n) => wikilinkFor(n.rel, n.title)).join("\n");
  return `${RELATED_NOTES_HEADING}\n\n${links || "- (no notes matched prefix)"}`;
}

function buildTopicHub(cluster: ClusterDef, notes: { rel: string; title: string }[]): string {
  return `${HUB_CONTRACT}
# ${cluster.heading}

${cluster.scope}

${buildRelatedNotesSection(notes)}
`;
}

/** Preserve existing hub body; replace Related notes index only (AC6 / 36-3 mergeHubWithIndex pattern). */
function mergeTopicHubWithIndex(
  existingMarkdown: string,
  cluster: ClusterDef,
  notes: { rel: string; title: string }[],
): string {
  const indexStart = existingMarkdown.search(/^## Related notes\s*$/m);
  if (indexStart < 0) return buildTopicHub(cluster, notes);
  const preserved = existingMarkdown.slice(0, indexStart).trimEnd();
  return `${preserved}\n\n${buildRelatedNotesSection(notes)}\n`;
}

type BulkScanMetrics = {
  scanned: number;
  clean: number;
  errors: number;
  warnings: number;
  r2: number;
  r4: number;
  raw: string;
};

async function captureBulkScanSummary(
  vaultRoot: string,
  repoRoot: string,
): Promise<BulkScanMetrics | null> {
  const scriptPath = path.join(
    repoRoot,
    "scripts/hermes-skill-examples/vault-lint/scripts/bulk_scan.py",
  );
  if (!fs.existsSync(scriptPath)) return null;
  const defaultVault = 'VAULT = "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE"';
  try {
    const { stdout } = await execFileAsync(
      "python3",
      [
        "-c",
        `import sys
vault = ${JSON.stringify(vaultRoot)}
src = open(${JSON.stringify(scriptPath)}, encoding="utf-8").read()
if ${JSON.stringify(defaultVault)} not in src:
    sys.exit(2)
src = src.replace(${JSON.stringify(defaultVault)}, "VAULT = " + repr(vault), 1)
exec(compile(src, ${JSON.stringify(scriptPath)}, "exec"), {"__name__": "__main__"})
`,
      ],
      { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 },
    );
    const raw = stdout.trim();
    const summary = raw.split("\n").find((l) => l.startsWith("Scanned="));
    const detail = raw.split("\n").find((l) => l.includes("R2(orphan)="));
    if (!summary || !detail) return null;
    const scanned = Number(summary.match(/Scanned=(\d+)/)?.[1] ?? NaN);
    const clean = Number(summary.match(/Clean=(\d+)/)?.[1] ?? NaN);
    const errors = Number(summary.match(/Errors=(\d+)/)?.[1] ?? NaN);
    const warnings = Number(summary.match(/Warnings=(\d+)/)?.[1] ?? NaN);
    const r2 = Number(detail.match(/R2\(orphan\)=(\d+)/)?.[1] ?? NaN);
    const r4 = Number(detail.match(/R4\(missing\)=(\d+)/)?.[1] ?? NaN);
    if ([scanned, clean, errors, warnings, r2, r4].some((n) => Number.isNaN(n))) return null;
    return { scanned, clean, errors, warnings, r2, r4, raw };
  } catch {
    return null;
  }
}

function formatPostRunSection(
  scan: BulkScanMetrics | null,
  preserved: string | null,
): string {
  if (scan) {
    const ac11 = scan.r2 < 5 ? "**satisfied**" : "not met — review remaining orphans";
    return `## Post-run Rule 2 (AC11)

**Equivalent scan** (\`bulk_scan.py\` per \`vault-lint.md\`, post-hub):

\`\`\`
${scan.raw}
\`\`\`

| Metric | Before (2026-05-21 Hermes) | After (${RUN_DATE} post-hub scan) |
|--------|---------------------------:|---------------------------------:|
| Rule 2 orphans (vault-wide) | **23** | **${scan.r2}** |
| AC11 target (< 5) | — | ${ac11} |

**Note:** **${scan.r4}** Rule 4 findings on contract manifests / governed notes (hub \`*-hub.md\` files use PAKE skip). Orphan count is **${scan.r2}**.

**Operator:** Re-run \`/vault-lint\` in \`#hermes\` to refresh \`_meta/reports/vault-lint-2026-05-21.md\` (or next dated report).

**Audit:** \`${SURFACE}\` lines in \`_meta/logs/agent-log.md\` (6 hubs + 2 README updates).`;
  }
  if (preserved) return preserved;
  return `## Post-run Rule 2 (AC11)

**Operator:** Re-run \`/vault-lint\` in \`#hermes\` after this batch. Target: vault-wide Rule 2 orphan WARNING count **< 5**.

**Pre-run vault-wide orphan count (2026-05-21 report):** 23

**After count:** _(bulk_scan unavailable — paste Hermes summary or re-run script with python3 + live \`CNS_VAULT_ROOT\`)_`;
}

function appendSectionIfMissing(body: string, heading: string, content: string): string {
  if (body.includes(heading)) return body;
  return `${body.trimEnd()}\n\n${heading}\n\n${content.trim()}\n`;
}

function loadParentReadmeBase(vaultRoot: string, repoRoot: string): string {
  const livePath = path.join(vaultRoot, PARENT_README_REL);
  if (fs.existsSync(livePath)) {
    const live = fs.readFileSync(livePath, "utf8");
    if (live.includes("purpose:")) return live;
  }
  const fixture = path.join(repoRoot, "Knowledge-Vault-ACTIVE", PARENT_README_REL);
  if (fs.existsSync(fixture)) return fs.readFileSync(fixture, "utf8");
  return `${HUB_CONTRACT}\n# 03-Resources\n`;
}

async function main(): Promise<void> {
  const vaultRoot = resolveVaultRoot();
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const reportPath = path.join(vaultRoot, "_meta/reports/vault-lint-2026-05-21.md");
  const reportText = fs.existsSync(reportPath) ? await readFile(reportPath, "utf8") : "";
  const orphansBefore = reportText ? parseOrphanPaths(reportText, RESOURCES_PREFIX) : [];

  const hubRows: string[] = [];
  const hubWikilinksInResearch: string[] = [];

  for (const cluster of CLUSTERS) {
    const notes = listNotesByPrefix(vaultRoot, cluster.pathPrefix);
    const hubAbs = path.join(vaultRoot, cluster.hubRel);
    const existed = fs.existsSync(hubAbs);
    const existingMarkdown = existed ? fs.readFileSync(hubAbs, "utf8") : "";
    const markdown = existed
      ? mergeTopicHubWithIndex(existingMarkdown, cluster, notes)
      : buildTopicHub(cluster, notes);

    await vaultCreateNoteFromMarkdown(vaultRoot, cluster.hubRel, markdown, { surface: SURFACE });

    hubRows.push(
      `| \`${cluster.hubRel}\` | ${existed ? "merge" : "create"} | ${notes.length} | ${notes.map((n) => `\`${path.basename(n.rel)}\``).join(", ") || "—"} |`,
    );
    hubWikilinksInResearch.push(
      wikilinkFor(cluster.hubRel, cluster.heading).replace(/^- /, "- "),
    );
  }

  const researchPath = path.join(vaultRoot, RESEARCH_README_REL);
  let researchBody = fs.readFileSync(researchPath, "utf8");

  const workflowLines: string[] = [
    wikilinkFor("03-Resources/Vault-Intelligence-Discovery-Workflow.md", "Vault Intelligence Discovery Workflow"),
  ];

  const geminiRel = "03-Resources/building-with-gemini-embedding-2-agentic-multimodal-rag-and-beyond.md";
  const geminiAbs = path.join(vaultRoot, geminiRel);
  let geminiNote = "linked (37-1 retained note)";
  if (fs.existsSync(geminiAbs)) {
    const gFm = matter(fs.readFileSync(geminiAbs, "utf8")).data as Record<string, unknown>;
    workflowLines.push(wikilinkFor(geminiRel, noteTitle(gFm, geminiRel)));
  } else {
    geminiNote = "skipped — removed in 37-1";
  }

  workflowLines.push(
    wikilinkFor(
      "03-Resources/hooks-epic-30-e2e-synthesis-test-cursor-dev-2026-05-16.md",
      "Hooks: Epic 30 E2E synthesis test (Cursor dev) (2026-05-16)",
    ),
  );
  workflowLines.push(
    wikilinkFor("03-Resources/Research/Gemini-Prompt-Engineering.md", "Gemini Prompt Engineering"),
  );
  workflowLines.push(
    wikilinkFor(
      "03-Resources/Research/Top Github Repositories which everyone should look.md",
      "Top Github Repositories which everyone should look",
    ),
  );

  researchBody = appendSectionIfMissing(
    researchBody,
    "## Topic hubs (Perplexity clusters)",
    hubWikilinksInResearch.join("\n"),
  );
  researchBody = appendSectionIfMissing(
    researchBody,
    "## Workflow & discovery",
    workflowLines.join("\n"),
  );

  await vaultCreateNoteFromMarkdown(vaultRoot, RESEARCH_README_REL, researchBody, {
    surface: SURFACE,
  });

  let parentBody = loadParentReadmeBase(vaultRoot, repoRoot);
  const notebooklmRel = "03-Resources/notebooklm-project-map.md";
  const nbAbs = path.join(vaultRoot, notebooklmRel);
  let notebooklmNote = "resolved";
  if (fs.existsSync(nbAbs)) {
    const nbFm = matter(fs.readFileSync(nbAbs, "utf8")).data as Record<string, unknown>;
    parentBody = appendSectionIfMissing(
      parentBody,
      "## Key resources",
      wikilinkFor(notebooklmRel, noteTitle(nbFm, notebooklmRel)),
    );
  } else {
    notebooklmNote = "notebooklm map not found on vault";
  }

  await vaultCreateNoteFromMarkdown(vaultRoot, PARENT_README_REL, parentBody, { surface: SURFACE });

  const spotCheck = [
    "03-Resources/perplexity-creative-technologist-consulting-rates-sydney-2026-creative-technologist-consulting-rates-sydney-2026-2026-04.md",
    "03-Resources/Vault-Intelligence-Discovery-Workflow.md",
    "03-Resources/notebooklm-project-map.md",
  ];

  const spotRows = spotCheck.map((p) => {
    const research = fs.readFileSync(researchPath, "utf8");
    const linked =
      research.includes(path.basename(p)) ||
      research.includes(p) ||
      CLUSTERS.some((c) => {
        const hub = fs.existsSync(path.join(vaultRoot, c.hubRel))
          ? fs.readFileSync(path.join(vaultRoot, c.hubRel), "utf8")
          : "";
        return hub.includes(path.basename(p));
      });
    return `| \`${p}\` | ${linked ? "incoming from hub/README" : "check manually"} |`;
  });

  const evidencePath = path.join(
    repoRoot,
    "_bmad-output/implementation-artifacts/epic-37-hub-evidence.md",
  );
  const existingEvidence = fs.existsSync(evidencePath)
    ? await readFile(evidencePath, "utf8")
    : "";
  const preservedPostRun = existingEvidence.includes("AC11 target")
    ? (existingEvidence.match(/## Post-run Rule 2[\s\S]*$/)?.[0] ?? null)
    : null;
  const scan = await captureBulkScanSummary(vaultRoot, repoRoot);
  const postRunSection = formatPostRunSection(scan, preservedPostRun);

  const evidence = `# Epic 37 — Topic hub indexes evidence (Story 37-2)

| Field | Value |
|-------|--------|
| **Story** | 37-2-03-resources-topic-hub-indexes |
| **Run date** | ${RUN_DATE} (UTC) |
| **Lint baseline** | \`_meta/reports/vault-lint-2026-05-21.md\` |
| **Surface** | \`${SURFACE}\` |

## Rule 2 baseline (03-Resources/ orphans)

**Before (Hermes 2026-05-21):** **${orphansBefore.length}** orphan paths under \`03-Resources/\` (vault-wide warnings: **23**).

**Sample before paths:**

${orphansBefore.slice(0, 8).map((p) => `- \`${p}\``).join("\n")}
${orphansBefore.length > 8 ? `- … (+${orphansBefore.length - 8} more)` : ""}

## Part A — Six topic hubs

| Hub path | Action | Wikilinks | Linked targets |
|----------|--------|-----------|----------------|
${hubRows.join("\n")}

## Part B — README merges

| Target | Updates |
|--------|---------|
| \`${RESEARCH_README_REL}\` | \`## Topic hubs (Perplexity clusters)\` (6 hub links); \`## Workflow & discovery\` (Vault-Intelligence, gemini ingest: **${geminiNote}**, hooks E2E, Research Gemini + Top Github) |
| \`${PARENT_README_REL}\` | \`## Key resources\` — NotebookLM map (**${notebooklmNote}**) |

## Spot-check (AC10)

| Path | Incoming edge |
|------|----------------|
${spotRows.join("\n")}

${postRunSection}
`;

  await writeFile(evidencePath, evidence, "utf8");

  console.log(`Hubs created/updated: ${CLUSTERS.length}`);
  console.log(`Research README merged: ${RESEARCH_README_REL}`);
  console.log(`Parent README merged: ${PARENT_README_REL}`);
  console.log(`Baseline 03-Resources orphans (report): ${orphansBefore.length}`);
  console.log(`Evidence: ${evidencePath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
