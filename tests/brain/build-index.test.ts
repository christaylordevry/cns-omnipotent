import { lstat, mkdir, mkdtemp, readFile, symlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertOutputDirOutsideVault,
  discoverMarkdownCandidates,
  runBuildIndex,
  serializeBuildIndexArtifact,
  writeBuildIndexArtifact,
} from "../../src/brain/build-index.js";
import { StubEmbedder } from "../../src/brain/embedder.js";
import { effectiveCorpusRoots, loadBrainCorpusAllowlistFromVault } from "../../src/brain/load-corpus-allowlist.js";
import { parseBrainCorpusAllowlistUnknown } from "../../src/brain/corpus-allowlist.js";
import { CnsError } from "../../src/errors.js";
import {
  BRAIN_INDEX_MANIFEST_FAILURE_CAP,
  computeVaultSnapshotAndFreshness,
  serializeBrainIndexManifest,
} from "../../src/brain/brain-index-manifest.js";

async function writeAllowlist(
  vaultRoot: string,
  body: {
    subtrees: string[];
    inbox?: { enabled: boolean };
    pake_types?: string[];
    protected_corpora_opt_in?: {
      enabled: true;
      rationale: string;
      acknowledged_risks: true;
    };
  },
): Promise<void> {
  const dir = path.join(vaultRoot, "_meta", "schemas");
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "brain-corpus-allowlist.json"),
    JSON.stringify({
      schema_version: 1,
      inbox: { enabled: false },
      ...body,
    }),
    "utf8",
  );
}

describe("loadBrainCorpusAllowlistFromVault + effectiveCorpusRoots", () => {
  let vaultRoot: string;

  beforeEach(async () => {
    vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-idx-"));
  });

  it("loads allowlist from disk and merges inbox.enabled into effective roots", async () => {
    await writeAllowlist(vaultRoot, {
      subtrees: ["03-Resources"],
      inbox: { enabled: true },
    });
    const r = await loadBrainCorpusAllowlistFromVault(vaultRoot);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    const roots = effectiveCorpusRoots(r.value);
    expect(roots).toEqual(["00-Inbox", "03-Resources"]);
  });
});

describe("discoverMarkdownCandidates", () => {
  let vaultRoot: string;

  beforeEach(async () => {
    vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-disc-"));
  });

  it("excludes _meta/logs/** even when _meta is allowlisted with opt-in", async () => {
    await writeAllowlist(vaultRoot, {
      subtrees: ["_meta/schemas"],
      protected_corpora_opt_in: {
        enabled: true,
        rationale: "fixture",
        acknowledged_risks: true,
      },
    });
    await mkdir(path.join(vaultRoot, "_meta", "schemas"), { recursive: true });
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
    await writeFile(path.join(vaultRoot, "_meta", "schemas", "ok.md"), "---\ntitle: x\n---\n", "utf8");
    await writeFile(path.join(vaultRoot, "_meta", "logs", "audit.md"), "---\ntitle: y\n---\n", "utf8");

    const al = parseBrainCorpusAllowlistUnknown({
      schema_version: 1,
      subtrees: ["_meta/schemas"],
      protected_corpora_opt_in: {
        enabled: true,
        rationale: "fixture",
        acknowledged_risks: true,
      },
    });
    expect(al.ok).toBe(true);
    if (!al.ok) {
      return;
    }

    const cands = await discoverMarkdownCandidates(vaultRoot, al.value);
    expect(cands.candidates).toEqual(["_meta/schemas/ok.md"]);
  });

  it("excludes symlink aliases that point into _meta/logs", async () => {
    await writeAllowlist(vaultRoot, { subtrees: ["03-Resources"] });
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
    await writeFile(path.join(vaultRoot, "_meta", "logs", "audit.md"), "---\ntitle: y\n---\n", "utf8");
    await symlink(path.join(vaultRoot, "_meta", "logs"), path.join(vaultRoot, "03-Resources", "logs-alias"));

    const al = parseBrainCorpusAllowlistUnknown({
      schema_version: 1,
      subtrees: ["03-Resources"],
    });
    expect(al.ok).toBe(true);
    if (!al.ok) {
      return;
    }

    const cands = await discoverMarkdownCandidates(vaultRoot, al.value);
    expect(cands.candidates).toEqual([]);
  });
});

