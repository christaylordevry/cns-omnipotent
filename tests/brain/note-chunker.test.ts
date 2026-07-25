import { describe, expect, it } from "vitest";
import { decode, encode } from "gpt-tokenizer/encoding/cl100k_base";
import {
  CHUNK_MAX_TOKENS,
  CHUNK_OVERLAP_TOKENS,
  CHUNK_TARGET_TOKENS,
  chunkNoteText,
} from "../../src/brain/note-chunker.js";

describe("chunkNoteText", () => {
  it("returns empty array for empty input", () => {
    expect(chunkNoteText("")).toEqual([]);
  });

  it("returns a single chunk for short notes", () => {
    const text = "Hello, short note body.";
    const chunks = chunkNoteText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      chunk_index: 0,
      char_start: 0,
      char_end: text.length,
      text,
    });
  });

  it("splits long notes into multiple chunks with overlap", () => {
    const words = Array.from({ length: 1200 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkNoteText(words, { targetTokens: 100, overlapTokens: 10 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(encode(chunk.text).length).toBeLessThanOrEqual(100);
      expect(encode(chunk.text).length).toBeLessThanOrEqual(CHUNK_MAX_TOKENS);
      expect(chunk.text).toBe(words.slice(chunk.char_start, chunk.char_end));
    }

    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i]!.chunk_index).toBe(i);
      expect(chunks[i]!.char_start).toBeGreaterThanOrEqual(chunks[i - 1]!.char_start);
    }
  });

  it("uses env-tunable defaults", () => {
    expect(CHUNK_TARGET_TOKENS).toBeGreaterThan(0);
    expect(CHUNK_OVERLAP_TOKENS).toBeGreaterThan(0);
    expect(CHUNK_TARGET_TOKENS).toBeLessThanOrEqual(CHUNK_MAX_TOKENS);
  });

  it("preserves lossless char offsets via cumulative decode", () => {
    const text = "The quick brown fox jumps over the lazy dog. ".repeat(80);
    const chunks = chunkNoteText(text, { targetTokens: 64, overlapTokens: 8 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(text.slice(chunk.char_start, chunk.char_end)).toBe(chunk.text);
      expect(decode(encode(chunk.text))).toBe(chunk.text);
    }
  });
});
