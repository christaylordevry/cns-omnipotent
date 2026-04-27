/**
 * Live test runner for runChain() — wires Research → Synthesis → Hook → Boss
 * with real Firecrawl + Perplexity (Research) and real Anthropic-backed
 * LLM adapters (Synthesis, Hook, Boss).
 *
 * Usage:
 *   CNS_VAULT_ROOT="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE" \
 *   FIRECRAWL_API_KEY=... PERPLEXITY_API_KEY=... ANTHROPIC_API_KEY=... \
 *   tsx scripts/run-chain.ts
 *
 * Default output is compact, secret-safe smoke evidence. Use --raw-json only
 * for local debugging when full stage result payloads are acceptable.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runChain } from "../src/agents/run-chain.js";
import {
  type FirecrawlAdapter,
  type FirecrawlSearchResult,
} from "../src/agents/research-agent.js";
import {
  type PerplexitySlot,
  type PerplexityResult,
} from "../src/agents/perplexity-slot.js";
import { createLlmSynthesisAdapter } from "../src/agents/synthesis-adapter-llm.js";
import { createLlmHookGenerationAdapter } from "../src/agents/hook-adapter-llm.js";
import { createLlmWeaponsCheckAdapter } from "../src/agents/boss-adapter-llm.js";
import {
  buildChainSmokeEvidence,
  buildFatalChainSmokeEvidence,
  classifyVaultRoot,
  formatChainSmokeEvidenceMarkdown,
  type VaultRootClass,
} from "../src/agents/chain-smoke-evidence.js";

type CliOptions = {
  rawJson: boolean;
  evidenceFile: string | undefined;
  operatorNotes: string[];
  vaultRootClass: VaultRootClass | undefined;
  help: boolean;
};

function parseVaultRootClass(value: string): VaultRootClass {
  if (value === "staging" || value === "active" || value === "unknown") return value;
  throw new Error(`Invalid vault root class: ${value}`);
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    rawJson: false,
    evidenceFile: undefined,
    operatorNotes: [],
    vaultRootClass:
      process.env.CHAIN_VAULT_ROOT_CLASS !== undefined
        ? parseVaultRootClass(process.env.CHAIN_VAULT_ROOT_CLASS)
        : undefined,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--raw-json":
        opts.rawJson = true;
        break;
      case "--evidence-file": {
        const value = argv[++i];
        if (value === undefined) throw new Error("--evidence-file requires a path");
        opts.evidenceFile = value;
        break;
      }
      case "--operator-note": {
        const value = argv[++i];
        if (value === undefined) throw new Error("--operator-note requires text");
        opts.operatorNotes.push(value);
        break;
      }
      case "--vault-root-class": {
        const value = argv[++i];
        if (value === undefined) {
          throw new Error("--vault-root-class requires staging, active, or unknown");
        }
        opts.vaultRootClass = parseVaultRootClass(value);
        break;
      }
      case "--help":
      case "-h":
        opts.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

function printHelp(): void {
  console.log(`Usage:
  CNS_VAULT_ROOT=/path/to/staging-vault \\
  FIRECRAWL_API_KEY=... PERPLEXITY_API_KEY=... ANTHROPIC_API_KEY=... \\
  tsx scripts/run-chain.ts [--evidence-file path] [--operator-note text]

Options:
  --evidence-file path        Write compact safe evidence markdown to a file.
  --operator-note text        Add a sanitized operator note to the evidence.
  --vault-root-class value    staging, active, or unknown. Overrides auto-detect.
  --raw-json                  Also print full raw ChainRunResult JSON for local debugging.
  --help                      Show this help.
`);
}

// ---------------------------------------------------------------------------
// Firecrawl adapter — calls api.firecrawl.dev v1
// ---------------------------------------------------------------------------

function serviceErrorRecorder(): {
  errors: string[];
  record(error: string): void;
} {
  const errors: string[] = [];
  return {
    errors,
    record(error: string) {
      errors.push(error);
    },
  };
}

async function httpFailureSummary(
  service: string,
  action: string,
  res: Response,
): Promise<string> {
  const text = await res.text();
  const compactBody = text.trim().slice(0, 220);
  return compactBody.length > 0
    ? `${service} ${action} HTTP ${res.status}: ${compactBody}`
    : `${service} ${action} HTTP ${res.status}`;
}

function buildFirecrawlAdapter(
  apiKey: string,
  recordServiceError: (error: string) => void,
): FirecrawlAdapter {
  return {
    async search(query: string, opts: { limit: number }): Promise<FirecrawlSearchResult[]> {
      const res = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ query, limit: opts.limit }),
      });
      if (!res.ok) {
        const summary = await httpFailureSummary("Firecrawl", "search", res);
        recordServiceError(summary);
        throw new Error(summary);
      }
      const data = (await res.json()) as {
        data?: Array<{ url: string; title?: string; description?: string }>;
      };
      return (data.data ?? []).map((item) => ({
        url: item.url,
        title: item.title,
        snippet: item.description,
      }));
    },

    async scrape(url: string): Promise<{ markdown: string; title?: string }> {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ url, formats: ["markdown"] }),
      });
      if (!res.ok) {
        const summary = await httpFailureSummary("Firecrawl", "scrape", res);
        recordServiceError(summary);
        throw new Error(summary);
      }
      const data = (await res.json()) as {
        data?: { markdown?: string; metadata?: { title?: string } };
      };
      return {
        markdown: data.data?.markdown ?? "",
        title: data.data?.metadata?.title,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Perplexity slot — calls api.perplexity.ai sonar model
// ---------------------------------------------------------------------------

function buildPerplexitySlot(
  apiKey: string,
  recordServiceError: (error: string) => void,
): PerplexitySlot {
  return {
    available: true,
    async search(query: string): Promise<PerplexityResult> {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: query }],
        }),
      });
      if (!res.ok) {
        const summary = await httpFailureSummary("Perplexity", "search", res);
        recordServiceError(summary);
        throw new Error(summary);
      }
      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
        citations?: string[];
      };
      return {
        answer: data.choices?.[0]?.message?.content ?? "",
        citations: data.citations ?? [],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  if (cli.help) {
    printHelp();
    return;
  }

  const vaultRoot =
    process.env.CNS_VAULT_ROOT ??
    "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE";
  const vaultRootClass = cli.vaultRootClass ?? classifyVaultRoot(vaultRoot);

  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY not set");
  if (!perplexityKey) throw new Error("PERPLEXITY_API_KEY not set");
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not set");

  const brief = {
    topic: "Creative Technologist remote roles and how to position for them in 2026",
    queries: [
      "what do companies actually want when they hire a creative technologist",
      "creative technologist remote job market 2026 salary expectations",
      "how to position AI skills for creative director or creative technologist roles reddit",
    ],
    depth: "deep" as const,
  };

  console.log("=== Chain Live Smoke (Research -> Synthesis -> Hook -> Boss) ===");
  console.log(`Vault root class: ${vaultRootClass}`);
  console.log(`Brief topic: ${brief.topic}`);
  console.log("Services configured: Firecrawl, Perplexity, Anthropic");
  console.log("Running chain. Default output will be compact safe evidence.\n");

  const startedAt = Date.now();
  const serviceErrors = serviceErrorRecorder();
  try {
    const result = await runChain(vaultRoot, brief, {
      research: {
        surface: "live-test",
        adapters: {
          firecrawl: buildFirecrawlAdapter(firecrawlKey, serviceErrors.record),
          perplexity: buildPerplexitySlot(perplexityKey, serviceErrors.record),
        },
      },
      adapters: {
        synthesis: createLlmSynthesisAdapter(),
        hookGeneration: createLlmHookGenerationAdapter(),
        weaponsCheck: createLlmWeaponsCheckAdapter(),
      },
    });

    const evidence = buildChainSmokeEvidence({
      result,
      vaultRoot,
      vaultRootClass,
      brief,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      operatorNotes: cli.operatorNotes,
      externalServiceErrors: serviceErrors.errors,
    });
    const rendered = formatChainSmokeEvidenceMarkdown(evidence);
    console.log(rendered);

    if (cli.evidenceFile !== undefined) {
      await mkdir(path.dirname(cli.evidenceFile), { recursive: true });
      await writeFile(cli.evidenceFile, rendered, "utf8");
      console.log(`Evidence written: ${cli.evidenceFile}`);
    }

    if (cli.rawJson) {
      console.log("\n=== raw ChainRunResult JSON (--raw-json requested) ===");
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (err) {
    const evidence = buildFatalChainSmokeEvidence({
      error: err,
      vaultRoot,
      vaultRootClass,
      brief,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      operatorNotes: cli.operatorNotes,
    });
    const rendered = formatChainSmokeEvidenceMarkdown(evidence);
    console.error(rendered);

    if (cli.evidenceFile !== undefined) {
      await mkdir(path.dirname(cli.evidenceFile), { recursive: true });
      await writeFile(cli.evidenceFile, rendered, "utf8");
      console.error(`Evidence written: ${cli.evidenceFile}`);
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error("FATAL:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
