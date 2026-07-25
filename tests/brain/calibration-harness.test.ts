import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Embedder } from "../../src/brain/embedder.js";
import {
  forbiddenPathsInRetrieval,
  precisionAtK,
  runCalibrationForQuery,
  runCalibrationHarness,
} from "../../src/brain/calibration-harness.js";
import { formatCalibrationPassMarkdown } from "../../src/brain/calibration-artifact.js";
import { parseBrainGoldenQueries } from "../../src/brain/golden-queries.js";
import { countTokensViaAnthropicApi } from "../../src/brain/inference-token-counter.js";

const FIXTURE_POLICY = {
  schema_version: 1 as const,
  policy_version: "cal-test-0.1.0",
  inject_blocked_paths: ["AI-Context/AGENTS.md", "_meta/logs/**"],
  channels: {
    voice_pane: {
      max_top_k_fetch: 3,
      min_score_threshold: 0.05,
      max_injection_tokens: 500,
      max_chunks: 2,
    },
    standard_text: {
      max_top_k_fetch: 5,
      min_score_threshold: 0.05,
      max_injection_tokens: 800,
      max_chunks: 3,
    },
    yapped_text: {
      max_top_k_fetch: 8,
      min_score_threshold: 0.05,
      max_injection_tokens: 1200,
      max_chunks: 4,
    },
  },
  yapped_text_min_chars: 50,
  index: {
    quality_weight_strength: 0.3,
  },
  shadow_mode: false,
};

async function writeIndex(params: {
  dir: string;
  records: Array<{ path: string; embedding: number[]; text?: string }>;
}): Promise<string> {
  const indexPath = path.join(params.dir, "brain-index.json");
  await writeFile(
    indexPath,
    JSON.stringify(
      {
        schema_version: 2,
        embedder: { providerId: "test", modelId: "fixed" },
        chunking: {
          target_tokens: 768,
          overlap_tokens: 64,
          tokenizer_encoding: "cl100k_base",
          tokenizer_package: "gpt-tokenizer@3.4.0",
        },
        records: params.records.map((r, i) => ({
          path: r.path,
          chunk_index: i,
          char_start: 0,
          char_end: (r.text ?? `Body for ${r.path}`).length,
          text: r.text ?? `Body for ${r.path}`,
          embedding: r.embedding,
        })),
        exclusions: [],
      },
      null,
      2,
    ),
    "utf8",
  );
  return indexPath;
}

async function writeVaultNote(vaultRoot: string, vaultRel: string, body: string): Promise<void> {
  const abs = path.join(vaultRoot, vaultRel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, `---\ntitle: Test\n---\n\n${body}`, "utf8");
}

describe("precisionAtK", () => {
  it("returns 1 when all expected paths appear in top-k", () => {
    expect(precisionAtK(["a.md", "b.md", "c.md"], ["a.md", "b.md"], 3)).toBe(1);
  });

  it("returns partial score when only some expected paths are in top-k", () => {
    expect(precisionAtK(["a.md", "x.md"], ["a.md", "b.md"], 2)).toBe(0.5);
  });
});

describe("forbiddenPathsInRetrieval", () => {
  it("returns forbidden paths present in retrieval top-k only", () => {
    expect(
      forbiddenPathsInRetrieval(
        ["notes/good.md", "AI-Context/AGENTS.md", "notes/other.md"],
        ["AI-Context/AGENTS.md"],
        2,
      ),
    ).toEqual(["AI-Context/AGENTS.md"]);
  });
});

describe("parseBrainGoldenQueries", () => {
  it("loads shipped config with at least 10 operator-curated queries", async () => {
    const text = await readFile(path.join(process.cwd(), "config/brain-golden-queries.json"), "utf8");
    const parsed = parseBrainGoldenQueries(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.queries.length).toBeGreaterThanOrEqual(10);
    expect(parsed.value.queries[0]?.provenance.length).toBeGreaterThan(0);
  });

  it("loads harness fixture with 10 queries", async () => {
    const text = await readFile(
      path.join(process.cwd(), "tests/fixtures/brain-golden-queries-harness.json"),
      "utf8",
    );
    const parsed = parseBrainGoldenQueries(text);
    expect(parsed.ok).toBe(true);
  });
});

