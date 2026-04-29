import { CnsError } from "../errors.js";
import { fetchWithRetry } from "./anthropic-fetch.js";
import { parseLlmJsonText } from "./llm-json.js";
import {
  hookGenerationAdapterOutputSchema,
  type HookGenerationAdapter,
  type HookGenerationAdapterInput,
  type HookGenerationAdapterOutput,
} from "./hook-agent.js";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 300;

const SYSTEM_PROMPT = [
  "You are a world-class copywriter for a marketing/creative agency.",
  "You write hooks that are direct, high-stakes, and free of filler.",
  "",
  "Respond ONLY with a single JSON object with EXACTLY these two keys:",
  '{"hook_text": string, "score": integer 1-10}',
  "Do not wrap the JSON in markdown code fences.",
  "Do not include any preamble, commentary, or trailing text.",
  "The score MUST be an integer (not a string, not a float).",
  "Be honest: 10 means genuinely exceptional and is rare. Inflated scores harm the process.",
  "Return JSON only.",
].join("\n");

const SLOT_ARCHETYPES: Record<number, { label: string; guidance: string }> = {
  1: {
    label: "Slot 1 — bold claim / big promise",
    guidance:
      "Lead with a bold claim or big promise. Stake out a clear, confident position that forces the reader to pay attention.",
  },
  2: {
    label: "Slot 2 — counterintuitive / contrarian angle",
    guidance:
      "Lead with a counterintuitive or contrarian angle that inverts the reader's default assumption about the topic. Surprise them with the opposite of what they expect.",
  },
  3: {
    label: "Slot 3 — specific + concrete (numbers, mechanisms, named artifacts)",
    guidance:
      "Anchor the hook in specifics: numbers, mechanisms, and named artifacts drawn from the synthesis. Avoid vague hype — lean on concrete detail that only someone who read the sources could produce.",
  },
  4: {
    label: "Slot 4 — challenge / provocation",
    guidance:
      "Write a challenge or provocation. Call the reader out. Ask a hard question they would rather avoid.",
  },
};

function archetypeFor(slot: number): { label: string; guidance: string } {
  return (
    SLOT_ARCHETYPES[slot] ?? {
      label: `Slot ${slot}`,
      guidance: "Produce a distinct hook angle that stands apart from other slots.",
    }
  );
}

const SCORING_RUBRIC = [
  "Scoring rubric (integer 1-10):",
  "- 10: specific, concrete, grounded in the sources, non-generic, would stop a scroll. Achievable — aim for it.",
  "- 7-9: strong but not yet specific enough. Push harder on concrete detail.",
  "- 1-6: weak; rewrite it.",
  "Score based on:",
  "- novelty: freshness, non-generic angle, no clichés — use numbers, mechanisms, named specifics from the synthesis.",
  "- copy intensity: direct, high-stakes, no filler, every word earns its place.",
  "Score what you actually wrote. If it is specific, grounded in the sources, and non-generic, score it 10.",
].join("\n");

function buildGeneratePrompt(input: HookGenerationAdapterInput): string {
  const arche = archetypeFor(input.hook_slot);
  const lines: string[] = [
    `Hook slot: ${input.hook_slot} of 4`,
    arche.label,
    arche.guidance,
    "",
    `Synthesis vault path: ${input.synthesis_vault_path}`,
  ];
  if (input.synthesis_title) {
    lines.push(`Synthesis title: ${input.synthesis_title}`);
  }
  lines.push(
    "",
    "Synthesis body:",
    "---",
    input.synthesis_body,
    "---",
    "",
    "Generate a fresh hook from scratch for this slot, grounded in the synthesis above.",
    "Produce a single hook sentence (or very short line) that fits the slot archetype.",
    "",
    SCORING_RUBRIC,
    "",
    'Return JSON: {"hook_text": "...", "score": <integer 1-10>}',
  );
  return lines.join("\n");
}

