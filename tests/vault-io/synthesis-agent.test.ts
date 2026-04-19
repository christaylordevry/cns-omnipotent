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
    sweep_timestamp: "2026-04-18T22:00:00.000Z",
    ...overrides,
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
    "patterns" in behavior
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
    synthesize: (b.synthesize ?? (async () => ({
      patterns: ["pattern one"],
      gaps: ["gap one"],
      opportunities: ["opp one"],
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
                return {
                  patterns: [],
                  gaps: [],
                  opportunities: [],
                  summary: "s",
                };
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
              return {
                patterns: [],
                gaps: [],
                opportunities: [],
                summary: "s",
              };
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
          patterns: ["p1"],
          gaps: [],
          opportunities: [],
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
            return {
              patterns: [],
              gaps: [],
              opportunities: [],
              summary: "s",
            };
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
  it("passes topic, queries, and source_notes to the synthesis adapter", async () => {
    const vaultRoot = await makeVault();
    let captured: Parameters<SynthesisAdapter["synthesize"]>[0] | null = null;
    await runSynthesisAgent(vaultRoot, validSweep(), {
      queries: ["q1", "q2"],
      adapters: {
        vaultRead: makeVaultRead({}),
        synthesis: {
          synthesize: async (input) => {
            captured = input;
            return {
              patterns: ["p"],
              gaps: [],
              opportunities: [],
              summary: "s",
            };
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
                patterns: ["p"],
                gaps: [],
                // missing opportunities, missing summary
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
              patterns: [],
              gaps: [],
              opportunities: [],
              summary: "",
            }),
          },
        },
      }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("validates output schema with synthesisAdapterOutputSchema", () => {
    expect(() =>
      synthesisAdapterOutputSchema.parse({
        patterns: [],
        gaps: [],
        opportunities: [],
        summary: "ok",
      }),
    ).not.toThrow();
    expect(() =>
      synthesisAdapterOutputSchema.parse({
        patterns: [],
        gaps: [],
        opportunities: [],
        summary: "",
      }),
    ).toThrow();
  });
});

// ── AC: insight-note ────────────────────────────────────────────────────────

describe("AC: insight-note — ingest via pipeline as InsightNote", () => {
  it("writes an InsightNote with synthesis tag and structured body", async () => {
    const vaultRoot = await makeVault();
    const result = await runSynthesisAgent(vaultRoot, validSweep(), {
      adapters: {
        vaultRead: makeVaultRead({}),
        synthesis: makeSynthesis({
          patterns: ["pattern one", "pattern two"],
          gaps: ["gap one"],
          opportunities: ["opp one", "opp two"],
          summary: "everything converges on agent orchestration",
        }),
      },
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");

    const abs = path.join(vaultRoot, result.insight_note.vault_path);
    const content = await readFile(abs, "utf8");

    expect(content).toContain("pake_type: InsightNote");
    expect(content).toContain("# Synthesis: AI agents");
    expect(content).toContain("## Patterns");
    expect(content).toContain("- pattern one");
    expect(content).toContain("## Gaps");
    expect(content).toContain("- gap one");
    expect(content).toContain("## Opportunities");
    expect(content).toContain("- opp one");
    expect(content).toContain("## Sources");
    expect(content).toContain("[[note-a]]");
    expect(content).toContain("[[note-b]]");
    expect(content).toContain("[[note-c]]");
    expect(content).toMatch(/tags:[\s\S]*synthesis/);
    expect(content).toMatch(/tags:[\s\S]*AI agents/);
    expect(content).toContain("ai_summary:");
    expect(content).toContain("everything converges on agent orchestration");
  });

  it("renders '_none identified_' for empty sections", async () => {
    const vaultRoot = await makeVault();
    const result = await runSynthesisAgent(vaultRoot, validSweep(), {
      adapters: {
        vaultRead: makeVaultRead({}),
        synthesis: makeSynthesis({
          patterns: [],
          gaps: [],
          opportunities: ["only opp"],
          summary: "thin synthesis",
        }),
      },
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    const abs = path.join(vaultRoot, result.insight_note.vault_path);
    const content = await readFile(abs, "utf8");
    expect(content).toContain("## Patterns\n\n- _none identified_");
    expect(content).toContain("## Gaps\n\n- _none identified_");
    expect(content).toContain("- only opp");
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
          patterns: ["p"],
          gaps: [],
          opportunities: [],
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
          patterns: ["p"],
          gaps: [],
          opportunities: [],
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
          patterns: ["p"],
          gaps: [],
          opportunities: [],
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
      adapter.synthesize({ topic: "t", queries: [], source_notes: [] }),
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
      sweep_timestamp: "2026-04-18T22:00:00.000Z",
    };
    const result = await runSynthesisAgent(vaultRoot, sweep, {
      adapters: {
        synthesis: makeSynthesis({
          patterns: ["default-path-pattern"],
          gaps: [],
          opportunities: [],
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
