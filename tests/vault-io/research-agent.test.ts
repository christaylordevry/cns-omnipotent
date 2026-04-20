import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  runResearchAgent,
  researchBriefSchema,
  researchSweepResultSchema,
  firecrawlSweep,
  apifySweep,
  firecrawlQueryAdapterFailureUri,
  apifyQueryAdapterFailureUri,
  perplexityAnswerSourceUri,
  type ApifyAdapter,
  type FirecrawlAdapter,
  type ResearchBrief,
} from "../../src/agents/research-agent.js";
import { createPerplexitySlot, type PerplexitySlot } from "../../src/agents/perplexity-slot.js";
import { CnsError } from "../../src/errors.js";

async function makeVault(): Promise<string> {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-research-"));
  await mkdir(path.join(vaultRoot, "00-Inbox"), { recursive: true });
  await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
  await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
  return vaultRoot;
}

const LONG_BODY = "x".repeat(220);

function validBrief(overrides: Partial<ResearchBrief> = {}): ResearchBrief {
  return {
    topic: "AI agents",
    queries: ["what is an AI agent"],
    depth: "standard",
    ...overrides,
  };
}

function makeFirecrawl(behavior: {
  search?: (query: string) => ReturnType<FirecrawlAdapter["search"]>;
  scrape?: (url: string) => ReturnType<FirecrawlAdapter["scrape"]>;
}): FirecrawlAdapter {
  return {
    search: behavior.search ?? (async () => []),
    scrape: behavior.scrape ?? (async (url) => ({ markdown: `# Scraped\n\nFrom ${url}` })),
  };
}

function makeApify(behavior: {
  ragWebBrowser?: (query: string) => ReturnType<ApifyAdapter["ragWebBrowser"]>;
}): ApifyAdapter {
  return {
    ragWebBrowser: behavior.ragWebBrowser ?? (async () => []),
  };
}

function makeAvailablePerplexity(search?: (q: string) => Promise<never>): PerplexitySlot {
  return {
    available: true,
    search:
      search ??
      (async () => {
        throw new CnsError("UNSUPPORTED", "stub");
      }),
  };
}

// ── AC: brief ───────────────────────────────────────────────────────────────

describe("AC: brief — schema validation", () => {
  it("accepts a valid brief", () => {
    const parsed = researchBriefSchema.parse({
      topic: "x",
      queries: ["q1"],
      depth: "standard",
    });
    expect(parsed.topic).toBe("x");
  });

  it("defaults depth to deep when omitted", () => {
    const parsed = researchBriefSchema.parse({
      topic: "x",
      queries: ["q1"],
    });
    expect(parsed.depth).toBe("deep");
  });

  it("rejects empty queries array", () => {
    expect(() =>
      researchBriefSchema.parse({ topic: "x", queries: [], depth: "standard" }),
    ).toThrow();
  });

  it("rejects more than 10 queries", () => {
    expect(() =>
      researchBriefSchema.parse({
        topic: "x",
        queries: Array(11).fill("q"),
        depth: "standard",
      }),
    ).toThrow();
  });

  it("rejects empty topic", () => {
    expect(() =>
      researchBriefSchema.parse({ topic: "", queries: ["q"], depth: "standard" }),
    ).toThrow();
  });

  it("rejects invalid depth", () => {
    expect(() =>
      researchBriefSchema.parse({ topic: "x", queries: ["q"], depth: "bogus" }),
    ).toThrow();
  });

  it("fails fast on invalid brief before any MCP call", async () => {
    const vaultRoot = await makeVault();
    let firecrawlCalled = false;
    const fc = makeFirecrawl({
      search: async () => {
        firecrawlCalled = true;
        return [];
      },
    });
    await expect(
      runResearchAgent(
        vaultRoot,
        { topic: "", queries: [], depth: "standard" } as unknown as ResearchBrief,
        { adapters: { firecrawl: fc } },
      ),
    ).rejects.toThrow();
    expect(firecrawlCalled).toBe(false);
  });
});

