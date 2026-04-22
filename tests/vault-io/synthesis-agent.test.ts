import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  runSynthesisAgent,
  synthesisAdapterOutputSchema,
  createDefaultSynthesisAdapter,
  createDefaultVaultReadAdapter,
  type SynthesisAdapter,
  type SynthesisAdapterOutput,
  type SynthesisRunResult,
  type VaultReadAdapter,
} from "../../src/agents/synthesis-agent.js";
import { DEFAULT_OPERATOR_CONTEXT } from "../../src/agents/operator-context.js";
import type { VaultContextPacket } from "../../src/agents/vault-context-builder.js";
import type { ResearchSweepResult } from "../../src/agents/research-agent.js";
import { CnsError } from "../../src/errors.js";

async function makeVault(): Promise<string> {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-synth-"));
  await mkdir(path.join(vaultRoot, "00-Inbox"), { recursive: true });
  await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
  await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
  return vaultRoot;
}

function validSweep(overrides: Partial<ResearchSweepResult> = {}): ResearchSweepResult {
  return {
    brief_topic: "AI agents",
    notes_created: [
      {
        vault_path: "03-Resources/note-a.md",
        pake_id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
        source_uri: "https://example.com/a",
        source: "firecrawl",
      },
      {
        vault_path: "03-Resources/note-b.md",
        pake_id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
        source_uri: "https://example.com/b",
        source: "apify",
      },
      {
        vault_path: "03-Resources/note-c.md",
        pake_id: "cccccccc-cccc-4ccc-bccc-cccccccccccc",
        source_uri: "https://example.com/c",
        source: "firecrawl",
      },
    ],
    notes_skipped: [],
    perplexity_skipped: true,
    perplexity_answers_filed: 0,
    sweep_timestamp: "2026-04-18T22:00:00.000Z",
    ...overrides,
  };
}

function emptyPacket(): VaultContextPacket {
  return {
    notes: [],
    total_notes: 0,
    token_budget_used: 0,
    retrieval_timestamp: "2026-04-18T22:00:00.000Z",
  };
}

function makeVaultRead(behavior: {
  readNote?: (vaultPath: string) => ReturnType<VaultReadAdapter["readNote"]>;
}): VaultReadAdapter {
  return {
    readNote:
      behavior.readNote ??
      (async (vaultPath: string) => ({
        body: `Body of ${vaultPath}`,
        frontmatter: { pake_id: `fm-${vaultPath}` },
      })),
  };
}

function repeatSentence(sentence: string, count: number): string {
  return Array.from({ length: count }, () => sentence).join(" ");
}

const NO_VAULT_CONTEXT_WARNING =
  "> [!warning] No vault context found — this synthesis is grounded in external research only.";

