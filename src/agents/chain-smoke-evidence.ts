import path from "node:path";
import type { ChainRunResult } from "./run-chain.js";
import type { ResearchBrief } from "./research-agent.js";

export type VaultRootClass = "staging" | "active" | "unknown";

export type ChainSmokeStageEvidence = {
  status: "ok" | "partial" | "skipped" | "failed" | "unknown";
  generated_vault_paths: string[];
  counts: Record<string, number>;
  service_errors: string[];
  observations: string[];
};

export type ChainSmokeEvidence = {
  schema: "cns.chain-smoke-evidence.v1";
  generated_at: string;
  duration_ms?: number;
  command_shape: string;
  vault_root: {
    class: VaultRootClass;
    basename: string;
  };
  brief: {
    topic: string;
    depth: ResearchBrief["depth"];
    query_count: number;
  };
  services: {
    firecrawl: "configured";
    apify: "configured";
    scrapling: "configured";
    perplexity: "configured";
    anthropic: "configured";
  };
  stages: {
    research: ChainSmokeStageEvidence;
    synthesis: ChainSmokeStageEvidence;
    hooks: ChainSmokeStageEvidence;
    weapons: ChainSmokeStageEvidence;
  };
  rate_limit_observations: string[];
  operator_notes: string[];
  fatal_error?: string;
};

export function sanitizeEvidenceString(input: string, maxLength = 500): string {
  let out = input;
  out = out.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]");
  out = out.replace(
    /\b(FIRECRAWL_API_KEY|APIFY_API_TOKEN|PERPLEXITY_API_KEY|ANTHROPIC_API_KEY)\s*[:=]\s*["']?[^"',\s)]+/gi,
    "$1=[REDACTED]",
  );
  out = out.replace(/\bsk-ant-[A-Za-z0-9_-]+/g, "[REDACTED_ANTHROPIC_KEY]");
  out = out.replace(/\bpplx-[A-Za-z0-9_-]+/g, "[REDACTED_PERPLEXITY_KEY]");
  out = out.replace(/\bfc-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_FIRECRAWL_KEY]");
  out = out.replace(
    /([?&](?:api_?key|key|token|auth|authorization|access_token|client_secret)=)[^&\s]+/gi,
    "$1[REDACTED]",
  );

  if (out.length > maxLength) {
    return `${out.slice(0, maxLength)}... [truncated]`;
  }
  return out;
}

export function classifyVaultRoot(vaultRoot: string): VaultRootClass {
  const normalized = vaultRoot.toLowerCase();
  if (
    /\bstaging\b/.test(normalized) ||
    /\bfixture\b/.test(normalized) ||
    normalized.includes("minimal-vault") ||
    normalized.includes("live-smoke") ||
    normalized.includes("/tmp/") ||
    normalized.includes("\\tmp\\")
  ) {
    return "staging";
  }
  if (normalized.includes("knowledge-vault-active") || /\bactive\b/.test(normalized)) {
    return "active";
  }
  return "unknown";
}

export function safeCommandShape(): string {
  return [
    'CNS_VAULT_ROOT="<staging-vault-root>"',
    "FIRECRAWL_API_KEY=[REDACTED]",
    "APIFY_API_TOKEN=[REDACTED]",
    'SCRAPLING_COMMAND="scrapling"',
    "PERPLEXITY_API_KEY=[REDACTED]",
    "ANTHROPIC_API_KEY=[REDACTED]",
    "tsx scripts/run-chain.ts",
  ].join(" ");
}

function uniqueSanitized(items: string[], maxItems = 12): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const sanitized = sanitizeEvidenceString(item);
    if (seen.has(sanitized)) continue;
    seen.add(sanitized);
    out.push(sanitized);
    if (out.length >= maxItems) break;
  }
  return out;
}

function researchStage(result: ChainRunResult): ChainSmokeStageEvidence {
  const created = result.sweep.notes_created;
  const skipped = result.sweep.notes_skipped;
  const fetchFailures = skipped.filter((note) => note.reason === "fetch_error");
  const status =
    created.length > 0
      ? skipped.length > 0
        ? "partial"
        : "ok"
      : skipped.length > 0 || result.sweep.perplexity_skipped
        ? "failed"
        : "unknown";

  return {
    status,
    generated_vault_paths: uniqueSanitized(created.map((note) => note.vault_path)),
    counts: {
      notes_created: created.length,
      notes_skipped: skipped.length,
      perplexity_answers_filed: result.sweep.perplexity_answers_filed,
    },
    service_errors: uniqueSanitized(fetchFailures.map((note) => note.source_uri), 5),
    observations: [
      result.sweep.perplexity_skipped
        ? "Perplexity was skipped or unavailable during probe."
        : "Perplexity available.",
    ],
  };
}