// ── AC: firecrawl ───────────────────────────────────────────────────────────

describe("AC: firecrawl — search + scrape + ingest", () => {
  it("calls firecrawl_search per query and ingests results as URL SourceNotes", async () => {
    const vaultRoot = await makeVault();
    let searchCalls = 0;
    const fc = makeFirecrawl({
      search: async (query) => {
        searchCalls++;
        return [
          {
            url: `https://example.com/${encodeURIComponent(query)}/1`,
            title: `Title ${query}`,
            snippet: `# Title ${query}\n\n${LONG_BODY}`,
          },
        ];
      },
    });

    const result = await runResearchAgent(
      vaultRoot,
      validBrief({ queries: ["alpha", "beta"], depth: "standard" }),
      { adapters: { firecrawl: fc } },
    );

    expect(searchCalls).toBe(2);
    expect(result.notes_created.length).toBe(2);
    expect(result.notes_created.every((n) => n.source === "firecrawl")).toBe(true);
    expect(result.notes_created[0].vault_path).toMatch(/^03-Resources\//);
  });

  it("skips short firecrawl bodies via quality gate", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async () => [{ url: "https://example.com/short", title: "S", snippet: "too short" }],
    });

    const result = await runResearchAgent(
      vaultRoot,
      validBrief({ queries: ["q"], depth: "standard" }),
      { adapters: { firecrawl: fc } },
    );

    expect(result.notes_created.length).toBe(0);
    expect(result.notes_skipped).toEqual([
      { source_uri: "https://example.com/short", reason: "quality_gate" },
    ]);
  });

  it("caps firecrawl results at 5 per query for standard depth", async () => {
    const vaultRoot = await makeVault();
    let receivedLimit = 0;
    const fc = makeFirecrawl({
      search: async (_q, { limit }) => {
        receivedLimit = limit;
        return [];
      },
    });

    await runResearchAgent(vaultRoot, validBrief({ depth: "standard" }), {
      adapters: { firecrawl: fc },
    });

    expect(receivedLimit).toBe(5);
  });

  it("caps firecrawl results at 2 per query for shallow depth", async () => {
    const vaultRoot = await makeVault();
    let receivedLimit = 0;
    const fc = makeFirecrawl({
      search: async (_q, { limit }) => {
        receivedLimit = limit;
        return [];
      },
    });

    await runResearchAgent(vaultRoot, validBrief({ depth: "shallow" }), {
      adapters: { firecrawl: fc },
    });

    expect(receivedLimit).toBe(2);
  });

  it("calls firecrawl_scrape only in deep mode", async () => {
    const vaultRoot = await makeVault();
    let scrapeCalls = 0;
    const fc = makeFirecrawl({
      search: async () => [{ url: "https://example.com/a", title: "A", snippet: LONG_BODY }],
      scrape: async (url) => {
        scrapeCalls++;
        return { markdown: `# Deep\n\n${LONG_BODY}\n\nFrom ${url}` };
      },
    });

    await runResearchAgent(vaultRoot, validBrief({ queries: ["q"], depth: "deep" }), {
      adapters: { firecrawl: fc },
    });
    expect(scrapeCalls).toBe(1);

    scrapeCalls = 0;
    const vault2 = await makeVault();
    await runResearchAgent(vault2, validBrief({ queries: ["q"], depth: "standard" }), {
      adapters: { firecrawl: fc },
    });
    expect(scrapeCalls).toBe(0);
  });

  it("continues sweep when a single scrape fails", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async () => [
        { url: "https://example.com/good", title: "Good", snippet: LONG_BODY },
        { url: "https://example.com/bad", title: "Bad", snippet: LONG_BODY },
      ],
      scrape: async (url) => {
        if (url.endsWith("/bad")) throw new Error("scrape failed");
        return { markdown: `# Good\n\n${LONG_BODY}` };
      },
    });

    const result = await runResearchAgent(
      vaultRoot,
      validBrief({ queries: ["q"], depth: "deep" }),
      { adapters: { firecrawl: fc } },
    );

    expect(result.notes_created.length).toBe(1);
    expect(result.notes_skipped.length).toBe(1);
    expect(result.notes_skipped[0].reason).toBe("fetch_error");
  });

  it("continues sweep when firecrawl_search throws for one query", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async (query) => {
        if (query === "bad") throw new Error("search failed");
        return [{ url: `https://example.com/${query}`, title: query, snippet: LONG_BODY }];
      },
    });

    const result = await runResearchAgent(
      vaultRoot,
      validBrief({ queries: ["good", "bad"], depth: "standard" }),
      { adapters: { firecrawl: fc } },
    );

    expect(result.notes_created.length).toBe(1);
    expect(result.notes_created[0].source_uri).toBe("https://example.com/good");
    expect(result.notes_skipped).toEqual([
      { source_uri: firecrawlQueryAdapterFailureUri("bad"), reason: "fetch_error" },
    ]);
  });
});

