/**
 * Live test runner for runChain() — wires Research → Synthesis → Hook → Boss
 * with real Firecrawl + Apify + Scrapling + Perplexity (Research) and real
 * Anthropic-backed LLM adapters (Synthesis, Hook, Boss).
 *
 * Usage:
 *   CNS_VAULT_ROOT="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE" \
 *   FIRECRAWL_API_KEY=... APIFY_API_TOKEN=... PERPLEXITY_API_KEY=... ANTHROPIC_API_KEY=... \
 *   tsx scripts/run-chain.ts
 *
 * Select a brief with CNS_BRIEF_TOPIC, --brief-file, or --topic/--query.
 *
 * Default output is compact, secret-safe smoke evidence. Use --raw-json only
 * for local debugging when full stage result payloads are acceptable.
 */

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import matter from "gray-matter";
import { runChain } from "../src/agents/run-chain.js";
import {
  createPerplexitySlot,
  type FirecrawlAdapter,
  type FirecrawlSearchResult,
  isSocialDomain,
  researchBriefSchema,
  type ResearchBrief,
} from "../src/agents/research-agent.js";
import { buildApifyAdapter } from "../src/adapters/apify-adapter.js";
import { buildScraplingAdapter } from "../src/adapters/scrapling-adapter.js";
import {
  type PerplexitySlot,
  type PerplexityResult,
} from "../src/agents/perplexity-slot.js";
import { createLlmSynthesisAdapter } from "../src/agents/synthesis-adapter-llm.js";
import { createLlmHookGenerationAdapter } from "../src/agents/hook-adapter-llm.js";
import { createLlmWeaponsCheckAdapter } from "../src/agents/boss-adapter-llm.js";
import {
  createDefaultVaultReadAdapter,
  validatePakeSynthesisBody,
  type SynthesisRunResult,
} from "../src/agents/synthesis-agent.js";
import { DEFAULT_OPERATOR_CONTEXT } from "../src/agents/operator-context.js";
import {
  buildVaultContextPacket,
  loadOperatorContextFromVault,
  type VaultContextPacket,
} from "../src/agents/vault-context-builder.js";
import {
  buildChainSmokeEvidence,
  buildFatalChainSmokeEvidence,
  classifyVaultRoot,
  formatChainSmokeEvidenceMarkdown,
  sanitizeEvidenceString,
  type PakeValidationEvidence,
  type VaultRootClass,
} from "../src/agents/chain-smoke-evidence.js";
import { resolveVaultPath } from "../src/paths.js";
import { assertWriteAllowed } from "../src/write-gate.js";
import type { OperatorContext } from "../src/agents/operator-context.js";

type CliOptions = {
  rawJson: boolean;
  evidenceFile: string | undefined;
  operatorNotes: string[];
  vaultRootClass: VaultRootClass | undefined;
  briefFile: string | undefined;
  topic: string | undefined;
  queries: string[];
  depth: ResearchBrief["depth"] | undefined;
  verboseCleanup: boolean;
  help: boolean;
};

export const DEFAULT_BRIEF_TOPIC =
  "freelance consulting day rate calculation methodology 2026";

