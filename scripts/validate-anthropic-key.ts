/**
 * FR11-A Anthropic API key smoke validator (Story 75-4).
 * Standalone — no imports from src/agents/* or scripts/run-chain.ts.
 *
 * Usage (repo root):
 *   npx tsx scripts/validate-anthropic-key.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";
export const VALIDATE_MODEL = "claude-haiku-4-5";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const DEFAULT_ENV_FILE = path.join(REPO_ROOT, ".env.live-chain");

const KEY_FORMAT_RE = /^sk-ant-.+/;

export function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function maskApiKeyForDisplay(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 10) {
    return `${trimmed.slice(0, 3)}…[masked]`;
  }
  const prefix = trimmed.slice(0, 10);
  return `${prefix}…****`;
}

export function assertKeyFormat(key: string): void {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new Error(
      "validate-anthropic-key: malformed ANTHROPIC_API_KEY (expected sk-ant- prefix)",
    );
  }
  if (!KEY_FORMAT_RE.test(trimmed)) {
    throw new Error(
      "validate-anthropic-key: malformed ANTHROPIC_API_KEY (expected sk-ant- prefix)",
    );
  }
}

export function loadAnthropicKeyFromEnvFile(
  envFilePath: string,
  readFile = readFileSync,
): string {
  let content: string;
  try {
    content = readFile(envFilePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`validate-anthropic-key: missing ${envFilePath}`, {
        cause: err,
      });
    }
    throw err;
  }

  const parsed = parseEnvFile(content);
  const key = parsed.ANTHROPIC_API_KEY;
  if (key === undefined || key.trim() === "") {
    throw new Error(
      "validate-anthropic-key: ANTHROPIC_API_KEY not set in .env.live-chain",
    );
  }
  return key;
}

export function resolveAnthropicApiKey(
  env: NodeJS.ProcessEnv,
  envFilePath: string = DEFAULT_ENV_FILE,
  readFile = readFileSync,
): string {
  const fromEnv = env.ANTHROPIC_API_KEY?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return loadAnthropicKeyFromEnvFile(envFilePath, readFile);
}

export type ValidateAnthropicKeyResult =
  | { ok: true; status: number }
  | { ok: false; status: number; message: string };

export async function validateAnthropicKey(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<ValidateAnthropicKeyResult> {
  const trimmed = apiKey.trim();
  const requestBody = {
    model: VALIDATE_MODEL,
    max_tokens: 1,
    messages: [{ role: "user", content: "ping" }],
  };

  let response: Response;
  try {
    response = await fetchFn(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "x-api-key": trimmed,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      message: `validate-anthropic-key: network error — ${detail}`,
    };
  }

  if (response.ok) {
    return { ok: true, status: response.status };
  }

  if (response.status === 401) {
    return {
      ok: false,
      status: 401,
      message:
        "validate-anthropic-key: Anthropic API returned 401 — ANTHROPIC_API_KEY invalid or revoked. Rotate per AI-Context/modules/run-chain.md § Key validation and rotation.",
    };
  }

  const detail = await response
    .text()
    .then((text) => text.slice(0, 200))
    .catch(() => "");
  const suffix = detail ? ` — ${detail}` : "";
  return {
    ok: false,
    status: response.status,
    message: `validate-anthropic-key: Anthropic API returned ${response.status}${suffix}`,
  };
}

export async function main(
  env: NodeJS.ProcessEnv = process.env,
  envFilePath: string = DEFAULT_ENV_FILE,
  fetchFn: typeof fetch = fetch,
): Promise<number> {
  let apiKey: string;
  try {
    apiKey = resolveAnthropicApiKey(env, envFilePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return 1;
  }

  try {
    assertKeyFormat(apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return 1;
  }

  const masked = maskApiKeyForDisplay(apiKey);
  const result = await validateAnthropicKey(apiKey, fetchFn);

  if (result.ok) {
    console.log(`Anthropic key OK (${masked})`);
    console.log(`Model: ${VALIDATE_MODEL} | HTTP ${result.status}`);
    return 0;
  }

  console.error(result.message);
  console.error(`Key: ${masked}`);
  return 1;
}

const isMain =
  import.meta.url === pathToFileURL(process.argv[1] ?? "").href;

if (isMain) {
  main().then((code) => process.exit(code));
}