// ── AC: apify ───────────────────────────────────────────────────────────────

describe("AC: apify — rag-web-browser + ingest", () => {
  it("calls apify.ragWebBrowser per query and ingests URL snippets", async () => {
    const vaultRoot = await makeVault();
    let ragCalls = 0;
    const apify = makeApify({
      ragWebBrowser: async (query) => {
        ragCalls++;
        return [
          {
            url: `https://apify.example/${encodeURIComponent(query)}`,
            title: `Apify ${query}`,
            text: `# ${query}\n\n${LONG_BODY}`,
          },
        ];
      },
    });

    const result = await runResearchAgent(
      vaultRoot,
      validBrief({ queries: ["alpha", "beta"], depth: "standard" }),
      { adapters: { apify } },
    );

    expect(ragCalls).toBe(2);
    expect(result.notes_created.length).toBe(2);
    expect(result.notes_created.every((n) => n.source === "apify")).toBe(true);
  });

  it("skips short apify bodies via quality gate", async () => {
    const vaultRoot = await makeVault();
    const apify = makeApify({
      ragWebBrowser: async (query) => [{ url: `https://apify.example/${query}`, text: "too short" }],
    });

    const result = await runResearchAgent(vaultRoot, validBrief({ queries: ["q"], depth: "standard" }), {
      adapters: { apify },
    });

    expect(result.notes_created.length).toBe(0);
    expect(result.notes_skipped).toEqual([
      { source_uri: "https://apify.example/q", reason: "quality_gate" },
    ]);
  });

  it("continues apify sweep when one query throws", async () => {
    const vaultRoot = await makeVault();
    const apify = makeApify({
      ragWebBrowser: async (query) => {
        if (query === "bad") throw new Error("apify broke");
        return [{ url: `https://apify.example/${query}`, text: `# ${query}\n\n${LONG_BODY}` }];
      },
    });

    const result = await runResearchAgent(
      vaultRoot,
      validBrief({ queries: ["good", "bad"], depth: "standard" }),
      { adapters: { apify } },
    );

    expect(result.notes_created.length).toBe(1);
    expect(result.notes_created[0].source).toBe("apify");
    expect(result.notes_skipped).toEqual([
      { source_uri: apifyQueryAdapterFailureUri("bad"), reason: "fetch_error" },
    ]);
  });
});

// ── AC: perplexity-stub ──────────────────────────────────────────────────────

