import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseNoteFrontmatter } from "../../src/pake/parse-frontmatter.js";
import {
  appendContentToDailyBody,
  normalizeDailySectionHeading,
  todayUtcYmd,
  vaultAppendDaily,
  vaultAppendDailyInputSchema,
} from "../../src/tools/vault-append-daily.js";

const FAKE_UTC_DAY = "2026-06-15";

const validDailyFm = `---
pake_id: "550e8400-e29b-41d4-a716-446655440000"
pake_type: WorkflowNote
title: "Daily Note ${FAKE_UTC_DAY}"
created: "${FAKE_UTC_DAY}"
modified: "${FAKE_UTC_DAY}"
status: in-progress
confidence_score: 0.5
verification_status: pending
creation_method: ai
tags:
  - daily
---

# ${FAKE_UTC_DAY}

## Log


## Agent Log


## Reflections

`;

describe("vaultAppendDaily helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FAKE_UTC_DAY}T12:00:00.000Z`));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("todayUtcYmd matches vault-update-frontmatter clock", () => {
    expect(todayUtcYmd()).toBe(FAKE_UTC_DAY);
  });

  it("normalizeDailySectionHeading adds ## for plain titles", () => {
    expect(normalizeDailySectionHeading("Agent Log")).toBe("## Agent Log");
  });

  it("normalizeDailySectionHeading preserves leading-hash lines", () => {
    expect(normalizeDailySectionHeading("## Agent Log")).toBe("## Agent Log");
  });

  it("appendContentToDailyBody appends at end when section omitted", () => {
    const body = "# x\n\nhello\n";
    expect(appendContentToDailyBody(body, "tail", undefined)).toMatch(/hello\n\ntail\n$/);
  });

  it("appendContentToDailyBody inserts under existing H2 before next H2", () => {
    const body = "## A\n\nx\n## B\n\ny\n";
    const out = appendContentToDailyBody(body, "mid", "## A");
    expect(out).toContain("## A");
    expect(out).toMatch(/## A\n\nx\n\nmid\n## B/s);
  });

  it("appendContentToDailyBody creates missing section with heading and content", () => {
    const body = "## Log\n\n";
    const out = appendContentToDailyBody(body, "note", "Fresh");
    expect(out).toContain("## Fresh");
    expect(out).toContain("note");
  });

  it("appendContentToDailyBody splices into the first duplicate H2 section (first-wins)", () => {
    const body = ["## Agent Log", "", "FIRST_SECTION_FILLER", "", "## Agent Log", "", "SECOND_SECTION_FILLER", ""].join(
      "\n",
    );
    const marker = "UNIQUE_APPEND_MARKER_6_6";
    const out = appendContentToDailyBody(body, marker, "Agent Log");
    const firstH2 = out.indexOf("## Agent Log");
    const secondH2 = out.indexOf("## Agent Log", firstH2 + 1);
    const fillerEnd = out.indexOf("FIRST_SECTION_FILLER") + "FIRST_SECTION_FILLER".length;
    const markerIdx = out.indexOf(marker);
    expect(markerIdx).toBeGreaterThan(fillerEnd);
    expect(markerIdx).toBeLessThan(secondH2);
    expect(out.indexOf("SECOND_SECTION_FILLER")).toBeGreaterThan(secondH2);
  });
});

describe("vaultAppendDaily", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${FAKE_UTC_DAY}T12:00:00.000Z`));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates missing daily and appends under ## Agent Log", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-daily-"));
    const rel = `DailyNotes/${FAKE_UTC_DAY}.md`;

    const out = await vaultAppendDaily(vaultRoot, {
      content: "Did a thing.",
      section: "Agent Log",
    });

    expect(out.path).toBe(rel);
    expect(out.appended_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const disk = await readFile(path.join(vaultRoot, rel), "utf8");
    expect(disk).toContain("## Agent Log");
    expect(disk).toContain("Did a thing.");
    expect(disk).not.toContain("[Chronological entries");
    const { frontmatter } = parseNoteFrontmatter(disk);
    expect(frontmatter.pake_type).toBe("WorkflowNote");
    expect(frontmatter.tags).toEqual(["daily"]);
    expect(frontmatter.modified).toBe(FAKE_UTC_DAY);
  });

  it("appends at end of body when section is omitted", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-daily-"));
    const rel = `DailyNotes/${FAKE_UTC_DAY}.md`;
    await mkdir(path.join(vaultRoot, "DailyNotes"), { recursive: true });
    await writeFile(path.join(vaultRoot, rel), validDailyFm, "utf8");

    await vaultAppendDaily(vaultRoot, { content: "EOF marker" });

    const disk = await readFile(path.join(vaultRoot, rel), "utf8");
    expect(disk).toMatch(/EOF marker\n$/);
    const { frontmatter } = parseNoteFrontmatter(disk);
    expect(frontmatter.modified).toBe(FAKE_UTC_DAY);
  });

  it("fails SCHEMA_INVALID when PAKE rejects post-edit frontmatter", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-daily-"));
    const rel = `DailyNotes/${FAKE_UTC_DAY}.md`;
    await mkdir(path.join(vaultRoot, "DailyNotes"), { recursive: true });
    const bad = validDailyFm.replace("confidence_score: 0.5", "confidence_score: 2");
    await writeFile(path.join(vaultRoot, rel), bad, "utf8");

    await expect(vaultAppendDaily(vaultRoot, { content: "x" })).rejects.toMatchObject({
      code: "SCHEMA_INVALID",
    });
  });

  it("fails SECRET_PATTERN when appended content matches a secret shape and PAKE passes", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-daily-"));
    const rel = `DailyNotes/${FAKE_UTC_DAY}.md`;
    await mkdir(path.join(vaultRoot, "DailyNotes"), { recursive: true });
    await writeFile(path.join(vaultRoot, rel), validDailyFm, "utf8");

    await expect(
      vaultAppendDaily(vaultRoot, { content: "leak AKIA0123456789ABCDEF" }),
    ).rejects.toMatchObject({ code: "SECRET_PATTERN" });
  });

  it("runs PAKE before secret scan when both would fail", async () => {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-daily-"));
    const rel = `DailyNotes/${FAKE_UTC_DAY}.md`;
    await mkdir(path.join(vaultRoot, "DailyNotes"), { recursive: true });
    const bad = validDailyFm.replace("confidence_score: 0.5", "confidence_score: 2");
    await writeFile(path.join(vaultRoot, rel), bad, "utf8");

    await expect(
      vaultAppendDaily(vaultRoot, { content: "AKIA0123456789ABCDEF" }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("rejects whitespace-only content in input schema", () => {
    const r = vaultAppendDailyInputSchema.safeParse({ content: "   \n" });
    expect(r.success).toBe(false);
  });
});
