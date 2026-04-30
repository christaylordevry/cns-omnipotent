import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { Embedder } from "../../src/brain/embedder.js";
import { queryBrainIndex } from "../../src/brain/retrieval/query-index.js";

async function writeIndex(params: {
  dir: string;
  embedder?: { providerId: string; modelId: string };
  records: Array<{
    path: string;
    embedding: number[];
    quality?: {
      status?: string;
      confidence_score?: number;
      verification_status?: string;
      pake_type?: string;
    };
  }>;
}): Promise<string> {
  const indexPath = path.join(params.dir, "brain-index.json");
  const obj = {
    schema_version: 1,
    embedder: params.embedder ?? { providerId: "stub", modelId: "stub-v1" },
    records: params.records,
    exclusions: [],
  };
  await writeFile(indexPath, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
  return indexPath;
}

async function writeManifest(params: {
  dir: string;
  outcome: "success" | "failed";
  last_build_utc: string;
  estimated_stale_count: number;
  estimated_stale_sample?: string[];
}): Promise<string> {
  const manifestPath = path.join(params.dir, "brain-index-manifest.json");
  const obj = {
    schema_version: 1,
    outcome: params.outcome,
    build_timestamp_utc: params.last_build_utc,
    allowlist_snapshot: { subtrees: [], inbox: { enabled: false } },
    embedder: { providerId: "stub", modelId: "stub-v1" },
    counts: { candidates_discovered: 0, embedded: 0, excluded: 0, failed: 0 },
    exclusion_reason_breakdown: {},
    failures: [],
    vault_snapshot: {
      vault_root_realpath_hash: "a".repeat(64),
      markdown_candidates_discovered: 0,
      max_mtime_ms: null,
      max_mtime_utc: null,
    },
    freshness: {
      last_build_utc: params.last_build_utc,
      estimated_stale_count: params.estimated_stale_count,
      estimated_stale_sample: params.estimated_stale_sample ?? [],
    },
  };
  await writeFile(manifestPath, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
  return manifestPath;
}

describe("queryBrainIndex", () => {
  it("ranks higher cosine similarity scores first (deterministic; ties broken lexically by path)", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-"));
    const indexPath = await writeIndex({
      dir,
      records: [
        { path: "notes/c.md", embedding: [0, 1] },
        { path: "notes/a.md", embedding: [1, 0] },
        { path: "notes/b.md", embedding: [1, 0] }, // tie with a.md
        { path: "notes/d.md", embedding: [0.5, 0] },
      ],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder });
    expect(out.results.map((r) => r.path)).toEqual(["notes/a.md", "notes/b.md", "notes/d.md", "notes/c.md"]);
    expect(out.results.every((r) => typeof r.score === "number")).toBe(true);
  });

  it("down-ranks records missing quality metadata entirely (quality is applied as a multiplier)", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-qm-"));
    const indexPath = await writeIndex({
      dir,
      records: [
        { path: "notes/has-quality.md", embedding: [1, 0], quality: { status: "reviewed", confidence_score: 0.9, verification_status: "verified" } },
        { path: "notes/no-quality.md", embedding: [1, 0] }, // identical cosine; should be down-ranked
      ],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder });
    expect(out.results.map((r) => r.path)).toEqual(["notes/has-quality.md", "notes/no-quality.md"]);
  });

  it("uses PAKE type weighting to promote reference-grade records when cosine ties", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-type-"));
    const indexPath = await writeIndex({
      dir,
      records: [
        {
          path: "notes/a-workflow.md",
          embedding: [1, 0],
          quality: {
            status: "reviewed",
            confidence_score: 1,
            verification_status: "verified",
            pake_type: "WorkflowNote",
          },
        },
        {
          path: "notes/z-source.md",
          embedding: [1, 0],
          quality: {
            status: "reviewed",
            confidence_score: 1,
            verification_status: "verified",
            pake_type: "SourceNote",
          },
        },
      ],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder });
    expect(out.results.map((r) => r.path)).toEqual(["notes/z-source.md", "notes/a-workflow.md"]);
  });

  it("applies manifest stale-sample freshness penalty when quality weighting is enabled", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-fresh-"));
    const quality = {
      status: "reviewed",
      confidence_score: 1,
      verification_status: "verified",
      pake_type: "SourceNote",
    };
    const indexPath = await writeIndex({
      dir,
      records: [
        { path: "notes/a-stale.md", embedding: [1, 0], quality },
        { path: "notes/z-fresh.md", embedding: [1, 0], quality },
      ],
    });
    await writeManifest({
      dir,
      outcome: "success",
      last_build_utc: "2026-04-14T00:00:00.000Z",
      estimated_stale_count: 1,
      estimated_stale_sample: ["notes/a-stale.md"],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder });
    expect(out.results.map((r) => r.path)).toEqual(["notes/z-fresh.md", "notes/a-stale.md"]);
    const codes = (out.warnings ?? []).map((w) => w.code);
    expect(codes).toContain("INDEX_ESTIMATED_STALE");
    expect(codes).toContain("FRESHNESS_PENALTY_APPLIED");
  });

  it("does not apply manifest stale-sample freshness penalty when quality weighting is disabled", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-fresh-off-"));
    const quality = {
      status: "reviewed",
      confidence_score: 1,
      verification_status: "verified",
      pake_type: "SourceNote",
    };
    const indexPath = await writeIndex({
      dir,
      records: [
        { path: "notes/a-stale.md", embedding: [1, 0], quality },
        { path: "notes/z-fresh.md", embedding: [1, 0], quality },
      ],
    });
    await writeManifest({
      dir,
      outcome: "success",
      last_build_utc: "2026-04-14T00:00:00.000Z",
      estimated_stale_count: 1,
      estimated_stale_sample: ["notes/a-stale.md"],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder, qualityWeighting: false });
    expect(out.results.map((r) => r.path)).toEqual(["notes/a-stale.md", "notes/z-fresh.md"]);
    const codes = (out.warnings ?? []).map((w) => w.code);
    expect(codes).not.toContain("FRESHNESS_PENALTY_APPLIED");
  });

  it("returns safe explain components without absolute paths or note body fragments", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-explain-"));
    const marker = "BODY_MARKER_UNIQUE_EXPLAIN_12345";
    await writeFile(path.join(dir, "body.md"), marker, "utf8");
    const indexPath = await writeIndex({
      dir,
      records: [
        {
          path: "notes/a.md",
          embedding: [1, 0],
          quality: {
            status: "reviewed",
            confidence_score: 0.9,
            verification_status: "verified",
            pake_type: "SourceNote",
          },
        },
      ],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder, explain: true });
    const first = out.results[0];
    expect(first?.components?.rawSimilarity).toBeCloseTo(1);
    expect(first?.components?.qualityMultiplier).toBeCloseTo(0.9);
    expect(first?.components?.quality.typeWeight).toBeCloseTo(1);
    expect(first?.components?.freshnessPenalty).toBe(1);
    expect(first?.components?.finalScore).toBeCloseTo(first?.score ?? 0);

    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain(dir);
    expect(serialized).not.toContain(marker);
  });

  it("preserves pure cosine ordering when qualityWeighting is false (even if quality differs)", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-qwo-"));
    const indexPath = await writeIndex({
      dir,
      records: [
        // a has lower cosine but higher quality; should NOT be promoted when weighting disabled
        { path: "notes/a.md", embedding: [0.9, 0.1], quality: { status: "reviewed", confidence_score: 1.0, verification_status: "verified" } },
        { path: "notes/b.md", embedding: [1, 0], quality: { status: "draft", confidence_score: 0.1, verification_status: "pending" } },
      ],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder, qualityWeighting: false });
    expect(out.results.map((r) => r.path)).toEqual(["notes/b.md", "notes/a.md"]);
  });

  it("enforces topK cap of 50 and emits TOPK_CAPPED warning", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-k-"));
    const records = Array.from({ length: 60 }, (_, i) => ({
      path: `notes/${String(i).padStart(2, "0")}.md`,
      embedding: [1, 0],
    }));
    const indexPath = await writeIndex({ dir, records });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 100, embedder });
    expect(out.results).toHaveLength(50);
    const codes = (out.warnings ?? []).map((w) => w.code);
    expect(codes).toContain("TOPK_CAPPED");
  });

  it("loads sibling manifest best-effort and emits provenance warnings (and last_build_utc) without failing hard", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-man-"));
    const indexPath = await writeIndex({
      dir,
      records: [{ path: "notes/a.md", embedding: [1, 0] }],
    });
    await writeManifest({
      dir,
      outcome: "failed",
      last_build_utc: "2026-01-01T00:00:00.000Z",
      estimated_stale_count: 2,
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder });
    expect(out.provenance?.last_build_utc).toBe("2026-01-01T00:00:00.000Z");
    const warningCodes = (out.warnings ?? []).map((w) => w.code);
    expect(warningCodes).toContain("MANIFEST_OUTCOME_NOT_SUCCESS");
    expect(warningCodes).toContain("INDEX_ESTIMATED_STALE");
  });

  it("emits INDEX_ESTIMATED_STALE even when outcome is success and results are returned", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-stale-"));
    const indexPath = await writeIndex({
      dir,
      records: [
        { path: "notes/a.md", embedding: [1, 0] },
        { path: "notes/b.md", embedding: [0, 1] },
      ],
    });
    await writeManifest({
      dir,
      outcome: "success",
      last_build_utc: "2026-04-14T00:00:00.000Z",
      estimated_stale_count: 3,
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder });
    expect(out.results.length).toBeGreaterThan(0);
    const codes = (out.warnings ?? []).map((w) => w.code);
    expect(codes).toContain("INDEX_ESTIMATED_STALE");
    expect(codes).not.toContain("MANIFEST_OUTCOME_NOT_SUCCESS");
  });

  it("handles zero-vector query embedding gracefully (no NaN, returns warning)", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-zv-"));
    const indexPath = await writeIndex({
      dir,
      records: [{ path: "notes/a.md", embedding: [1, 0] }],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "zero" },
      embed: async () => [0, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder });
    expect(out.results).toHaveLength(0);
    const codes = (out.warnings ?? []).map((w) => w.code);
    expect(codes).toContain("ZERO_VECTOR_QUERY");
  });

  it("skips records with unsafe/absolute paths and emits UNSAFE_RECORD_PATH warning", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-unsafe-"));
    const indexPath = await writeIndex({
      dir,
      records: [
        { path: "/abs/secret.md", embedding: [1, 0] },
        { path: "notes/good.md", embedding: [1, 0] },
      ],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder });
    expect(out.results.map((r) => r.path)).toEqual(["notes/good.md"]);
    const codes = (out.warnings ?? []).map((w) => w.code);
    expect(codes).toContain("UNSAFE_RECORD_PATH");
  });

  it("skips zero-vector stored records and emits ZERO_VECTOR_RECORD warning", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-zr-"));
    const indexPath = await writeIndex({
      dir,
      records: [
        { path: "notes/good.md", embedding: [1, 0] },
        { path: "notes/zero.md", embedding: [0, 0] },
      ],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder });
    expect(out.results.map((r) => r.path)).toEqual(["notes/good.md"]);
    const codes = (out.warnings ?? []).map((w) => w.code);
    expect(codes).toContain("ZERO_VECTOR_RECORD");
  });

  it("zero-vector query early return still includes manifest warnings", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-zvman-"));
    const indexPath = await writeIndex({
      dir,
      records: [{ path: "notes/a.md", embedding: [1, 0] }],
    });
    await writeManifest({
      dir,
      outcome: "success",
      last_build_utc: "2026-04-14T00:00:00.000Z",
      estimated_stale_count: 5,
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "zero" },
      embed: async () => [0, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder });
    expect(out.results).toHaveLength(0);
    const codes = (out.warnings ?? []).map((w) => w.code);
    expect(codes).toContain("ZERO_VECTOR_QUERY");
    expect(codes).toContain("INDEX_ESTIMATED_STALE");
    expect(out.provenance?.last_build_utc).toBe("2026-04-14T00:00:00.000Z");
  });

  it("topK of 0, negative, and NaN all produce zero results without crashing", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-tk0-"));
    const indexPath = await writeIndex({
      dir,
      records: [{ path: "notes/a.md", embedding: [1, 0] }],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    for (const k of [0, -5, NaN]) {
      const out = await queryBrainIndex({ indexPath, query: "q", topK: k, embedder });
      expect(out.results).toHaveLength(0);
    }
  });

  it("emits DIMENSION_MISMATCH for records with different embedding lengths", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-dim-"));
    const indexPath = await writeIndex({
      dir,
      records: [
        { path: "notes/good.md", embedding: [1, 0] },
        { path: "notes/bad.md", embedding: [1, 0, 0] },
      ],
    });

    const embedder: Embedder = {
      metadata: { providerId: "test", modelId: "fixed" },
      embed: async () => [1, 0],
    };

    const out = await queryBrainIndex({ indexPath, query: "q", topK: 10, embedder });
    expect(out.results.map((r) => r.path)).toEqual(["notes/good.md"]);
    const codes = (out.warnings ?? []).map((w) => w.code);
    expect(codes).toContain("DIMENSION_MISMATCH");
  });
});

