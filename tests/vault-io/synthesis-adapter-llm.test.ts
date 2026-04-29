import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLlmSynthesisAdapter } from "../../src/agents/synthesis-adapter-llm.js";
import type { SynthesisAdapterInput } from "../../src/agents/synthesis-agent.js";
import { DEFAULT_OPERATOR_CONTEXT } from "../../src/agents/operator-context.js";
import type { VaultContextPacket } from "../../src/agents/vault-context-builder.js";
import { CnsError } from "../../src/errors.js";

function makeAnthropicJsonResponse(bodyObj: unknown): Response {
  return new Response(
    JSON.stringify({
      content: [{ type: "text", text: JSON.stringify(bodyObj) }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function makeAnthropicTextResponse(rawAssistantText: string): Response {
  return new Response(
    JSON.stringify({
      content: [{ type: "text", text: rawAssistantText }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function makeAnthropicEnvelopeResponse(envelope: unknown): Response {
  return new Response(JSON.stringify(envelope), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const populatedPacket: VaultContextPacket = {
  notes: [
    {
      vault_path: "03-Resources/Operator-Profile.md",
      title: "Operator Profile",
      excerpt: "Chris is based in Sydney and operates solo.",
      retrieval_reason: "operator-profile",
      tags: ["operator"],
    },
    {
      vault_path: "03-Resources/agent-architectures-primer.md",
      title: "Agent Architectures Primer",
      excerpt: "ReAct-style agents combine reasoning with tool use.",
      retrieval_reason: "topic-match",
      tags: ["agents"],
    },
  ],
  total_notes: 2,
  token_budget_used: 0,
  retrieval_timestamp: "2026-04-22T00:00:00.000Z",
};

const emptyPacket: VaultContextPacket = {
  notes: [],
  total_notes: 0,
  token_budget_used: 0,
  retrieval_timestamp: "2026-04-22T00:00:00.000Z",
};

const noProfilePacket: VaultContextPacket = {
  notes: [
    {
      vault_path: "03-Resources/agent-architectures-primer.md",
      title: "Agent Architectures Primer",
      excerpt: "ReAct-style agents combine reasoning with tool use.",
      retrieval_reason: "topic-match",
      tags: ["agents"],
    },
  ],
  total_notes: 1,
  token_budget_used: 0,
  retrieval_timestamp: "2026-04-22T00:00:00.000Z",
};

const sampleInput: SynthesisAdapterInput = {
  topic: "AI agents",
  queries: ["what is an AI agent", "agent architectures"],
  source_notes: [
    {
      vault_path: "03-Resources/note-a.md",
      body: "Agents are systems that perceive and act.",
      frontmatter: { pake_id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" },
    },
    {
      vault_path: "03-Resources/note-b.md",
      body: "ReAct pattern combines reasoning with tool use.",
      frontmatter: {},
    },
  ],
  operator_context: DEFAULT_OPERATOR_CONTEXT,
  vault_context_packet: populatedPacket,
};

const sampleBodyMarkdown = [
  "> [!abstract]",
  "> Findings converge on agentic orchestration.",
  "",
  "## What We Know",
  "Agents connect perception to action through planning and tool use. See [[Operator-Profile]] for the operator context. The [[Agent-Architectures-Primer]] summarizes the field. Cross-check with [[Decision-Ledger]] for prior calls.",
  "",
  "> [!note] Signal vs Noise",
  "",
  "| Claim | Agree | Disagree | Implication |",
  "| --- | --- | --- | --- |",
  "| c1 | a1 | d1 | i1 |",
  "| c2 | a2 | d2 | i2 |",
  "| c3 | a3 | d3 | i3 |",
  "",
  "## The Gap Map",
  "",
  "| Known | Unknown | Why it matters |",
  "| --- | --- | --- |",
  "| k1 | u1 | w1 |",
  "| k2 | u2 | w2 |",
  "| k3 | u3 | w3 |",
  "| k4 | u4 | w4 |",
  "",
  "> [!warning] Blind Spots",
  "> Sources miss real-world durability.",
  "",
  "## Where Chris Has Leverage",
  "Chris operates from Sydney, Australia, positioned as a Creative Technologist. Both active tracks — Escape Job and Build Agency — give compounding leverage because the same research stream feeds both. Escape Job benefits from narrative proof; Build Agency benefits from demonstrated capability. Chris can ship public artefacts quickly which doubles as distribution for either track.",
  "",
  "> [!tip] Highest-Leverage Move",
  "> Ship a public weekly intelligence brief this Friday.",
  "",
  "## Connected Vault Notes",
  "",
  "| Note | Why relevant | Status |",
  "| --- | --- | --- |",
  "| [[Operator-Profile]] | context | active |",
  "| [[Agent-Architectures-Primer]] | primer | active |",
  "| [[Decision-Ledger]] | prior decisions | active |",
  "| [[Weekly-Brief-Template]] | format | active |",
  "| [[Distribution-Plan]] | channels | active |",
  "",
  "## Decisions Needed",
  "",
  "### Decision: pick architecture",
  "- **Option A:** ReAct loop",
  "- **Option B:** Planner-executor",
  "- **Downstream consequence:** affects latency vs reliability tradeoff",
  "",
  "### Decision: publish cadence",
  "- **Option A:** weekly",
  "- **Option B:** biweekly",
  "- **Downstream consequence:** pipeline pressure vs reach",
  "",
  "### Decision: distribution channel",
  "- **Option A:** LinkedIn",
  "- **Option B:** newsletter",
  "- **Downstream consequence:** audience fit",
  "",
  "### Decision: tooling stack",
  "- **Option A:** TS-only",
  "- **Option B:** polyglot",
  "- **Downstream consequence:** build speed",
  "",
  "## Open Questions",
  "1. Which retrieval strategy holds up at 100 notes?",
  "2. How is latency measured across adapters?",
  "3. What is the rollback path if a run corrupts the vault?",
  "",
  "## Version / Run Metadata",
  "",
  "| Date | Brief topic | Sources ingested | Queries run |",
  "| --- | --- | --- | --- |",
  "| 2026-04-22 | AI agents | 2 | 2 |",
].join("\n");

const validSynthesisOutput = {
  body: sampleBodyMarkdown,
  summary: "Agents converge on orchestration; Chris should ship a weekly brief.",
};

describe("createLlmSynthesisAdapter", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-api-key-xxxx";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  it("happy path: returns validated synthesis output and calls Anthropic API with required params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validSynthesisOutput));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();
    const result = await adapter.synthesize(sampleInput);

    expect(result).toEqual(validSynthesisOutput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-api-key-xxxx");
    expect(headers["anthropic-version"]).toBeDefined();
    expect(headers["content-type"]).toMatch(/application\/json/);

    const body = JSON.parse(init.body as string) as {
      model: string;
      max_tokens: number;
      system: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("claude-sonnet-4-6");
    expect(body.max_tokens).toBe(8000);
    expect(typeof body.system).toBe("string");
    expect(body.system).toContain("Chris Taylor");
    expect(body.system).toContain("Sydney");
    expect(body.system.toLowerCase()).toContain("json");

    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");

    const userText = body.messages[0].content;
    expect(userText).toContain("AI agents");
    expect(userText).toContain("what is an AI agent");
    expect(userText).toContain("agent architectures");
    expect(userText).toContain("03-Resources/note-a.md");
    expect(userText).toContain("03-Resources/note-b.md");
    expect(userText).toContain("Agents are systems that perceive and act.");
    expect(userText).toContain("ReAct pattern combines reasoning with tool use.");
    // Operator context
    expect(userText).toContain("Chris Taylor");
    expect(userText).toContain("Sydney");
    expect(userText).toContain("Creative Technologist");
    // Track names verbatim
    expect(userText).toContain("Escape Job");
    expect(userText).toContain("Build Agency");
    // PAKE++ section minimums mentioned
    expect(userText).toContain("What We Know");
    expect(userText).toContain("Contradiction Ledger");
    expect(userText).toContain("Gap Map");
    expect(userText).toContain("Where Chris Has Leverage");
    expect(userText).toContain("Decisions Needed");
    expect(userText).toContain("Connected Vault Notes");
    expect(userText).toContain("Version / Run Metadata");
    // Response contract
    expect(userText).toContain('"body"');
    expect(userText).toContain('"summary"');
    // Abstract written last rule
    expect(userText).toContain("Write the `[!abstract]` callout last");
  });

  it("includes vault context block when packet has notes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validSynthesisOutput));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();
    await adapter.synthesize(sampleInput);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      messages: Array<{ content: string }>;
    };
    const userText = body.messages[0].content;

    expect(userText).toContain("=== Vault Context ===");
    expect(userText).toContain("03-Resources/Operator-Profile.md");
    expect(userText).toContain("Operator Profile");
    expect(userText).toContain("Chris is based in Sydney and operates solo.");
    expect(userText).toContain("retrieval_reason: operator-profile");
    expect(userText).toContain("retrieval_reason: topic-match");
  });

  it("empty vault_context_packet: prompt includes 'no vault context' instruction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validSynthesisOutput));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();
    await adapter.synthesize({ ...sampleInput, vault_context_packet: emptyPacket });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      messages: Array<{ content: string }>;
    };
    const userText = body.messages[0].content;

    expect(userText).toContain("no vault context found");
    expect(userText).toContain(
      "> [!warning] No vault context found — this synthesis is grounded in external research only.",
    );
  });

  it("missing operator-profile note: prompt includes no-vault warning instruction even with topic notes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validSynthesisOutput));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();
    await adapter.synthesize({ ...sampleInput, vault_context_packet: noProfilePacket });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      messages: Array<{ content: string }>;
    };
    const userText = body.messages[0].content;

    expect(userText).toContain("operator profile note missing");
    expect(userText).toContain("03-Resources/agent-architectures-primer.md");
    expect(userText).toContain(
      "> [!warning] No vault context found — this synthesis is grounded in external research only.",
    );
  });

  it("fetch rejects: throws CnsError IO_ERROR", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();

    await expect(adapter.synthesize(sampleInput)).rejects.toMatchObject({
      name: "CnsError",
      code: "IO_ERROR",
    });
  });

  it("env var missing: throws CnsError IO_ERROR", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const adapter = createLlmSynthesisAdapter();

    await expect(adapter.synthesize(sampleInput)).rejects.toMatchObject({
      name: "CnsError",
      code: "IO_ERROR",
    });
  });

  it("env var whitespace only: throws CnsError IO_ERROR", async () => {
    process.env.ANTHROPIC_API_KEY = "   ";
    const adapter = createLlmSynthesisAdapter();

    await expect(adapter.synthesize(sampleInput)).rejects.toMatchObject({
      name: "CnsError",
      code: "IO_ERROR",
    });
  });

  it("non-2xx response: throws CnsError IO_ERROR", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad key" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();

    await expect(adapter.synthesize(sampleInput)).rejects.toMatchObject({
      name: "CnsError",
      code: "IO_ERROR",
    });
  });

  it("missing assistant content text in envelope: throws CnsError IO_ERROR", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeAnthropicEnvelopeResponse({ content: [{ type: "tool_use", id: "x" }] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();

    await expect(adapter.synthesize(sampleInput)).rejects.toMatchObject({
      name: "CnsError",
      code: "IO_ERROR",
    });
  });

  it("assistant content split across multiple text blocks: concatenates and parses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeAnthropicEnvelopeResponse({
        content: [
          { type: "text", text: '{"body":"# partial' },
          { type: "text", text: ' body","summary":"s"}' },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();
    const result = await adapter.synthesize(sampleInput);
    expect(result).toEqual({ body: "# partial body", summary: "s" });
  });

  it("non-JSON response text: throws CnsError IO_ERROR with specific message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeAnthropicTextResponse("not-a-json-object-at-all"));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();

    const err = await adapter.synthesize(sampleInput).catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("IO_ERROR");
    expect((err as CnsError).message).toBe(
      "Synthesis LLM returned non-JSON response",
    );
  });

  it("zod schema invalid: returns JSON missing summary -> throws CnsError SCHEMA_INVALID", async () => {
    const invalidOutput = { body: "# something" };
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(invalidOutput));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();

    const err = await adapter.synthesize(sampleInput).catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("SCHEMA_INVALID");
    expect((err as CnsError).message.length).toBeGreaterThan(0);
  });

  it("zod schema invalid: empty body -> throws CnsError SCHEMA_INVALID", async () => {
    const invalidOutput = { body: "", summary: "s" };
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(invalidOutput));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();

    const err = await adapter.synthesize(sampleInput).catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("SCHEMA_INVALID");
  });

  it("empty source_notes: still calls API and resolves", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validSynthesisOutput));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();
    const result = await adapter.synthesize({
      topic: "empty-sources-topic",
      queries: ["q1"],
      source_notes: [],
      operator_context: DEFAULT_OPERATOR_CONTEXT,
      vault_context_packet: emptyPacket,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(validSynthesisOutput);
  });

  it("caps source_notes at 8 and truncates each body to 600 chars before concat", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validSynthesisOutput));
    vi.stubGlobal("fetch", fetchMock);

    const longBody = "x".repeat(2000);
    const notes = Array.from({ length: 12 }, (_, i) => ({
      vault_path: `03-Resources/note-${i}.md`,
      body: longBody,
      frontmatter: {},
    }));

    const adapter = createLlmSynthesisAdapter();
    await adapter.synthesize({
      topic: "capping",
      queries: [],
      source_notes: notes,
      operator_context: DEFAULT_OPERATOR_CONTEXT,
      vault_context_packet: emptyPacket,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      messages: Array<{ content: string }>;
    };
    const userText = body.messages[0].content;

    // Only first 8 included
    for (let i = 0; i < 8; i++) {
      expect(userText).toContain(`03-Resources/note-${i}.md`);
    }
    expect(userText).not.toContain("03-Resources/note-8.md");
    expect(userText).not.toContain("03-Resources/note-11.md");

    // Each included body truncated to 600 chars (not 2000)
    expect(userText).not.toContain("x".repeat(601));
    expect(userText).toContain("x".repeat(600));
  });

  it("429 then 200: retries once with clamped sleep and resolves with exactly 2 fetch calls", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { retry_after: 7 } }), {
            status: 429,
            headers: { "content-type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(makeAnthropicJsonResponse(validSynthesisOutput));
      vi.stubGlobal("fetch", fetchMock);

      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      const adapter = createLlmSynthesisAdapter();
      const promise = adapter.synthesize(sampleInput);

      // Advance past retry-after (clamped to min 5s -> 7s used as-is)
      await vi.advanceTimersByTimeAsync(7_000);

      const result = await promise;
      expect(result).toEqual(validSynthesisOutput);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // Verify clamp: sleep was exactly 7000ms (in [5000, 120000])
      const sleepCall = setTimeoutSpy.mock.calls.find(
        (c) => typeof c[1] === "number" && c[1] >= 5_000 && c[1] <= 120_000,
      );
      expect(sleepCall).toBeDefined();
      expect(sleepCall![1]).toBe(7_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("3 consecutive 429s: throws CnsError with synthesis-specific rate-limit message", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { retry_after: 5 } }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const adapter = createLlmSynthesisAdapter();
      const promise = adapter.synthesize(sampleInput).catch((e) => e);

      await vi.advanceTimersByTimeAsync(5_000);
      await vi.advanceTimersByTimeAsync(5_000);

      const err = (await promise) as CnsError;
      expect(err).toBeInstanceOf(CnsError);
      expect(err.code).toBe("IO_ERROR");
      expect(err.message).toBe(
        "Synthesis API rate limited after 3 attempts",
      );
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