describe("runCalibrationHarness", () => {
  it("reports precision@k, token use, and pass for aligned fixture index", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-4-v-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-4-i-"));

    const notes = [
      { id: "alpha", vec: [1, 0, 0] },
      { id: "beta", vec: [0.9, 0.1, 0] },
      { id: "gamma", vec: [0, 1, 0] },
      { id: "delta", vec: [0, 0.9, 0.1] },
      { id: "epsilon", vec: [0, 0, 1] },
      { id: "zeta", vec: [0.1, 0, 0.9] },
      { id: "eta", vec: [0.8, 0.2, 0] },
      { id: "theta", vec: [0, 0.8, 0.2] },
      { id: "iota", vec: [0.2, 0.8, 0] },
      { id: "kappa", vec: [0, 0.2, 0.8] },
    ];

    for (const n of notes) {
      await writeVaultNote(vaultRoot, `notes/${n.id}.md`, `Body for ${n.id} topic with unique ${n.id} content.`);
    }

    const indexPath = await writeIndex({
      dir: indexDir,
      records: notes.map((n) => ({
        path: `notes/${n.id}.md`,
        embedding: n.vec,
        text: `Body for ${n.id} topic with unique ${n.id} content.`,
      })),
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async (text: string) => {
        const t = text.toLowerCase();
        const map: Record<string, number[]> = {
          alpha: [1, 0, 0],
          beta: [0.9, 0.1, 0],
          gamma: [0, 1, 0],
          delta: [0, 0.9, 0.1],
          epsilon: [0, 0, 1],
          zeta: [0.1, 0, 0.9],
          eta: [0.8, 0.2, 0],
          theta: [0, 0.8, 0.2],
          iota: [0.2, 0.8, 0],
          kappa: [0, 0.2, 0.8],
        };
        const keys = Object.keys(map).sort((a, b) => b.length - a.length);
        for (const key of keys) {
          if (t.includes(`${key} topic`)) {
            return map[key]!;
          }
        }
        return [0.5, 0.5, 0];
      },
    };

    const goldenText = await readFile(
      path.join(process.cwd(), "tests/fixtures/brain-golden-queries-harness.json"),
      "utf8",
    );
    const goldenParsed = parseBrainGoldenQueries(goldenText);
    expect(goldenParsed.ok).toBe(true);
    if (!goldenParsed.ok) return;

    const mockCounter = async () => 10;

    const report = await runCalibrationHarness({
      vaultRoot,
      indexPath,
      policy: FIXTURE_POLICY,
      goldenQueries: goldenParsed.value,
      embedder,
      countTokens: mockCounter,
    });

    if (!report.passed) {
      const failures = report.results
        .filter((r) => !r.passed)
        .map((r) => ({
          id: r.queryId,
          channels: r.channels
            .filter((c) => !c.passed)
            .map((c) => ({
              channel: c.channel,
              precisionAtK: c.precisionAtK,
              recallPass: c.recallPass,
              citedPaths: c.citedPaths,
              retrievedPaths: c.retrievedPaths,
            })),
        }));
      expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
    }

    expect(report.passed).toBe(true);
    expect(report.summary.passedChannelRuns).toBe(report.summary.totalChannelRuns);
    for (const q of report.results) {
      for (const ch of q.channels) {
        expect(ch.precisionAtK).toBe(1);
        expect(ch.recallPass).toBe(true);
        expect(ch.tokensUsedActual).not.toBeNull();
        expect(ch.tokenMeasure).toBe("actual");
        expect(ch.withinBudget).toBe(true);
      }
    }
  });

  it("warns on forbidden paths in retrieval without failing the query", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-4-fbd-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-4-fbd-i-"));
    await writeVaultNote(vaultRoot, "notes/good.md", "Good topic body.");
    await writeVaultNote(vaultRoot, "AI-Context/AGENTS.md", "Constitution body.");
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [
        { path: "notes/good.md", embedding: [1, 0, 0], text: "Good topic body." },
        { path: "AI-Context/AGENTS.md", embedding: [0.99, 0.01, 0], text: "Constitution body." },
      ],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0, 0],
    };

    const stderrChunks: string[] = [];
    const origStderr = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrChunks.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const result = await runCalibrationForQuery({
        vaultRoot,
        indexPath,
        policy: FIXTURE_POLICY,
        query: {
          id: "q-forbidden-retrieval",
          prompt: "good topic",
          expected_paths: ["notes/good.md"],
          forbidden_paths: ["AI-Context/AGENTS.md"],
          provenance: "fixture",
          channels: ["standard_text"],
        },
        embedder,
      });

      expect(result.passed).toBe(true);
      expect(result.channels[0]?.forbiddenPass).toBe(true);
      expect(result.channels[0]?.forbiddenInRetrieval).toContain("AI-Context/AGENTS.md");
      expect(result.warnings.some((w) => w.includes("forbidden in retrieval"))).toBe(true);
      expect(stderrChunks.join("")).toContain("[cns-brain-calibration warn]");
    } finally {
      process.stderr.write = origStderr;
    }
  });

  it("degrades to estimate when token counter proxy fails", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-4-tok-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-4-tok-i-"));
    await writeVaultNote(vaultRoot, "notes/alpha.md", "Alpha body.");
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [{ path: "notes/alpha.md", embedding: [1, 0, 0], text: "Alpha body." }],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0, 0],
    };

    const degraded: string[] = [];
    const result = await runCalibrationForQuery({
      vaultRoot,
      indexPath,
      policy: FIXTURE_POLICY,
      query: {
        id: "q-alpha",
        prompt: "alpha topic",
        expected_paths: ["notes/alpha.md"],
        provenance: "fixture",
        channels: ["standard_text"],
      },
      embedder,
      countTokens: async () => {
        throw new Error("proxy unreachable");
      },
      onTokenCountDegraded: (msg) => degraded.push(msg),
    });

    expect(result.passed).toBe(true);
    expect(result.channels[0]?.tokenMeasure).toBe("estimate");
    expect(result.channels[0]?.tokensUsedActual).toBeNull();
    expect(degraded.length).toBeGreaterThan(0);
    expect(result.tokenMeasureSummary).toContain("standard_text=estimate");
  });

  it("shadow_mode logs would-inject payload without returning context", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-4-sh-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-4-idx-sh-"));
    await writeVaultNote(vaultRoot, "notes/alpha.md", "Alpha shadow body.");
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [{ path: "notes/alpha.md", embedding: [1, 0, 0], text: "Alpha body." }],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0, 0],
    };

    const stderrChunks: string[] = [];
    const origStderr = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrChunks.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const result = await runCalibrationForQuery({
        vaultRoot,
        indexPath,
        policy: { ...FIXTURE_POLICY, shadow_mode: true },
        query: {
          id: "q-alpha",
          prompt: "alpha topic",
          expected_paths: ["notes/alpha.md"],
          provenance: "fixture",
          channels: ["standard_text"],
        },
        embedder,
        logShadowPayloads: true,
      });

      expect(result.channels[0]?.shadow).toBe(true);
      expect(result.channels[0]?.wouldInjectContext).toContain("vault:notes/alpha.md");
      expect(stderrChunks.join("")).toContain("[cns-brain-calibration shadow]");
    } finally {
      process.stderr.write = origStderr;
    }
  });
});

