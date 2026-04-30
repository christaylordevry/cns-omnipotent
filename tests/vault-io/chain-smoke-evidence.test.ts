import { describe, expect, it } from "vitest";
import {
  buildChainSmokeEvidence,
  buildFatalChainSmokeEvidence,
  classifyVaultRoot,
  formatChainSmokeEvidenceMarkdown,
  safeCommandShape,
  sanitizeEvidenceString,
} from "../../src/agents/chain-smoke-evidence.js";
import type { ChainRunResult } from "../../src/agents/run-chain.js";
import type { ResearchBrief } from "../../src/agents/research-agent.js";

const brief: ResearchBrief = {
  topic: "Creative Technologist remote roles",
  queries: ["creative technologist jobs", "AI portfolio positioning"],
  depth: "deep",
};

const resultOk: ChainRunResult = {
  sweep: {
    brief_topic: brief.topic,
    notes_created: [
      {
        vault_path: "03-Resources/source-a.md",
        pake_id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
        source_uri: "https://example.com/a?api_key=sk-ant-secret-value",
        source: "firecrawl",
      },
    ],
    notes_skipped: [
      {
        source_uri: "https://api.firecrawl.dev/error?token=fc-123456789012345678901234",
        reason: "fetch_error",
      },
    ],
    perplexity_skipped: false,
    perplexity_answers_filed: 1,
    sweep_timestamp: "2026-04-22T00:00:00.000Z",
  },
  synthesis: {
    status: "ok",
    insight_note: {
      vault_path: "03-Resources/synthesis.md",
      pake_id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
    },
    sources_used: ["03-Resources/source-a.md"],
    sources_read_failed: [],
    synthesis_timestamp: "2026-04-22T00:01:00.000Z",
  },
  hooks: {
    status: "ok",
    hook_set_note: {
      vault_path: "03-Resources/hooks.md",
      pake_id: "cccccccc-cccc-4ccc-bccc-cccccccccccc",
    },
    synthesis_insight_path: "03-Resources/synthesis.md",
    options: [
      {
        slot: 1,
        final_hook: "Do not include raw hook body in compact evidence sk-ant-hidden.",
        iterations: 3,
        trace: [{ iteration: 3, score: 10 }],
      },
    ],
    hook_timestamp: "2026-04-22T00:02:00.000Z",
  },
  weapons: {
    status: "ok",
    weapons_check_note: {
      vault_path: "03-Resources/weapons.md",
      pake_id: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
    },
    hook_set_note_path: "03-Resources/hooks.md",
    synthesis_insight_path: "03-Resources/synthesis.md",
    options: [
      {
        slot: 1,
        final_hook: "Do not include raw weapons body in compact evidence pplx-hidden.",
        iterations: 1,
        trace: [
          {
            iteration: 1,
            novelty: 10,
            copy_intensity: 10,
            rationale: "Do not include trace rationale in compact evidence.",
          },
        ],
      },
    ],
    weapons_timestamp: "2026-04-22T00:03:00.000Z",
  },
};

describe("chain smoke evidence formatting", () => {
  it("redacts known API key and auth-header shapes", () => {
    const raw =
      "Authorization: Bearer sk-ant-api03-secret FIRECRAWL_API_KEY=fc-123456789012345678901234 url=https://x.test?access_token=pplx-secret";

    const sanitized = sanitizeEvidenceString(raw);

    expect(sanitized).toContain("Bearer [REDACTED]");
    expect(sanitized).toContain("FIRECRAWL_API_KEY=[REDACTED]");
    expect(sanitized).toContain("access_token=[REDACTED]");
    expect(sanitized).not.toContain("sk-ant-api03-secret");
    expect(sanitized).not.toContain("fc-123456789012345678901234");
    expect(sanitized).not.toContain("pplx-secret");
  });

  it("builds compact evidence without raw hook, weapons, or secret-bearing payloads", () => {
    const evidence = buildChainSmokeEvidence({
      result: resultOk,
      vaultRoot: "/tmp/cns-live-smoke-vault",
      brief,
      generatedAt: "2026-04-22T00:04:00.000Z",
      durationMs: 1234,
      operatorNotes: ["Operator note with ANTHROPIC_API_KEY=sk-ant-note-secret"],
      externalServiceErrors: [
        "Firecrawl search HTTP 401: bearer token invalid sk-ant-service-secret",
      ],
    });

    const rendered = formatChainSmokeEvidenceMarkdown(evidence);

    expect(evidence.vault_root.class).toBe("staging");
    expect(rendered).toContain("| Research | ok |");
    expect(rendered).toContain("PAKE++ validation: UNKNOWN");
    expect(rendered).toContain("03-Resources/synthesis.md");
    expect(rendered).toContain("03-Resources/hooks.md");
    expect(rendered).toContain("03-Resources/weapons.md");
    expect(rendered).toContain("token=[REDACTED]");
    expect(rendered).toContain("Firecrawl search HTTP 401");
    expect(rendered).toContain("ANTHROPIC_API_KEY=[REDACTED]");
    expect(rendered).not.toContain("raw hook body");
    expect(rendered).not.toContain("raw weapons body");
    expect(rendered).not.toContain("trace rationale");
    expect(rendered).not.toContain("sk-ant-note-secret");
    expect(rendered).not.toContain("sk-ant-service-secret");
  });

  it("summarizes fatal errors with redaction and rate-limit observations", () => {
    const evidence = buildFatalChainSmokeEvidence({
      error: new Error(
        "Anthropic HTTP 429 retry exhausted with Authorization: Bearer sk-ant-fatal",
      ),
      vaultRoot: "/vaults/staging",
      brief,
      generatedAt: "2026-04-22T00:05:00.000Z",
    });

    const rendered = formatChainSmokeEvidenceMarkdown(evidence);

    expect(rendered).toContain("Fatal Error");
    expect(rendered).toContain("PAKE++ validation: UNKNOWN");
    expect(rendered).toContain("429");
    expect(rendered).toContain("Rate-Limit");
    expect(rendered).toContain("Bearer [REDACTED]");
    expect(rendered).not.toContain("sk-ant-fatal");
    expect(evidence.rate_limit_observations).toHaveLength(1);
  });

  it("uses a secret-safe command shape and classifies common vault roots", () => {
    expect(safeCommandShape()).toContain("FIRECRAWL_API_KEY=[REDACTED]");
    if (process.env.FIRECRAWL_API_KEY) {
      expect(safeCommandShape()).not.toContain(process.env.FIRECRAWL_API_KEY);
    }
    expect(classifyVaultRoot("/tmp/cns-live-smoke-vault")).toBe("staging");
    expect(classifyVaultRoot("/Users/chris/Knowledge-Vault-ACTIVE")).toBe("active");
  });
});
