import { describe, expect, it } from "vitest";
import { CnsError } from "../../src/errors.js";
import { PortalEmbedder, PORTAL_EMBEDDER_PROVIDER_ID } from "../../src/brain/embedder-portal.js";
import {
  BRAIN_EMBEDDER_ENV,
  BRAIN_EMBED_MODEL_ENV,
  BRAIN_EMBED_TIMEOUT_MS_ENV,
  DEFAULT_PORTAL_EMBED_BASE_URL,
  resolveBrainEmbedder,
} from "../../src/brain/resolve-embedder.js";
import { StubEmbedder } from "../../src/brain/embedder.js";

function mockFetchOk(embedding: number[]): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({
        data: [{ embedding, index: 0 }],
        model: "test-model",
        usage: { prompt_tokens: 1, total_tokens: 1 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;
}

function mockFetchError(status: number, message: string): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ error: { message } }), {
      status,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
}

describe("PortalEmbedder", () => {
  it("returns non-stub vectors with portal metadata", async () => {
    const vector = [0.1, 0.2, 0.3, 0.4];
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return mockFetchOk(vector)(url, init);
    }) as typeof fetch;

    const embedder = new PortalEmbedder({
      baseUrl: "http://127.0.0.1:8645/v1",
      modelId: "openai/text-embedding-3-small",
      fetchFn,
    });

    expect(embedder.metadata).toEqual({
      providerId: PORTAL_EMBEDDER_PROVIDER_ID,
      modelId: "openai/text-embedding-3-small",
    });

    const out = await embedder.embed("vault note text");
    expect(out).toEqual(vector);
    expect(out).not.toEqual(await new StubEmbedder().embed("vault note text"));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://127.0.0.1:8645/v1/embeddings");
    const body = JSON.parse(String(calls[0]?.init?.body)) as { input: string; model: string };
    expect(body.input).toBe("vault note text");
    expect(body.model).toBe("openai/text-embedding-3-small");
  });

  it("strips trailing slash from base URL", async () => {
    const fetchFn = mockFetchOk([1, 2]);
    const embedder = new PortalEmbedder({
      baseUrl: "http://127.0.0.1:8645/v1/",
      modelId: "m",
      fetchFn,
    });
    await embedder.embed("x");
    // mockFetchOk doesn't capture URL — use error path with custom fetch
    const calls: string[] = [];
    const tracking = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return mockFetchOk([1])(url);
    }) as typeof fetch;
    const e2 = new PortalEmbedder({ baseUrl: "http://host/v1/", modelId: "m", fetchFn: tracking });
    await e2.embed("y");
    expect(calls[0]).toBe("http://host/v1/embeddings");
  });

  it("throws CnsError on HTTP error from Portal", async () => {
    const embedder = new PortalEmbedder({
      baseUrl: "http://127.0.0.1:8645/v1",
      modelId: "m",
      fetchFn: mockFetchError(502, "upstream unavailable"),
    });
    await expect(embedder.embed("text")).rejects.toMatchObject({
      code: "IO_ERROR",
      message: expect.stringContaining("upstream unavailable"),
    });
  });

  it("throws CnsError when response omits embedding array", async () => {
    const fetchFn = (async () =>
      new Response(JSON.stringify({ data: [{}] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    const embedder = new PortalEmbedder({
      baseUrl: "http://127.0.0.1:8645/v1",
      modelId: "m",
      fetchFn,
    });
    await expect(embedder.embed("text")).rejects.toBeInstanceOf(CnsError);
  });

  it("passes an abort signal and reports timeout when Portal hangs", async () => {
    const signals: AbortSignal[] = [];
    const fetchFn = ((async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.signal instanceof AbortSignal) {
        signals.push(init.signal);
      }
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }) as unknown) as typeof fetch;
    const embedder = new PortalEmbedder({
      baseUrl: "http://127.0.0.1:8645/v1",
      modelId: "m",
      timeoutMs: 1,
      fetchFn,
    });
    await expect(embedder.embed("text")).rejects.toMatchObject({
      code: "IO_ERROR",
      message: expect.stringContaining("timed out"),
    });
    expect(signals[0]?.aborted).toBe(true);
  });

  it("rejects empty model id at construction", () => {
    expect(() => new PortalEmbedder({ baseUrl: "http://x/v1", modelId: "  " })).toThrow(CnsError);
  });
});