describe("runBuildIndex", () => {
  let vaultRoot: string;

  beforeEach(async () => {
    vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-run-"));
  });

  it("applies pake_types filter (exclude missing or non-matching)", async () => {
    await writeAllowlist(vaultRoot, {
      subtrees: ["notes"],
      pake_types: ["SourceNote"],
    });
    await mkdir(path.join(vaultRoot, "notes"), { recursive: true });
    await writeFile(
      path.join(vaultRoot, "notes", "good.md"),
      `---
pake_id: 11111111-1111-4111-8111-111111111111
pake_type: SourceNote
title: "a"
created: 2026-01-01
modified: 2026-01-01
status: draft
confidence_score: 0.5
verification_status: pending
creation_method: human
tags: []
---
body`,
      "utf8",
    );
    await writeFile(path.join(vaultRoot, "notes", "bad.md"), "---\npake_type: InsightNote\ntitle: x\n---\n", "utf8");
    await writeFile(path.join(vaultRoot, "notes", "missing.md"), "---\ntitle: missing\n---\n", "utf8");

    const al = parseBrainCorpusAllowlistUnknown({
      schema_version: 1,
      subtrees: ["notes"],
      pake_types: ["SourceNote"],
    });
    expect(al.ok).toBe(true);
    if (!al.ok) {
      return;
    }

    const embedder = new StubEmbedder();
    const run = await runBuildIndex(vaultRoot, al.value, embedder);
    expect(run.result.records.map((r) => r.path)).toEqual(["notes/good.md"]);
    expect(run.result.records[0]?.quality).toEqual({
      status: "draft",
      confidence_score: 0.5,
      verification_status: "pending",
      pake_type: "SourceNote",
    });
    expect(run.result.exclusions.some((e) => e.path === "notes/bad.md" && e.reasonCode === "PAKE_TYPE_FILTER")).toBe(true);
    expect(run.result.exclusions.some((e) => e.path === "notes/missing.md" && e.reasonCode === "PAKE_TYPE_FILTER")).toBe(true);
  });

  it("excludes malformed frontmatter without aborting the build", async () => {
    await writeAllowlist(vaultRoot, { subtrees: ["notes"] });
    await mkdir(path.join(vaultRoot, "notes"), { recursive: true });
    await writeFile(path.join(vaultRoot, "notes", "bad.md"), "---\n: bad\n---\n", "utf8");
    await writeFile(
      path.join(vaultRoot, "notes", "good.md"),
      `---
pake_id: 22222222-2222-4222-8222-222222222222
pake_type: SourceNote
title: "g"
created: 2026-01-01
modified: 2026-01-01
status: draft
confidence_score: 0.5
verification_status: pending
creation_method: human
tags: []
---
ok`,
      "utf8",
    );

    const al = parseBrainCorpusAllowlistUnknown({ schema_version: 1, subtrees: ["notes"] });
    expect(al.ok).toBe(true);
    if (!al.ok) {
      return;
    }

    const run = await runBuildIndex(vaultRoot, al.value, new StubEmbedder());
    expect(run.result.records.map((r) => r.path)).toEqual(["notes/good.md"]);
    expect(run.result.exclusions.some((e) => e.path === "notes/bad.md" && e.reasonCode === "FRONTMATTER_PARSE")).toBe(true);
  });

  it("excludes secret matches without echoing material in serialized exclusions", async () => {
    await writeAllowlist(vaultRoot, { subtrees: ["notes"] });
    await mkdir(path.join(vaultRoot, "notes"), { recursive: true });
    const secret = "AKIA0123456789ABCDEF";
    await writeFile(path.join(vaultRoot, "notes", "leak.md"), `---\ntitle: x\n---\n${secret}\n`, "utf8");
    await writeFile(
      path.join(vaultRoot, "notes", "clean.md"),
      `---
pake_id: 33333333-3333-4333-8333-333333333333
pake_type: SourceNote
title: "c"
created: 2026-01-01
modified: 2026-01-01
status: draft
confidence_score: 0.5
verification_status: pending
creation_method: human
tags: []
---
ok`,
      "utf8",
    );

    const al = parseBrainCorpusAllowlistUnknown({ schema_version: 1, subtrees: ["notes"] });
    expect(al.ok).toBe(true);
    if (!al.ok) {
      return;
    }

    const run = await runBuildIndex(vaultRoot, al.value, new StubEmbedder());
    const ser = serializeBuildIndexArtifact(run.result);
    expect(ser).not.toContain(secret);
    expect(ser).not.toContain("AKIA");
    expect(run.result.exclusions.some((e) => e.path === "notes/leak.md")).toBe(true);
  });

  it("rejects symlink escape at canonical read with VAULT_BOUNDARY", async () => {
    await writeAllowlist(vaultRoot, { subtrees: ["notes"] });
    await mkdir(path.join(vaultRoot, "notes"), { recursive: true });
    const outside = path.join(os.tmpdir(), `outside-${Date.now()}.md`);
    await writeFile(outside, "# outside\n", "utf8");
    await symlink(outside, path.join(vaultRoot, "notes", "escape.md"));

    const al = parseBrainCorpusAllowlistUnknown({ schema_version: 1, subtrees: ["notes"] });
    expect(al.ok).toBe(true);
    if (!al.ok) {
      return;
    }

    const run = await runBuildIndex(vaultRoot, al.value, new StubEmbedder());
    expect(run.result.records).toHaveLength(0);
    const ex = run.result.exclusions.find((e) => e.path === "notes/escape.md");
    expect(ex?.reasonCode).toBe("VAULT_BOUNDARY");
  });

  it("strips ## Agent Log before embedding for DailyNotes paths", async () => {
    await writeAllowlist(vaultRoot, { subtrees: ["DailyNotes"] });
    await mkdir(path.join(vaultRoot, "DailyNotes"), { recursive: true });
    const raw = `---
pake_id: 44444444-4444-4444-8444-444444444444
pake_type: SourceNote
title: "d"
created: 2026-01-01
modified: 2026-01-01
status: draft
confidence_score: 0.5
verification_status: pending
creation_method: human
tags: []
---

## Work

keep

## Agent Log

DROP_ME_UNIQUE_999

## Other

tail
`;
    await writeFile(path.join(vaultRoot, "DailyNotes", "2026-04-13.md"), raw, "utf8");

    const al = parseBrainCorpusAllowlistUnknown({ schema_version: 1, subtrees: ["DailyNotes"] });
    expect(al.ok).toBe(true);
    if (!al.ok) {
      return;
    }

    const embedder = new StubEmbedder();
    const embedSpy = vi.spyOn(embedder, "embed");
    const run = await runBuildIndex(vaultRoot, al.value, embedder);
    expect(run.result.records).toHaveLength(1);
    const arg = embedSpy.mock.calls[0]?.[0];
    expect(typeof arg).toBe("string");
    expect(arg).not.toContain("DROP_ME_UNIQUE_999");
    embedSpy.mockRestore();
  });

  it("produces deterministic ordering and serialization for unchanged inputs", async () => {
    await writeAllowlist(vaultRoot, { subtrees: ["a"] });
    await mkdir(path.join(vaultRoot, "a"), { recursive: true });
    const fm = `---
pake_id: 55555555-5555-4555-8555-555555555555
pake_type: SourceNote
title: "t"
created: 2026-01-01
modified: 2026-01-01
status: draft
confidence_score: 0.5
verification_status: pending
creation_method: human
tags: []
---
`;
    await writeFile(path.join(vaultRoot, "a", "z.md"), `${fm}z`, "utf8");
    await writeFile(path.join(vaultRoot, "a", "m.md"), `${fm}m`, "utf8");

    const al = parseBrainCorpusAllowlistUnknown({ schema_version: 1, subtrees: ["a"] });
    expect(al.ok).toBe(true);
    if (!al.ok) {
      return;
    }

    const embedder = new StubEmbedder();
    const r1 = await runBuildIndex(vaultRoot, al.value, embedder);
    const r2 = await runBuildIndex(vaultRoot, al.value, embedder);
    expect(serializeBuildIndexArtifact(r1.result)).toBe(serializeBuildIndexArtifact(r2.result));
  });
});

