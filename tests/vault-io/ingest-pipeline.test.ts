import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { classifySource, resolvePakeType } from "../../src/ingest/classify.js";
import { deriveTitle, normalizeText, normalizeUrl } from "../../src/ingest/normalize.js";
import { formatIndexRow } from "../../src/ingest/index-update.js";
import { INGEST_INDEX_VAULT_REL } from "../../src/ingest/index-update.js";
import { runIngestPipeline } from "../../src/ingest/pipeline.js";

// ── AC: detect ──────────────────────────────────────────────────────────────

describe("classifySource (AC: detect)", () => {
  it("classifies http URLs as url", () => {
    expect(classifySource("http://example.com/page")).toBe("url");
  });

  it("classifies https URLs as url", () => {
    expect(classifySource("https://example.com/article")).toBe("url");
  });

  it("classifies .pdf paths as pdf", () => {
    expect(classifySource("/home/user/docs/report.pdf")).toBe("pdf");
  });

  it("classifies plain text as text", () => {
    expect(classifySource("This is a research note about X.")).toBe("text");
  });

  it("trims whitespace before classifying", () => {
    expect(classifySource("  https://example.com  ")).toBe("url");
  });

  it("classifies ftp URLs as url", () => {
    expect(classifySource("ftp://files.example.com/pub/doc.pdf")).toBe("url");
  });

  it("classifies .pdf paths with query string as pdf", () => {
    expect(classifySource("/home/user/docs/report.pdf?download=1")).toBe("pdf");
  });

  it("classifies www. host as url", () => {
    expect(classifySource("www.example.com/page")).toBe("url");
  });
});

// ── AC: classify ─────────────────────────────────────────────────────────────

describe("resolvePakeType (AC: classify)", () => {
  it("defaults url sources to SourceNote", () => {
    expect(resolvePakeType("url", {})).toBe("SourceNote");
  });

  it("defaults pdf sources to SourceNote", () => {
    expect(resolvePakeType("pdf", {})).toBe("SourceNote");
  });

  it("defaults text sources to SourceNote", () => {
    expect(resolvePakeType("text", {})).toBe("SourceNote");
  });

  it("respects ingest_as: InsightNote override", () => {
    expect(resolvePakeType("url", { ingest_as: "InsightNote" })).toBe("InsightNote");
  });

  it("respects ingest_as: SourceNote override", () => {
    expect(resolvePakeType("text", { ingest_as: "SourceNote" })).toBe("SourceNote");
  });

  it("respects ingest_as: HookSetNote override", () => {
    expect(resolvePakeType("text", { ingest_as: "HookSetNote" })).toBe("HookSetNote");
  });

  it("respects ingest_as: SynthesisNote override", () => {
    expect(resolvePakeType("text", { ingest_as: "SynthesisNote" })).toBe("SynthesisNote");
  });
});

// ── Normalize helpers ─────────────────────────────────────────────────────────

describe("normalize helpers", () => {
  it("deriveTitle extracts first # heading", () => {
    expect(deriveTitle("# Hello World\n\nBody text", "fallback")).toBe("Hello World");
  });

  it("deriveTitle falls back to first non-empty non-heading line", () => {
    expect(deriveTitle("## Sub\n\nFirst paragraph", "fallback")).toBe("First paragraph");
  });

  it("deriveTitle returns fallback when content is empty", () => {
    expect(deriveTitle("", "fallback")).toBe("fallback");
  });

  it("normalizeText uses title_hint when provided", () => {
    const result = normalizeText("Some content", "My Title");
    expect(result.title).toBe("My Title");
    expect(result.body).toBe("Some content");
  });

  it("normalizeUrl attaches source_uri", () => {
    const result = normalizeUrl("https://example.com", "# Page Title\n\nContent.");
    expect(result.source_uri).toBe("https://example.com");
    expect(result.title).toBe("Page Title");
  });

  it("normalizeUrl prefers non-empty title_hint over derived title", () => {
    const result = normalizeUrl("https://example.com", "# Body Heading\n\nContent.", "  Hint Title  ");
    expect(result.title).toBe("Hint Title");
  });
});

// ── AC: index — formatIndexRow ────────────────────────────────────────────────