function synthesisStage(result: ChainRunResult): ChainSmokeStageEvidence {
  if (result.synthesis.status === "skipped") {
    return {
      status: "skipped",
      generated_vault_paths: [],
      counts: {
        sources_read_failed: result.synthesis.sources_read_failed.length,
      },
      service_errors: [],
      observations: [`Skipped: ${result.synthesis.reason}`],
    };
  }

  return {
    status: "ok",
    generated_vault_paths: [sanitizeEvidenceString(result.synthesis.insight_note.vault_path)],
    counts: {
      sources_used: result.synthesis.sources_used.length,
      sources_read_failed: result.synthesis.sources_read_failed.length,
    },
    service_errors: uniqueSanitized(result.synthesis.sources_read_failed, 5),
    observations: [],
  };
}

function hooksStage(result: ChainRunResult): ChainSmokeStageEvidence {
  if (result.hooks.status === "skipped") {
    return {
      status: "skipped",
      generated_vault_paths: [],
      counts: {},
      service_errors: [],
      observations: [`Skipped: ${result.hooks.reason}`],
    };
  }

  return {
    status: "ok",
    generated_vault_paths: [sanitizeEvidenceString(result.hooks.hook_set_note.vault_path)],
    counts: {
      options: result.hooks.options.length,
      total_iterations: result.hooks.options.reduce(
        (total, option) => total + option.iterations,
        0,
      ),
    },
    service_errors: [],
    observations: [],
  };
}

function weaponsStage(result: ChainRunResult): ChainSmokeStageEvidence {
  if (result.weapons.status === "skipped") {
    return {
      status: "skipped",
      generated_vault_paths: [],
      counts: {},
      service_errors: [],
      observations: [`Skipped: ${result.weapons.reason}`],
    };
  }

  return {
    status: "ok",
    generated_vault_paths: [
      sanitizeEvidenceString(result.weapons.weapons_check_note.vault_path),
    ],
    counts: {
      options: result.weapons.options.length,
      total_iterations: result.weapons.options.reduce(
        (total, option) => total + option.iterations,
        0,
      ),
    },
    service_errors: [],
    observations: [],
  };
}

function detectRateLimitObservations(values: string[]): string[] {
  const observations: string[] = [];
  for (const raw of values) {
    if (/\b429\b|rate[-\s]?limit|retry/i.test(raw)) {
      observations.push(sanitizeEvidenceString(raw));
    }
  }
  return uniqueSanitized(observations, 5);
}

export function buildChainSmokeEvidence(args: {
  result: ChainRunResult;
  vaultRoot: string;
  vaultRootClass?: VaultRootClass;
  brief: ResearchBrief;
  generatedAt: string;
  durationMs?: number;
  operatorNotes?: string[];
  externalServiceErrors?: string[];
}): ChainSmokeEvidence {
  const stages = {
    research: researchStage(args.result),
    synthesis: synthesisStage(args.result),
    hooks: hooksStage(args.result),
    weapons: weaponsStage(args.result),
  };
  if (args.externalServiceErrors !== undefined) {
    stages.research.service_errors = uniqueSanitized(
      [...stages.research.service_errors, ...args.externalServiceErrors],
      12,
    );
  }
  const serviceErrorText = Object.values(stages).flatMap((stage) => stage.service_errors);

  return {
    schema: "cns.chain-smoke-evidence.v1",
    generated_at: args.generatedAt,
    duration_ms: args.durationMs,
    command_shape: safeCommandShape(),
    vault_root: {
      class: args.vaultRootClass ?? classifyVaultRoot(args.vaultRoot),
      basename: sanitizeEvidenceString(path.basename(args.vaultRoot)),
    },
    brief: {
      topic: sanitizeEvidenceString(args.brief.topic),
      depth: args.brief.depth,
      query_count: args.brief.queries.length,
    },
    services: {
      firecrawl: "configured",
      apify: "configured",
      scrapling: "configured",
      perplexity: "configured",
      anthropic: "configured",
    },
    stages,
    rate_limit_observations: detectRateLimitObservations(serviceErrorText),
    operator_notes: (args.operatorNotes ?? []).map((note) =>
      sanitizeEvidenceString(note, 700),
    ),
  };
}

