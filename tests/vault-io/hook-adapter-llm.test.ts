import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLlmHookGenerationAdapter } from "../../src/agents/hook-adapter-llm.js";
import type { HookGenerationAdapterInput } from "../../src/agents/hook-agent.js";
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

const SYNTHESIS_BODY_SENTINEL =
  "# Synthesis: AI agents\n\nAI agents perceive and act. Core-pattern-XYZ shows up in every source.";

function generateInput(
  overrides: Partial<HookGenerationAdapterInput> = {},
): HookGenerationAdapterInput {
  return {
    synthesis_body: SYNTHESIS_BODY_SENTINEL,
    synthesis_vault_path: "03-Resources/synthesis-ai-agents.md",
    synthesis_title: "Synthesis: AI agents (2026-04-20)",
    hook_slot: 1,
    iteration: 1,
    current_draft: "",
    ...overrides,
  };
}

function refineInput(
  overrides: Partial<HookGenerationAdapterInput> = {},
): HookGenerationAdapterInput {
  return {
    synthesis_body: SYNTHESIS_BODY_SENTINEL,
    synthesis_vault_path: "03-Resources/synthesis-ai-agents.md",
    synthesis_title: "Synthesis: AI agents (2026-04-20)",
    hook_slot: 2,
    iteration: 2,
    current_draft: "PREVIOUS-DRAFT-SENTINEL-uniq-abc123",
    ...overrides,
  };
}

const validHookOutput = {
  hook_text: "Your AI agent is just a chatbot wearing a suit.",
  score: 8,
};

function getRequestBody(
  fetchMock: ReturnType<typeof vi.fn>,
): {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: string; content: string }>;
} {
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return JSON.parse(init.body as string);
}