describe("AC: perplexity-stub — graceful degradation", () => {
  it("createPerplexitySlot is unavailable when PERPLEXITY_API_KEY is missing", () => {
    const saved = process.env.PERPLEXITY_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    try {
      const slot = createPerplexitySlot();
      expect(slot.available).toBe(false);
    } finally {
      if (saved !== undefined) process.env.PERPLEXITY_API_KEY = saved;
    }
  });

  it("slot.search throws UNSUPPORTED when unavailable", async () => {
    const saved = process.env.PERPLEXITY_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    try {
      const slot = createPerplexitySlot();
      await expect(slot.search("q")).rejects.toMatchObject({ code: "UNSUPPORTED" });
    } finally {
      if (saved !== undefined) process.env.PERPLEXITY_API_KEY = saved;
    }
  });

  it("orchestrator sets perplexity_skipped=true when key missing", async () => {
    const saved = process.env.PERPLEXITY_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    try {
      const vaultRoot = await makeVault();
      const result = await runResearchAgent(vaultRoot, validBrief(), {
        adapters: {
          firecrawl: makeFirecrawl({
            search: async () => [{ url: "https://example.com/a", title: "A", snippet: LONG_BODY }],
          }),
        },
      });
      expect(result.perplexity_skipped).toBe(true);
    } finally {
      if (saved !== undefined) process.env.PERPLEXITY_API_KEY = saved;
    }
  });

  it("orchestrator sets perplexity_skipped=true when slot throws (stub)", async () => {
    const vaultRoot = await makeVault();
    const perplexity = makeAvailablePerplexity();
    const result = await runResearchAgent(vaultRoot, validBrief(), {
      adapters: { perplexity },
    });
    expect(result.perplexity_skipped).toBe(true);
    expect(result.perplexity_answers_filed).toBe(0);
  });

  it("orchestrator sets perplexity_skipped=false when slot succeeds", async () => {
    const vaultRoot = await makeVault();
    const perplexity: PerplexitySlot = {
      available: true,
      async search() {
        return { answer: "Real answer", citations: [] };
      },
    };
    const result = await runResearchAgent(vaultRoot, validBrief(), {
      adapters: { perplexity },
    });
    expect(result.perplexity_skipped).toBe(false);
    expect(result.perplexity_answers_filed).toBe(1);
    expect(result.notes_created.filter((n) => n.source === "perplexity").length).toBe(1);
  });

  it("orchestrator does not throw when perplexity is unavailable", async () => {
    const vaultRoot = await makeVault();
    const saved = process.env.PERPLEXITY_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    try {
      await expect(runResearchAgent(vaultRoot, validBrief())).resolves.toBeTruthy();
    } finally {
      if (saved !== undefined) process.env.PERPLEXITY_API_KEY = saved;
    }
  });
});

// ── AC: vault-notes ─────────────────────────────────────────────────────────

describe("AC: vault-notes — created via ingest pipeline as SourceNotes", () => {
  it("creates SourceNote with topic tag and research-sweep tag", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async () => [
        { url: "https://example.com/tag-test", title: "Tag Test", snippet: `# Tag Test\n\n${LONG_BODY}` },
      ],
    });

    const result = await runResearchAgent(
      vaultRoot,
      validBrief({ topic: "hooks", queries: ["copywriting hooks"], tags: ["insight"] }),
      { adapters: { firecrawl: fc } },
    );

    expect(result.notes_created.length).toBe(1);
    const noteAbs = path.join(vaultRoot, ...result.notes_created[0].vault_path.split("/"));
    const body = await readFile(noteAbs, "utf8");
    expect(body).toContain("pake_type: SourceNote");
    expect(body).toContain("hooks");
    expect(body).toContain("research-sweep");
    expect(body).toContain("insight");
    expect(body).toContain("copywriting hooks");
    expect(body).toContain("https://example.com/tag-test");
  });
});

// ── AC: manifest ────────────────────────────────────────────────────────────

