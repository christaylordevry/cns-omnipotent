import matter from "gray-matter";
import type { Embedder } from "./embedder.js";
import {
  isDailyNotesVaultPath,
  stripAgentLogSectionFromMarkdown,
} from "./brain-path-utils.js";
import {
  evaluateNoteForEmbeddingSecretGate,
  INDEXING_SECRET_EXCLUSION_REASON,
} from "./indexing-secret-gate.js";
import {
  channelPolicyFor,
  type BrainRecallPolicy,
  type RecallChannel,
} from "./recall-policy.js";
import { queryBrainIndex } from "./retrieval/query-index.js";
import { vaultReadFile } from "../tools/vault-read.js";

export type RecallInjectionDropReason =
  | "BUDGET"
  | "PATH_BLOCKED"
  | "NOT_FOUND"
  | "SECRET_GATE"
  | "READ_ERROR";

export type RecallInjectionDroppedChunk = {
  path: string;
  reason: RecallInjectionDropReason;
};

export type RecallInjectionCitation = {
  path: string;
  score: number;
};

export type RecallInjectionResult = {
  context: string | null;
  citations: RecallInjectionCitation[];
  channel: RecallChannel;
  shadow: boolean;
  policyVersion: string;
  tokensUsed: number;
  dropped: RecallInjectionDroppedChunk[];
};

export type BuildRecallInjectionParams = {
  vaultRoot: string;
  indexPath: string;
  query: string;
  channel: RecallChannel;
  policy: BrainRecallPolicy;
  embedder: Embedder;
};

const VOICE_PLATFORM_HINTS = new Set(["nexus-voice"]);

/** Estimate injection token cost (matches vault-context-builder convention). */
export function estimateInjectionTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Derive recall channel from turn metadata (ADR-HERMES-015).
 * `voice_pane` wins over length heuristic when platform or explicit channel hint is set.
 */
export function detectRecallChannel(params: {
  userMessage: string;
  platformHint?: string | null;
  recallChannelHint?: string | null;
  yappedTextMinChars: number;
}): RecallChannel {
  const platform = params.platformHint?.trim().toLowerCase();
  if (platform && VOICE_PLATFORM_HINTS.has(platform)) {
    return "voice_pane";
  }
  const channelHint = params.recallChannelHint?.trim().toLowerCase();
  if (channelHint === "voice_pane") {
    return "voice_pane";
  }
  if (channelHint === "standard_text" || channelHint === "yapped_text") {
    return channelHint;
  }
  if (params.userMessage.length >= params.yappedTextMinChars) {
    return "yapped_text";
  }
  return "standard_text";
}

export function isRecallInjectionPathBlocked(vaultRelPath: string, blockedPatterns: string[]): boolean {
  const normalized = vaultRelPath.replace(/\\/g, "/");
  if (/[\r\n]/.test(normalized)) {
    return true;
  }
  for (const pattern of blockedPatterns) {
    const p = pattern.replace(/\\/g, "/");
    if (p.endsWith("/**")) {
      const base = p.slice(0, -3);
      if (normalized === base || normalized.startsWith(`${base}/`)) {
        return true;
      }
      continue;
    }
    if (normalized === p) {
      return true;
    }
  }
  return false;
}

export function formatRecallChunk(path: string, excerpt: string, score: number): string {
  const scoreSuffix = Number.isFinite(score) ? ` (score: ${score.toFixed(3)})` : "";
  return `### vault:${path}${scoreSuffix}\n\n${excerpt.trim()}`;
}

export function formatRecallContextBlock(params: {
  chunks: string[];
  policyVersion: string;
  channel: RecallChannel;
}): string {
  if (params.chunks.length === 0) {
    return "";
  }
  const header = `<!-- cns-brain-recall policy_version=${params.policyVersion} channel=${params.channel} -->`;
  return [header, ...params.chunks].join("\n\n");
}

function excerptFromRawNote(
  vaultRelPath: string,
  raw: string,
  maxChars: number,
): string {
  const parsed = matter(raw);
  let body = parsed.content;
  if (isDailyNotesVaultPath(vaultRelPath)) {
    body = stripAgentLogSectionFromMarkdown(body);
  }
  const trimmed = body.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return trimmed.slice(0, maxChars);
}

