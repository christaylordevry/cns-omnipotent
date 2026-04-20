import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLlmSynthesisAdapter } from "../../src/agents/synthesis-adapter-llm.js";
import type { SynthesisAdapterInput } from "../../src/agents/synthesis-agent.js";
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
};

const validSynthesisOutput = {
  patterns: ["pattern 1", "pattern 2"],
  gaps: ["gap 1"],
  opportunities: ["opp 1"],
  summary: "A concise executive summary of the research.",
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
    expect(body.max_tokens).toBe(1000);
    expect(typeof body.system).toBe("string");
    expect(body.system.toLowerCase()).toContain("marketing");
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
    expect(userText.toLowerCase()).toContain("patterns");
    expect(userText.toLowerCase()).toContain("gaps");
    expect(userText.toLowerCase()).toContain("opportunities");
    expect(userText.toLowerCase()).toContain("summary");
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
          { type: "text", text: "{\"patterns\":[\"p\"],\"gaps\":[" },
          { type: "text", text: "\"g\"],\"opportunities\":[\"o\"],\"summary\":\"s\"}" },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();
    const result = await adapter.synthesize(sampleInput);
    expect(result).toEqual({
      patterns: ["p"],
      gaps: ["g"],
      opportunities: ["o"],
      summary: "s",
    });
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
    const invalidOutput = {
      patterns: ["pattern 1"],
      gaps: ["gap 1"],
      opportunities: ["opp 1"],
    };
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(invalidOutput));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();

    const err = await adapter.synthesize(sampleInput).catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("SCHEMA_INVALID");
    expect((err as CnsError).message.length).toBeGreaterThan(0);
  });

  it("empty source_notes: still calls API and resolves", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validSynthesisOutput));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmSynthesisAdapter();
    const result = await adapter.synthesize({
      topic: "empty-sources-topic",
      queries: ["q1"],
      source_notes: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(validSynthesisOutput);
  });
});
