import { z } from "zod";
import { CnsError } from "../errors.js";

export const vaultRequestDisambiguationInputSchema = z
  .object({
    question: z.string().min(1, "question is required"),
    candidates: z
      .array(z.string().min(1))
      .min(2, "candidates must have at least 2 items")
      .max(3, "candidates must have at most 3 items"),
    context: z.string().optional(),
  })
  .strict();

export type VaultRequestDisambiguationInput = z.infer<typeof vaultRequestDisambiguationInputSchema>;

export type VaultRequestDisambiguationResult =
  | { choice: string; choice_index: number }
  | { timeout: true };

const DISCORD_MAX_CONTENT = 2000;

export function formatDisambiguationDiscordMessage(input: VaultRequestDisambiguationInput): string {
  const lines: string[] = ["❓ Disambiguation needed:", input.question.trim()];
  if (input.context !== undefined && input.context.trim().length > 0) {
    lines.push("", input.context.trim());
  }
  lines.push("");
  input.candidates.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.trim()}`);
  });
  lines.push("");
  const n = input.candidates.length;
  lines.push(n === 2 ? "Reply with 1 or 2." : "Reply with 1, 2, or 3.");
  return lines.join("\n");
}

/**
 * Parse operator reply content into a 0-based candidate index.
 * Valid choices are digits 1..candidateCount only.
 */
export function parseOperatorChoice(content: string, candidateCount: number): number | null {
  const trimmed = content.trim();
  const exact = trimmed.match(/^([1-3])$/);
  if (exact) {
    const n = Number(exact[1]);
    if (n >= 1 && n <= candidateCount) return n - 1;
  }
  const loose = trimmed.match(/\b([1-3])\b/);
  if (loose) {
    const n = Number(loose[1]);
    if (n >= 1 && n <= candidateCount) return n - 1;
  }
  return null;
}

type DiscordMessage = {
  id: string;
  content: string;
  author: { id: string; bot?: boolean };
};

export function selectEarliestHumanChoice(
  messages: DiscordMessage[],
  ourBotUserId: string,
  candidateCount: number,
  anchorMessageId: string,
): number | null {
  const anchor = BigInt(anchorMessageId);
  const sorted = [...messages].sort((a, b) => {
    if (BigInt(a.id) < BigInt(b.id)) return -1;
    if (BigInt(a.id) > BigInt(b.id)) return 1;
    return 0;
  });
  for (const m of sorted) {
    if (BigInt(m.id) <= anchor) continue;
    if (m.author.id === ourBotUserId) continue;
    if (m.author.bot === true) continue;
    const idx = parseOperatorChoice(m.content, candidateCount);
    if (idx !== null) return idx;
  }
  return null;
}

export const DEFAULT_DISAMBIGUATION_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_DISAMBIGUATION_POLL_MS = 2000;

export type VaultRequestDisambiguationDeps = {
  fetchImpl: typeof fetch;
  nowMs: () => number;
  sleep: (ms: number) => Promise<void>;
  timeoutMs: number;
  pollIntervalMs: number;
  apiBase: string;
};

/**
 * Posts a disambiguation prompt to Discord `#hermes` (configured channel) and polls for a human
 * reply with choice 1..N. Read-only: no vault IO. See Discord REST: POST/GET channel messages (v10).
 */
export async function vaultRequestDisambiguation(
  input: VaultRequestDisambiguationInput,
  cfg: { botToken: string; channelId: string },
  deps: Partial<VaultRequestDisambiguationDeps> = {},
): Promise<VaultRequestDisambiguationResult> {
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const nowMs = deps.nowMs ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = deps.timeoutMs ?? DEFAULT_DISAMBIGUATION_TIMEOUT_MS;
  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_DISAMBIGUATION_POLL_MS;
  const apiBase = deps.apiBase ?? "https://discord.com/api/v10";

  const content = formatDisambiguationDiscordMessage(input);
  if (content.length > DISCORD_MAX_CONTENT) {
    throw new CnsError("SCHEMA_INVALID", "Formatted Discord message exceeds Discord 2000 character limit.", {
      length: content.length,
    });
  }

  const authHeader = `Bot ${cfg.botToken}`;
  const ua = "CNS-VaultIO/1.0 (vault_request_disambiguation)";

  const postRes = await fetchImpl(`${apiBase}/channels/${cfg.channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      "User-Agent": ua,
    },
    body: JSON.stringify({ content }),
  });
  if (!postRes.ok) {
    const body = await postRes.text();
    throw new CnsError("IO_ERROR", `Discord API error while posting disambiguation message (HTTP ${postRes.status}).`, {
      discord_status: postRes.status,
      debug: body.slice(0, 500),
    });
  }

  const posted = (await postRes.json()) as DiscordMessage;
  const anchorId = posted.id;
  const ourBotUserId = posted.author.id;

  const deadline = nowMs() + timeoutMs;
  while (nowMs() < deadline) {
    const listUrl = `${apiBase}/channels/${cfg.channelId}/messages?limit=25&after=${encodeURIComponent(anchorId)}`;
    const getRes = await fetchImpl(listUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "User-Agent": ua,
      },
    });
    if (!getRes.ok) {
      const body = await getRes.text();
      throw new CnsError("IO_ERROR", `Discord API error while polling for replies (HTTP ${getRes.status}).`, {
        discord_status: getRes.status,
        debug: body.slice(0, 500),
      });
    }
    const batch = (await getRes.json()) as DiscordMessage[];
    if (!Array.isArray(batch)) {
      throw new CnsError("IO_ERROR", "Discord API returned an unexpected response when listing messages.");
    }
    const choiceIdx = selectEarliestHumanChoice(batch, ourBotUserId, input.candidates.length, anchorId);
    if (choiceIdx !== null) {
      const choice = input.candidates[choiceIdx];
      if (choice === undefined) {
        throw new CnsError("IO_ERROR", "Internal error resolving disambiguation choice.");
      }
      return { choice, choice_index: choiceIdx };
    }
    await sleep(pollIntervalMs);
  }
  return { timeout: true };
}