const DEFAULT_BRIEF_QUERIES = [
  "freelance consulting day rate calculation methodology 2026",
  "reddit.com freelance consultant day rate pricing 2026",
  "freelance consultant pricing strategy value based vs hourly 2026 bot protected pricing guide",
] as const;

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
    briefFile: undefined,
    topic: undefined,
    queries: [],
    depth: undefined,
    verboseCleanup: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--raw-json":
        opts.rawJson = true;
        break;
      case "--verbose-cleanup":
        opts.verboseCleanup = true;
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
      case "--brief-file": {
        const value = argv[++i];
        if (value === undefined) throw new Error("--brief-file requires a path");
        opts.briefFile = value;
        break;
      }
      case "--topic": {
        const value = argv[++i];
        if (value === undefined) throw new Error("--topic requires text");
        opts.topic = value;
        break;
      }
      case "--query": {
        const value = argv[++i];
        if (value === undefined) throw new Error("--query requires text");
        opts.queries.push(value);
        break;
      }
      case "--depth": {
        const value = argv[++i];
        if (value === undefined) throw new Error("--depth requires shallow, standard, or deep");
        if (value !== "shallow" && value !== "standard" && value !== "deep") {
          throw new Error("--depth requires shallow, standard, or deep");
        }
        opts.depth = value;
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
  CNS_BRIEF_TOPIC="freelance consulting day rate calculation methodology 2026" \\
  FIRECRAWL_API_KEY=... APIFY_API_TOKEN=... PERPLEXITY_API_KEY=... ANTHROPIC_API_KEY=... \\
  tsx scripts/run-chain.ts [--brief-file brief.json] [--evidence-file path] [--operator-note text]

Options:
  --brief-file path          Read a ResearchBrief JSON file: topic, queries, depth, optional tags.
  --topic text               Override the brief topic without editing source.
  --query text               Add a query. Repeat for multiple queries.
  --depth value              shallow, standard, or deep. Defaults to deep.
  --evidence-file path        Write compact safe evidence markdown to a file.
  --operator-note text        Add a sanitized operator note to the evidence.
  --vault-root-class value    staging, active, or unknown. Overrides auto-detect.
  --verbose-cleanup           Print removed/skipped paths for pre-run cleanup.
  --raw-json                  Also print full raw ChainRunResult JSON for local debugging.
  --help                      Show this help.
`);
}

function defaultQueriesForTopic(topic: string): string[] {
  if (topic === DEFAULT_BRIEF_TOPIC) return [...DEFAULT_BRIEF_QUERIES];
  return [
    topic,
    `reddit.com ${topic}`,
    `${topic} bot protected pricing guide`,
  ];
}

function formatBriefError(message: string): Error {
  return new Error(`${message}. Expected ResearchBrief JSON shape: {"topic":"...","queries":["..."],"depth":"deep"}`);
}

export async function loadBriefForRun(
  cli: Pick<CliOptions, "briefFile" | "topic" | "queries" | "depth">,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResearchBrief> {
  if (cli.briefFile !== undefined) {
    if (cli.topic !== undefined || cli.queries.length > 0 || cli.depth !== undefined) {
      throw formatBriefError("--brief-file cannot be combined with --topic, --query, or --depth");
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(await readFile(cli.briefFile, "utf8"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw formatBriefError(`Failed to read or parse --brief-file ${cli.briefFile}: ${msg}`);
    }
    const parsed = researchBriefSchema.strict().safeParse(parsedJson);
    if (!parsed.success) {
      throw formatBriefError(`Invalid --brief-file ${cli.briefFile}: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  const envTopic = env.CNS_BRIEF_TOPIC?.trim();
  const topic = cli.topic?.trim() || envTopic || DEFAULT_BRIEF_TOPIC;
  const queries = cli.queries.length > 0 ? cli.queries : defaultQueriesForTopic(topic);
  const parsed = researchBriefSchema.strict().safeParse({
    topic,
    queries,
    depth: cli.depth ?? "deep",
  });
  if (!parsed.success) {
    throw formatBriefError(`Invalid runtime brief: ${parsed.error.message}`);
  }
  return parsed.data;
}

