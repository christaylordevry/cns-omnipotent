/**
 * Gemini CLI surface adapter — translates a routing DecisionRecord
 * into the Gemini CLI's user-level settings format.
 *
 * **Target:** `~/.gemini/settings.json` (user-level Gemini CLI config).
 *
 * **Config key:** `model.name` (nested path — the adapter deep-merges
 * into `existing["model"]["name"]` to preserve sibling keys like
 * `model.safety`).
 *
 * **Why `~/.gemini/settings.json` over alternatives:**
 *
 * - `GEMINI_MODEL` env var: programmatic `process.env` mutation is
 *   global — affects ALL child processes, not scoped to Gemini CLI.
 *   Env var persistence (`.bashrc`/`.zshrc`) is fragile and
 *   surface-dependent.
 * - `--model` CLI flag: session-only — not persistently injectable by
 *   CNS. Would require wrapping every Gemini CLI invocation.
 * - `~/.gemini/settings.json`: machine-writable JSON, scoped to
 *   Gemini CLI only, loaded automatically on CLI startup, supports
 *   atomic write, and follows the same pattern as Cursor and Claude
 *   Code adapters.
 *
 * This module contains no routing logic — it is a translator only.
 */

import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createAuditingCallback } from "../audit-log.js";
import { orchestrateFallback } from "../fallback-orchestrator.js";
import type {
  AdapterResult,
  AliasRegistry,
  DecisionRecord,
  OnFallbackCallback,
  RoutingPolicy,
} from "../types.js";
import { resolveAlias } from "./resolve-alias.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function atomicWriteGeminiCliConfig(
  configPath: string,
  modelId: string,
): Promise<AdapterResult> {
  // Local helper is intentional: each surface uses a different on-disk JSON shape.
  let existing: Record<string, unknown> = {};
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return {
        ok: false,
        error: "Failed to parse existing config: existing config must be a JSON object",
        surface: "gemini-cli",
      };
    }

    existing = parsed;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Failed to parse existing config: ${msg}`, surface: "gemini-cli" };
    }
  }

  const modelObj = isRecord(existing["model"]) ? (existing["model"] as Record<string, unknown>) : {};
  modelObj["name"] = modelId;
  existing["model"] = modelObj;

  const tmpPath = configPath + ".tmp";
  try {
    await writeFile(tmpPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
    await rename(tmpPath, configPath);
  } catch (err: unknown) {
    try { await unlink(tmpPath); } catch { /* best-effort cleanup */ }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Atomic write failed: ${msg}`, surface: "gemini-cli" };
  }

  return { ok: true, writtenPath: configPath, modelResolved: modelId };
}

export async function applyGeminiCliAdapter(
  decision: DecisionRecord,
  registry: AliasRegistry,
  configPath: string,
  policy?: RoutingPolicy,
  reasonCodes?: readonly string[],
  onFallback?: OnFallbackCallback,
  vaultRoot?: string,
): Promise<AdapterResult> {
  const resolution = resolveAlias(decision.selected_model_alias, registry);
  if (!resolution.ok) {
    return { ok: false, error: resolution.error, surface: "gemini-cli" };
  }

  const result = await atomicWriteGeminiCliConfig(configPath, resolution.modelId);
  if (result.ok) return result;

  if (policy !== undefined && reasonCodes !== undefined) {
    const callback = vaultRoot
      ? createAuditingCallback(
          vaultRoot,
          {
            surface: decision.surface,
            taskCategory: decision.taskCategory,
            operatorOverride: decision.operator_override,
          },
          onFallback,
        )
      : onFallback;
    const fallback = orchestrateFallback(decision, registry, policy, reasonCodes, result.error);
    callback?.(fallback);

    if (fallback.ok) {
      const fbResolution = resolveAlias(fallback.decision.selected_model_alias, registry);
      if (!fbResolution.ok) {
        return { ok: false, error: fbResolution.error, surface: "gemini-cli" };
      }
      return atomicWriteGeminiCliConfig(configPath, fbResolution.modelId);
    }

    return { ok: false, error: fallback.error.message, surface: "gemini-cli" };
  }

  return result;
}