describe("AC: manifest — ResearchSweepResult shape", () => {
  it("returns complete manifest with timestamp and counts", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async () => [{ url: "https://example.com/m", title: "M", snippet: LONG_BODY }],
    });
    const apify = makeApify({
      ragWebBrowser: async () => [{ url: "https://apify.example/m", text: `# Apify\n\n${LONG_BODY}` }],
    });

    const result = await runResearchAgent(
      vaultRoot,
      validBrief({ topic: "manifest-topic" }),
      { adapters: { firecrawl: fc, apify } },
    );

    expect(result.brief_topic).toBe("manifest-topic");
    expect(Array.isArray(result.notes_created)).toBe(true);
    expect(Array.isArray(result.notes_skipped)).toBe(true);
    expect(typeof result.perplexity_skipped).toBe("boolean");
    expect(typeof result.perplexity_answers_filed).toBe("number");
    expect(result.sweep_timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(result.notes_created.length).toBe(2);
    expect(researchSweepResultSchema.safeParse(result).success).toBe(true);
  });

  it("notes_created entries include vault_path, pake_id, source_uri, source", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async () => [{ url: "https://example.com/shape", title: "S", snippet: LONG_BODY }],
    });
    const result = await runResearchAgent(vaultRoot, validBrief(), {
      adapters: { firecrawl: fc },
    });
    const created = result.notes_created[0];
    expect(created.vault_path).toMatch(/^03-Resources\//);
    expect(created.pake_id).toMatch(/[0-9a-f-]{36}/i);
    expect(created.source_uri).toBe("https://example.com/shape");
    expect(created.source).toBe("firecrawl");
  });
});

// ── AC: audit ───────────────────────────────────────────────────────────────

describe("AC: audit — one sweep-level record + per-note ingest records", () => {
  it("emits one research_sweep audit line", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async () => [{ url: "https://example.com/audit", title: "A", snippet: LONG_BODY }],
    });

    const result = await runResearchAgent(vaultRoot, validBrief(), {
      adapters: { firecrawl: fc },
    });

    const auditAbs = path.join(vaultRoot, "_meta", "logs", "agent-log.md");
    const logBody = await readFile(auditAbs, "utf8");
    const sweepLines = logBody.split("\n").filter((l) => l.includes("research_sweep"));
    expect(sweepLines.length).toBe(1);
    expect(sweepLines[0]).toContain("research_agent");
    expect(sweepLines[0]).toContain(result.notes_created[0].vault_path);
  });

  it("sweep audit uses no-notes-created target when sweep produces zero notes", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({ search: async () => [] });
    await runResearchAgent(vaultRoot, validBrief(), { adapters: { firecrawl: fc } });

    const logBody = await readFile(path.join(vaultRoot, "_meta", "logs", "agent-log.md"), "utf8");
    expect(logBody).toContain("research_sweep");
    expect(logBody).toContain("no-notes-created");
  });

  it("per-note ingest audit lines are still emitted by the pipeline", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async () => [{ url: "https://example.com/per-note", title: "P", snippet: LONG_BODY }],
    });
    await runResearchAgent(vaultRoot, validBrief(), { adapters: { firecrawl: fc } });

    const logBody = await readFile(path.join(vaultRoot, "_meta", "logs", "agent-log.md"), "utf8");
    expect(logBody).toContain("ingest");
    expect(logBody).toContain("ingest_pipeline");
  });
});

// ── AC: tests — composite scenarios ─────────────────────────────────────────