function validPakeBody(): string {
  const whatWeKnow = [
    "The source set points toward agent orchestration as the practical layer where research becomes action for [[note-a]], [[note-b]], [[note-c]], and [[real-note]].",
    repeatSentence(
      "The important pattern is that operators do not need a generic summary; they need a connected readout that explains what changed, why it matters, where confidence is uneven, and which vault notes should shape the next move.",
      10,
    ),
  ].join(" ");
  const leverage = [
    "Chris Taylor is operating from Sydney, Australia as a Creative Technologist, which makes the research useful only if it can be turned into a visible asset and a decision in the same session.",
    "Escape Job and Build Agency should both be named because the same intelligence stream can serve employment escape velocity and agency proof at once.",
    repeatSentence(
      "Escape Job benefits when the synthesis clarifies the fastest path to runway, while Build Agency benefits when the same analysis becomes public evidence of taste, systems thinking, and execution quality.",
      8,
    ),
  ].join(" ");

  return [
    "## What We Know",
    whatWeKnow,
    "",
    "> [!note] Signal vs Noise",
    "> Strong sources agree on orchestration, but they differ on how much autonomy is durable.",
    "",
    "| Claim | Agree | Disagree | Implication |",
    "| --- | --- | --- | --- |",
    "| Agents need tools | Multiple sources show tool use | Some sources frame chat as enough | Prioritize workflows, not summaries |",
    "| Planning matters | Architectures emphasize decomposition | Simple tasks may not need it | Match complexity to task size |",
    "| Evaluation is hard | Reliability is repeatedly flagged | Benchmarks stay shallow | Keep decisions reversible |",
    "",
    "## The Gap Map",
    "",
    "| Known | Unknown | Why it matters |",
    "| --- | --- | --- |",
    "| Agents can call tools | Which tools matter first | Tool choice determines operator leverage |",
    "| Research can be filed | Which notes compound | Vault links shape reuse |",
    "| Prompt rules guide output | Which rules fail live | Validation protects quality |",
    "| Decisions can be listed | Which decision blocks action | Open questions should be practical |",
    "",
    "> [!warning] Blind Spots",
    "> The sources still understate cost, latency, failure recovery, and the amount of operator judgment required.",
    "",
    "## Where Chris Has Leverage",
    leverage,
    "",
    "> [!tip] Highest-Leverage Move",
    "> Turn the synthesis into one time-boxed decision memo connected to [[note-a]] and ship it before starting another research sweep.",
    "",
    "## Connected Vault Notes",
    "",
    "| Note | Why relevant | Status |",
    "| --- | --- | --- |",
    "| [[note-a]] | Source evidence | active |",
    "| [[note-b]] | Architecture signal | active |",
    "| [[note-c]] | Comparison point | active |",
    "| [[real-note]] | Fixture-backed note | active |",
    "| [[Operator-Profile]] | Operator constraints | active |",
    "",
    "## Decisions Needed",
    "",
    "### Decision: pick architecture",
    "- **Option A:** ReAct loop",
    "- **Option B:** Planner-executor",
    "- **Downstream consequence:** The choice changes latency, observability, and failure handling.",
    "",
    "### Decision: pick cadence",
    "- **Option A:** Weekly synthesis",
    "- **Option B:** Per-brief synthesis",
    "- **Downstream consequence:** The choice changes workload and compounding cadence.",
    "",
    "### Decision: pick distribution",
    "- **Option A:** Public memo",
    "- **Option B:** Private vault note",
    "- **Downstream consequence:** The choice changes proof creation and feedback speed.",
    "",
    "### Decision: pick validation gate",
    "- **Option A:** Strict PAKE++ validation",
    "- **Option B:** Prompt-only guidance",
    "- **Downstream consequence:** The choice changes rejection rate and output consistency.",
    "",
    "## Open Questions",
    "1. Which source should drive the first operator decision?",
    "2. Which vault note should become the canonical reference?",
    "3. Which next action is blocked by missing evidence?",
    "",
    "## Version / Run Metadata",
    "",
    "| Date | Brief topic | Sources ingested | Queries run |",
    "| --- | --- | --- | --- |",
    "| 2026-04-22 | AI agents | 3 | 2 |",
    "",
    "> [!abstract]",
    "> The synthesis shows that agent orchestration matters most when it becomes an operator decision, not a generic summary.",
    "> The highest-leverage action is to turn the research into one connected decision memo before running another sweep.",
    NO_VAULT_CONTEXT_WARNING,
  ].join("\n");
}

function makeSynthesis(
  behavior:
    | {
        synthesize?: (
          input: Parameters<SynthesisAdapter["synthesize"]>[0],
        ) => Promise<SynthesisAdapterOutput> | Promise<unknown>;
      }
    | SynthesisAdapterOutput
    | undefined,
): SynthesisAdapter {
  if (
    behavior &&
    typeof behavior === "object" &&
    "summary" in behavior &&
    "body" in behavior
  ) {
    const canned = behavior as SynthesisAdapterOutput;
    return { synthesize: async () => canned };
  }
  const b = (behavior ?? {}) as {
    synthesize?: (
      input: Parameters<SynthesisAdapter["synthesize"]>[0],
    ) => Promise<SynthesisAdapterOutput> | Promise<unknown>;
  };
  return {
    synthesize: (b.synthesize ??
      (async () => ({
        body: validPakeBody(),
        summary: "a concise summary",
      }))) as SynthesisAdapter["synthesize"],
  };
}

async function readAuditLog(vaultRoot: string): Promise<string[]> {
  const logPath = path.join(vaultRoot, "_meta", "logs", "agent-log.md");
  try {
    const raw = await readFile(logPath, "utf8");
    return raw.split("\n").filter((l) => l.length > 0);
  } catch {
    return [];
  }
}

// ── AC: input-validation ────────────────────────────────────────────────────