function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function topicTagSlug(topic: string): string {
  const s = topic
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > 0 ? s : "research-topic";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function frontmatterRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

async function listMarkdownFiles(root: string, relDir: string): Promise<string[]> {
  const absDir = resolveVaultPath(root, relDir);
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(absDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out: string[] = [];
  for (const entry of entries) {
    const rel = `${relDir}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...(await listMarkdownFiles(root, rel)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(rel);
    }
  }
  return out;
}

function generatedPerplexityTitle(brief: ResearchBrief, query: string, dateYmd: string): string {
  return `Perplexity: ${brief.topic.slice(0, 80)} — ${query.slice(0, 80)} (${dateYmd})`;
}

function generatedTitlesForBrief(brief: ResearchBrief, dateYmd: string): Set<string> {
  return new Set([
    `Synthesis: ${brief.topic} (${dateYmd})`,
    `Hooks: ${brief.topic} (${dateYmd})`,
    `Weapons check: ${brief.topic} (${dateYmd})`,
    ...brief.queries.map((query) => generatedPerplexityTitle(brief, query, dateYmd)),
  ]);
}

function isStaleChainNote(frontmatter: Record<string, unknown>, brief: ResearchBrief): boolean {
  if (frontmatter.creation_method !== "ai") return false;
  const tags = asStringArray(frontmatter.tags);
  if (!tags.includes("research-sweep")) return false;

  const topicSlug = topicTagSlug(brief.topic);
  const hasTopicTag = tags.includes(brief.topic) || tags.includes(topicSlug);
  if (!hasTopicTag) return false;

  const pakeType = frontmatter.pake_type;
  return (
    pakeType === "SourceNote" ||
    pakeType === "InsightNote" ||
    pakeType === "SynthesisNote" ||
    pakeType === "HookSetNote" ||
    pakeType === "WeaponsCheckNote"
  );
}

export async function cleanStaleChainNotes(
  vaultRoot: string,
  brief: ResearchBrief,
  opts: { dateYmd?: string } = {},
): Promise<{ removed: string[]; skipped: string[] }> {
  const dateYmd = opts.dateYmd ?? todayUtcYmd();
  const generatedTitles = generatedTitlesForBrief(brief, dateYmd);
  const removed: string[] = [];
  const skipped: string[] = [];

  for (const relPath of await listMarkdownFiles(vaultRoot, "03-Resources")) {
    let raw: string;
    try {
      raw = await readFile(resolveVaultPath(vaultRoot, relPath), "utf8");
    } catch {
      skipped.push(relPath);
      continue;
    }
    const frontmatter = frontmatterRecord(matter(raw).data);
    const title = typeof frontmatter.title === "string" ? frontmatter.title : "";
    const generatedTitleMatch =
      generatedTitles.has(title) && frontmatter.creation_method === "ai";
    if (!generatedTitleMatch && !isStaleChainNote(frontmatter, brief)) continue;

    const absPath = resolveVaultPath(vaultRoot, relPath);
    try {
      assertWriteAllowed(vaultRoot, absPath, { operation: "delete" });
      await rm(absPath, { force: true });
      removed.push(relPath);
    } catch {
      skipped.push(relPath);
    }
  }

  return { removed, skipped };
}

export function assertRequiredEnvKeys(
  keys: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): void {
  const missing = keys.filter((key) => (env[key]?.trim() ?? "").length === 0);
  if (missing.length === 0) return;
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

export async function cleanStaleOutputNotesByPrefix(
  vaultRoot: string,
  opts: { prefixes?: readonly string[]; relDir?: string } = {},
): Promise<{ removed: string[]; skipped: string[] }> {
  const relDir = opts.relDir ?? "03-Resources";
  const prefixes = opts.prefixes ?? ["synthesis-", "hooks-", "weapons-check-"];

  const absDir = resolveVaultPath(vaultRoot, relDir);
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(absDir, { withFileTypes: true });
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
    if (code === "ENOENT") return { removed: [], skipped: [] };
    throw err;
  }

  const removed: string[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".md")) continue;
    if (!prefixes.some((prefix) => entry.name.startsWith(prefix))) continue;

    const relPath = `${relDir}/${entry.name}`;
    const absPath = resolveVaultPath(vaultRoot, relPath);
    try {
      assertWriteAllowed(vaultRoot, absPath, { operation: "delete" });
      await rm(absPath, { force: true });
      removed.push(relPath);
    } catch {
      skipped.push(relPath);
    }
  }

  return { removed, skipped };
}

export async function validatePersistedSynthesisPake(args: {
  vaultRoot: string;
  synthesis: SynthesisRunResult;
  operatorContext: OperatorContext;
  vaultContextPacket: VaultContextPacket;
}): Promise<PakeValidationEvidence> {
  if (args.synthesis.status !== "ok") {
    return {
      status: "unknown",
      failures: ["Synthesis did not produce a persisted InsightNote."],
    };
  }

  const insight_note_path = args.synthesis.insight_note.vault_path;
  try {
    const read = await createDefaultVaultReadAdapter(args.vaultRoot).readNote(insight_note_path);
    const failures = validatePakeSynthesisBody({
      body: read.body,
      operator_context: args.operatorContext,
      vault_context_packet: args.vaultContextPacket,
    });
    return {
      status: failures.length === 0 ? "pass" : "fail",
      insight_note_path,
      failures: failures.map((failure) => sanitizeEvidenceString(failure, 220)),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "fail",
      insight_note_path,
      failures: [`Persisted InsightNote read-back failed: ${sanitizeEvidenceString(msg, 220)}`],
    };
  }
}

function routingOperatorNote(brief: ResearchBrief, cleanup: { removed: string[]; skipped: string[] }): string {
  const socialCount = brief.queries.filter((query) => isSocialDomain(query)).length;
  return [
    `Brief routing triggers: social-domain query count=${socialCount}; Scrapling tier configured for post-Firecrawl/Apify acquisition attempts.`,
    `Stale generated chain notes cleaned before run: removed=${cleanup.removed.length}, skipped=${cleanup.skipped.length}.`,
  ].join(" ");
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
  const brief = await loadBriefForRun(cli);
  let operatorNotes = [...cli.operatorNotes];

  assertRequiredEnvKeys(["FIRECRAWL_API_KEY", "APIFY_API_TOKEN", "ANTHROPIC_API_KEY"]);

  const firecrawlKey = process.env.FIRECRAWL_API_KEY ?? "";
  const apifyToken = process.env.APIFY_API_TOKEN ?? "";
  const scraplingCommand = process.env.SCRAPLING_COMMAND ?? "scrapling";
  const perplexityKey = process.env.PERPLEXITY_API_KEY;

  const startedAt = Date.now();
  const serviceErrors = serviceErrorRecorder();
  const perplexitySlot =
    (perplexityKey?.trim() ?? "").length > 0
      ? buildPerplexitySlot(perplexityKey!, serviceErrors.record)
      : createPerplexitySlot();
  console.log("=== Chain Live Smoke (Research -> Synthesis -> Hook -> Boss) ===");
  console.log(`Vault root class: ${vaultRootClass}`);
  console.log(`Brief topic: ${brief.topic}`);
  console.log(`Brief query count: ${brief.queries.length}`);
  console.log(
    `Services configured: Firecrawl, Apify, Scrapling, Anthropic, Perplexity=${perplexitySlot.available ? "enabled" : "disabled"}`,
  );

  try {
    const prefixCleanup = await cleanStaleOutputNotesByPrefix(vaultRoot);
    console.log(
      `Stale output notes cleaned: removed=${prefixCleanup.removed.length} skipped=${prefixCleanup.skipped.length}`,
    );
    if (cli.verboseCleanup) {
      if (prefixCleanup.removed.length > 0) {
        console.log("Removed output notes:");
        for (const relPath of prefixCleanup.removed) console.log(`- ${relPath}`);
      }
      if (prefixCleanup.skipped.length > 0) {
        console.log("Skipped output notes:");
        for (const relPath of prefixCleanup.skipped) console.log(`- ${relPath}`);
      }
    }

    const cleanup = await cleanStaleChainNotes(vaultRoot, brief);
    operatorNotes = [...operatorNotes, routingOperatorNote(brief, cleanup)];
    console.log(`Stale generated chain notes cleaned: ${cleanup.removed.length}`);
    console.log("Running chain. Default output will be compact safe evidence.\n");

    const operator_context =
      (await loadOperatorContextFromVault(vaultRoot)) ?? DEFAULT_OPERATOR_CONTEXT;
    const vault_context_packet = await buildVaultContextPacket(
      vaultRoot,
      brief.topic,
      brief.queries,
    );
    const result = await runChain(vaultRoot, brief, {
      research: {
        surface: "live-test",
        adapters: {
          firecrawl: buildFirecrawlAdapter(firecrawlKey, serviceErrors.record),
          apify: buildApifyAdapter(apifyToken, serviceErrors.record),
          scrapling: buildScraplingAdapter(scraplingCommand, serviceErrors.record),
          perplexity: perplexitySlot,
        },
      },
      adapters: {
        synthesis: createLlmSynthesisAdapter(),
        hookGeneration: createLlmHookGenerationAdapter(),
        weaponsCheck: createLlmWeaponsCheckAdapter(),
      },
      operator_context,
      vault_context_packet,
    });
    const pakeValidation = await validatePersistedSynthesisPake({
      vaultRoot,
      synthesis: result.synthesis,
      operatorContext: operator_context,
      vaultContextPacket: vault_context_packet,
    });

    const evidence = buildChainSmokeEvidence({
      result,
      vaultRoot,
      vaultRootClass,
      brief,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      operatorNotes,
      externalServiceErrors: serviceErrors.errors,
      pakeValidation,
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
    if (pakeValidation.status === "fail") {
      process.exitCode = 1;
    }
  } catch (err) {
    const evidence = buildFatalChainSmokeEvidence({
      error: err,
      vaultRoot,
      vaultRootClass,
      brief,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      operatorNotes,
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
