import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateNoteForEmbeddingSecretGate,
  INDEXING_SECRET_EXCLUSION_REASON,
} from "../../src/brain/indexing-secret-gate.js";
import { discoverMarkdownCandidates } from "../../src/brain/build-index.js";
import { parseBrainCorpusAllowlistUnknown } from "../../src/brain/corpus-allowlist.js";

async function writeAllowlist(
  vaultRoot: string,
  body: { subtrees: string[]; inbox?: { enabled: boolean } },
): Promise<void> {
  const dir = path.join(vaultRoot, "_meta", "schemas");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "brain-corpus-allowlist.json"),
    JSON.stringify({ schema_version: 1, inbox: { enabled: false }, ...body }),
    "utf8",
  );
}

describe("Story 79-2 secret-gate spot checks (NFR-GOV-2)", () => {
  it("excludes AWS-shaped secrets from embedding eligibility", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-2-sec-"));
    const secret = "AKIA0123456789ABCDEF";
    const r = await evaluateNoteForEmbeddingSecretGate(vaultRoot, `key: ${secret}`);
    expect(r.eligible).toBe(false);
    if (r.eligible) return;
    expect(r.reasonCode).toBe(INDEXING_SECRET_EXCLUSION_REASON);
  });

  it("excludes _meta/logs even when _meta subtree is allowlisted with opt-in", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-2-logs-"));
    const dir = path.join(vaultRoot, "_meta", "schemas");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "brain-corpus-allowlist.json"),
      JSON.stringify({
        schema_version: 1,
        subtrees: ["_meta/schemas"],
        inbox: { enabled: false },
        protected_corpora_opt_in: {
          enabled: true,
          rationale: "fixture spot-check",
          acknowledged_risks: true,
        },
      }),
      "utf8",
    );
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
    await writeFile(path.join(vaultRoot, "_meta", "logs", "audit.md"), "# audit\n", "utf8");
    await writeFile(path.join(vaultRoot, "_meta", "schemas", "ok.md"), "# ok\n", "utf8");
    const al = parseBrainCorpusAllowlistUnknown(
      JSON.parse(await readFile(path.join(dir, "brain-corpus-allowlist.json"), "utf8")),
    );
    expect(al.ok).toBe(true);
    if (!al.ok) return;
    const { candidates } = await discoverMarkdownCandidates(vaultRoot, al.value);
    expect(candidates).toEqual(["_meta/schemas/ok.md"]);
    expect(candidates.some((p) => p.includes("_meta/logs"))).toBe(false);
  });

  it("excludes AI-Context/AGENTS.md path when not in protected opt-in allowlist", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-2-agents-"));
    await writeAllowlist(vaultRoot, { subtrees: ["AI-Context"] });
    await mkdir(path.join(vaultRoot, "AI-Context"), { recursive: true });
    await writeFile(path.join(vaultRoot, "AI-Context", "AGENTS.md"), "# agents\n", "utf8");
    const al = parseBrainCorpusAllowlistUnknown(
      JSON.parse(await readFile(path.join(vaultRoot, "_meta/schemas/brain-corpus-allowlist.json"), "utf8")),
    );
    expect(al).toMatchObject({
      ok: false,
      issues: [expect.objectContaining({ code: "POLICY_PROTECTED_PATH" })],
    });
  });
});