describe("AC: input-validation — schema guard on sweep input", () => {
  it("throws SCHEMA_INVALID on malformed sweep input", async () => {
    const vaultRoot = await makeVault();
    await expect(
      runSynthesisAgent(vaultRoot, { bogus: true }, {
        adapters: { vaultRead: makeVaultRead({}), synthesis: makeSynthesis({}) },
      }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("does not call vault read or synthesis adapters on invalid input", async () => {
    const vaultRoot = await makeVault();
    let readCalled = false;
    let synthCalled = false;
    await expect(
      runSynthesisAgent(
        vaultRoot,
        { brief_topic: "x" },
        {
          adapters: {
            vaultRead: makeVaultRead({
              readNote: async () => {
                readCalled = true;
                return { body: "", frontmatter: {} };
              },
            }),
            synthesis: makeSynthesis({
              synthesize: async () => {
                synthCalled = true;
                return { body: "# x", summary: "s" };
              },
            }),
          },
        },
      ),
    ).rejects.toThrow();
    expect(readCalled).toBe(false);
    expect(synthCalled).toBe(false);
  });
});

// ── AC: empty-sweep ─────────────────────────────────────────────────────────

describe("AC: empty-sweep — short-circuit when no notes_created", () => {
  it("returns skipped with reason no-source-notes", async () => {
    const vaultRoot = await makeVault();
    let synthCalled = false;
    const result = await runSynthesisAgent(
      vaultRoot,
      validSweep({ notes_created: [] }),
      {
        adapters: {
          vaultRead: makeVaultRead({}),
          synthesis: makeSynthesis({
            synthesize: async () => {
              synthCalled = true;
              return { body: "# x", summary: "s" };
            },
          }),
        },
      },
    );
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.reason).toBe("no-source-notes");
    }
    expect(synthCalled).toBe(false);
  });

  it("emits synthesis_skipped audit record with reason no-source-notes", async () => {
    const vaultRoot = await makeVault();
    await runSynthesisAgent(vaultRoot, validSweep({ notes_created: [] }), {
      adapters: { vaultRead: makeVaultRead({}), synthesis: makeSynthesis({}) },
    });
    const lines = await readAuditLog(vaultRoot);
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("synthesis_skipped");
    expect(lines[0]).toContain("no-insight-note");
    expect(lines[0]).toContain("no-source-notes");
  });
});

// ── AC: vault-reads ─────────────────────────────────────────────────────────

describe("AC: vault-reads — per-note read errors do not abort", () => {
  it("collects partial failures and continues with remaining notes", async () => {
    const vaultRoot = await makeVault();
    const result = await runSynthesisAgent(vaultRoot, validSweep(), {
      adapters: {
        vaultRead: makeVaultRead({
          readNote: async (p) => {
            if (p === "03-Resources/note-b.md") {
              throw new CnsError("NOT_FOUND", "missing");
            }
            return {
              body: `body of ${p}`,
              frontmatter: { pake_id: `fm-${p}` },
            };
          },
        }),
        synthesis: makeSynthesis({
          body: validPakeBody(),
          summary: "partial summary",
        }),
      },
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.sources_used).toEqual([
        "03-Resources/note-a.md",
        "03-Resources/note-c.md",
      ]);
      expect(result.sources_read_failed).toEqual(["03-Resources/note-b.md"]);
    }
  });

  it("skips with no-readable-sources when all reads fail", async () => {
    const vaultRoot = await makeVault();
    let synthCalled = false;
    const result = await runSynthesisAgent(vaultRoot, validSweep(), {
      adapters: {
        vaultRead: makeVaultRead({
          readNote: async () => {
            throw new CnsError("NOT_FOUND", "missing");
          },
        }),
        synthesis: makeSynthesis({
          synthesize: async () => {
            synthCalled = true;
            return { body: "# x", summary: "s" };
          },
        }),
      },
    });
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.reason).toBe("no-readable-sources");
      expect(result.sources_read_failed).toEqual([
        "03-Resources/note-a.md",
        "03-Resources/note-b.md",
        "03-Resources/note-c.md",
      ]);
    }
    expect(synthCalled).toBe(false);
  });
});

// ── AC: synthesis ───────────────────────────────────────────────────────────