function fitRecallChunkToBudget(params: {
  path: string;
  rawText: string;
  score: number;
  remainingTokens: number;
}): { chunk: string; tokens: number } | null {
  const emptyChunk = formatRecallChunk(params.path, "", params.score);
  const headerTokens = estimateInjectionTokens(emptyChunk);
  if (headerTokens >= params.remainingTokens) {
    return null;
  }
  let maxChars = (params.remainingTokens - headerTokens) * 4;
  while (maxChars > 0) {
    const excerpt = excerptFromRawNote(params.path, params.rawText, maxChars);
    if (excerpt.length === 0) {
      return null;
    }
    const chunk = formatRecallChunk(params.path, excerpt, params.score);
    const tokens = estimateInjectionTokens(chunk);
    if (tokens <= params.remainingTokens) {
      return { chunk, tokens };
    }
    maxChars -= Math.max(1, (tokens - params.remainingTokens) * 4);
  }
  return null;
}

/**
 * Query Brain index, load vault excerpts, trim to per-channel budget, emit cited context block.
 */
export async function buildRecallInjection(params: BuildRecallInjectionParams): Promise<RecallInjectionResult> {
  const channelPolicy = channelPolicyFor(params.policy, params.channel);
  const queryOut = await queryBrainIndex({
    indexPath: params.indexPath,
    query: params.query,
    topK: channelPolicy.max_top_k_fetch,
    minScore: channelPolicy.min_score_threshold,
    qualityWeighting: channelPolicy.quality_weighting ?? true,
    staleSamplePenaltyFactor: params.policy.index?.stale_penalty_factor,
    includeScores: true,
    includeEmbedderMetadata: false,
    embedder: params.embedder,
  });

  const dropped: RecallInjectionDroppedChunk[] = [];
  const chunks: string[] = [];
  const citations: RecallInjectionCitation[] = [];
  let tokensUsed = 0;
  const maxTokens = channelPolicy.max_injection_tokens;
  const maxChunks = channelPolicy.max_chunks;

  for (const hit of queryOut.results) {
    if (chunks.length >= maxChunks) {
      break;
    }
    const vaultPath = hit.path;
    const score = hit.score ?? 0;

    if (isRecallInjectionPathBlocked(vaultPath, params.policy.inject_blocked_paths)) {
      dropped.push({ path: vaultPath, reason: "PATH_BLOCKED" });
      continue;
    }

    let rawText: string | null;
    try {
      rawText = await vaultReadFile(params.vaultRoot, vaultPath);
    } catch {
      dropped.push({ path: vaultPath, reason: "NOT_FOUND" });
      continue;
    }

    let secretGate: Awaited<ReturnType<typeof evaluateNoteForEmbeddingSecretGate>>;
    try {
      secretGate = await evaluateNoteForEmbeddingSecretGate(params.vaultRoot, rawText);
    } catch {
      dropped.push({ path: vaultPath, reason: "SECRET_GATE" });
      continue;
    }
    if (!secretGate.eligible) {
      dropped.push({
        path: vaultPath,
        reason: secretGate.reasonCode === INDEXING_SECRET_EXCLUSION_REASON ? "SECRET_GATE" : "PATH_BLOCKED",
      });
      continue;
    }

    const remainingTokens = maxTokens - tokensUsed;
    if (remainingTokens <= 0) {
      break;
    }
    const excerpt = excerptFromRawNote(vaultPath, rawText, remainingTokens * 4);
    if (excerpt.length === 0) {
      dropped.push({ path: vaultPath, reason: "NOT_FOUND" });
      continue;
    }

    const fitted = fitRecallChunkToBudget({
      path: vaultPath,
      rawText,
      score,
      remainingTokens,
    });
    if (fitted === null) {
      dropped.push({ path: vaultPath, reason: "BUDGET" });
      continue;
    }

    chunks.push(fitted.chunk);
    citations.push({ path: vaultPath, score });
    tokensUsed += fitted.tokens;
  }

  const contextBlock = formatRecallContextBlock({
    chunks,
    policyVersion: params.policy.policy_version,
    channel: params.channel,
  });

  const shadow = params.policy.shadow_mode === true;
  return {
    context: shadow ? null : contextBlock.length > 0 ? contextBlock : null,
    citations,
    channel: params.channel,
    shadow,
    policyVersion: params.policy.policy_version,
    tokensUsed,
    dropped,
  };
}