function buildRefinePrompt(input: HookGenerationAdapterInput): string {
  const arche = archetypeFor(input.hook_slot);
  const lines: string[] = [
    `Hook slot: ${input.hook_slot} of 4`,
    arche.label,
    arche.guidance,
    "",
    `Iteration: ${input.iteration}`,
    `Synthesis vault path: ${input.synthesis_vault_path}`,
  ];
  if (input.synthesis_title) {
    lines.push(`Synthesis title: ${input.synthesis_title}`);
  }
  lines.push(
    "",
    "Synthesis body:",
    "---",
    input.synthesis_body,
    "---",
    "",
    "Previous hook (to refine):",
    "<<<PREVIOUS>>>",
    input.current_draft,
    "<<<END>>>",
    "",
    "Refine and improve the previous hook. Keep the slot archetype. Sharpen novelty and copy intensity. Cut filler. Make every word earn its place.",
    "",
    SCORING_RUBRIC,
    "",
    'Return JSON: {"hook_text": "...", "score": <integer 1-10>}',
  );
  return lines.join("\n");
}

function isGenerateMode(input: HookGenerationAdapterInput): boolean {
  return input.iteration === 1 && input.current_draft === "";
}

function extractAssistantText(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return undefined;
  const textBlocks: string[] = [];
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string"
    ) {
      textBlocks.push((block as { text: string }).text);
    }
  }
  return textBlocks.length > 0 ? textBlocks.join("") : undefined;
}

export function createLlmHookGenerationAdapter(): HookGenerationAdapter {
  return {
    async generateOrRefine(
      input: HookGenerationAdapterInput,
    ): Promise<HookGenerationAdapterOutput> {
      const apiKeyRaw = process.env.ANTHROPIC_API_KEY;
      const apiKey = apiKeyRaw?.trim();
      if (!apiKey) {
        throw new CnsError(
          "IO_ERROR",
          "ANTHROPIC_API_KEY is not set; cannot call Anthropic Messages API",
        );
      }

      if (input.iteration === 1 && input.current_draft !== "") {
        throw new CnsError(
          "IO_ERROR",
          "Inconsistent hook adapter input: iteration 1 with non-empty draft",
        );
      }

      const userPrompt = isGenerateMode(input)
        ? buildGeneratePrompt(input)
        : buildRefinePrompt(input);

      const requestBody = {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      };

      let response: Response;
      try {
        response = await fetchWithRetry(
          ANTHROPIC_MESSAGES_URL,
          {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": ANTHROPIC_VERSION,
              "content-type": "application/json",
            },
            body: JSON.stringify(requestBody),
          },
          {
            adapterLabel: "hook",
            exhaustedMessage: "Hook API rate limited after 3 attempts",
          },
        );
      } catch (err) {
        if (err instanceof CnsError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new CnsError("IO_ERROR", `Hook LLM fetch failed: ${msg}`);
      }

      if (!response.ok) {
        let bodySnippet: string | undefined;
        try {
          const text = await response.text();
          const trimmed = text.trim();
          if (trimmed.length > 0) bodySnippet = trimmed.slice(0, 300);
        } catch {
          // ignore
        }
        throw new CnsError(
          "IO_ERROR",
          bodySnippet
            ? `Hook LLM returned HTTP ${response.status}: ${bodySnippet}`
            : `Hook LLM returned HTTP ${response.status}`,
          {
            http_status: response.status,
            retry_after: response.headers.get("retry-after") ?? undefined,
          },
        );
      }

      let envelope: unknown;
      try {
        envelope = await response.json();
      } catch {
        throw new CnsError("IO_ERROR", "Hook LLM response body was not valid JSON");
      }

      const assistantText = extractAssistantText(envelope);
      if (typeof assistantText !== "string") {
        throw new CnsError(
          "IO_ERROR",
          "Hook LLM response missing assistant content text",
        );
      }

      let parsedJson: unknown;
      try {
        parsedJson = parseLlmJsonText(assistantText);
      } catch {
        throw new CnsError("IO_ERROR", "Hook LLM returned non-JSON response");
      }

      const parsed = hookGenerationAdapterOutputSchema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new CnsError("SCHEMA_INVALID", parsed.error.message);
      }
      return parsed.data;
    },
  };
}