describe("AC: synthesis — adapter invocation and output validation", () => {
  it("passes topic, queries, source_notes, operator_context, vault_context_packet to the synthesis adapter", async () => {
    const vaultRoot = await makeVault();
    let captured: Parameters<SynthesisAdapter["synthesize"]>[0] | null = null;
    const packet: VaultContextPacket = {
      notes: [
        {
          vault_path: "03-Resources/Operator-Profile.md",
          title: "Operator Profile",
          excerpt: "Chris based in Sydney.",
          retrieval_reason: "operator-profile",
          tags: ["operator"],
        },
      ],
      total_notes: 1,
      token_budget_used: 0,
      retrieval_timestamp: "2026-04-18T22:00:00.000Z",
    };
    await runSynthesisAgent(vaultRoot, validSweep(), {
      queries: ["q1", "q2"],
      operator_context: DEFAULT_OPERATOR_CONTEXT,
      vault_context_packet: packet,
      adapters: {
        vaultRead: makeVaultRead({}),
        synthesis: {
          synthesize: async (input) => {
            captured = input;
            return { body: validPakeBody(), summary: "s" };
          },
        },
      },
    });
    expect(captured).not.toBeNull();
    expect(captured!.topic).toBe("AI agents");
    expect(captured!.queries).toEqual(["q1", "q2"]);
    expect(captured!.source_notes.length).toBe(3);
    expect(captured!.source_notes[0].vault_path).toBe("03-Resources/note-a.md");
    expect(captured!.source_notes[0].body).toContain("Body of 03-Resources/note-a.md");
    expect(captured!.source_notes[2].vault_path).toBe("03-Resources/note-c.md");
    expect(captured!.operator_context.name).toBe("Chris Taylor");
    expect(captured!.operator_context.tracks.map((t) => t.name)).toEqual([
      "Escape Job",
      "Build Agency",
    ]);
    expect(captured!.vault_context_packet.total_notes).toBe(1);
    expect(captured!.vault_context_packet.notes[0].retrieval_reason).toBe(
      "operator-profile",
    );
  });

  it("defaults operator_context and vault_context_packet when not supplied", async () => {
    const vaultRoot = await makeVault();
    let captured: Parameters<SynthesisAdapter["synthesize"]>[0] | null = null;
    await runSynthesisAgent(vaultRoot, validSweep(), {
      adapters: {
        vaultRead: makeVaultRead({}),
        synthesis: {
          synthesize: async (input) => {
            captured = input;
            return { body: validPakeBody(), summary: "s" };
          },
        },
      },
    });
    expect(captured).not.toBeNull();
    expect(captured!.operator_context.name).toBe("Chris Taylor");
    expect(captured!.vault_context_packet.total_notes).toBe(0);
    expect(captured!.vault_context_packet.notes).toEqual([]);
  });

  it("throws SCHEMA_INVALID when adapter returns malformed output", async () => {
    const vaultRoot = await makeVault();
    await expect(
      runSynthesisAgent(vaultRoot, validSweep(), {
        adapters: {
          vaultRead: makeVaultRead({}),
          synthesis: {
            synthesize: async () =>
              ({
                body: "# only body, missing summary",
              }) as unknown as SynthesisAdapterOutput,
          },
        },
      }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("throws SCHEMA_INVALID when adapter returns empty summary", async () => {
    const vaultRoot = await makeVault();
    await expect(
      runSynthesisAgent(vaultRoot, validSweep(), {
        adapters: {
          vaultRead: makeVaultRead({}),
          synthesis: {
            synthesize: async () => ({
              body: "# body",
              summary: "",
            }),
          },
        },
      }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("throws SCHEMA_INVALID when adapter returns empty body", async () => {
    const vaultRoot = await makeVault();
    await expect(
      runSynthesisAgent(vaultRoot, validSweep(), {
        adapters: {
          vaultRead: makeVaultRead({}),
          synthesis: {
            synthesize: async () => ({ body: "", summary: "s" }),
          },
        },
      }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("throws SCHEMA_INVALID when adapter returns a non-empty but non-PAKE body", async () => {
    const vaultRoot = await makeVault();
    await expect(
      runSynthesisAgent(vaultRoot, validSweep(), {
        adapters: {
          vaultRead: makeVaultRead({}),
          synthesis: {
            synthesize: async () => ({ body: "# b", summary: "s" }),
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "SCHEMA_INVALID",
      message: expect.stringContaining("PAKE++ body"),
    });
  });

  it("throws SCHEMA_INVALID when operator profile is absent and body omits the no-vault warning", async () => {
    const vaultRoot = await makeVault();
    await expect(
      runSynthesisAgent(vaultRoot, validSweep(), {
        vault_context_packet: emptyPacket(),
        adapters: {
          vaultRead: makeVaultRead({}),
          synthesis: {
            synthesize: async () => ({
              body: validPakeBody().replace(NO_VAULT_CONTEXT_WARNING, ""),
              summary: "s",
            }),
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "SCHEMA_INVALID",
      message: expect.stringContaining("no-vault-context warning"),
    });
  });

  it("throws SCHEMA_INVALID when abstract is not 2-3 sentences", async () => {
    const vaultRoot = await makeVault();
    const body = validPakeBody().replace(
      "\n> The highest-leverage action is to turn the research into one connected decision memo before running another sweep.",
      "",
    );
    await expect(
      runSynthesisAgent(vaultRoot, validSweep(), {
        adapters: {
          vaultRead: makeVaultRead({}),
          synthesis: {
            synthesize: async () => ({ body, summary: "s" }),
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "SCHEMA_INVALID",
      message: expect.stringContaining("Abstract must contain 2-3 sentences"),
    });
  });

  it("throws SCHEMA_INVALID when Highest-Leverage Move is not specific, timeable, and vault-connected", async () => {
    const vaultRoot = await makeVault();
    const body = validPakeBody().replace(
      "> Turn the synthesis into one time-boxed decision memo connected to [[note-a]] and ship it before starting another research sweep.",
      "> Move faster.",
    );
    await expect(
      runSynthesisAgent(vaultRoot, validSweep(), {
        adapters: {
          vaultRead: makeVaultRead({}),
          synthesis: {
            synthesize: async () => ({ body, summary: "s" }),
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "SCHEMA_INVALID",
      message: expect.stringContaining("Highest-Leverage Move"),
    });
  });

  it("validates output schema with synthesisAdapterOutputSchema", () => {
    expect(() =>
      synthesisAdapterOutputSchema.parse({ body: "# ok", summary: "ok" }),
    ).not.toThrow();
    expect(() =>
      synthesisAdapterOutputSchema.parse({ body: "# ok", summary: "" }),
    ).toThrow();
    expect(() =>
      synthesisAdapterOutputSchema.parse({ body: "", summary: "ok" }),
    ).toThrow();
  });
});

// ── AC: insight-note ────────────────────────────────────────────────────────

describe("AC: insight-note — ingest via pipeline as InsightNote", () => {
  it("writes an InsightNote whose body is the adapter-authored markdown", async () => {
    const vaultRoot = await makeVault();
    const adapterBody = validPakeBody();
    const result = await runSynthesisAgent(vaultRoot, validSweep(), {
      adapters: {
        vaultRead: makeVaultRead({}),
        synthesis: makeSynthesis({
          body: adapterBody,
          summary: "everything converges on agent orchestration",
        }),
      },
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");

    const abs = path.join(vaultRoot, result.insight_note.vault_path);
    const content = await readFile(abs, "utf8");

    expect(content).toContain("pake_type: InsightNote");
    expect(content).toContain("> [!abstract]");
    expect(content).toContain("## What We Know");
    expect(content).toContain("[[note-a]]");
    expect(content).toMatch(/tags:[\s\S]*synthesis/);
    expect(content).toMatch(/tags:[\s\S]*AI agents/);
    expect(content).toContain("ai_summary:");
    expect(content).toContain("everything converges on agent orchestration");
  });
});

// ── AC: result ──────────────────────────────────────────────────────────────

describe("AC: result — typed SynthesisRunResult shape", () => {
  it("returns ok shape with insight_note + sources_used on success", async () => {
    const vaultRoot = await makeVault();
    const result: SynthesisRunResult = await runSynthesisAgent(vaultRoot, validSweep(), {
      adapters: {
        vaultRead: makeVaultRead({}),
        synthesis: makeSynthesis({
          body: validPakeBody(),
          summary: "s",
        }),
      },
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(typeof result.insight_note.vault_path).toBe("string");
    expect(typeof result.insight_note.pake_id).toBe("string");
    expect(result.sources_used.length).toBe(3);
    expect(result.sources_read_failed.length).toBe(0);
    expect(typeof result.synthesis_timestamp).toBe("string");
    expect(new Date(result.synthesis_timestamp).toString()).not.toBe("Invalid Date");
  });
});

// ── AC: audit ───────────────────────────────────────────────────────────────

describe("AC: audit — sweep-level record emitted", () => {
  it("emits synthesis_run record on success with pake_id in payload", async () => {
    const vaultRoot = await makeVault();
    const result = await runSynthesisAgent(vaultRoot, validSweep(), {
      adapters: {
        vaultRead: makeVaultRead({}),
        synthesis: makeSynthesis({
          body: validPakeBody(),
          summary: "s",
        }),
      },
    });
    if (result.status !== "ok") throw new Error("expected ok");
    const lines = await readAuditLog(vaultRoot);
    const synthesisRunLines = lines.filter((l) => l.includes("| synthesis_run |"));
    expect(synthesisRunLines.length).toBe(1);
    expect(synthesisRunLines[0]).toContain(result.insight_note.vault_path);
    expect(synthesisRunLines[0]).toContain(result.insight_note.pake_id);
  });

  it("emits synthesis_skipped record with reason when no readable sources", async () => {
    const vaultRoot = await makeVault();
    await runSynthesisAgent(vaultRoot, validSweep(), {
      adapters: {
        vaultRead: makeVaultRead({
          readNote: async () => {
            throw new CnsError("NOT_FOUND", "x");
          },
        }),
        synthesis: makeSynthesis({}),
      },
    });
    const lines = await readAuditLog(vaultRoot);
    const skipped = lines.filter((l) => l.includes("| synthesis_skipped |"));
    expect(skipped.length).toBe(1);
    expect(skipped[0]).toContain("no-readable-sources");
  });

  it("emits exactly one sweep-level record plus one pipeline ingest record on success", async () => {
    const vaultRoot = await makeVault();
    await runSynthesisAgent(vaultRoot, validSweep(), {
      adapters: {
        vaultRead: makeVaultRead({}),
        synthesis: makeSynthesis({
          body: validPakeBody(),
          summary: "s",
        }),
      },
    });
    const lines = await readAuditLog(vaultRoot);
    const runs = lines.filter((l) => l.includes("| synthesis_run |"));
    const ingests = lines.filter((l) => l.includes("| ingest |"));
    expect(runs.length).toBe(1);
    expect(ingests.length).toBe(1);
  });
});

// ── AC: tests — default adapters + fixture integration ─────────────────────

describe("AC: tests — default adapters behavior", () => {
  it("default synthesis adapter throws UNSUPPORTED when not configured", async () => {
    const adapter = createDefaultSynthesisAdapter();
    await expect(
      adapter.synthesize({
        topic: "t",
        queries: [],
        source_notes: [],
        operator_context: DEFAULT_OPERATOR_CONTEXT,
        vault_context_packet: emptyPacket(),
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });

  it("default vault read adapter reads a real note and parses frontmatter", async () => {
    const vaultRoot = await makeVault();
    const { writeFile: wf } = await import("node:fs/promises");
    const rel = "03-Resources/example.md";
    const abs = path.join(vaultRoot, rel);
    await wf(
      abs,
      "---\npake_id: test-id\ntitle: Example\n---\n\nbody content\n",
      "utf8",
    );
    const adapter = createDefaultVaultReadAdapter(vaultRoot);
    const { body, frontmatter } = await adapter.readNote(rel);
    expect(body.trim()).toBe("body content");
    expect(frontmatter.pake_id).toBe("test-id");
    expect(frontmatter.title).toBe("Example");
  });

  it("uses default vault read adapter when opts.adapters.vaultRead is omitted", async () => {
    const vaultRoot = await makeVault();
    const { writeFile: wf } = await import("node:fs/promises");
    const rel = "03-Resources/real-note.md";
    await wf(
      path.join(vaultRoot, rel),
      "---\npake_id: real-id\ntitle: Real\n---\n\nreal body\n",
      "utf8",
    );
    const sweep: ResearchSweepResult = {
      brief_topic: "default-adapter-topic",
      notes_created: [
        {
          vault_path: rel,
          pake_id: "real-id",
          source_uri: "https://example.com/real",
          source: "firecrawl",
        },
      ],
      notes_skipped: [],
      perplexity_skipped: true,
      perplexity_answers_filed: 0,
      sweep_timestamp: "2026-04-18T22:00:00.000Z",
    };
    const result = await runSynthesisAgent(vaultRoot, sweep, {
      adapters: {
        synthesis: makeSynthesis({
          body: validPakeBody(),
          summary: "default path summary",
        }),
      },
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    const content = await readFile(
      path.join(vaultRoot, result.insight_note.vault_path),
      "utf8",
    );
    expect(content).toContain("default path summary");
    expect(content).toContain("[[real-note]]");
  });
});
