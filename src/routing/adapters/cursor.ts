/**
 * Cursor surface adapter — translates a routing DecisionRecord into
 * Cursor's workspace-level settings format.
 *
 * **Target:** `.cursor/settings.json` (project-level, not user-level).
 *
 * Cursor reads model configuration from its workspace settings JSON.
 * The adapter writes the resolved model_id under a `cns.routing.model`
 * key, which a Cursor rule or future integration can consume for model
 * selection. Writing to a project-level file keeps model choice scoped
 * per workspace and avoids polluting global Cursor settings.
 *
 * The adapter merges into the existing settings object so that
 * non-routing Cursor config keys are preserved.
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

async function atomicWriteCursorConfig(
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
        surface: "cursor",
      };
    }

    existing = parsed;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Failed to parse existing config: ${msg}`, surface: "cursor" };
    }
  }

  existing["cns.routing.model"] = modelId;

  const tmpPath = configPath + ".tmp";
  try {
    await writeFile(tmpPath, JSON.stringify(existing, null, 2) + "\n", "utf8");
    await rename(tmpPath, configPath);
  } catch (err: unknown) {
    try { await unlink(tmpPath); } catch { /* best-effort cleanup */ }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Atomic write failed: ${msg}`, surface: "cursor" };
  }

  return { ok: true, writtenPath: configPath, modelResolved: modelId };
}

export async function applyCursorAdapter(
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
    return { ok: false, error: resolution.error, surface: "cursor" };
  }

  const result = await atomicWriteCursorConfig(configPath, resolution.modelId);
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
        return { ok: false, error: fbResolution.error, surface: "cursor" };
      }
      return atomicWriteCursorConfig(configPath, fbResolution.modelId);
    }

    return { ok: false, error: fallback.error.message, surface: "cursor" };
  }

  return result;
}
