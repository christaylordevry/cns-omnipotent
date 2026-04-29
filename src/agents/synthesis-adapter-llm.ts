import { CnsError } from "../errors.js";
import { fetchWithRetry } from "./anthropic-fetch.js";
import { parseLlmJsonText } from "./llm-json.js";
import {
  synthesisAdapterOutputSchema,
  type SynthesisAdapter,
  type SynthesisAdapterInput,
  type SynthesisAdapterOutput,
} from "./synthesis-agent.js";
import type { OperatorContext } from "./operator-context.js";
import type {
  VaultContextNote,
  VaultContextPacket,
} from "./vault-context-builder.js";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8000;
const MAX_SOURCE_NOTES = 8;
const MAX_SOURCE_NOTE_BODY_CHARS = 600;
const MAX_VAULT_CONTEXT_NOTES = 3;

const SYSTEM_PROMPT = [
  "You are a world-class content strategist and research synthesizer writing",
  "for a specific named operator: Chris Taylor — a Sydney-based Creative",
  "Technologist running two active tracks in parallel (Escape Job, Build Agency).",
  "",
  "Your job is to distill research into an operator-ready intelligence artifact",
  "Chris can act on in the same session — not a neutral summary, not a bullet",
  "dump. Think: reasoned analysis, explicit tradeoffs, connected vault context,",
  "decision-driving callouts.",
  "",
  "You produce one Obsidian-flavoured markdown note body (the PAKE++ structure",
  "the user specifies) plus a short executive summary for frontmatter.",
  "",
  "Respond ONLY with a single JSON object of this exact shape:",
  '{"body": "<full PAKE++ markdown body>", "summary": "<one-sentence executive summary>"}',
  "",
  "Do not wrap the JSON in markdown code fences.",
  "Do not include any preamble, commentary, or trailing text.",
  "The body must be valid markdown (callouts, tables, wikilinks allowed).",
  "The summary must be one sentence, non-empty, suitable for the ai_summary frontmatter field.",
].join("\n");

function renderOperatorContextBlock(ctx: OperatorContext): string {
  const tracks = ctx.tracks
    .map((t) => `- ${t.name} (status: ${t.status}, priority: ${t.priority})`)
    .join("\n");
  const constraints =
    ctx.constraints.length === 0
      ? "(none)"
      : ctx.constraints.map((c) => `- ${c}`).join("\n");
  const profileLink = ctx.vault_profile_note
    ? `\nVault profile note: ${ctx.vault_profile_note}`
    : "";

  return [
    "=== Operator Context ===",
    `Name: ${ctx.name}`,
    `Location: ${ctx.location}`,
    `Positioning: ${ctx.positioning}`,
    "Tracks:",
    tracks,
    "Constraints:",
    constraints,
    profileLink.trim().length > 0 ? profileLink.trimStart() : "",
  ]
    .filter((s) => s.length > 0)
    .join("\n");
}

function renderVaultContextNote(note: VaultContextNote): string {
  const tagList = note.tags.length > 0 ? note.tags.join(", ") : "(none)";
  return [
    "---",
    `vault_path: ${note.vault_path}`,
    `title: ${note.title}`,
    `retrieval_reason: ${note.retrieval_reason}`,
    `tags: ${tagList}`,
    "excerpt:",
    note.excerpt,
  ].join("\n");
}

function renderVaultContextBlock(packet: VaultContextPacket): string {
  const missingProfileInstruction = [
    "Because the operator profile note is absent, you MUST include this callout",
    "verbatim in the body:",
    "",
    "> [!warning] No vault context found — this synthesis is grounded in external research only.",
  ].join("\n");

  if (packet.notes.length === 0) {
    return [
      "=== Vault Context ===",
      "(no vault context found)",
      "",
      missingProfileInstruction,
    ].join("\n");
  }
  const capped = packet.notes.slice(0, MAX_VAULT_CONTEXT_NOTES);
  const blocks = capped.map(renderVaultContextNote).join("\n");
  const hasOperatorProfile = packet.notes.some(
    (note) => note.retrieval_reason === "operator-profile",
  );
  return [
    "=== Vault Context ===",
    `(${capped.length} of ${packet.total_notes} notes shown)`,
    hasOperatorProfile
      ? ""
      : [
          "(operator profile note missing; topic-match vault context is still shown)",
          "",
          missingProfileInstruction,
          "",
        ].join("\n"),
    blocks,
  ]
    .filter((s) => s.length > 0)
    .join("\n");
}

