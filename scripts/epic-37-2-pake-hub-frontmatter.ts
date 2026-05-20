/**
 * Story 37-2 follow-up: add PAKE Standard fields to six Research topic hubs
 * (contract manifest + PAKE merge via vault_update_frontmatter).
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { vaultUpdateFrontmatter } from "../src/tools/vault-update-frontmatter.js";

const SURFACE = "story-37-2";
const RUN_DATE = "2026-05-21";

type HubPatch = {
  path: string;
  title: string;
  tags: string[];
};

const HUBS: HubPatch[] = [
  {
    path: "03-Resources/Research/ai-agent-orchestration-hub.md",
    title: "AI Agent Orchestration Hub",
    tags: ["research", "hub", "ai-agent-orchestration"],
  },
  {
    path: "03-Resources/Research/consulting-rates-hub.md",
    title: "Consulting Rates Hub",
    tags: ["research", "hub", "consulting-rates"],
  },
  {
    path: "03-Resources/Research/day-rate-hub.md",
    title: "Day Rate Hub",
    tags: ["research", "hub", "day-rate"],
  },
  {
    path: "03-Resources/Research/obsidian-pkm-hub.md",
    title: "Obsidian PKM Hub",
    tags: ["research", "hub", "obsidian-pkm"],
  },
  {
    path: "03-Resources/Research/remote-roles-hub.md",
    title: "Remote Roles Hub",
    tags: ["research", "hub", "remote-roles"],
  },
  {
    path: "03-Resources/Research/retainer-pricing-hub.md",
    title: "Retainer Pricing Hub",
    tags: ["research", "hub", "retainer-pricing"],
  },
];

function resolveVaultRoot(): string {
  const env = process.env.CNS_VAULT_ROOT?.trim();
  if (env) return path.resolve(env);
  const fallback = "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE";
  if (fs.existsSync(fallback)) return fallback;
  throw new Error("CNS_VAULT_ROOT is not set");
}

async function main(): Promise<void> {
  const vaultRoot = resolveVaultRoot();
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const rows: string[] = [];

  for (const hub of HUBS) {
    const abs = path.join(vaultRoot, hub.path);
    if (!fs.existsSync(abs)) {
      throw new Error(`Hub missing: ${hub.path}`);
    }
    const pakeId = randomUUID();
    const ts = new Date().toISOString();
    await vaultUpdateFrontmatter(
      vaultRoot,
      hub.path,
      {
        pake_id: pakeId,
        pake_type: "WorkflowNote",
        title: hub.title,
        created: RUN_DATE,
        modified: RUN_DATE,
        status: "draft",
        confidence_score: 0.7,
        verification_status: "verified",
        creation_method: "human",
        tags: hub.tags,
      },
      { surface: SURFACE },
    );
    rows.push(`| \`${hub.path}\` | ${pakeId} | ${ts} |`);
    console.log(`PAKE frontmatter: ${hub.path}`);
  }

  const evidencePath = path.join(
    repoRoot,
    "_bmad-output/implementation-artifacts/epic-37-hub-pake-evidence.md",
  );
  const evidence = `# Epic 37 — Topic hub PAKE frontmatter (Story 37-2 follow-up)

| Field | Value |
|-------|--------|
| **Run date** | ${RUN_DATE} (UTC) |
| **Vault root** | \`${vaultRoot}\` |
| **Surface** | \`${SURFACE}\` |
| **Mutator** | \`vault_update_frontmatter\` × 6 |

## Patches

| Path | pake_id | UTC |
|------|---------|-----|
${rows.join("\n")}

**Operator:** Run \`/vault-lint\` in \`#hermes\`; expect **ERRORS = 0** (six prior Rule 4 hub flags cleared).
`;

  await writeFile(evidencePath, evidence, "utf8");
  console.log(`Evidence: ${evidencePath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
