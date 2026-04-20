import { CnsError } from "../errors.js";
import {
  synthesisAdapterOutputSchema,
  type SynthesisAdapter,
  type SynthesisAdapterInput,
  type SynthesisAdapterOutput,
} from "./synthesis-agent.js";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1000;

const SYSTEM_PROMPT = [
  "You are a content research synthesizer for a marketing/creative agency.",
  "Analyze the provided research sources and distill them into actionable insights",
  "for content strategy and creative direction.",
  "",
  "Respond ONLY with a single JSON object matching this shape:",
  '{"patterns": string[], "gaps": string[], "opportunities": string[], "summary": string}',
  "Do not wrap the JSON in markdown code fences.",
  "Do not include any preamble, commentary, or trailing text.",
  "Return JSON only.",
].join("\n");

function buildUserPrompt(input: SynthesisAdapterInput): string {
  const queryList =
    input.queries.length === 0
      ? "(none)"
      : input.queries.map((q) => `- ${q}`).join("\n");

  const sourceBlocks =
    input.source_notes.length === 0
      ? "(no source notes provided)"
      : input.source_notes
          .map((note) =>
            ["---", `vault_path: ${note.vault_path}`, "body:", note.body].join("\n"),
          )
          .join("\n");

  return [
    `Topic: ${input.topic}`,
    "",
    "Queries run:",
    queryList,
    "",
    "Sources:",
    sourceBlocks,
    "",
    "Analyze these sources and produce:",
    "- patterns: recurring themes observed across multiple sources",
    "- gaps: areas that are underexplored or missing coverage",
    "- opportunities: angles a marketing/creative team could pursue originally",
    "- summary: a concise executive summary (non-empty)",
    "",
    'Return a JSON object with keys "patterns", "gaps", "opportunities", "summary".',
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

export function createLlmSynthesisAdapter(): SynthesisAdapter {
  return {
    async synthesize(input: SynthesisAdapterInput): Promise<SynthesisAdapterOutput> {
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
        response = await fetch(ANTHROPIC_MESSAGES_URL, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new CnsError("IO_ERROR", `Synthesis LLM fetch failed: ${msg}`);
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
            ? `Synthesis LLM returned HTTP ${response.status}: ${bodySnippet}`
            : `Synthesis LLM returned HTTP ${response.status}`,
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
          "Synthesis LLM response body was not valid JSON",
        );
      }

      const assistantText = extractAssistantText(envelope);
      if (typeof assistantText !== "string") {
        throw new CnsError(
          "IO_ERROR",
          "Synthesis LLM response missing assistant content text",
        );
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(assistantText);
      } catch {
        throw new CnsError("IO_ERROR", "Synthesis LLM returned non-JSON response");
      }

      const parsed = synthesisAdapterOutputSchema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new CnsError("SCHEMA_INVALID", parsed.error.message);
      }
      return parsed.data;
    },
  };
}