describe("query-index CLI", () => {
  const entry = path.join(process.cwd(), "src/brain/query-index-cli.ts");

  it("prints JSON to stdout and never echoes absolute index paths or note body fragments", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "cns-brain-q-cli-"));
    const marker = "BODY_MARKER_UNIQUE_12345";
    await writeFile(path.join(dir, "body.md"), marker, "utf8");
    const indexPath = await writeIndex({
      dir,
      records: [
        { path: "notes/a.md", embedding: [1, 0, 0, 0, 0, 0, 0, 0] },
        { path: "notes/b.md", embedding: [0, 1, 0, 0, 0, 0, 0, 0] },
      ],
    });

    const res = spawnSync("npx", ["tsx", entry, "--index-path", indexPath, "--query", "q", "--top-k", "2", "--explain"], {
      encoding: "utf8",
      env: { ...process.env },
    });
    expect(res.status).toBe(0);
    expect(res.stdout.trim().startsWith("{")).toBe(true);
    expect(res.stdout).not.toContain(dir);
    expect(res.stdout).not.toContain(marker);

    const parsed = JSON.parse(res.stdout) as { results: Array<{ path: string; components?: { rawSimilarity?: number } }> };
    expect(parsed.results.map((r) => r.path)).toEqual(["notes/a.md", "notes/b.md"]);
    expect(typeof parsed.results[0]?.components?.rawSimilarity).toBe("number");
  });

  it("exits non-zero when required args are missing (no stack traces)", () => {
    const res = spawnSync("npx", ["tsx", entry], { encoding: "utf8", env: { ...process.env } });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/--index-path/);
    expect(res.stderr).not.toMatch(/at\s+\w+/);
  });
});
