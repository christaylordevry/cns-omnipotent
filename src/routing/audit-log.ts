/**
 * Audit log entry builder and vault writer for fallback events.
 *
 * buildFallbackLogEntry is a pure function.
 * writeAuditEntry performs append-only filesystem IO (isolated here).
 * createAuditingCallback wraps both into a fire-and-forget callback.
 */

import { appendFile, stat } from "node:fs/promises";
import { join } from "node:path";

import type {
  AuditWriteResult,
  FallbackLogEntry,
  FallbackResult,
  OnFallbackCallback,
  RoutingContext,
} from "./types.js";

export function buildFallbackLogEntry(
  result: FallbackResult,
  context: RoutingContext,
): FallbackLogEntry {
  if (result.ok) {
    return {
      timestamp: new Date().toISOString(),
      surface: context.surface,
      taskCategory: context.taskCategory,
      originalAlias: result.originalAlias,
      selectedAlias: result.decision.selected_model_alias,
      tier: result.tier,
      reason: result.tier === "visible" ? result.reason : "same-provider fallback",
      reason_code: result.decision.reason_code,
    };
  }

  return {
    timestamp: new Date().toISOString(),
    surface: context.surface,
    taskCategory: context.taskCategory,
    originalAlias: result.originalAlias,
    selectedAlias: null,
    tier: result.tier,
    reason: result.error.message,
    reason_code: result.error.reason_code,
  };
}

function formatAuditLine(entry: FallbackLogEntry): string {
  const selected = entry.selectedAlias ?? "exhausted";
  return `- [${entry.timestamp}] ROUTING ${entry.tier} ${entry.reason_code} ${entry.surface}/${entry.taskCategory}: ${entry.originalAlias} → ${selected}\n`;
}

export async function writeAuditEntry(
  entry: FallbackLogEntry,
  vaultRoot: string,
): Promise<AuditWriteResult> {
  const logPath = join(vaultRoot, "AI-Context", "agent-log.md");
  try {
    await stat(logPath);
  } catch (err: unknown) {
    const fsErr = err as NodeJS.ErrnoException;
    if (fsErr.code === "ENOENT") {
      return {
        ok: false,
        error: "agent-log.md does not exist; file creation is the vault contract's responsibility",
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Failed to stat audit log (permission/IO error): ${message}`,
    };
  }

  try {
    await appendFile(logPath, formatAuditLine(entry));
    return { ok: true, path: logPath };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Failed to append audit entry: ${message}` };
  }
}

export function createAuditingCallback(
  vaultRoot: string,
  context: RoutingContext,
  userCallback?: OnFallbackCallback,
): OnFallbackCallback {
  return (result: FallbackResult) => {
    const entry = buildFallbackLogEntry(result, context);
    void writeAuditEntry(entry, vaultRoot).then((writeResult) => {
      if (!writeResult.ok) {
        console.error(`Failed to write routing audit entry: ${writeResult.error}`);
      }
    });
    userCallback?.(result);
  };
}