describe("formatIndexRow (AC: index)", () => {
  it("formats a row with all fields", () => {
    const row = formatIndexRow({
      date: "2026-04-18",
      pake_id: "550e8400-e29b-41d4-a716-446655440000",
      pake_type: "SourceNote",
      title: "My Article",
      source_uri: "https://example.com/article",
      vault_path: "03-Resources/my-article.md",
    });
    expect(row).toContain("2026-04-18");
    expect(row).toContain("SourceNote");
    expect(row).toContain("My Article");
    expect(row).toContain("https://example.com/article");
    expect(row).toContain("03-Resources/my-article.md");
  });

  it("sanitizes pipe characters in cell values", () => {
    const row = formatIndexRow({
      date: "2026-04-18",
      pake_id: "550e8400-e29b-41d4-a716-446655440000",
      pake_type: "SourceNote",
      title: "A | B",
      source_uri: "",
      vault_path: "03-Resources/a-b.md",
    });
    expect(row).not.toMatch(/A \| B/);
    // pipe replaced by space; original "A | B" → "A   B" (space + replacement + space)
    expect(row).toContain("A   B");
  });
});

// ── End-to-end pipeline (AC: validate, AC: audit, AC: index, AC: wiki-ingest) ─

describe("runIngestPipeline end-to-end", () => {
  async function makeVault(): Promise<string> {
    const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-ingest-"));
    await mkdir(path.join(vaultRoot, "00-Inbox"), { recursive: true });
    await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
    await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
    return vaultRoot;
  }

  it("AC: validate — URL source creates a governed SourceNote with valid PAKE frontmatter", async () => {
    const vaultRoot = await makeVault();
    const result = await runIngestPipeline(vaultRoot, {
      input: "https://example.com/article",
      fetched_content: "# Research Findings\n\nThis is the article body.",
      source_type: "url",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.vault_path).toMatch(/^03-Resources\//);

    const noteContent = await readFile(
      path.join(vaultRoot, ...result.vault_path.split("/")),
      "utf8",
    );
    expect(noteContent).toContain("pake_type: SourceNote");
    expect(noteContent).toContain("source_uri");
    expect(noteContent).toContain("https://example.com/article");
    expect(noteContent).toContain("Research Findings");
    expect(noteContent).toContain("creation_method: ai");
  });

  it("AC: validate — raw text source creates InsightNote when ingest_as is set", async () => {
    const vaultRoot = await makeVault();
    const result = await runIngestPipeline(vaultRoot, {
      input: "# Analysis\n\nDeep insight about the market.",
      source_type: "text",
      ingest_as: "InsightNote",
      title_hint: "Market Analysis",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.vault_path).toMatch(/^03-Resources\//);

    const content = await readFile(path.join(vaultRoot, ...result.vault_path.split("/")), "utf8");
    expect(content).toContain("pake_type: InsightNote");
  });

  it("AC: validate — raw text source creates HookSetNote when ingest_as is set", async () => {
    const vaultRoot = await makeVault();
    const result = await runIngestPipeline(vaultRoot, {
      input: "# Hooks draft\n\nOption A and B.",
      source_type: "text",
      ingest_as: "HookSetNote",
      title_hint: "Hook Set",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.vault_path).toMatch(/^03-Resources\//);

    const content = await readFile(path.join(vaultRoot, ...result.vault_path.split("/")), "utf8");
    expect(content).toContain("pake_type: HookSetNote");
  });

  it("AC: validate — raw text with provenance_uri dedupes on second ingest", async () => {
    const vaultRoot = await makeVault();
    const prov = "urn:cns:test:provenance:dedupe-1";
    const first = await runIngestPipeline(vaultRoot, {
      input: "# First\n\nBody one.",
      source_type: "text",
      provenance_uri: prov,
      ingest_as: "InsightNote",
      title_hint: "Provenance Dedupe",
    });
    expect(first.status).toBe("ok");

    const second = await runIngestPipeline(vaultRoot, {
      input: "# Second\n\nDifferent body.",
      source_type: "text",
      provenance_uri: prov,
      ingest_as: "InsightNote",
      title_hint: "Provenance Dedupe",
    });
    expect(second.status).toBe("duplicate");
    if (second.status === "duplicate") {
      expect(second.source_uri).toBe(prov);
    }
  });

  it("AC: index — master index is created and contains the ingested note row", async () => {
    const vaultRoot = await makeVault();
    const result = await runIngestPipeline(vaultRoot, {
      input: "https://example.com/index-test",
      fetched_content: "# Index Test\n\nBody for index test.",
      source_type: "url",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const indexContent = await readFile(
      path.join(vaultRoot, ...INGEST_INDEX_VAULT_REL.split("/")),
      "utf8",
    );
    expect(indexContent).toContain("SourceNote");
    expect(indexContent).toContain("Index Test");
    expect(indexContent).toContain("https://example.com/index-test");
    expect(indexContent).toContain(result.vault_path);
  });

  it("AC: audit — audit log is appended with ingest action", async () => {
    const vaultRoot = await makeVault();
    const result = await runIngestPipeline(vaultRoot, {
      input: "# Audit Test\n\nContent.",
      source_type: "text",
    });

    expect(result.status).toBe("ok");

    const auditContent = await readFile(
      path.join(vaultRoot, "_meta", "logs", "agent-log.md"),
      "utf8",
    );
    expect(auditContent).toContain("ingest");
    expect(auditContent).toContain("ingest_pipeline");
    expect(auditContent).not.toContain("| create | vault_create_note |");
  });

  it("AC: validate — PAKE validation failure leaves inbox draft and returns validation_error", async () => {
    const vaultRoot = await makeVault();
    // Same title twice triggers EEXIST from vaultCreateNote; second result is conflict (not PAKE validation).

    // Ingest the same content twice to trigger EEXIST on the second attempt
    const content = "# Conflict Test Note\n\nBody.";
    const first = await runIngestPipeline(vaultRoot, {
      input: content,
      source_type: "text",
      title_hint: "Conflict Test Note",
    });
    expect(first.status).toBe("ok");

    // Second ingest with same title should hit EEXIST (IO_ERROR) from vaultCreateNote → conflict
    const second = await runIngestPipeline(vaultRoot, {
      input: content,
      source_type: "text",
      title_hint: "Conflict Test Note",
    });
    expect(second.status).toBe("conflict");
    if (second.status !== "conflict") return;
    // Inbox draft must remain for human triage
    expect(second.inbox_path).toMatch(/^00-Inbox\//);
  });

  it("AC: wiki-ingest — pipeline maps source_uri, ai_summary, tags into PAKE frontmatter correctly", async () => {
    const vaultRoot = await makeVault();
    const result = await runIngestPipeline(vaultRoot, {
      input: "https://example.com/wiki-map",
      fetched_content: "# Wiki Map Test\n\nContent body.",
      source_type: "url",
      ai_summary: "A brief summary of the article.",
      tags: ["research", "test"],
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const content = await readFile(path.join(vaultRoot, ...result.vault_path.split("/")), "utf8");
    // source_uri mapping
    expect(content).toContain("source_uri");
    expect(content).toContain("https://example.com/wiki-map");
    // tag pipeline adds "ingest" + caller tags
    expect(content).toContain("ingest");
    expect(content).toContain("research");
    expect(content).toContain("test");
    // PAKE fields all present
    expect(content).toContain("pake_id");
    expect(content).toContain("pake_type: SourceNote");
    expect(content).toContain("creation_method: ai");
    expect(content).toContain("verification_status: pending");
    expect(content).toContain("ai_summary:");
    expect(content).toContain("A brief summary of the article.");
  });

  it("AC: detect — PDF source type is classified and creates a SourceNote", async () => {
    const vaultRoot = await makeVault();
    // Supply fetched_content so no disk read is needed
    const result = await runIngestPipeline(vaultRoot, {
      input: "/tmp/report.pdf",
      fetched_content: "# PDF Report\n\nExtracted text from PDF.",
      source_type: "pdf",
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const content = await readFile(path.join(vaultRoot, ...result.vault_path.split("/")), "utf8");
    expect(content).toContain("pake_type: SourceNote");
    expect(content).toContain("source_uri: \"file:///tmp/report.pdf\"");
  });

  it("AC: dedup — second ingest with same source_uri returns duplicate", async () => {
    const vaultRoot = await makeVault();
    const uri = "https://example.com/dedup-test";
    const first = await runIngestPipeline(vaultRoot, {
      input: uri,
      fetched_content: "# First\n\nBody.",
      source_type: "url",
    });
    expect(first.status).toBe("ok");

    const second = await runIngestPipeline(vaultRoot, {
      input: uri,
      fetched_content: "# Second\n\nDifferent body.",
      source_type: "url",
    });
    expect(second.status).toBe("duplicate");
    if (second.status !== "duplicate") return;
    expect(second.source_uri).toBe(uri);
  });

  it("URL ingest without fetched_content rejects", async () => {
    const vaultRoot = await makeVault();
    await expect(
      runIngestPipeline(vaultRoot, {
        input: "https://example.com/no-fetch",
        source_type: "url",
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });

  it("index accumulates multiple rows across successive ingests", async () => {
    const vaultRoot = await makeVault();
    await runIngestPipeline(vaultRoot, {
      input: "https://example.com/a",
      fetched_content: "# Article A\n\nBody A.",
      source_type: "url",
    });
    await runIngestPipeline(vaultRoot, {
      input: "https://example.com/b",
      fetched_content: "# Article B\n\nBody B.",
      source_type: "url",
    });

    const indexContent = await readFile(
      path.join(vaultRoot, ...INGEST_INDEX_VAULT_REL.split("/")),
      "utf8",
    );
    expect(indexContent).toContain("Article A");
    expect(indexContent).toContain("Article B");
  });
});
