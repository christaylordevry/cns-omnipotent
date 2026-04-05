/**
 * AuditLogger — Story 5.1: append-only lines to `_meta/logs/agent-log.md`.
 * Format: `[ISO8601 UTC] | action | tool | surface | target_path | payload_summary`
 */

import path from "node:path";
import { appendFile, mkdir } from "node:fs/promises";
import {
  assertWriteAllowed,
  AUDIT_AGENT_LOG_VAULT_REL,
} from "../write-gate.js";

const PAYLOAD_SUMMARY_MAX_LEN = 120;

function normalizeAbsolute(p: string): string {
  return path.normalize(path.resolve(p));
}

/**
 * AC3: pipe-safe, single-line segments for surface, target_path, and payload_summary.
 */
export function sanitizeAuditFreeText(value: string): string {
  return value.replace(/\|/g, " ").replace(/\r/g, " ").replace(/\n/g, " ");
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  const o = value as Record<string, unknown>;
  return Object.keys(o)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      acc[k] = sortKeysDeep(o[k]);
      return acc;
    }, {});
}

/**
 * AC2 Phase 1: human-readable summary, max 120 JS string units; stable JSON for structured input.
 */
export function summarizePayloadForAudit(input: unknown): string {
  if (typeof input === "string") {
    return input.slice(0, PAYLOAD_SUMMARY_MAX_LEN);
  }
  try {
    const canonical = sortKeysDeep(input);
    const s = JSON.stringify(canonical);
    return (typeof s === "string" ? s : "[unserializable]").slice(0, PAYLOAD_SUMMARY_MAX_LEN);
  } catch {
    return "[unserializable]";
  }
}

export type AuditAppendFields = {
  action: string;
  tool: string;
  surface: string;
  targetPath: string;
  payloadInput: unknown;
  /** If set, used as the bracket timestamp; otherwise `new Date().toISOString()`. */
  isoUtc?: string | undefined;
};

/** Builds one physical line (no trailing newline). Timestamp is caller-supplied ISO UTC. */
export function formatAuditLine(
  isoUtc: string,
  fields: {
    action: string;
    tool: string;
    surface: string;
    targetPath: string;
    payloadSummary: string;
  },
): string {
  const action = sanitizeAuditFreeText(fields.action);
  const tool = sanitizeAuditFreeText(fields.tool);
  const surface = sanitizeAuditFreeText(fields.surface);
  const targetPath = sanitizeAuditFreeText(fields.targetPath);
  const payloadSummary = sanitizeAuditFreeText(fields.payloadSummary);
  return `[${isoUtc}] | ${action} | ${tool} | ${surface} | ${targetPath} | ${payloadSummary}`;
}

/**
 * Appends one LF-terminated audit record. Resolves log path, ensures parent dir exists,
 * WriteGate `audit-append` + `append`, then UTF-8 append.
 */
export async function appendRecord(vaultRoot: string, fields: AuditAppendFields): Promise<void> {
  const isoUtc = fields.isoUtc ?? new Date().toISOString();
  const payloadSummary = summarizePayloadForAudit(fields.payloadInput);
  const line = formatAuditLine(isoUtc, {
    action: fields.action,
    tool: fields.tool,
    surface: fields.surface,
    targetPath: fields.targetPath,
    payloadSummary,
  });

  const root = normalizeAbsolute(path.resolve(vaultRoot));
  const logAbs = path.join(root, ...AUDIT_AGENT_LOG_VAULT_REL.split("/"));
  assertWriteAllowed(vaultRoot, logAbs, { purpose: "audit-append", operation: "append" });
  await mkdir(path.dirname(logAbs), { recursive: true });
  const payload = line.endsWith("\n") ? line : `${line}\n`;
  await appendFile(logAbs, payload, "utf8");
}
