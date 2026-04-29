import { CnsError } from "../errors.js";
import { fetchWithRetry } from "./anthropic-fetch.js";
import {
  WEAPONS_RUBRIC,
  weaponsCheckAdapterOutputSchema,
  type WeaponsCheckAdapter,
  type WeaponsCheckAdapterInput,
  type WeaponsCheckAdapterOutput,
} from "./boss-agent.js";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1200;

const SYSTEM_PROMPT = [
  "You are a weapons-check judge and rewrite engine for marketing/creative hooks.",
  "In a single response you must: (1) score the provided hook on the rubric below,",
  "and (2) produce a revised hook that improves both scores.",
  "",
  "Rubric (apply it exactly — do not invent new dimensions):",
  WEAPONS_RUBRIC,
  "",
  "Output contract:",
  "Respond ONLY with a single JSON object with these exact keys:",
  '{"revised_hook": string, "scores": {"novelty": integer 1-10, "copy_intensity": integer 1-10, "rationale": string}}',
  "Do not wrap the JSON in markdown code fences.",
  "Do not include any preamble, commentary, or trailing text.",
  "novelty and copy_intensity MUST be integers (not strings, not floats).",
  "Return JSON only.",
].join("\n");

function buildUserPrompt(input: WeaponsCheckAdapterInput): string {
  return [
    `Topic: ${input.topic}`,
    `Synthesis insight path: ${input.synthesis_insight_path}`,
    `Hook set note path: ${input.hook_set_note_path}`,
    `Hook slot: ${input.hook_slot}`,
    `Iteration: ${input.iteration}`,
    "",
    "Current hook:",
    "<<<HOOK>>>",
    input.current_hook,
    "<<<END>>>",
    "",
    "Task:",
    "1) Score the current hook on both rubric dimensions using integers 1-10.",
    "2) Rewrite the hook to raise both scores (even if the current hook is already strong).",
    "3) Provide a short rationale for the scores.",
    "",
    'Return JSON with this exact shape: {"revised_hook": "...", "scores": {"novelty": <integer 1-10>, "copy_intensity": <integer 1-10>, "rationale": "..."}}',
  ].join("\n");
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

export function createLlmWeaponsCheckAdapter(): WeaponsCheckAdapter {
  return {
    async scoreAndRewrite(
      input: WeaponsCheckAdapterInput,
    ): Promise<WeaponsCheckAdapterOutput> {
      const apiKeyRaw = process.env.ANTHROPIC_API_KEY;
      const apiKey = apiKeyRaw?.trim();
      if (!apiKey) {
        throw new CnsError(
          "IO_ERROR",
          "ANTHROPIC_API_KEY is not set; cannot call Anthropic Messages API",
        );
      }

      const requestBody = {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(input) }],
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
            adapterLabel: "weapons check",
            exhaustedMessage: "Weapons check API rate limited after 3 attempts",
          },
        );
      } catch (err) {
        if (err instanceof CnsError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new CnsError("IO_ERROR", `Weapons check LLM fetch failed: ${msg}`);
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
            ? `Weapons check LLM returned HTTP ${response.status}: ${bodySnippet}`
            : `Weapons check LLM returned HTTP ${response.status}`,
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
        throw new CnsError(
          "IO_ERROR",
          "Weapons check LLM response body was not valid JSON",
        );
      }

      const assistantText = extractAssistantText(envelope);
      if (typeof assistantText !== "string") {
        throw new CnsError(
          "IO_ERROR",
          "Weapons check LLM response missing assistant content text",
        );
      }

      let parsedJson: unknown;
      try {
        const stripped = assistantText.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
        parsedJson = JSON.parse(stripped);
      } catch {
        throw new CnsError(
          "IO_ERROR",
          "Weapons check LLM returned non-JSON response",
        );
      }

      const parsed = weaponsCheckAdapterOutputSchema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new CnsError("SCHEMA_INVALID", parsed.error.message);
      }
      return parsed.data;
    },
  };
}