describe("assertOutputDirOutsideVault", () => {
  it("throws when output resolves inside the vault", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-out-"));
    await mkdir(path.join(vaultRoot, "_meta", "schemas"), { recursive: true });
    await writeFile(
      path.join(vaultRoot, "_meta", "schemas", "brain-corpus-allowlist.json"),
      JSON.stringify({
        schema_version: 1,
        subtrees: ["03-Resources"],
        inbox: { enabled: false },
      }),
      "utf8",
    );
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });

    const inside = path.join(vaultRoot, "out");
    await expect(assertOutputDirOutsideVault(vaultRoot, inside)).rejects.toThrow(CnsError);
  });
});

describe("writeBuildIndexArtifact", () => {
  it("writes JSON outside the vault", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-vault-"));
    const out = await mkdtemp(path.join(os.tmpdir(), "cns-brain-art-"));
    const result = {
      embedder: { providerId: "stub", modelId: "stub-v1" },
      records: [{ path: "a/b.md", embedding: [0.1] }],
      exclusions: [],
    };
    const p = await writeBuildIndexArtifact(vaultRoot, out, result);
    const txt = await readFile(p, "utf8");
    expect(p).toMatch(/brain-index\.json$/);
    expect(JSON.parse(txt).records[0].path).toBe("a/b.md");
  });

  it("rejects direct artifact writes inside the vault", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-art-vault-"));
    const inside = path.join(vaultRoot, "out");
    const result = {
      embedder: { providerId: "stub", modelId: "stub-v1" },
      records: [{ path: "a/b.md", embedding: [0.1] }],
      exclusions: [],
    };

    await expect(writeBuildIndexArtifact(vaultRoot, inside, result)).rejects.toThrow(CnsError);
  });

  it("replaces a symlinked artifact path without writing into the vault", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-art-safe-vault-"));
    const out = await mkdtemp(path.join(os.tmpdir(), "cns-brain-art-safe-out-"));
    const vaultTarget = path.join(vaultRoot, "vault-target.json");
    const outsideArtifactPath = path.join(out, "brain-index.json");
    const result = {
      embedder: { providerId: "stub", modelId: "stub-v1" },
      records: [{ path: "a/b.md", embedding: [0.1] }],
      exclusions: [],
    };

    await writeFile(vaultTarget, "KEEP_ME", "utf8");
    await symlink(vaultTarget, outsideArtifactPath);

    const written = await writeBuildIndexArtifact(vaultRoot, out, result);
    const outsideStat = await lstat(written);
    const outsideText = await readFile(written, "utf8");
    const vaultText = await readFile(vaultTarget, "utf8");

    expect(outsideStat.isSymbolicLink()).toBe(false);
    expect(JSON.parse(outsideText).records[0].path).toBe("a/b.md");
    expect(vaultText).toBe("KEEP_ME");
  });
});

