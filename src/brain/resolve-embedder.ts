import { CnsError } from "../errors.js";
import { PortalEmbedder } from "./embedder-portal.js";
import { StubEmbedder, type Embedder } from "./embedder.js";

export const BRAIN_EMBEDDER_ENV = "CNS_BRAIN_EMBEDDER" as const;
export const BRAIN_EMBED_BASE_URL_ENV = "CNS_BRAIN_EMBED_BASE_URL" as const;
export const BRAIN_EMBED_MODEL_ENV = "CNS_BRAIN_EMBED_MODEL" as const;
export const BRAIN_EMBED_API_KEY_ENV = "CNS_BRAIN_EMBED_API_KEY" as const;
export const BRAIN_EMBED_TIMEOUT_MS_ENV = "CNS_BRAIN_EMBED_TIMEOUT_MS" as const;

/** Hermes `hermes proxy start` default (Nous Portal subscription proxy). */
export const DEFAULT_PORTAL_EMBED_BASE_URL = "http://127.0.0.1:8645/v1";

/**
 * Operator must set `CNS_BRAIN_EMBED_MODEL` when enabling portal mode.
 * List models via `curl http://127.0.0.1:8645/v1/models` with proxy running.
 */
export type BrainEmbedderMode = "stub" | "portal";

function normalizeEmbedderMode(raw: string | undefined): BrainEmbedderMode {
  const mode = (raw ?? "stub").trim().toLowerCase();
  if (mode === "" || mode === "stub") {
    return "stub";
  }
  if (mode === "portal" || mode === "nous-portal" || mode === "nous") {
    return "portal";
  }
  throw new CnsError("SCHEMA_INVALID", `Unknown ${BRAIN_EMBEDDER_ENV}: ${mode}. Use "stub" or "portal".`);
}

function parseTimeoutMs(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new CnsError("SCHEMA_INVALID", `${BRAIN_EMBED_TIMEOUT_MS_ENV} must be a positive finite number.`);
  }
  return Math.floor(parsed);
}

/**
 * Selects Brain embedder from environment (NFR5 reversibility: default stub).
 *
 * Portal mode requires `CNS_BRAIN_EMBED_MODEL` and reachable `CNS_BRAIN_EMBED_BASE_URL`.
 */
export function resolveBrainEmbedder(env: NodeJS.ProcessEnv = process.env): Embedder {
  const mode = normalizeEmbedderMode(env[BRAIN_EMBEDDER_ENV]);
  if (mode === "stub") {
    return new StubEmbedder();
  }

  const baseUrl = env[BRAIN_EMBED_BASE_URL_ENV]?.trim() || DEFAULT_PORTAL_EMBED_BASE_URL;
  const modelId = env[BRAIN_EMBED_MODEL_ENV]?.trim();
  if (!modelId) {
    throw new CnsError(
      "SCHEMA_INVALID",
      `${BRAIN_EMBED_MODEL_ENV} is required when ${BRAIN_EMBEDDER_ENV}=portal.`,
    );
  }

  return new PortalEmbedder({
    baseUrl,
    modelId,
    apiKey: env[BRAIN_EMBED_API_KEY_ENV],
    timeoutMs: parseTimeoutMs(env[BRAIN_EMBED_TIMEOUT_MS_ENV]),
  });
}
