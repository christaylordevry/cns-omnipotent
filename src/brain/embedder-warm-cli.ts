import path from "node:path";
import { fileURLToPath } from "node:url";
import { CnsError } from "../errors.js";
import {
  BRAIN_RECALL_POLICY_REPO_REL,
  loadBrainRecallPolicyFromFile,
  type BrainRecallPolicy,
} from "./recall-policy.js";
import { resolveBrainEmbedder } from "./resolve-embedder.js";

export const EMBEDDER_WARM_INPUT = "warm" as const;
export const EMBEDDER_WARM_PROXY_HEALTH_TIMEOUT_MS = 2_000;
export const EMBEDDER_WARM_EMBED_TIMEOUT_MS = 10_000;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function resolveRepoRoot(explicit?: string): string {
  const fromArg = explicit?.trim();
  if (fromArg) {
    return path.resolve(fromArg);
  }
  const fromEnv = process.env.CNS_OMNIPOTENT_ROOT?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return REPO_ROOT;
}

export function isEmbedderWarmKeepEnabled(policy: BrainRecallPolicy): boolean {
  return policy.embedder_warm_keep?.enabled === true;
}

function normalizeEmbedderMode(env: NodeJS.ProcessEnv): "stub" | "portal" {
  const mode = (env.CNS_BRAIN_EMBEDDER ?? "stub").trim().toLowerCase();
  if (mode === "" || mode === "stub") {
    return "stub";
  }
  return "portal";
}

export function resolveEmbedderWarmBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.CNS_BRAIN_EMBED_BASE_URL?.trim();
  if (!raw) {
    return "http://127.0.0.1:8645/v1";
  }
  return raw.replace(/\/$/, "");
}

/** Best-effort GET /models — returns false when proxy is down (AC1 skip path). */
export async function isPortalEmbedProxyReachable(params: {
  baseUrl: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}): Promise<boolean> {
  const fetchFn = params.fetchFn ?? fetch;
  const timeoutMs = params.timeoutMs ?? EMBEDDER_WARM_PROXY_HEALTH_TIMEOUT_MS;
  const modelsUrl = `${params.baseUrl.replace(/\/$/, "")}/models`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(modelsUrl, { method: "GET", signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export type EmbedderWarmCliResult =
  | { status: "disabled" }
  | { status: "skipped_proxy_down" }
  | { status: "warmed"; vectorDimension: number };

export async function runEmbedderWarmCli(params?: {
  repoRoot?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<EmbedderWarmCliResult> {
  const env = params?.env ?? process.env;
  const repoRoot = resolveRepoRoot(params?.repoRoot);
  const policyPath = path.join(repoRoot, BRAIN_RECALL_POLICY_REPO_REL);
  const policy = await loadBrainRecallPolicyFromFile(policyPath);

  if (!isEmbedderWarmKeepEnabled(policy)) {
    return { status: "disabled" };
  }

  const embedderMode = normalizeEmbedderMode(env);
  if (embedderMode !== "stub") {
    const baseUrl = resolveEmbedderWarmBaseUrl(env);
    const reachable = await isPortalEmbedProxyReachable({ baseUrl });
    if (!reachable) {
      process.stderr.write("[brain-embedder-warm] skip: hermes-proxy unreachable\n");
      return { status: "skipped_proxy_down" };
    }
  }

  const embedder = resolveBrainEmbedder({
    ...env,
    CNS_BRAIN_EMBED_TIMEOUT_MS: String(EMBEDDER_WARM_EMBED_TIMEOUT_MS),
  });
  const vector = await embedder.embed(EMBEDDER_WARM_INPUT);
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new CnsError("IO_ERROR", "Embedder warm ping returned an empty vector.");
  }

  return { status: "warmed", vectorDimension: vector.length };
}

function safeSingleLine(s: string): string {
  return String(s).split(/\r?\n/, 1)[0]?.trim() ?? "Error";
}

async function main(): Promise<void> {
  const result = await runEmbedderWarmCli();
  if (result.status === "warmed") {
    process.stderr.write(
      `[brain-embedder-warm] ok dimension=${result.vectorDimension}\n`,
    );
  }
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