describe("countTokensViaAnthropicApi", () => {
  it("uses API input_tokens not chars/4 estimate", async () => {
    const fetchFn = async () =>
      new Response(JSON.stringify({ input_tokens: 42 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const tokens = await countTokensViaAnthropicApi("hello world", {
      baseUrl: "http://example.test/v1",
      model: "claude-test",
      fetchFn: fetchFn as typeof fetch,
    });
    expect(tokens).toBe(42);
  });
});

describe("formatCalibrationPassMarkdown", () => {
  it("writes gate artifact with policy version and pass date", () => {
    const md = formatCalibrationPassMarkdown({
      repoRoot: "/repo",
      passDateUtc: "2026-06-26T12:00:00.000Z",
      indexPath: "/tmp/brain-index.json",
      goldenQueriesPath: "config/brain-golden-queries.json",
      report: {
        policyVersion: "0.1.0",
        shadowMode: false,
        goldenQueryCount: 12,
        passed: true,
        results: [],
        summary: {
          totalChannelRuns: 36,
          passedChannelRuns: 36,
          failedChannelRuns: 0,
          warnings: [],
          tokenCountDegraded: false,
        },
      },
    });
    expect(md).toContain("policy_version: \"0.1.0\"");
    expect(md).toContain("Epic 82 gate");
    expect(md).toContain("gate_status: PASS");
    expect(md).not.toContain("gate_status: SHADOW_WAIVER");
  });

  it("writes SHADOW_WAIVER gate status when operator waiver set on failed run", () => {
    const md = formatCalibrationPassMarkdown({
      repoRoot: "/repo",
      passDateUtc: "2026-06-26T12:00:00.000Z",
      indexPath: "/tmp/brain-index.json",
      goldenQueriesPath: "config/brain-golden-queries.json",
      operatorWaiver: {
        reason: "Continuing shadow until live index recalibrated",
        waivedBy: "Chris",
        waivedAtUtc: "2026-06-26T12:00:00.000Z",
      },
      report: {
        policyVersion: "0.1.0",
        shadowMode: true,
        goldenQueryCount: 12,
        passed: false,
        results: [
          {
            queryId: "youtube-bar",
            prompt: "test",
            passed: false,
            warnings: [],
            tokenMeasureSummary: "standard_text=estimate",
            channels: [],
          },
        ],
        summary: {
          totalChannelRuns: 1,
          passedChannelRuns: 0,
          failedChannelRuns: 1,
          warnings: [],
          tokenCountDegraded: false,
        },
      },
    });
    expect(md).toContain("gate_status: SHADOW_WAIVER");
    expect(md).not.toContain("gate_status: PASS");
    expect(md).toContain("Operator waiver");
    expect(md).toContain("Token measure:");
  });
});