describe("serializeBrainIndexManifest", () => {
  it("enforces bounded, sanitized failure summaries at serialization time", () => {
    const secret = "AKIA0123456789ABCDEF";
    const failures = Array.from({ length: BRAIN_INDEX_MANIFEST_FAILURE_CAP + 1 }, (_, index) => ({
      path: index === 0 ? "/tmp/leak.md" : `./notes/${index}.md`,
      reasonCode: "IO_ERROR",
      detail:
        index === 0
          ? ({ code: "IO_ERROR", body: secret, absolutePath: "/tmp/leak.md" } as Record<string, unknown>)
          : ({ code: "IO_ERROR", ignored: `value-${index}` } as Record<string, unknown>),
    }));

    const text = serializeBrainIndexManifest({
      schema_version: 1,
      outcome: "success",
      build_timestamp_utc: "2026-01-01T00:00:00.000Z",
      allowlist_snapshot: { subtrees: ["notes"], inbox: { enabled: false } },
      embedder: { providerId: "stub", modelId: "stub-v1" },
      counts: { candidates_discovered: 1, embedded: 1, excluded: 0, failed: 0 },
      exclusion_reason_breakdown: {},
      failures,
      vault_snapshot: {
        vault_root_realpath_hash: "a".repeat(64),
        markdown_candidates_discovered: 1,
        max_mtime_ms: null,
        max_mtime_utc: null,
      },
      freshness: {
        last_build_utc: "2026-01-01T00:00:00.000Z",
        estimated_stale_count: 0,
        estimated_stale_sample: [],
      },
    });

    const parsed = JSON.parse(text) as { failures: Array<{ path: string; detail?: Record<string, unknown> }> };
    expect(parsed.failures).toHaveLength(BRAIN_INDEX_MANIFEST_FAILURE_CAP);
    expect(parsed.failures[0]).toEqual({
      path: "[redacted]",
      reasonCode: "IO_ERROR",
      detail: { code: "IO_ERROR" },
    });
    expect(parsed.failures[1]?.path).toBe("notes/1.md");
    expect(text).not.toContain(secret);
    expect(text).not.toContain("/tmp/leak.md");
    expect(text).not.toContain("absolutePath");
    expect(text).not.toContain("ignored");
  });
});