describe("AC: tests — composite scenarios", () => {
  it("happy path: Firecrawl + Apify both succeed", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async (q) => [
        { url: `https://fc.example/${q}`, title: `FC ${q}`, snippet: `# FC ${q}\n\n${LONG_BODY}` },
      ],
    });
    const apify = makeApify({
      ragWebBrowser: async (q) => [
        { url: `https://ap.example/${q}`, title: `AP ${q}`, text: `# AP ${q}\n\n${LONG_BODY}` },
      ],
    });

    const result = await runResearchAgent(
      vaultRoot,
      validBrief({ queries: ["x", "y"] }),
      { adapters: { firecrawl: fc, apify } },
    );

    expect(result.notes_created.length).toBe(4);
    expect(result.notes_created.filter((n) => n.source === "firecrawl").length).toBe(2);
    expect(result.notes_created.filter((n) => n.source === "apify").length).toBe(2);
    expect(result.perplexity_answers_filed).toBe(0);
  });

  it("Firecrawl succeeds, Apify adapter throws for all queries", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async () => [{ url: "https://fc.example/a", title: "A", snippet: LONG_BODY }],
    });
    const apify = makeApify({
      ragWebBrowser: async () => {
        throw new Error("apify down");
      },
    });

    const result = await runResearchAgent(vaultRoot, validBrief(), {
      adapters: { firecrawl: fc, apify },
    });

    expect(result.notes_created.length).toBe(1);
    expect(result.notes_created[0].source).toBe("firecrawl");
    expect(result.notes_skipped).toEqual([
      { source_uri: apifyQueryAdapterFailureUri("what is an AI agent"), reason: "fetch_error" },
    ]);
  });

  it("duplicate source_uri is suppressed on second sweep", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async () => [{ url: "https://example.com/dupe", title: "D", snippet: LONG_BODY }],
    });

    const first = await runResearchAgent(vaultRoot, validBrief(), { adapters: { firecrawl: fc } });
    expect(first.notes_created.length).toBe(1);

    const second = await runResearchAgent(vaultRoot, validBrief(), { adapters: { firecrawl: fc } });
    expect(second.notes_created.length).toBe(0);
    expect(second.notes_skipped.length).toBe(1);
    expect(second.notes_skipped[0].reason).toBe("duplicate");
    expect(second.notes_skipped[0].source_uri).toBe("https://example.com/dupe");
  });

  it("all-fail sweep returns empty manifest without throwing", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async () => {
        throw new Error("down");
      },
    });
    const apify = makeApify({
      ragWebBrowser: async () => {
        throw new Error("also down");
      },
    });

    const result = await runResearchAgent(vaultRoot, validBrief(), {
      adapters: { firecrawl: fc, apify },
    });

    expect(result.notes_created).toEqual([]);
    expect(result.notes_skipped).toEqual([
      { source_uri: firecrawlQueryAdapterFailureUri("what is an AI agent"), reason: "fetch_error" },
      { source_uri: apifyQueryAdapterFailureUri("what is an AI agent"), reason: "fetch_error" },
    ]);
  });

  it("firecrawlSweep and apifySweep can be called independently", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async () => [{ url: "https://fc.example/solo", title: "Solo", snippet: LONG_BODY }],
    });

    const direct = await firecrawlSweep(vaultRoot, validBrief(), fc, {
      surface: "unit-test",
      profile: { firecrawlLimit: 5, firecrawlScrape: false, apifyLimit: 5 },
    });

    expect(direct.created.length).toBe(1);
    expect(direct.created[0].source).toBe("firecrawl");

    const vault2 = await makeVault();
    const apify = makeApify({
      ragWebBrowser: async () => [{ url: "https://ap.example/solo", text: `# Solo\n\n${LONG_BODY}` }],
    });
    const directApify = await apifySweep(vault2, validBrief(), apify, {
      surface: "unit-test",
      profile: { firecrawlLimit: 5, firecrawlScrape: false, apifyLimit: 5 },
    });

    expect(directApify.created.length).toBe(1);
    expect(directApify.created[0].source).toBe("apify");
  });
});

// ── AC: answer-filing (17-6) ────────────────────────────────────────────────

