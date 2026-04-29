import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanStaleChainNotes,
  DEFAULT_BRIEF_TOPIC,
  loadBriefForRun,
  validatePersistedSynthesisPake,
} from "../../scripts/run-chain.js";
import {
  validatePakeSynthesisBody,
  type SynthesisRunResult,
} from "../../src/agents/synthesis-agent.js";
import { DEFAULT_OPERATOR_CONTEXT } from "../../src/agents/operator-context.js";
import type { ResearchBrief } from "../../src/agents/research-agent.js";
import type { VaultContextPacket } from "../../src/agents/vault-context-builder.js";
import { validPakeSynthesisBody } from "../fixtures/pake-synthesis-body.js";

const emptyPacket: VaultContextPacket = {
  notes: [],
  total_notes: 0,
  token_budget_used: 0,
  retrieval_timestamp: "2026-04-29T00:00:00.000Z",
};

const synthesisOk: SynthesisRunResult = {
  status: "ok",
  insight_note: {
    vault_path: "03-Resources/synth.md",
    pake_id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  },
  sources_used: ["03-Resources/source.md"],
  sources_read_failed: [],
  synthesis_timestamp: "2026-04-29T00:00:00.000Z",
};

async function makeVault(): Promise<string> {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-run-chain-harness-"));
  await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
  return vaultRoot;
}

async function writeNote(vaultRoot: string, relPath: string, body: string): Promise<void> {
  const absPath = path.join(vaultRoot, relPath);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, body, "utf8");
}

describe("run-chain live harness helpers", () => {
  it("exports and reuses the PAKE++ validator for a known-good body", () => {
    const failures = validatePakeSynthesisBody({
      body: validPakeSynthesisBody(DEFAULT_OPERATOR_CONTEXT),
      operator_context: DEFAULT_OPERATOR_CONTEXT,
      vault_context_packet: emptyPacket,
    });

    expect(failures).toEqual([]);
  });

  it("validates the persisted synthesis note body and records sanitized failure summaries", async () => {
    const vaultRoot = await makeVault();
    await writeNote(
      vaultRoot,
      "03-Resources/synth.md",
      [
        "---",
        "pake_id: bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
        "pake_type: InsightNote",
        'title: "Synthesis: Bad (2026-04-29)"',
        "---",
        "",
        "## What We Know",
        "too short",
      ].join("\n"),
    );

    const evidence = await validatePersistedSynthesisPake({
      vaultRoot,
      synthesis: synthesisOk,
      operatorContext: DEFAULT_OPERATOR_CONTEXT,
      vaultContextPacket: emptyPacket,
    });

    expect(evidence.status).toBe("fail");
    expect(evidence.insight_note_path).toBe("03-Resources/synth.md");
    expect(evidence.failures.length).toBeGreaterThan(0);
    expect(evidence.failures.join(" ")).not.toContain("too short");
  });

  it("passes persisted synthesis validation for a known-good PAKE++ note", async () => {
    const vaultRoot = await makeVault();
    await writeNote(
      vaultRoot,
      "03-Resources/synth.md",
      [
        "---",
        "pake_id: bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
        "pake_type: InsightNote",
        'title: "Synthesis: AI agents (2026-04-29)"',
        "---",
        "",
        validPakeSynthesisBody(DEFAULT_OPERATOR_CONTEXT),
      ].join("\n"),
    );

    const evidence = await validatePersistedSynthesisPake({
      vaultRoot,
      synthesis: synthesisOk,
      operatorContext: DEFAULT_OPERATOR_CONTEXT,
      vaultContextPacket: emptyPacket,
    });

    expect(evidence).toEqual({
      status: "pass",
      insight_note_path: "03-Resources/synth.md",
      failures: [],
    });
  });

  it("selects the runtime brief topic from CNS_BRIEF_TOPIC with the freelance fallback", async () => {
    const fallback = await loadBriefForRun(
      { briefFile: undefined, topic: undefined, queries: [], depth: undefined },
      {},
    );
    const envSelected = await loadBriefForRun(
      { briefFile: undefined, topic: undefined, queries: [], depth: undefined },
      { CNS_BRIEF_TOPIC: "runtime-selected topic" },
    );

    expect(fallback.topic).toBe(DEFAULT_BRIEF_TOPIC);
    expect(envSelected.topic).toBe("runtime-selected topic");
    expect(envSelected.queries.some((query) => query.includes("reddit.com"))).toBe(true);
  });

  it("strictly reads a brief file and rejects unknown keys", async () => {
    const vaultRoot = await makeVault();
    const briefPath = path.join(vaultRoot, "brief.json");
    await writeFile(
      briefPath,
      JSON.stringify({
        topic: "file topic",
        queries: ["query"],
        depth: "deep",
        surprise: true,
      }),
      "utf8",
    );

    await expect(
      loadBriefForRun({
        briefFile: briefPath,
        topic: undefined,
        queries: [],
        depth: undefined,
      }),
    ).rejects.toThrow("Invalid --brief-file");
  });

  it("cleans stale AI-generated chain notes for the selected topic before a run", async () => {
    const vaultRoot = await makeVault();
    const brief: ResearchBrief = {
      topic: "cleanable topic",
      queries: ["query"],
      depth: "deep",
    };
    await writeNote(
      vaultRoot,
      "03-Resources/stale.md",
      [
        "---",
        "pake_id: aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
        "pake_type: SourceNote",
        'title: "Source"',
        'created: "2026-04-29"',
        'modified: "2026-04-29"',
        "status: draft",
        "confidence_score: 0.5",
        "verification_status: pending",
        "creation_method: ai",
        "tags:",
        '  - "cleanable topic"',
        '  - "research-sweep"',
        "---",
        "",
        "body",
      ].join("\n"),
    );
    await writeNote(
      vaultRoot,
      "03-Resources/keeper.md",
      [
        "---",
        "pake_id: cccccccc-cccc-4ccc-cccc-cccccccccccc",
        "pake_type: SourceNote",
        'title: "Keeper"',
        "creation_method: human",
        "tags:",
        '  - "cleanable topic"',
        '  - "research-sweep"',
        "---",
        "",
        "body",
      ].join("\n"),
    );
    await writeNote(
      vaultRoot,
      "03-Resources/title-keeper.md",
      [
        "---",
        "pake_id: dddddddd-dddd-4ddd-dddd-dddddddddddd",
        "pake_type: InsightNote",
        'title: "Synthesis: cleanable topic (2026-04-29)"',
        "creation_method: human",
        "---",
        "",
        "body",
      ].join("\n"),
    );

    const cleanup = await cleanStaleChainNotes(vaultRoot, brief, {
      dateYmd: "2026-04-29",
    });

    expect(cleanup.removed).toEqual(["03-Resources/stale.md"]);
    await expect(readFile(path.join(vaultRoot, "03-Resources/stale.md"), "utf8")).rejects.toThrow();
    await expect(readFile(path.join(vaultRoot, "03-Resources/keeper.md"), "utf8")).resolves.toContain("Keeper");
    await expect(readFile(path.join(vaultRoot, "03-Resources/title-keeper.md"), "utf8")).resolves.toContain("Synthesis");
  });
});
