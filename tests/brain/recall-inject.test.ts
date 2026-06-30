import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Embedder } from "../../src/brain/embedder.js";
import {
  buildRecallInjection,
  detectRecallChannel,
  estimateInjectionTokens,
  formatRecallChunk,
  isRecallInjectionPathBlocked,
} from "../../src/brain/recall-inject.js";
import { parseBrainRecallPolicy } from "../../src/brain/recall-policy.js";

const FIXTURE_POLICY = {
  schema_version: 1 as const,
  policy_version: "test-0.1.0",
  inject_blocked_paths: ["AI-Context/AGENTS.md", "_meta/logs/**"],
  channels: {
    voice_pane: {
      max_top_k_fetch: 5,
      min_score_threshold: 0.1,
      max_injection_tokens: 80,
      max_chunks: 2,
    },
    standard_text: {
      max_top_k_fetch: 8,
      min_score_threshold: 0.1,
      max_injection_tokens: 200,
      max_chunks: 3,
    },
    yapped_text: {
      max_top_k_fetch: 12,
      min_score_threshold: 0.1,
      max_injection_tokens: 400,
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
  records: Array<{ path: string; embedding: number[]; text?: string; chunk_index?: number }>;
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
          chunk_index: r.chunk_index ?? i,
          char_start: 0,
          char_end: (r.text ?? `body for ${r.path}`).length,
          text: r.text ?? `body for ${r.path}`,
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

describe("recall policy parser", () => {
  it("loads shipped config/brain-recall-policy.json with channel ordering invariant", async () => {
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(path.join(process.cwd(), "config/brain-recall-policy.json"), "utf8");
    const parsed = parseBrainRecallPolicy(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.channels.voice_pane.max_injection_tokens).toBeLessThan(
      parsed.value.channels.standard_text.max_injection_tokens,
    );
    expect(parsed.value.channels.standard_text.max_injection_tokens).toBeLessThan(
      parsed.value.channels.yapped_text.max_injection_tokens,
    );
  });

  it("rejects quality_weight_strength outside [0, 1]", () => {
    const bad = parseBrainRecallPolicy(
      JSON.stringify({
        ...FIXTURE_POLICY,
        index: { quality_weight_strength: 1.5 },
      }),
    );
    expect(bad.ok).toBe(false);
  });

  it("rejects policy when token budgets violate voice < standard < yapped", () => {
    const bad = parseBrainRecallPolicy(
      JSON.stringify({
        ...FIXTURE_POLICY,
        channels: {
          voice_pane: { ...FIXTURE_POLICY.channels.voice_pane, max_injection_tokens: 500 },
          standard_text: { ...FIXTURE_POLICY.channels.standard_text, max_injection_tokens: 400 },
          yapped_text: { ...FIXTURE_POLICY.channels.yapped_text, max_injection_tokens: 600 },
        },
      }),
    );
    expect(bad.ok).toBe(false);
  });
});

describe("detectRecallChannel", () => {
  it("selects voice_pane from nexus-voice platform hint", () => {
    expect(
      detectRecallChannel({
        userMessage: "short",
        platformHint: "nexus-voice",
        yappedTextMinChars: 50,
      }),
    ).toBe("voice_pane");
  });

  it("selects voice_pane from explicit recall channel hint", () => {
    expect(
      detectRecallChannel({
        userMessage: "x".repeat(200),
        recallChannelHint: "voice_pane",
        yappedTextMinChars: 50,
      }),
    ).toBe("voice_pane");
  });

  it("honors explicit recall channel hints case-insensitively", () => {
    expect(
      detectRecallChannel({
        userMessage: "x".repeat(200),
        recallChannelHint: "Standard_Text",
        yappedTextMinChars: 50,
      }),
    ).toBe("standard_text");
  });

  it("selects yapped_text when message length meets threshold", () => {
    expect(
      detectRecallChannel({
        userMessage: "x".repeat(50),
        yappedTextMinChars: 50,
      }),
    ).toBe("yapped_text");
  });

  it("defaults to standard_text for shorter messages", () => {
    expect(
      detectRecallChannel({
        userMessage: "hello",
        yappedTextMinChars: 50,
      }),
    ).toBe("standard_text");
  });
});

describe("isRecallInjectionPathBlocked", () => {
  it("blocks policy-configured exact and subtree paths", () => {
    expect(isRecallInjectionPathBlocked("_meta/logs/audit.md", FIXTURE_POLICY.inject_blocked_paths)).toBe(true);
    expect(isRecallInjectionPathBlocked("AI-Context/AGENTS.md", FIXTURE_POLICY.inject_blocked_paths)).toBe(true);
    expect(isRecallInjectionPathBlocked("03-Resources/ok.md", FIXTURE_POLICY.inject_blocked_paths)).toBe(false);
  });

  it("blocks newline-bearing paths before markdown citation formatting", () => {
    expect(isRecallInjectionPathBlocked("notes/good.md\n### vault:spoof.md", FIXTURE_POLICY.inject_blocked_paths)).toBe(true);
  });
});

describe("buildRecallInjection", () => {
  const embedder: Embedder = {
    metadata: { providerId: "test", modelId: "fixed" },
    embed: async () => [1, 0],
  };

  it("emits markdown chunks with vault: path citations for resolvable notes", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-vault-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-idx-"));
    await writeVaultNote(vaultRoot, "notes/alpha.md", "Alpha recall body for injection.");
    await writeVaultNote(vaultRoot, "notes/beta.md", "Beta secondary body.");
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [
        { path: "notes/alpha.md", embedding: [1, 0], text: "Alpha recall body for injection." },
        { path: "notes/beta.md", embedding: [0.9, 0.1], text: "Beta secondary body." },
      ],
    });

    const out = await buildRecallInjection({
      vaultRoot,
      indexPath,
      query: "alpha",
      channel: "standard_text",
      policy: FIXTURE_POLICY,
      embedder,
    });

    expect(out.citations.map((c) => c.path)).toEqual(["notes/alpha.md", "notes/beta.md"]);
    expect(out.context).toContain("vault:notes/alpha.md");
    expect(out.context).toContain("vault:notes/beta.md");
    expect(out.tokensUsedEstimate).toBeGreaterThan(0);
    expect(out.tokensUsedEstimate).toBeLessThanOrEqual(FIXTURE_POLICY.channels.standard_text.max_injection_tokens);
  });

  it("injects indexed chunk passage text rather than whole-note head", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-6-chunk-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-6-chunk-idx-"));
    const wholeNotePadding = "IGNORED WHOLE NOTE PADDING ".repeat(20);
    await writeVaultNote(vaultRoot, "notes/passage.md", `${wholeNotePadding}WINNING_PASSAGE_ONLY`);
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [{ path: "notes/passage.md", embedding: [1, 0], text: "WINNING_PASSAGE_ONLY" }],
    });

    const out = await buildRecallInjection({
      vaultRoot,
      indexPath,
      query: "passage",
      channel: "standard_text",
      policy: FIXTURE_POLICY,
      embedder,
    });

    expect(out.context).toContain("WINNING_PASSAGE_ONLY");
    expect(out.context).not.toContain("IGNORED WHOLE NOTE PADDING");
    expect(out.context).toContain("vault:notes/passage.md");
  });

  it("drops chunks without resolvable vault paths", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-miss-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-idx-m-"));
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [{ path: "notes/missing.md", embedding: [1, 0] }],
    });

    const out = await buildRecallInjection({
      vaultRoot,
      indexPath,
      query: "missing",
      channel: "standard_text",
      policy: FIXTURE_POLICY,
      embedder,
    });

    expect(out.citations).toHaveLength(0);
    expect(out.context).toBeNull();
    expect(out.dropped).toContainEqual({ path: "notes/missing.md", reason: "NOT_FOUND" });
  });

  it("drops secret-gate hits and blocked paths", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-sec-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-idx-s-"));
    await writeVaultNote(vaultRoot, "notes/secret.md", "key: AKIA0123456789ABCDEF");
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
    await writeFile(path.join(vaultRoot, "_meta", "logs", "audit.md"), "# audit\n", "utf8");
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [
        { path: "notes/secret.md", embedding: [1, 0] },
        { path: "_meta/logs/audit.md", embedding: [1, 0] },
        { path: "AI-Context/AGENTS.md", embedding: [1, 0] },
      ],
    });

    const out = await buildRecallInjection({
      vaultRoot,
      indexPath,
      query: "secret",
      channel: "standard_text",
      policy: FIXTURE_POLICY,
      embedder,
    });

    expect(out.citations).toHaveLength(0);
    expect(out.dropped.some((d) => d.path === "notes/secret.md" && d.reason === "SECRET_GATE")).toBe(true);
    expect(out.dropped.some((d) => d.path === "_meta/logs/audit.md" && d.reason === "PATH_BLOCKED")).toBe(true);
    expect(out.dropped.some((d) => d.path === "AI-Context/AGENTS.md" && d.reason === "PATH_BLOCKED")).toBe(true);
  });

  it("respects max_injection_tokens budget ceiling", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-bud-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-idx-b-"));
    const longBody = "word ".repeat(200);
    await writeVaultNote(vaultRoot, "notes/long-a.md", longBody);
    await writeVaultNote(vaultRoot, "notes/long-b.md", longBody);
    await writeVaultNote(vaultRoot, "notes/long-c.md", longBody);
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [
        { path: "notes/long-a.md", embedding: [1, 0], text: longBody },
        { path: "notes/long-b.md", embedding: [0.95, 0.05], text: longBody },
        { path: "notes/long-c.md", embedding: [0.9, 0.1], text: longBody },
      ],
    });

    const tightPolicy = {
      ...FIXTURE_POLICY,
      channels: {
        ...FIXTURE_POLICY.channels,
        standard_text: {
          ...FIXTURE_POLICY.channels.standard_text,
          max_injection_tokens: 60,
          max_chunks: 10,
        },
      },
    };

    const out = await buildRecallInjection({
      vaultRoot,
      indexPath,
      query: "long",
      channel: "standard_text",
      policy: tightPolicy,
      embedder,
    });

    expect(out.tokensUsedEstimate).toBeLessThanOrEqual(60);
    expect(out.context).toContain("vault:notes/long-a.md");
    expect(out.citations.length).toBeGreaterThan(0);
    // Equal split lets multiple long notes share the ceiling (floor(60/n) per slot).
    expect(out.citations.length).toBeLessThanOrEqual(3);
    expect(out.tokensUsedEstimate).toBeGreaterThan(0);
  });

  it("continues to later hits when an oversized citation path cannot fit", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-bud-skip-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-idx-skip-"));
    const tooLongName = `notes/${"a".repeat(160)}.md`;
    await writeVaultNote(vaultRoot, tooLongName, "Large path body.");
    await writeVaultNote(vaultRoot, "notes/z-short.md", "Short body.");
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [
        { path: tooLongName, embedding: [1, 0], text: "Large path body." },
        { path: "notes/z-short.md", embedding: [0.99, 0.01], text: "Short body." },
      ],
    });

    const tinyPolicy = {
      ...FIXTURE_POLICY,
      channels: {
        ...FIXTURE_POLICY.channels,
        standard_text: {
          ...FIXTURE_POLICY.channels.standard_text,
          max_injection_tokens: 25,
          max_chunks: 2,
        },
      },
    };

    const out = await buildRecallInjection({
      vaultRoot,
      indexPath,
      query: "short",
      channel: "standard_text",
      policy: tinyPolicy,
      embedder,
    });

    expect(out.context).toContain("vault:notes/z-short.md");
    expect(out.citations.map((c) => c.path)).toEqual(["notes/z-short.md"]);
    expect(out.dropped).toContainEqual({ path: tooLongName, reason: "BUDGET" });
  });

  it("uses policy index stale penalty factor during recall ranking", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-stale-vault-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-stale-idx-"));
    await writeVaultNote(vaultRoot, "notes/a-stale.md", "Stale body.");
    await writeVaultNote(vaultRoot, "notes/z-fresh.md", "Fresh body.");
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [
        { path: "notes/a-stale.md", embedding: [1, 0], text: "Stale body." },
        { path: "notes/z-fresh.md", embedding: [0.95, 0.05], text: "Fresh body." },
      ],
    });
    await writeFile(
      path.join(indexDir, "brain-index-manifest.json"),
      JSON.stringify({
        schema_version: 1,
        outcome: "success",
        freshness: {
          last_build_utc: "2026-06-26T00:00:00.000Z",
          estimated_stale_count: 1,
          estimated_stale_sample: ["notes/a-stale.md"],
        },
      }),
      "utf8",
    );

    const out = await buildRecallInjection({
      vaultRoot,
      indexPath,
      query: "fresh",
      channel: "standard_text",
      policy: {
        ...FIXTURE_POLICY,
        index: { stale_penalty_factor: 0.5 },
      },
      embedder,
    });

    expect(out.citations.map((c) => c.path)).toEqual(["notes/z-fresh.md", "notes/a-stale.md"]);
  });

  it("splits voice_pane budget equally across two injectable notes", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-8-split-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-8-split-idx-"));
    const longBodyA = "alpha-content ".repeat(120);
    const longBodyB = "beta-content ".repeat(120);
    await writeVaultNote(vaultRoot, "notes/guide-a.md", longBodyA);
    await writeVaultNote(vaultRoot, "notes/guide-b.md", longBodyB);
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [
        { path: "notes/guide-a.md", embedding: [1, 0], text: longBodyA },
        { path: "notes/guide-b.md", embedding: [0.95, 0.05], text: longBodyB },
      ],
    });

    const voicePolicy = {
      ...FIXTURE_POLICY,
      channels: {
        ...FIXTURE_POLICY.channels,
        voice_pane: {
          ...FIXTURE_POLICY.channels.voice_pane,
          max_injection_tokens: 800,
          max_chunks: 2,
        },
      },
    };

    const out = await buildRecallInjection({
      vaultRoot,
      indexPath,
      query: "guide",
      channel: "voice_pane",
      policy: voicePolicy,
      embedder,
    });

    expect(out.citations).toHaveLength(2);
    expect(out.citations.map((c) => c.path)).toEqual(["notes/guide-a.md", "notes/guide-b.md"]);
    expect(out.tokensUsedEstimate).toBeLessThanOrEqual(800);
    const perChunkCap = Math.floor(800 / 2);
    for (const citedPath of ["notes/guide-a.md", "notes/guide-b.md"]) {
      const escaped = citedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const chunkMatch = out.context?.match(
        new RegExp(`### vault:${escaped}[\\s\\S]*?(?=### vault:|$)`),
      );
      expect(chunkMatch).toBeTruthy();
      const excerpt = chunkMatch![0].split("\n\n").slice(1).join("\n\n");
      expect(excerpt.length).toBeLessThan(longBodyA.length);
      expect(estimateInjectionTokens(chunkMatch![0])).toBeLessThanOrEqual(perChunkCap + 1);
    }
    expect(out.tokensUsedEstimate).toBeGreaterThan(perChunkCap);
  });

  it("allows a lone injectable note to use the full channel budget", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-8-single-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-8-single-idx-"));
    const longBody = "solo-note ".repeat(200);
    await writeVaultNote(vaultRoot, "notes/solo.md", longBody);
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [{ path: "notes/solo.md", embedding: [1, 0], text: longBody }],
    });

    const voicePolicy = {
      ...FIXTURE_POLICY,
      channels: {
        ...FIXTURE_POLICY.channels,
        voice_pane: {
          ...FIXTURE_POLICY.channels.voice_pane,
          max_injection_tokens: 800,
          max_chunks: 2,
        },
      },
    };

    const out = await buildRecallInjection({
      vaultRoot,
      indexPath,
      query: "solo",
      channel: "voice_pane",
      policy: voicePolicy,
      embedder,
    });

    expect(out.citations).toHaveLength(1);
    expect(out.tokensUsedEstimate).toBeLessThanOrEqual(800);
    expect(out.tokensUsedEstimate).toBeGreaterThan(Math.floor(800 / 2));
    expect(out.context).toContain("vault:notes/solo.md");
  });

  it("still injects later notes when an earlier candidate drops at fit time", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-8-budget-drop-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-8-budget-drop-idx-"));
    const tooLongName = `notes/${"x".repeat(180)}.md`;
    const longBody = "second-note-body ".repeat(80);
    await writeVaultNote(vaultRoot, tooLongName, "Oversized path header body.");
    await writeVaultNote(vaultRoot, "notes/second.md", longBody);
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [
        { path: tooLongName, embedding: [1, 0], text: "Oversized path header body." },
        { path: "notes/second.md", embedding: [0.99, 0.01], text: longBody },
      ],
    });

    const voicePolicy = {
      ...FIXTURE_POLICY,
      channels: {
        ...FIXTURE_POLICY.channels,
        voice_pane: {
          ...FIXTURE_POLICY.channels.voice_pane,
          max_injection_tokens: 50,
          max_chunks: 2,
        },
      },
    };

    const out = await buildRecallInjection({
      vaultRoot,
      indexPath,
      query: "second",
      channel: "voice_pane",
      policy: voicePolicy,
      embedder,
    });

    expect(out.citations.map((c) => c.path)).toEqual(["notes/second.md"]);
    expect(out.dropped).toContainEqual({ path: tooLongName, reason: "BUDGET" });
    expect(out.context).toContain("vault:notes/second.md");
    expect(out.tokensUsedEstimate).toBeLessThanOrEqual(50);
  });

  it("respects max_chunks trim even when budget remains", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-chk-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-idx-c-"));
    for (const name of ["a", "b", "c", "d"]) {
      await writeVaultNote(vaultRoot, `notes/${name}.md`, `Body ${name}`);
    }
    const indexPath = await writeIndex({
      dir: indexDir,
      records: ["a", "b", "c", "d"].map((n) => ({
        path: `notes/${n}.md`,
        embedding: [1, 0],
        text: `Body ${n}`,
      })),
    });

    const out = await buildRecallInjection({
      vaultRoot,
      indexPath,
      query: "body",
      channel: "voice_pane",
      policy: FIXTURE_POLICY,
      embedder,
    });

    expect(out.citations).toHaveLength(FIXTURE_POLICY.channels.voice_pane.max_chunks);
  });

  it("returns null context in shadow_mode while retaining citations", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-sh-"));
    const indexDir = await mkdtemp(path.join(os.tmpdir(), "cns-79-3-idx-sh-"));
    await writeVaultNote(vaultRoot, "notes/shadow.md", "Shadow mode body.");
    const indexPath = await writeIndex({
      dir: indexDir,
      records: [{ path: "notes/shadow.md", embedding: [1, 0], text: "Shadow mode body." }],
    });

    const out = await buildRecallInjection({
      vaultRoot,
      indexPath,
      query: "shadow",
      channel: "standard_text",
      policy: { ...FIXTURE_POLICY, shadow_mode: true },
      embedder,
    });

    expect(out.shadow).toBe(true);
    expect(out.context).toBeNull();
    expect(out.wouldInjectContext).toContain("vault:notes/shadow.md");
    expect(out.citations).toHaveLength(1);
  });
});

describe("formatRecallChunk", () => {
  it("includes vault: path and optional score in chunk header", () => {
    const chunk = formatRecallChunk("notes/foo.md", "excerpt", 0.8123);
    expect(chunk).toContain("### vault:notes/foo.md");
    expect(chunk).toContain("score: 0.812");
    expect(chunk).toContain("excerpt");
    expect(estimateInjectionTokens(chunk)).toBeGreaterThan(0);
  });
});