describe("AC: answer-filing — Perplexity answers via runIngestPipeline", () => {
  it("does not file answers when perplexity probe skips", async () => {
    const vaultRoot = await makeVault();
    const perplexity = makeAvailablePerplexity();
    const result = await runResearchAgent(vaultRoot, validBrief(), { adapters: { perplexity } });
    expect(result.perplexity_skipped).toBe(true);
    expect(result.perplexity_answers_filed).toBe(0);
    expect(result.notes_created.filter((n) => n.source === "perplexity")).toEqual([]);
  });

  it("files InsightNote when one sweep source matches citations", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async () => [
        { url: "https://example.com/only-one", title: "O", snippet: LONG_BODY },
      ],
    });
    const perplexity: PerplexitySlot = {
      available: true,
      async search() {
        return {
          answer: "Synthesised from one hit.",
          citations: ["https://example.com/only-one"],
        };
      },
    };
    const result = await runResearchAgent(vaultRoot, validBrief(), {
      adapters: { firecrawl: fc, perplexity },
    });
    expect(result.perplexity_answers_filed).toBe(1);
    const pNote = result.notes_created.find((n) => n.source === "perplexity");
    expect(pNote).toBeDefined();
    const raw = await readFile(path.join(vaultRoot, ...pNote!.vault_path.split("/")), "utf8");
    expect(raw).toContain("pake_type: InsightNote");
    expect(raw).toContain("## Linked vault sources");
    expect(raw).toMatch(/\[\[[^\]]+\]\]/);
  });

  it("files SynthesisNote when two distinct sweep SourceNotes match citations", async () => {
    const vaultRoot = await makeVault();
    const fc = makeFirecrawl({
      search: async () => [
        { url: "https://example.com/a", title: "A", snippet: LONG_BODY },
        { url: "https://example.com/b", title: "B", snippet: LONG_BODY },
      ],
    });
    const perplexity: PerplexitySlot = {
      available: true,
      async search() {
        return {
          answer: "Cross-cutting answer.",
          citations: ["https://example.com/a", "https://example.com/b"],
        };
      },
    };
    const result = await runResearchAgent(vaultRoot, validBrief({ queries: ["single-query"] }), {
      adapters: { firecrawl: fc, perplexity },
    });
    expect(result.perplexity_answers_filed).toBe(1);
    const pNote = result.notes_created.find((n) => n.source === "perplexity");
    expect(pNote).toBeDefined();
    const raw = await readFile(path.join(vaultRoot, ...pNote!.vault_path.split("/")), "utf8");
    expect(raw).toContain("pake_type: SynthesisNote");
  });

  it("includes perplexity_answers_filed in research_sweep audit payload", async () => {
    const vaultRoot = await makeVault();
    const perplexity: PerplexitySlot = {
      available: true,
      async search() {
        return { answer: "Audited answer.", citations: [] };
      },
    };
    await runResearchAgent(vaultRoot, validBrief(), { adapters: { perplexity } });
    const logBody = await readFile(path.join(vaultRoot, "_meta", "logs", "agent-log.md"), "utf8");
    expect(logBody).toContain("perplexity_answers_filed");
  });

  it("second sweep surfaces duplicate for same Perplexity provenance_uri", async () => {
    const vaultRoot = await makeVault();
    const perplexity: PerplexitySlot = {
      available: true,
      async search() {
        return { answer: "Stable answer.", citations: [] };
      },
    };
    const first = await runResearchAgent(vaultRoot, validBrief(), { adapters: { perplexity } });
    expect(first.perplexity_answers_filed).toBe(1);
    const second = await runResearchAgent(vaultRoot, validBrief(), { adapters: { perplexity } });
    expect(second.perplexity_answers_filed).toBe(0);
    expect(
      second.notes_skipped.some(
        (s) =>
          s.reason === "duplicate" &&
          s.source_uri === perplexityAnswerSourceUri(validBrief().queries[0]),
      ),
    ).toBe(true);
  });

  it("whitespace-only answers do not ingest", async () => {
    const vaultRoot = await makeVault();
    const perplexity: PerplexitySlot = {
      available: true,
      async search() {
        return { answer: "   \n\t  ", citations: [] };
      },
    };
    const result = await runResearchAgent(vaultRoot, validBrief(), { adapters: { perplexity } });
    expect(result.perplexity_answers_filed).toBe(0);
  });

  it("per-query search throw records fetch_error without blocking other queries", async () => {
    const vaultRoot = await makeVault();
    const perplexity: PerplexitySlot = {
      available: true,
      async search(q) {
        if (q === "second") throw new CnsError("UNSUPPORTED", "simulated failure");
        return { answer: `Answer for ${q}`, citations: [] };
      },
    };
    const result = await runResearchAgent(
      vaultRoot,
      validBrief({ queries: ["first", "second"] }),
      { adapters: { perplexity } },
    );
    expect(result.perplexity_answers_filed).toBe(1);
    expect(result.notes_skipped.some((s) => s.reason === "fetch_error")).toBe(true);
  });
});