describe("createLlmHookGenerationAdapter", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-api-key-xxxx";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  it("generate mode (iteration 1, empty draft): resolves and sends correct request; prompt excludes refine language", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validHookOutput));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmHookGenerationAdapter();
    const result = await adapter.generateOrRefine(generateInput());

    expect(result).toEqual(validHookOutput);

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
    expect(body.max_tokens).toBe(150);
    expect(typeof body.system).toBe("string");
    expect(body.system.toLowerCase()).toContain("copywriter");
    expect(body.system.toLowerCase()).toContain("json");
    expect(body.system).toContain("hook_text");
    expect(body.system).toContain("score");

    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");

    const userText = body.messages[0].content;
    expect(userText).toContain(SYNTHESIS_BODY_SENTINEL);
    expect(userText).toContain("03-Resources/synthesis-ai-agents.md");
    // Scoring rubric must appear in both modes
    expect(userText.toLowerCase()).toContain("novelty");
    expect(userText.toLowerCase()).toContain("copy intensity");
    expect(userText.toLowerCase()).toContain("honest");
    expect(userText).toMatch(/1[\s\S]{0,5}10/); // 1–10 range
    // Generate mode MUST NOT include refine language or current_draft terms
    expect(userText.toLowerCase()).not.toContain("current_draft");
    expect(userText.toLowerCase()).not.toContain("refine");
    expect(userText.toLowerCase()).not.toContain("improve");
    expect(userText.toLowerCase()).not.toContain("revision");
    expect(userText.toLowerCase()).not.toContain("iterate");
    expect(userText.toLowerCase()).not.toContain("previous draft");
  });

  it("refine mode (iteration 2, non-empty draft): includes draft and refine language", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validHookOutput));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmHookGenerationAdapter();
    const result = await adapter.generateOrRefine(refineInput());
    expect(result).toEqual(validHookOutput);

    const body = getRequestBody(fetchMock);
    const userText = body.messages[0].content;

    expect(userText).toContain("PREVIOUS-DRAFT-SENTINEL-uniq-abc123");
    expect(userText.toLowerCase()).toMatch(/refine|improve/);
    // Adapter must not pretend to know prior score
    expect(userText.toLowerCase()).not.toContain("previous score");
    expect(userText.toLowerCase()).not.toContain("prior score");
    // Scoring rubric still present
    expect(userText.toLowerCase()).toContain("novelty");
    expect(userText.toLowerCase()).toContain("copy intensity");
    expect(userText.toLowerCase()).toContain("honest");
  });

  it("hook_slot influences prompt: slot 1 vs slot 2 produce different prompts with distinct archetypes", async () => {
    const fetchMock1 = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validHookOutput));
    vi.stubGlobal("fetch", fetchMock1);
    let adapter = createLlmHookGenerationAdapter();
    await adapter.generateOrRefine(generateInput({ hook_slot: 1 }));
    const slot1Text = (getRequestBody(fetchMock1).messages[0].content).toLowerCase();

    vi.unstubAllGlobals();
    const fetchMock2 = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validHookOutput));
    vi.stubGlobal("fetch", fetchMock2);
    adapter = createLlmHookGenerationAdapter();
    await adapter.generateOrRefine(generateInput({ hook_slot: 2 }));
    const slot2Text = (getRequestBody(fetchMock2).messages[0].content).toLowerCase();

    expect(slot1Text).not.toBe(slot2Text);
    // Each prompt references its own slot label
    expect(slot1Text).toMatch(/slot\s*1|hook\s*option\s*1|bold claim|big promise/);
    expect(slot2Text).toMatch(/slot\s*2|hook\s*option\s*2|counterintuitive|contrarian/);
    // Each prompt must NOT lead with the other slot's unique archetype keyword
    expect(slot1Text).not.toContain("counterintuitive");
    expect(slot2Text).not.toContain("bold claim");
  });

  it("missing API key: throws CnsError IO_ERROR (whitespace-only treated as missing)", async () => {
    process.env.ANTHROPIC_API_KEY = "   ";
    const adapter = createLlmHookGenerationAdapter();
    await expect(adapter.generateOrRefine(generateInput())).rejects.toMatchObject({
      name: "CnsError",
      code: "IO_ERROR",
    });

    delete process.env.ANTHROPIC_API_KEY;
    const adapter2 = createLlmHookGenerationAdapter();
    await expect(adapter2.generateOrRefine(generateInput())).rejects.toMatchObject({
      name: "CnsError",
      code: "IO_ERROR",
    });
  });

  it("iteration 1 with non-empty draft: throws CnsError IO_ERROR (input guard)", async () => {
    const adapter = createLlmHookGenerationAdapter();
    await expect(
      adapter.generateOrRefine(generateInput({ current_draft: "not-empty" })),
    ).rejects.toMatchObject({
      name: "CnsError",
      code: "IO_ERROR",
      message: "Inconsistent hook adapter input: iteration 1 with non-empty draft",
    });
  });

  it("fetch rejects: throws CnsError IO_ERROR", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmHookGenerationAdapter();
    await expect(adapter.generateOrRefine(generateInput())).rejects.toMatchObject({
      name: "CnsError",
      code: "IO_ERROR",
    });
  });

  it("non-JSON assistant text: throws CnsError IO_ERROR with exact message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicTextResponse("not json"));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmHookGenerationAdapter();
    const err = await adapter.generateOrRefine(generateInput()).catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("IO_ERROR");
    expect((err as CnsError).message).toBe("Hook LLM returned non-JSON response");
  });

  it("schema invalid (score as string): throws CnsError SCHEMA_INVALID with Zod message preserved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeAnthropicJsonResponse({ hook_text: "x", score: "10" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = createLlmHookGenerationAdapter();
    const err = await adapter.generateOrRefine(generateInput()).catch((e) => e);
    expect(err).toBeInstanceOf(CnsError);
    expect((err as CnsError).code).toBe("SCHEMA_INVALID");
    expect((err as CnsError).message.length).toBeGreaterThan(0);
  });

  it("synthesis_body is NOT truncated to 1500 chars (full body passed through)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validHookOutput));
    vi.stubGlobal("fetch", fetchMock);

    const longBody = "A".repeat(4000);
    const adapter = createLlmHookGenerationAdapter();
    await adapter.generateOrRefine(generateInput({ synthesis_body: longBody }));

    const body = getRequestBody(fetchMock);
    const userText = body.messages[0].content;
    expect(userText).toContain("A".repeat(4000));
    expect(userText).not.toContain("[...truncated]");
  });

  it("refine mode: synthesis_body is NOT truncated to 1500 chars", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeAnthropicJsonResponse(validHookOutput));
    vi.stubGlobal("fetch", fetchMock);

    const longBody = "B".repeat(4000);
    const adapter = createLlmHookGenerationAdapter();
    await adapter.generateOrRefine(refineInput({ synthesis_body: longBody }));

    const body = getRequestBody(fetchMock);
    const userText = body.messages[0].content;
    expect(userText).toContain("B".repeat(4000));
    expect(userText).not.toContain("[...truncated]");
  });

  it("429 then 200: retries once with clamped sleep and resolves with exactly 2 fetch calls", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: { retry_after: 3 } }), {
            status: 429,
            headers: { "content-type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(makeAnthropicJsonResponse(validHookOutput));
      vi.stubGlobal("fetch", fetchMock);

      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      const adapter = createLlmHookGenerationAdapter();
      const promise = adapter.generateOrRefine(generateInput());

      // retry_after=3 is below min clamp (5s), so sleep should be 5000ms
      await vi.advanceTimersByTimeAsync(5_000);

      const result = await promise;
      expect(result).toEqual(validHookOutput);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const sleepCall = setTimeoutSpy.mock.calls.find(
        (c) => typeof c[1] === "number" && c[1] >= 5_000 && c[1] <= 120_000,
      );
      expect(sleepCall).toBeDefined();
      expect(sleepCall![1]).toBe(5_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("3 consecutive 429s: throws CnsError with hook-specific rate-limit message", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { retry_after: 5 } }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const adapter = createLlmHookGenerationAdapter();
      const promise = adapter.generateOrRefine(generateInput()).catch((e) => e);

      await vi.advanceTimersByTimeAsync(5_000);
      await vi.advanceTimersByTimeAsync(5_000);

      const err = (await promise) as CnsError;
      expect(err).toBeInstanceOf(CnsError);
      expect(err.code).toBe("IO_ERROR");
      expect(err.message).toBe(
        "Anthropic API rate limited after 3 attempts — hook",
      );
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
