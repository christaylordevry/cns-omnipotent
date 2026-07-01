#!/usr/bin/env node
import { parseArgs } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CnsError } from "../errors.js";
import { buildRecallInjection, detectRecallChannel } from "./recall-inject.js";
import { loadBrainRecallPolicyFromRepo } from "./recall-policy.js";
import { resolveBrainEmbedder } from "./resolve-embedder.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const BRAIN_INDEX_PATH_ENV = "CNS_BRAIN_INDEX_PATH" as const;

export type RecallPrefetchCliOutput = {
  context: string | null;
  citations: Array<{ path: string; score: number }>;
  channel: string;
  shadow: boolean;
};

function safeSingleLine(s: string): string {
  return String(s).split(/\r?\n/, 1)[0]?.trim() ?? "Error";
}

export function resolveVaultRoot(explicit?: string): string {
  const fromArg = explicit?.trim();
  if (fromArg) {
    return path.resolve(fromArg);
  }
  const fromEnv = process.env.CNS_VAULT_ROOT?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE";
}

export function resolveBrainIndexPath(explicit?: string): string {
  const fromArg = explicit?.trim();
  if (fromArg) {
    return path.resolve(fromArg);
  }
  const fromEnv = process.env[BRAIN_INDEX_PATH_ENV]?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  throw new CnsError(
    "SCHEMA_INVALID",
    `Brain index path required: pass --index-path or set ${BRAIN_INDEX_PATH_ENV} to brain-index.json`,
  );
}

export async function runRecallPrefetchCli(params: {
  query: string;
  platformHint?: string | null;
  recallChannelHint?: string | null;
  repoRoot?: string;
  vaultRoot?: string;
  indexPath?: string;
}): Promise<RecallPrefetchCliOutput> {
  const repoRoot = params.repoRoot ? path.resolve(params.repoRoot) : REPO_ROOT;
  const vaultRoot = resolveVaultRoot(params.vaultRoot);
  const indexPath = resolveBrainIndexPath(params.indexPath);
  const policy = await loadBrainRecallPolicyFromRepo(repoRoot);
  const channel = detectRecallChannel({
    userMessage: params.query,
    platformHint: params.platformHint,
    recallChannelHint: params.recallChannelHint,
    yappedTextMinChars: policy.yapped_text_min_chars,
  });

  const injectOut = await buildRecallInjection({
    vaultRoot,
    indexPath,
    query: params.query,
    channel,
    policy,
    embedder: resolveBrainEmbedder(),
  });

  if (injectOut.shadow && injectOut.wouldInjectContext) {
    process.stderr.write(
      `[cns-brain-recall:shadow] would-inject channel=${injectOut.channel} policy=${injectOut.policyVersion}\n${injectOut.wouldInjectContext}\n`,
    );
  }

  return {
    context: injectOut.context,
    citations: injectOut.citations,
    channel: injectOut.channel,
    shadow: injectOut.shadow,
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      query: { type: "string" },
      platform: { type: "string" },
      "recall-channel": { type: "string" },
      "index-path": { type: "string" },
      "vault-root": { type: "string" },
      "repo-root": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    process.stdout.write(
      [
        "brain-recall-prefetch — Hermes pre_llm_call subprocess (Story 79-5, ADR-HERMES-015).",
        "",
        "Usage:",
        "  node scripts/brain-recall-prefetch.mjs --query <user message> [--platform nexus-voice]",
        "",
        "Stdout JSON contract: { context, citations, channel, shadow }",
        "  shadow_mode:true in config/brain-recall-policy.json → context null, would-inject logged to stderr.",
        "",
        "Env:",
        `  ${BRAIN_INDEX_PATH_ENV} — absolute path to brain-index.json (required unless --index-path)`,
        "  CNS_VAULT_ROOT — vault root (default: operator Knowledge-Vault-ACTIVE path)",
        "  CNS_BRAIN_EMBEDDER — stub|portal (must match index build embedder)",
        "",
      ].join("\n"),
    );
    return;
  }

  const query = values.query?.trim();
  if (!query) {
    process.stderr.write("Error: --query is required.\n");
    process.exitCode = 1;
    return;
  }

  const out = await runRecallPrefetchCli({
    query,
    platformHint: values.platform,
    recallChannelHint: values["recall-channel"],
    repoRoot: values["repo-root"],
    vaultRoot: values["vault-root"],
    indexPath: values["index-path"],
  });

  process.stdout.write(`${JSON.stringify(out)}\n`);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  main().catch((err) => {
    const msg =
      err instanceof CnsError
        ? safeSingleLine(err.message)
        : err instanceof Error
          ? safeSingleLine(err.message)
          : "Error";
    process.stderr.write(`${msg}\n`);
    process.exitCode = 1;
  });
}
