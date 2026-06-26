import { decode, encode } from "gpt-tokenizer/encoding/cl100k_base";

export const CHUNK_TARGET_TOKENS = readEnvInt("CNS_BRAIN_CHUNK_TARGET_TOKENS", 768);
export const CHUNK_OVERLAP_TOKENS = readEnvInt("CNS_BRAIN_CHUNK_OVERLAP_TOKENS", 64);
export const CHUNK_MAX_TOKENS = 1024;
export const EMBEDDING_MODEL_MAX_TOKENS = 8191;
export const CHUNK_TOKENIZER_ENCODING = "cl100k_base" as const;
export const CHUNK_TOKENIZER_PACKAGE = "gpt-tokenizer@3.4.0" as const;

export type NoteChunk = {
  chunk_index: number;
  char_start: number;
  char_end: number;
  text: string;
};

export type ChunkNoteTextOptions = {
  targetTokens?: number;
  overlapTokens?: number;
};

export type BrainIndexChunkingMetadata = {
  target_tokens: number;
  overlap_tokens: number;
  tokenizer_encoding: typeof CHUNK_TOKENIZER_ENCODING;
  tokenizer_package: typeof CHUNK_TOKENIZER_PACKAGE;
};

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function brainIndexChunkingMetadata(
  options?: ChunkNoteTextOptions,
): BrainIndexChunkingMetadata {
  return {
    target_tokens: options?.targetTokens ?? CHUNK_TARGET_TOKENS,
    overlap_tokens: options?.overlapTokens ?? CHUNK_OVERLAP_TOKENS,
    tokenizer_encoding: CHUNK_TOKENIZER_ENCODING,
    tokenizer_package: CHUNK_TOKENIZER_PACKAGE,
  };
}

/**
 * Split note body text into overlapping token-bounded chunks for embedding.
 * Offsets index into the same string passed in (post frontmatter / agent-log strip).
 */
export function chunkNoteText(text: string, options?: ChunkNoteTextOptions): NoteChunk[] {
  const targetTokens = options?.targetTokens ?? CHUNK_TARGET_TOKENS;
  const overlapTokens = options?.overlapTokens ?? CHUNK_OVERLAP_TOKENS;

  if (targetTokens > CHUNK_MAX_TOKENS || CHUNK_MAX_TOKENS > EMBEDDING_MODEL_MAX_TOKENS) {
    throw new Error(
      `Chunk token limits invalid: target=${targetTokens}, max=${CHUNK_MAX_TOKENS}, model=${EMBEDDING_MODEL_MAX_TOKENS}`,
    );
  }
  if (overlapTokens >= targetTokens) {
    throw new Error(`Chunk overlap (${overlapTokens}) must be less than target (${targetTokens})`);
  }

  if (text.length === 0) {
    return [];
  }

  const tokens = encode(text);
  if (tokens.length === 0) {
    return [];
  }

  if (tokens.length <= targetTokens) {
    return [
      {
        chunk_index: 0,
        char_start: 0,
        char_end: text.length,
        text,
      },
    ];
  }

  const chunks: NoteChunk[] = [];
  let tokenStart = 0;
  let chunkIndex = 0;

  while (tokenStart < tokens.length) {
    const tokenEnd = Math.min(tokenStart + targetTokens, tokens.length);
    const sliceTokens = tokens.slice(tokenStart, tokenEnd);
    if (sliceTokens.length > CHUNK_MAX_TOKENS || sliceTokens.length > EMBEDDING_MODEL_MAX_TOKENS) {
      throw new Error(`Chunk exceeds token cap: ${sliceTokens.length}`);
    }

    const charStart = decode(tokens.slice(0, tokenStart)).length;
    const chunkText = decode(sliceTokens);
    const charEnd = charStart + chunkText.length;

    chunks.push({
      chunk_index: chunkIndex,
      char_start: charStart,
      char_end: charEnd,
      text: chunkText,
    });

    chunkIndex += 1;
    if (tokenEnd >= tokens.length) {
      break;
    }
    const nextStart = tokenEnd - overlapTokens;
    if (nextStart <= tokenStart) {
      break;
    }
    tokenStart = nextStart;
  }

  return chunks;
}
