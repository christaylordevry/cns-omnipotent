import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLlmWeaponsCheckAdapter } from "../../src/agents/boss-adapter-llm.js";
import {
  WEAPONS_RUBRIC,
  type WeaponsCheckAdapterInput,
} from "../../src/agents/boss-agent.js";
import { CnsError } from "../../src/errors.js";

function makeAnthropicJsonResponse(bodyObj: unknown): Response {
  return new Response(
    JSON.stringify({
      content: [{ type: "text", text: JSON.stringify(bodyObj) }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function makeAnthropicToolResponse(bodyObj: unknown): Response {
  return new Response(
    JSON.stringify({
      stop_reason: "tool_use",
      content: [
        {
          type: "tool_use",
          id: "toolu_test",
          name: "score_and_rewrite_hook",
          input: bodyObj,
        },
      ],
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

function sampleInput(
  overrides: Partial<WeaponsCheckAdapterInput> = {},
): WeaponsCheckAdapterInput {
  return {
    topic: "AI agents",
    synthesis_insight_path: "03-Resources/synthesis-ai-agents.md",
    hook_set_note_path: "03-Resources/hook-set-ai-agents.md",
    hook_slot: 2,
    iteration: 3,
    current_hook: "The agent isn't reasoning — it's autocompleting your job into oblivion.",
    ...overrides,
  };
}

const validWeaponsOutput = {
  revised_hook: "Your AI agent is autocompleting your job into oblivion.",
  scores: {
    novelty: 9,
    copy_intensity: 8,
    rationale: "Sharper specificity, tighter verbs; novelty still behind a 10 reframe.",
  },
};

function getRequestBody(
  fetchMock: ReturnType<typeof vi.fn>,
): {
  model: string;
  max_tokens: number;
  system: string;
  tools: Array<{ name: string; input_schema: { required: string[] } }>;
  tool_choice: { type: string; name: string };
  messages: Array<{ role: string; content: string }>;
} {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(init.body as string);
}

describe("createLlmWeaponsCheckAdapter", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-api-key-xxxx";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  it("happy path: single call returns validated output; request uses correct URL/method/headers/model/max_tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicToolResponse(validWeaponsOutput));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmWeaponsCheckAdapter();
    const result = await adapter.scoreAndRewrite(sampleInput());

    expect(result).toEqual(validWeaponsOutput);

    // Adapter must call the API EXACTLY ONCE (no adapter-level iteration)
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-api-key-xxxx");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["content-type"]).toMatch(/application\/json/);

    const body = getRequestBody(fetchMock);
    expect(body.model).toBe("claude-sonnet-4-6");
    expect(body.max_tokens).toBe(2000);
    expect(body.tool_choice).toEqual({
      type: "tool",
      name: "score_and_rewrite_hook",
    });
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0].name).toBe("score_and_rewrite_hook");
    expect(body.tools[0].input_schema.required).toEqual([
      "revised_hook",
      "scores",
    ]);

    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");
  });

  it("system prompt embeds WEAPONS_RUBRIC verbatim (against the actual request body sent to the API)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validWeaponsOutput));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmWeaponsCheckAdapter();
    await adapter.scoreAndRewrite(sampleInput());

    // Assert against the actual serialized request body — not just against a
    // substring. This is the drift-guard: any paraphrase, reformat, or
    // summary of the rubric will cause this test to fail.
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const rawRequestBody = init.body as string;
    expect(rawRequestBody).toContain(JSON.stringify(WEAPONS_RUBRIC).slice(1, -1));

    const body = getRequestBody(fetchMock);
    expect(body.system).toContain(WEAPONS_RUBRIC);
    expect(body.system.toLowerCase()).toContain("weapons");
    expect(body.system.toLowerCase()).toContain("json");
  });

  it("user prompt includes every WeaponsCheckAdapterInput field + schema-matched JSON output instruction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validWeaponsOutput));
    vi.stubGlobal("fetch", fetchMock);

    const input = sampleInput();
    const adapter = createLlmWeaponsCheckAdapter();
    await adapter.scoreAndRewrite(input);

    const body = getRequestBody(fetchMock);
    const userText = body.messages[0].content;

    expect(userText).toContain(input.topic);
    expect(userText).toContain(input.synthesis_insight_path);
    expect(userText).toContain(input.hook_set_note_path);
    expect(userText).toContain(String(input.hook_slot));
    expect(userText).toContain(String(input.iteration));
    expect(userText).toContain(input.current_hook);

    // Instruction to score + rewrite
    expect(userText.toLowerCase()).toContain("score");
    expect(userText.toLowerCase()).toContain("rewrite");
    expect(userText).toContain(
      "The returned scores must describe revised_hook",
    );

    // Output-schema key names surfaced in the instruction
    expect(userText).toContain("revised_hook");
    expect(userText).toContain("scores");
    expect(userText).toContain("novelty");
    expect(userText).toContain("copy_intensity");
    expect(userText).toContain("rationale");
    expect(userText.toLowerCase()).toContain("integer");
  });

  it("missing API key: IO_ERROR (whitespace-only treated as missing)", async () => {
    process.env.ANTHROPIC_API_KEY = "   ";
    const adapter = createLlmWeaponsCheckAdapter();
    await expect(adapter.scoreAndRewrite(sampleInput())).rejects.toMatchObject({
      name: "CnsError",
      code: "IO_ERROR",
    });

    delete process.env.ANTHROPIC_API_KEY;
    const adapter2 = createLlmWeaponsCheckAdapter();
    await expect(adapter2.scoreAndRewrite(sampleInput())).rejects.toMatchObject({
      name: "CnsError",
      code: "IO_ERROR",
    });
  });

  it("fetch rejects: IO_ERROR", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmWeaponsCheckAdapter();
    await expect(adapter.scoreAndRewrite(sampleInput())).rejects.toMatchObject({
      name: "CnsError",
      code: "IO_ERROR",
    });
  });

  it("non-2xx response: IO_ERROR with HTTP status in message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad key" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmWeaponsCheckAdapter();
    const err = await adapter.scoreAndRewrite(sampleInput()).catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("IO_ERROR");
    expect((err as CnsError).message).toContain("401");
  });

  it("non-JSON assistant text: IO_ERROR with context (stop_reason, parse cause)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          stop_reason: "end_turn",
          content: [{ type: "text", text: "not json" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmWeaponsCheckAdapter();
    const err = await adapter.scoreAndRewrite(sampleInput()).catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("IO_ERROR");
    const msg = (err as CnsError).message;
    expect(msg).toMatch(
      /^Weapons check LLM returned non-JSON response \(/,
    );
    expect(msg).toContain("text_len=");
    expect(msg).toContain("parse:");
  });

  it("no text blocks (e.g. tool_use only): IO_ERROR lists content types", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          stop_reason: "end_turn",
          content: [{ type: "tool_use", id: "1", name: "x", input: {} }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmWeaponsCheckAdapter();
    const err = await adapter.scoreAndRewrite(sampleInput()).catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("IO_ERROR");
    const msg = (err as CnsError).message;
    expect(msg).toContain("missing assistant content text");
    expect(msg).toContain("content_types");
    expect(msg).toContain("tool_use");
  });

  it("assistant text with preface and fenced JSON: parses the fenced object", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeAnthropicTextResponse(
        [
          "Here is the JSON:",
          "```json",
          JSON.stringify(validWeaponsOutput),
          "```",
        ].join("\n"),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmWeaponsCheckAdapter();
    const result = await adapter.scoreAndRewrite(sampleInput());
    expect(result).toEqual(validWeaponsOutput);
  });

  it("fallback text extraction preserves long JSON beyond 1007 characters", async () => {
    const longOutput = {
      revised_hook: `${"Sharp ".repeat(180)}hook`,
      scores: {
        novelty: 9,
        copy_intensity: 9,
        rationale: `${"Specific rationale. ".repeat(70)}Done.`,
      },
    };
    const rawAssistantText = JSON.stringify(longOutput);
    expect(rawAssistantText.length).toBeGreaterThan(1007);

    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicTextResponse(rawAssistantText));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmWeaponsCheckAdapter();
    const result = await adapter.scoreAndRewrite(sampleInput());
    expect(result).toEqual(longOutput);
  });

  it("schema invalid (novelty as string): SCHEMA_INVALID with Zod message preserved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeAnthropicToolResponse({
        revised_hook: "x",
        scores: {
          novelty: "10",
          copy_intensity: 10,
          rationale: "r",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmWeaponsCheckAdapter();
    const err = await adapter.scoreAndRewrite(sampleInput()).catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("SCHEMA_INVALID");
    expect((err as CnsError).message.length).toBeGreaterThan(0);
  });

  it("429 then 200: retries once with clamped sleep (upper bound) and resolves with exactly 2 fetch calls", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { retry_after: 500 } }), {
            status: 429,
            headers: { "content-type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(makeAnthropicJsonResponse(validWeaponsOutput));
      vi.stubGlobal("fetch", fetchMock);

      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      const adapter = createLlmWeaponsCheckAdapter();
      const promise = adapter.scoreAndRewrite(sampleInput());

      // retry_after=500 should clamp to 120s
      await vi.advanceTimersByTimeAsync(120_000);

      const result = await promise;
      expect(result).toEqual(validWeaponsOutput);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const sleepCall = setTimeoutSpy.mock.calls.find(
        (c) => typeof c[1] === "number" && c[1] >= 5_000 && c[1] <= 120_000,
      );
      expect(sleepCall).toBeDefined();
      expect(sleepCall![1]).toBe(120_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("3 consecutive 429s: throws CnsError with weapons-check-specific rate-limit message", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { retry_after: 5 } }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const adapter = createLlmWeaponsCheckAdapter();
      const promise = adapter.scoreAndRewrite(sampleInput()).catch((e) => e);

      await vi.advanceTimersByTimeAsync(5_000);
      await vi.advanceTimersByTimeAsync(5_000);

      const err = (await promise) as CnsError;
      expect(err).toBeInstanceOf(CnsError);
      expect(err.code).toBe("IO_ERROR");
      expect(err.message).toBe(
        "Weapons check API rate limited after 3 attempts",
      );
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("non-429 non-2xx (500): throws immediately without retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "server error" } }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmWeaponsCheckAdapter();
    await expect(adapter.scoreAndRewrite(sampleInput())).rejects.toMatchObject({
      name: "CnsError",
      code: "IO_ERROR",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