export function buildFatalChainSmokeEvidence(args: {
  error: unknown;
  vaultRoot: string;
  vaultRootClass?: VaultRootClass;
  brief: ResearchBrief;
  generatedAt: string;
  durationMs?: number;
  operatorNotes?: string[];
}): ChainSmokeEvidence {
  const errorText =
    args.error instanceof Error ? args.error.message : String(args.error);
  const sanitizedError = sanitizeEvidenceString(errorText, 700);
  return {
    schema: "cns.chain-smoke-evidence.v1",
    generated_at: args.generatedAt,
    duration_ms: args.durationMs,
    command_shape: safeCommandShape(),
    vault_root: {
      class: args.vaultRootClass ?? classifyVaultRoot(args.vaultRoot),
      basename: sanitizeEvidenceString(path.basename(args.vaultRoot)),
    },
    brief: {
      topic: sanitizeEvidenceString(args.brief.topic),
      depth: args.brief.depth,
      query_count: args.brief.queries.length,
    },
    services: {
      firecrawl: "configured",
      apify: "configured",
      scrapling: "configured",
      perplexity: "configured",
      anthropic: "configured",
    },
    stages: {
      research: {
        status: "unknown",
        generated_vault_paths: [],
        counts: {},
        service_errors: [],
        observations: ["Run aborted before a complete ChainRunResult was returned."],
      },
      synthesis: {
        status: "unknown",
        generated_vault_paths: [],
        counts: {},
        service_errors: [],
        observations: ["Run aborted before a complete ChainRunResult was returned."],
      },
      hooks: {
        status: "unknown",
        generated_vault_paths: [],
        counts: {},
        service_errors: [],
        observations: ["Run aborted before a complete ChainRunResult was returned."],
      },
      weapons: {
        status: "unknown",
        generated_vault_paths: [],
        counts: {},
        service_errors: [],
        observations: ["Run aborted before a complete ChainRunResult was returned."],
      },
    },
    rate_limit_observations: detectRateLimitObservations([sanitizedError]),
    operator_notes: (args.operatorNotes ?? []).map((note) =>
      sanitizeEvidenceString(note, 700),
    ),
    fatal_error: sanitizedError,
  };
}

function renderCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) return "none";
  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}

function renderStage(name: string, stage: ChainSmokeStageEvidence): string[] {
  const lines = [`| ${name} | ${stage.status} | ${renderCounts(stage.counts)} |`];
  for (const vaultPath of stage.generated_vault_paths) {
    lines.push(`  - generated: ${vaultPath}`);
  }
  for (const error of stage.service_errors) {
    lines.push(`  - service/error: ${error}`);
  }
  for (const observation of stage.observations) {
    lines.push(`  - observation: ${observation}`);
  }
  return lines;
}

export function formatChainSmokeEvidenceMarkdown(evidence: ChainSmokeEvidence): string {
  const lines: string[] = [
    "## Live Chain Smoke Evidence",
    "",
    `- Date: ${evidence.generated_at}`,
    `- Duration ms: ${evidence.duration_ms ?? "not-recorded"}`,
    `- Command shape: \`${evidence.command_shape}\``,
    `- Vault root class: ${evidence.vault_root.class} (${evidence.vault_root.basename})`,
    `- Brief topic: ${evidence.brief.topic}`,
    `- Depth/query count: ${evidence.brief.depth} / ${evidence.brief.query_count}`,
    "- Services: Firecrawl configured, Apify configured, Scrapling configured, Perplexity configured, Anthropic configured",
    "",
    "| Stage | Status | Counts |",
    "| --- | --- | --- |",
    ...renderStage("Research", evidence.stages.research),
    ...renderStage("Synthesis", evidence.stages.synthesis),
    ...renderStage("Hook", evidence.stages.hooks),
    ...renderStage("Boss", evidence.stages.weapons),
    "",
    "### Retry / Rate-Limit Observations",
  ];

  if (evidence.rate_limit_observations.length === 0) {
    lines.push("- None observed in compact evidence.");
  } else {
    for (const observation of evidence.rate_limit_observations) {
      lines.push(`- ${observation}`);
    }
  }

  if (evidence.operator_notes.length > 0) {
    lines.push("", "### Operator Notes");
    for (const note of evidence.operator_notes) {
      lines.push(`- ${note}`);
    }
  }

  if (evidence.fatal_error !== undefined) {
    lines.push("", "### Fatal Error", `- ${evidence.fatal_error}`);
  }

  return `${lines.join("\n")}\n`;
}