describe("resolveBrainEmbedder", () => {
  it("defaults to StubEmbedder when env unset", () => {
    const embedder = resolveBrainEmbedder({});
    expect(embedder).toBeInstanceOf(StubEmbedder);
    expect(embedder.metadata.providerId).toBe("stub");
  });

  it("returns StubEmbedder when CNS_BRAIN_EMBEDDER=stub", () => {
    const embedder = resolveBrainEmbedder({ [BRAIN_EMBEDDER_ENV]: "stub" });
    expect(embedder.metadata.providerId).toBe("stub");
  });

  it("returns PortalEmbedder when portal mode and model set", () => {
    const embedder = resolveBrainEmbedder({
      [BRAIN_EMBEDDER_ENV]: "portal",
      [BRAIN_EMBED_MODEL_ENV]: "openai/text-embedding-3-small",
    });
    expect(embedder.metadata.providerId).toBe(PORTAL_EMBEDDER_PROVIDER_ID);
    expect(embedder.metadata.modelId).toBe("openai/text-embedding-3-small");
  });

  it("uses default proxy base URL for portal mode", () => {
    const embedder = resolveBrainEmbedder({
      [BRAIN_EMBEDDER_ENV]: "nous-portal",
      [BRAIN_EMBED_MODEL_ENV]: "m",
    });
    expect(embedder).toBeInstanceOf(PortalEmbedder);
    expect(DEFAULT_PORTAL_EMBED_BASE_URL).toBe("http://127.0.0.1:8645/v1");
  });

  it("requires CNS_BRAIN_EMBED_MODEL in portal mode", () => {
    expect(() => resolveBrainEmbedder({ [BRAIN_EMBEDDER_ENV]: "portal" })).toThrow(CnsError);
  });

  it("rejects unknown embedder mode", () => {
    expect(() => resolveBrainEmbedder({ [BRAIN_EMBEDDER_ENV]: "openai" })).toThrow(CnsError);
  });

  it("rejects invalid portal timeout", () => {
    expect(() =>
      resolveBrainEmbedder({
        [BRAIN_EMBEDDER_ENV]: "portal",
        [BRAIN_EMBED_MODEL_ENV]: "m",
        [BRAIN_EMBED_TIMEOUT_MS_ENV]: "0",
      }),
    ).toThrow(CnsError);
  });
});

describe("PortalEmbedder index + query integration", () => {
  it("builds index and queries with matching portal vectors (mocked fetch)", async () => {
    const { mkdir, mkdtemp, writeFile } = await import("node:fs/promises");
    const os = await import("node:os");
    const path = await import("node:path");
    const { runBuildIndex, writeBuildIndexArtifact } = await import("../../src/brain/build-index.js");
    const { loadBrainCorpusAllowlistFromVault } = await import("../../src/brain/load-corpus-allowlist.js");
    const { queryBrainIndex } = await import("../../src/brain/retrieval/query-index.js");

    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-portal-brain-"));
    const out = await mkdtemp(path.join(os.tmpdir(), "cns-portal-brain-out-"));
    const dir = path.join(vaultRoot, "_meta", "schemas");
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, "brain-corpus-allowlist.json"),
      JSON.stringify({ schema_version: 1, subtrees: ["notes"], inbox: { enabled: false } }),
      "utf8",
    );
    await mkdir(path.join(vaultRoot, "notes"), { recursive: true });
    await writeFile(
      path.join(vaultRoot, "notes", "alpha.md"),
      `---
pake_id: 11111111-1111-4111-8111-111111111111
pake_type: SourceNote
title: "Alpha"
created: 2026-01-01
---
Alpha semantic topic about vault recall.
`,
      "utf8",
    );
    await writeFile(
      path.join(vaultRoot, "notes", "beta.md"),
      `---
pake_id: 22222222-2222-4222-8222-222222222222
pake_type: SourceNote
title: "Beta"
created: 2026-01-01
---
Unrelated beta content.
`,
      "utf8",
    );

    const cache = new Map<string, number[]>();
    let dim = 0;
    const fetchFn = (async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { input: string };
      let vec = cache.get(body.input);
      if (!vec) {
        dim += 1;
        vec = Array.from({ length: 4 }, (_, i) => (dim + i) * 0.01);
        cache.set(body.input, vec);
      }
      return mockFetchOk(vec)(_url, init);
    }) as typeof fetch;

    const embedder = new PortalEmbedder({
      baseUrl: "http://127.0.0.1:8645/v1",
      modelId: "test-embed-model",
      fetchFn,
    });

    const al = await loadBrainCorpusAllowlistFromVault(vaultRoot);
    expect(al.ok).toBe(true);
    if (!al.ok) return;

    const run = await runBuildIndex(vaultRoot, al.value, embedder);
    expect(run.result.embedder.providerId).toBe("portal");
    expect(run.result.embedder.vectorDimension).toBe(4);
    expect(run.result.records.length).toBe(2);

    const indexPath = await writeBuildIndexArtifact(vaultRoot, out, run.result);

    const smokeQueries = ["vault recall semantic", "alpha topic", "beta unrelated"];
    for (const q of smokeQueries) {
      const result = await queryBrainIndex({
        indexPath,
        query: q,
        topK: 5,
        minScore: 0,
        includeScores: true,
        embedder,
      });
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0]?.path).toMatch(/notes\/.*\.md/);
      expect(typeof result.results[0]?.score).toBe("number");
    }
  });
});