function renderSourceNotesBlock(input: SynthesisAdapterInput): string {
  const capped = input.source_notes.slice(0, MAX_SOURCE_NOTES);
  if (capped.length === 0) return "(no source notes provided)";
  return capped
    .map((note) => {
      const truncatedBody = note.body.slice(0, MAX_SOURCE_NOTE_BODY_CHARS);
      return [
        "---",
        `vault_path: ${note.vault_path}`,
        "body:",
        truncatedBody,
      ].join("\n");
    })
    .join("\n");
}

function buildUserPrompt(input: SynthesisAdapterInput): string {
  const queryList =
    input.queries.length === 0
      ? "(none)"
      : input.queries.map((q) => `- ${q}`).join("\n");

  const trackNames = input.operator_context.tracks.map((t) => t.name);
  const trackNamesVerbatim =
    trackNames.length === 0
      ? "(no tracks configured)"
      : trackNames.map((n) => `"${n}"`).join(", ");

  const operatorBlock = renderOperatorContextBlock(input.operator_context);
  const vaultBlock = renderVaultContextBlock(input.vault_context_packet);
  const sourcesBlock = renderSourceNotesBlock(input);

  return [
    `Topic: ${input.topic}`,
    "",
    "Queries run:",
    queryList,
    "",
    operatorBlock,
    "",
    vaultBlock,
    "",
    "=== Source Research Notes ===",
    sourcesBlock,
    "",
    "=== Output Contract (PAKE++ body) ===",
    "Write a full markdown body with these sections in this order:",
    "",
    "1. `## What We Know` — ≥180 words of prose reasoning. NO BULLETS. Include",
    "   ≥3 wikilinks of the form `[[Note-Title]]` that connect to vault notes",
    "   (prefer vault_context_packet notes; otherwise reference source notes by",
    "   a plausible wikilink target derived from the vault_path basename).",
    "2. `> [!note] Signal vs Noise` — short callout introducing the ledger,",
    "   immediately followed by a Contradiction Ledger markdown table with",
    "   ≥3 rows and exactly these columns: Claim | Agree | Disagree | Implication.",
    "3. `## The Gap Map` — a markdown table with ≥4 rows and exactly these",
    "   columns: Known | Unknown | Why it matters.",
    "4. `> [!warning] Blind Spots` — callout naming the biggest things the",
    "   sources collectively miss.",
    "5. `## Where Chris Has Leverage` — ≥150 words of prose. NO BULLETS. Must",
    `   name these tracks verbatim: ${trackNamesVerbatim}. You MUST include the`,
    `   exact string "${input.operator_context.location}" and the exact string`,
    `   "${input.operator_context.positioning}" verbatim in this section.`,
    "6. `> [!tip] Highest-Leverage Move` — one specific, timeable, vault-",
    "   connected action.",
    "7. `## Connected Vault Notes` — a markdown table with ≥5 rows and exactly",
    "   these columns: Note | Why relevant | Status. Use wikilinks in the Note",
    "   column.",
    "8. `## Decisions Needed` — ≥4 decisions. For each decision use the",
    "   structure:",
    "      ### Decision: <short title>",
    "      - **Option A:** …",
    "      - **Option B:** …",
    "      - **Downstream consequence:** …",
    "9. `## Open Questions` — ≥3 numbered questions. Decision-blocking only.",
    "10. `## Version / Run Metadata` — a markdown table with the columns",
    "    Date | Brief topic | Sources ingested | Queries run.",
    "11. `> [!abstract]` callout — 2–3 sentences summarizing the single most",
    "    important finding and the highest-leverage action. This must be the",
    "    final required PAKE++ section in the body.",
    "",
    "=== Voice & Depth Rules (non-negotiable) ===",
    '- Write all sections first. Write the `[!abstract]` callout last.',
    "- No thin bullet-summary mode. Meet or exceed every minimum above.",
    "- No bullets in What We Know or Where Chris Has Leverage — prose only.",
    `- Where Chris Has Leverage must name these tracks verbatim: ${trackNamesVerbatim}.`,
    "- Contradiction Ledger table must have ≥3 rows.",
    "- Decisions Needed must have ≥4 decisions, each with Option A / Option B",
    "  and a downstream consequence.",
    "",
    "=== Response Format ===",
    'Respond ONLY with a JSON object: {"body": "<full PAKE++ markdown>", "summary": "<one sentence>"}',
    "No markdown fences. No preamble. No trailing text.",
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
            adapterLabel: "synthesis",
            exhaustedMessage: "Synthesis API rate limited after 3 attempts",
          },
        );
      } catch (err) {
        if (err instanceof CnsError) throw err;
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
        parsedJson = parseLlmJsonText(assistantText);
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