describe("build-index-cli", () => {
  const entry = path.join(process.cwd(), "src/brain/build-index-cli.ts");

  it("exits non-zero when --output-dir is missing", () => {
    const res = spawnSync("npx", ["tsx", entry], {
      encoding: "utf8",
      env: { ...process.env },
    });
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/--output-dir/);
  });

  it("writes brain-index.json and brain-index-manifest.json on success (and manifest never echoes secret substrings)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-cli-vault-"));
    const out = await mkdtemp(path.join(os.tmpdir(), "cns-brain-cli-out-"));
    await writeAllowlist(vaultRoot, { subtrees: ["notes"] });
    await mkdir(path.join(vaultRoot, "notes"), { recursive: true });
    const secret = "AKIA0123456789ABCDEF";
    await writeFile(path.join(vaultRoot, "notes", "leak.md"), `---\ntitle: x\n---\n${secret}\n`, "utf8");
    await writeFile(
      path.join(vaultRoot, "notes", "clean.md"),
      `---
pake_id: 66666666-6666-4666-8666-666666666666
pake_type: SourceNote
title: "c"
created: 2026-01-01
modified: 2026-01-01
status: draft
confidence_score: 0.5
verification_status: pending
creation_method: human
tags: []
---
ok`,
      "utf8",
    );

    const res = spawnSync("npx", ["tsx", entry, "--output-dir", out], {
      encoding: "utf8",
      env: { ...process.env, CNS_VAULT_ROOT: vaultRoot },
    });
    expect(res.status).toBe(0);

    const indexText = await readFile(path.join(out, "brain-index.json"), "utf8");
    const manifestText = await readFile(path.join(out, "brain-index-manifest.json"), "utf8");
    expect(indexText).toMatch(/"schema_version": 1/);
    expect(manifestText).toMatch(/"schema_version": 1/);
    expect(manifestText).toMatch(/"outcome": "success"/);
    expect(manifestText).toMatch(/"providerId": "stub"/);
    expect(manifestText).toMatch(/"modelId": "stub-v1"/);
    expect(manifestText).not.toContain(secret);
    expect(manifestText).not.toContain("AKIA");
  });

  it("writes a failed manifest when allowlist is invalid (output dir is valid)", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-cli-bad-vault-"));
    const out = await mkdtemp(path.join(os.tmpdir(), "cns-brain-cli-bad-out-"));
    const dir = path.join(vaultRoot, "_meta", "schemas");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "brain-corpus-allowlist.json"), "{not-json", "utf8");

    const res = spawnSync("npx", ["tsx", entry, "--output-dir", out], {
      encoding: "utf8",
      env: { ...process.env, CNS_VAULT_ROOT: vaultRoot },
    });
    expect(res.status).not.toBe(0);

    const manifestText = await readFile(path.join(out, "brain-index-manifest.json"), "utf8");
    expect(manifestText).toMatch(/"outcome": "failed"/);
    expect(manifestText).toMatch(/"code": "ALLOWLIST_INVALID"/);
  });
});

describe("computeVaultSnapshotAndFreshness", () => {
  it("counts files with mtime after build timestamp as estimated stale", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-brain-drift-vault-"));
    await mkdir(path.join(vaultRoot, "notes"), { recursive: true });
    const p = path.join(vaultRoot, "notes", "a.md");
    await writeFile(p, "---\ntitle: a\n---\n", "utf8");

    const buildMs = Date.parse("2026-01-01T00:00:00.000Z");
    const futureMs = Date.parse("2026-01-02T00:00:00.000Z");
    await utimes(p, futureMs / 1000, futureMs / 1000);

    const drift = await computeVaultSnapshotAndFreshness(vaultRoot, ["notes/a.md"], buildMs, 20);
    expect(drift.freshness.estimated_stale_count).toBe(1);
    expect(drift.freshness.estimated_stale_sample).toEqual(["notes/a.md"]);
    expect(drift.vault_snapshot.max_mtime_ms).toBeGreaterThan(buildMs);
    expect(drift.vault_snapshot.vault_root_realpath_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
