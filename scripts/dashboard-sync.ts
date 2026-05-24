/**
 * CNS dashboard sync — read-only collectors (Story 42-3) + Convex push (Story 42-4).
 * Builds a DashboardSnapshot from vault, agent-log, lint, sprint status, and Hermes config.
 *
 * Usage:
 *   CNS_VAULT_ROOT="/path/to/vault" npx tsx scripts/dashboard-sync.ts [--json] [--no-push]
 *
 * `--json` is operator-only debug output (stdout, not secret-scanned). Cron push uses
 * `~/.hermes/dashboard-sync.env` for CONVEX_URL + CONVEX_DEPLOY_KEY.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { loadMergedSecretPatterns } from "../src/secrets/load-patterns.js";
import { findFirstMatchingSecretPatternId } from "../src/secrets/scan.js";

/** Hand-mirrored from cns-dashboard/convex/constants.ts — keep in sync. */
export const MCP_NAMES = [
  "vault-io",
  "notebooklm",
  "context7",
  "firecrawl",
  "perplexity",
  "playwright",
  "discord",
] as const;

export type McpName = (typeof MCP_NAMES)[number];

export type McpStatusValue = "active" | "stale" | "unknown" | "configured";
export type RunChainState = "dormant" | "running" | "error" | "unknown";
export type SyncStatusValue = "ok" | "error";

export type VaultHealth = {
  noteCount: number;
  lintErrors: number;
  lintWarnings: number;
  lintStale: boolean;
  inboxDepth: number;
  pakeDistribution: Record<string, number>;
  syncedAt: number;
};

export type McpStatusRow = {
  name: string;
  status: McpStatusValue;
  lastCallAt: number | null;
  badge: string;
};

export type AgentLogEntry = {
  timestamp: number;
  action: string;
  tool: string;
  surface: string;
  targetPath: string;
  summary: string;
};

export type RunChainStatus = {
  state: RunChainState;
  lastRunAt: number | null;
  lastSynthesisTitle: string | null;
};

export type NoteIndexRow = {
  title: string;
  path: string;
  tags: string[];
  modifiedAt: number;
};

export type SyncMetadata = {
  lastSyncAt: number;
  lastSyncStatus: SyncStatusValue;
  lastSyncError: string | null;
};

/** Full payload for ingestDashboardSnapshot — mirrors cns-dashboard/convex/validators.ts */
export type DashboardSnapshot = {
  vaultHealth: VaultHealth;
  mcpStatus: McpStatusRow[];
  agentLogEntries: AgentLogEntry[];
  runChainStatus: RunChainStatus;
  noteIndex: NoteIndexRow[];
  syncMetadata: SyncMetadata;
};

export const VAULT_IO_TOOLS = new Set([
  "vault_read",
  "vault_read_frontmatter",
  "vault_list",
  "vault_search",
  "vault_create_note",
  "vault_update_frontmatter",
  "vault_append_daily",
  "vault_log_action",
  "vault_move",
  "vault_request_disambiguation",
]);

const NOTE_ROOTS = ["01-Projects", "02-Areas", "03-Resources"] as const;
const INBOX_DIR = "00-Inbox";
const AGENT_LOG_REL = "_meta/logs/agent-log.md";
const LINT_REPORT_DIR = "_meta/reports";
const LINT_BASENAME_RE = /^vault-lint-(\d{4}-\d{2}-\d{2})\.md$/;
const AGENT_LOG_LINE_RE =
  /^\[([^\]]+)\]\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/;
const RUN_CHAIN_STORY_KEY = "38-2-kimi-k2-6-evaluation-run-chain";
const MCP_ACTIVE_MS = 6 * 60 * 1000;
const LINT_STALE_DAYS = 7;

export function repoRootFromModule(metaUrl: string): string {
  return path.resolve(path.dirname(fileURLToPath(metaUrl)), "..");
}

export function toPosixRel(root: string, absPath: string): string {
  return path.relative(root, absPath).split(path.sep).join("/");
}

export function parseAgentLogLine(line: string): AgentLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }
  const match = trimmed.match(AGENT_LOG_LINE_RE);
  if (!match) {
    return null;
  }
  const [, isoUtc, action, tool, surface, targetPath, summary] = match;
  const timestamp = Date.parse(isoUtc);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return {
    timestamp,
    action: action.trim(),
    tool: tool.trim(),
    surface: surface.trim(),
    targetPath: targetPath.trim(),
    summary: summary.trim(),
  };
}

export function parseAgentLogContent(content: string, limit = 20): AgentLogEntry[] {
  const parsed = content
    .split("\n")
    .map(parseAgentLogLine)
    .filter((entry): entry is AgentLogEntry => entry !== null);
  return parsed.slice(-limit);
}

export function pickNewestLintBasename(filenames: string[]): string | null {
  let best: { name: string; date: string } | null = null;
  for (const name of filenames) {
    const match = name.match(LINT_BASENAME_RE);
    if (!match) {
      continue;
    }
    const date = match[1];
    if (!best || date > best.date) {
      best = { name, date };
    }
  }
  return best?.name ?? null;
}

export function parseVaultLintSummary(content: string): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const line of content.split("\n")) {
    const errMatch = line.match(/^\s*[-*]?\s*Errors?:\s*(\d+)/i);
    const warnMatch = line.match(/^\s*[-*]?\s*Warnings?:\s*(\d+)/i);
    if (errMatch) {
      errors = Number.parseInt(errMatch[1], 10);
    }
    if (warnMatch) {
      warnings = Number.parseInt(warnMatch[1], 10);
    }
  }
  return { errors, warnings };
}

export function isLintReportStale(reportDateIso: string, now = new Date()): boolean {
  const reportDate = new Date(`${reportDateIso}T00:00:00Z`);
  if (Number.isNaN(reportDate.getTime())) {
    return true;
  }
  const ageMs = now.getTime() - reportDate.getTime();
  return ageMs > LINT_STALE_DAYS * 24 * 60 * 60 * 1000;
}

export function maxVaultIoLastCallAt(entries: AgentLogEntry[]): number | null {
  let max: number | null = null;
  for (const entry of entries) {
    if (!VAULT_IO_TOOLS.has(entry.tool)) {
      continue;
    }
    if (max === null || entry.timestamp > max) {
      max = entry.timestamp;
    }
  }
  return max;
}

export function mcpStatusFromLastCall(lastCallAt: number | null, now: number): McpStatusValue {
  if (lastCallAt === null) {
    return "unknown";
  }
  return now - lastCallAt <= MCP_ACTIVE_MS ? "active" : "stale";
}

/** Top-level `mcp_servers:` block body (indented lines only), or "" if absent. */
export function extractMcpServersBlock(configText: string): string {
  const lines = configText.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^mcp_servers:\s*$/.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) {
    return "";
  }
  const block: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 0 && !/^\s/.test(line)) {
      break;
    }
    block.push(line);
  }
  return block.join("\n");
}

export function parseHermesMcpServerNames(configText: string): Set<string> {
  const names = new Set<string>();
  for (const line of extractMcpServersBlock(configText).split("\n")) {
    const match = line.match(/^\s{2}([a-zA-Z0-9_-]+):\s*$/);
    if (match) {
      names.add(match[1]);
    }
  }
  return names;
}

export function isMcpConfiguredInHermesConfig(configText: string, mcpName: string): boolean {
  const servers = parseHermesMcpServerNames(configText);
  if (mcpName === "vault-io") {
    return servers.has("cns_vault_io") || servers.has("vault-io") || servers.has("vault_io");
  }
  return servers.has(mcpName);
}

export function parseSprintStatusValue(yaml: string, key: string): string | null {
  const re = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*(\\S+)\\s*$`, "m");
  const match = yaml.match(re);
  return match?.[1] ?? null;
}

/** Sprint-status mapping only; `"error"` reserved for run failure signals in Story 42-4. */
export function runChainStateFromStoryStatus(storyStatus: string | null): RunChainState {
  switch (storyStatus) {
    case "in-progress":
    case "review":
      return "running";
    case "done":
      return "dormant";
    case "backlog":
    case "ready-for-dev":
      return "dormant";
    default:
      return storyStatus ? "unknown" : "unknown";
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function walkMarkdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  if (!(await pathExists(dir))) {
    return out;
  }
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkMarkdownFiles(abs)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(abs);
    }
  }
  return out;
}

async function countInboxDepth(vaultRoot: string): Promise<number> {
  const inboxDir = path.join(vaultRoot, INBOX_DIR);
  if (!(await pathExists(inboxDir))) {
    return 0;
  }
  const entries = await readdir(inboxDir, { withFileTypes: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith(".md")).length;
}

function incrementPake(
  distribution: Record<string, number>,
  pakeType: unknown,
): void {
  const key =
    typeof pakeType === "string" && pakeType.trim() ? pakeType.trim() : "unknown";
  distribution[key] = (distribution[key] ?? 0) + 1;
}

export type VaultNotesScan = {
  noteIndex: NoteIndexRow[];
  pakeDistribution: Record<string, number>;
};

export async function collectVaultNotes(vaultRoot: string): Promise<VaultNotesScan> {
  const rows: NoteIndexRow[] = [];
  const pakeDistribution: Record<string, number> = {};
  for (const root of NOTE_ROOTS) {
    const absRoot = path.join(vaultRoot, root);
    const files = await walkMarkdownFiles(absRoot);
    for (const absPath of files) {
      const raw = await readFile(absPath, "utf8");
      const { data } = matter(raw);
      const title =
        typeof data.title === "string" && data.title.trim()
          ? data.title.trim()
          : path.basename(absPath, ".md");
      const tags = Array.isArray(data.tags)
        ? data.tags.filter((t): t is string => typeof t === "string")
        : [];
      const statResult = await stat(absPath);
      rows.push({
        title,
        path: toPosixRel(vaultRoot, absPath),
        tags,
        modifiedAt: statResult.mtimeMs,
      });
      incrementPake(pakeDistribution, data.pake_type);
    }
  }
  return {
    noteIndex: rows.sort((a, b) => b.modifiedAt - a.modifiedAt),
    pakeDistribution,
  };
}

export async function collectNoteIndex(vaultRoot: string): Promise<NoteIndexRow[]> {
  return (await collectVaultNotes(vaultRoot)).noteIndex;
}

export async function collectPakeDistribution(vaultRoot: string): Promise<Record<string, number>> {
  return (await collectVaultNotes(vaultRoot)).pakeDistribution;
}

export async function readVaultLintMetrics(
  vaultRoot: string,
  now = new Date(),
): Promise<{ lintErrors: number; lintWarnings: number; lintStale: boolean }> {
  const reportsDir = path.join(vaultRoot, LINT_REPORT_DIR);
  if (!(await pathExists(reportsDir))) {
    return { lintErrors: 0, lintWarnings: 0, lintStale: true };
  }
  const files = await readdir(reportsDir);
  const newest = pickNewestLintBasename(files);
  if (!newest) {
    return { lintErrors: 0, lintWarnings: 0, lintStale: true };
  }
  const dateMatch = newest.match(LINT_BASENAME_RE);
  const reportDateIso = dateMatch?.[1] ?? "";
  const stale = !reportDateIso || isLintReportStale(reportDateIso, now);
  const content = await readFile(path.join(reportsDir, newest), "utf8");
  const { errors, warnings } = parseVaultLintSummary(content);
  return { lintErrors: errors, lintWarnings: warnings, lintStale: stale };
}

export async function readAgentLogEntries(vaultRoot: string): Promise<AgentLogEntry[]> {
  const logPath = path.join(vaultRoot, AGENT_LOG_REL);
  if (!(await pathExists(logPath))) {
    return [];
  }
  const content = await readFile(logPath, "utf8");
  return parseAgentLogContent(content);
}

export async function readHermesConfigText(): Promise<string> {
  const configPath = path.join(os.homedir(), ".hermes", "config.yaml");
  if (!(await pathExists(configPath))) {
    return "";
  }
  return readFile(configPath, "utf8");
}

export async function findLatestSynthesisArtifact(
  repoRoot: string,
): Promise<{ title: string | null; mtimeMs: number | null }> {
  const artifactsDir = path.join(repoRoot, "_bmad-output", "implementation-artifacts");
  if (!(await pathExists(artifactsDir))) {
    return { title: null, mtimeMs: null };
  }
  const files = await readdir(artifactsDir);
  const synthesisFiles = files.filter((f) => /synthesis/i.test(f) && f.endsWith(".md"));
  let best: { name: string; mtimeMs: number } | null = null;
  for (const name of synthesisFiles) {
    const abs = path.join(artifactsDir, name);
    const s = await stat(abs);
    if (!best || s.mtimeMs > best.mtimeMs) {
      best = { name, mtimeMs: s.mtimeMs };
    }
  }
  if (!best) {
    return { title: null, mtimeMs: null };
  }
  const raw = await readFile(path.join(artifactsDir, best.name), "utf8");
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  return {
    title: titleMatch?.[1]?.trim() ?? best.name.replace(/\.md$/, ""),
    mtimeMs: best.mtimeMs,
  };
}

export async function collectRunChainStatus(repoRoot: string): Promise<RunChainStatus> {
  const sprintPath = path.join(repoRoot, "_bmad-output", "implementation-artifacts", "sprint-status.yaml");
  let storyStatus: string | null = null;
  if (await pathExists(sprintPath)) {
    const yaml = await readFile(sprintPath, "utf8");
    storyStatus = parseSprintStatusValue(yaml, RUN_CHAIN_STORY_KEY);
  }
  const synthesis = await findLatestSynthesisArtifact(repoRoot);
  return {
    state: runChainStateFromStoryStatus(storyStatus),
    lastRunAt: synthesis.mtimeMs,
    lastSynthesisTitle: synthesis.title,
  };
}

export function buildMcpStatusRows(
  agentLogEntries: AgentLogEntry[],
  hermesConfigText: string,
  now: number,
): McpStatusRow[] {
  const vaultIoLastCall = maxVaultIoLastCallAt(agentLogEntries);
  return MCP_NAMES.map((name) => {
    if (name === "vault-io") {
      const status = mcpStatusFromLastCall(vaultIoLastCall, now);
      return {
        name,
        status,
        lastCallAt: vaultIoLastCall,
        badge: status,
      };
    }
    const configured = isMcpConfiguredInHermesConfig(hermesConfigText, name);
    const status: McpStatusValue = configured ? "configured" : "unknown";
    return {
      name,
      status,
      lastCallAt: null,
      badge: configured ? "configured" : "unknown",
    };
  });
}

export type BuildSnapshotOptions = {
  vaultRoot: string;
  repoRoot: string;
  now?: number;
  hermesConfigText?: string;
};

export async function buildDashboardSnapshot(
  opts: BuildSnapshotOptions,
): Promise<DashboardSnapshot> {
  const now = opts.now ?? Date.now();
  const vaultRoot = path.resolve(opts.vaultRoot);
  const repoRoot = path.resolve(opts.repoRoot);

  const [vaultNotes, inboxDepth, lintMetrics, agentLogEntries, hermesConfigText, runChainStatus] =
    await Promise.all([
      collectVaultNotes(vaultRoot),
      countInboxDepth(vaultRoot),
      readVaultLintMetrics(vaultRoot, new Date(now)),
      readAgentLogEntries(vaultRoot),
      opts.hermesConfigText !== undefined
        ? Promise.resolve(opts.hermesConfigText)
        : readHermesConfigText(),
      collectRunChainStatus(repoRoot),
    ]);

  const mcpStatus = buildMcpStatusRows(agentLogEntries, hermesConfigText, now);
  const { noteIndex, pakeDistribution } = vaultNotes;

  return {
    vaultHealth: {
      noteCount: noteIndex.length,
      lintErrors: lintMetrics.lintErrors,
      lintWarnings: lintMetrics.lintWarnings,
      lintStale: lintMetrics.lintStale,
      inboxDepth,
      pakeDistribution,
      syncedAt: now,
    },
    mcpStatus,
    agentLogEntries,
    runChainStatus,
    noteIndex,
    syncMetadata: {
      lastSyncAt: now,
      lastSyncStatus: "ok",
      lastSyncError: null,
    },
  };
}

export const INGEST_MUTATION_PATH = "dashboard:ingestDashboardSnapshot";
export const CONVEX_PUSH_TIMEOUT_MS = 30_000;
export const MAX_SYNC_ERROR_LENGTH = 2000;
export const DEFAULT_DASHBOARD_SYNC_ENV_REL = ".hermes/dashboard-sync.env";

export function normalizeConvexUrl(convexUrl: string): string {
  return convexUrl.replace(/\/$/, "");
}

export function buildIngestMutationRequest(snapshot: DashboardSnapshot): {
  path: string;
  args: { snapshot: DashboardSnapshot };
  format: "json";
} {
  return {
    path: INGEST_MUTATION_PATH,
    args: { snapshot },
    format: "json",
  };
}

export type ConvexMutationResponse = {
  status: "success" | "error";
  value?: unknown;
  errorMessage?: string;
};

export async function pushDashboardSnapshot(
  snapshot: DashboardSnapshot,
  opts: { convexUrl: string; deployKey: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `${normalizeConvexUrl(opts.convexUrl)}/api/mutation`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${opts.deployKey}`,
    },
    body: JSON.stringify(buildIngestMutationRequest(snapshot)),
    signal: AbortSignal.timeout(opts.timeoutMs ?? CONVEX_PUSH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Convex HTTP ${response.status}: ${response.statusText}`);
  }

  let payload: ConvexMutationResponse;
  try {
    payload = (await response.json()) as ConvexMutationResponse;
  } catch {
    throw new Error("Convex mutation response was not valid JSON");
  }
  if (payload.status === "error") {
    throw new Error(payload.errorMessage ?? "Convex mutation failed");
  }
  if (payload.status !== "success") {
    throw new Error(payload.errorMessage ?? "Convex mutation returned unexpected status");
  }
}

export async function scanSnapshotForSecretPatternId(
  snapshot: DashboardSnapshot,
  vaultRoot: string,
): Promise<string | null> {
  const patterns = await loadMergedSecretPatterns(vaultRoot);
  return findFirstMatchingSecretPatternId(JSON.stringify(snapshot), patterns);
}

export function truncateSyncError(errorMessage: string, maxLength = MAX_SYNC_ERROR_LENGTH): string {
  if (errorMessage.length <= maxLength) {
    return errorMessage;
  }
  return `${errorMessage.slice(0, maxLength - 3)}...`;
}

export function snapshotWithSyncError(
  snapshot: DashboardSnapshot,
  errorMessage: string,
  now = Date.now(),
): DashboardSnapshot {
  return {
    ...snapshot,
    syncMetadata: {
      lastSyncAt: now,
      lastSyncStatus: "error",
      lastSyncError: truncateSyncError(errorMessage),
    },
  };
}

export function shouldPushFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.CONVEX_URL?.trim() && env.CONVEX_DEPLOY_KEY?.trim());
}

export function dashboardSyncEnvPath(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.DASHBOARD_SYNC_ENV?.trim();
  if (override) {
    return path.resolve(override);
  }
  return path.join(os.homedir(), ...DEFAULT_DASHBOARD_SYNC_ENV_REL.split("/"));
}

export async function isDashboardSyncEnvPresent(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  return pathExists(dashboardSyncEnvPath(env));
}

export async function collectAndMaybePush(opts: {
  vaultRoot: string;
  repoRoot: string;
  convexUrl?: string;
  deployKey?: string;
  fetchImpl?: typeof fetch;
  now?: number;
  hermesConfigText?: string;
}): Promise<{ snapshot: DashboardSnapshot; pushed: boolean; exitCode: number }> {
  const snapshot = await buildDashboardSnapshot({
    vaultRoot: opts.vaultRoot,
    repoRoot: opts.repoRoot,
    now: opts.now,
    hermesConfigText: opts.hermesConfigText,
  });

  const convexUrl = opts.convexUrl?.trim();
  const deployKey = opts.deployKey?.trim();
  if (!convexUrl || !deployKey) {
    return { snapshot, pushed: false, exitCode: 0 };
  }

  const patternId = await scanSnapshotForSecretPatternId(snapshot, opts.vaultRoot);
  if (patternId !== null) {
    console.error(`FATAL: snapshot matches secret pattern: ${patternId}`);
    return { snapshot, pushed: false, exitCode: 1 };
  }

  try {
    await pushDashboardSnapshot(snapshot, { convexUrl, deployKey, fetchImpl: opts.fetchImpl });
    return { snapshot, pushed: true, exitCode: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const errorSnapshot = snapshotWithSyncError(snapshot, message, opts.now ?? Date.now());
    const errorPatternId = await scanSnapshotForSecretPatternId(errorSnapshot, opts.vaultRoot);
    if (errorPatternId === null) {
      try {
        await pushDashboardSnapshot(errorSnapshot, {
          convexUrl,
          deployKey,
          fetchImpl: opts.fetchImpl,
        });
      } catch (secondaryErr) {
        const secondaryMessage =
          secondaryErr instanceof Error ? secondaryErr.message : String(secondaryErr);
        console.error(`FATAL: dashboard-sync error-metadata push failed: ${secondaryMessage}`);
      }
    } else {
      console.error(`FATAL: error snapshot matches secret pattern: ${errorPatternId}`);
    }
    console.error(`FATAL: dashboard-sync push failed: ${message}`);
    return { snapshot: errorSnapshot, pushed: false, exitCode: 1 };
  }
}

export function parseCliArgs(argv: string[]): { json: boolean; noPush: boolean } {
  return { json: argv.includes("--json"), noPush: argv.includes("--no-push") };
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const vaultRootRaw = process.env.CNS_VAULT_ROOT;
  const vaultRoot = vaultRootRaw?.trim();
  if (!vaultRoot) {
    console.error("FATAL: CNS_VAULT_ROOT is required");
    return 1;
  }
  if (!(await pathExists(path.resolve(vaultRoot)))) {
    console.error(`FATAL: CNS_VAULT_ROOT does not exist: ${vaultRoot}`);
    return 1;
  }

  try {
    const { json, noPush } = parseCliArgs(argv);
    const repoRoot = repoRootFromModule(import.meta.url);
    const expectPush = !noPush && !json;

    if (expectPush && (await isDashboardSyncEnvPresent()) && !shouldPushFromEnv(process.env)) {
      console.error(
        "FATAL: dashboard-sync.env present but CONVEX_URL and CONVEX_DEPLOY_KEY are unset",
      );
      return 1;
    }

    const push = expectPush && shouldPushFromEnv(process.env);

    if (push) {
      const result = await collectAndMaybePush({
        vaultRoot,
        repoRoot,
        convexUrl: process.env.CONVEX_URL,
        deployKey: process.env.CONVEX_DEPLOY_KEY,
      });
      if (result.exitCode !== 0) {
        return result.exitCode;
      }
      const { snapshot } = result;
      console.log(
        `dashboard-sync: pushed ${snapshot.vaultHealth.noteCount} notes, ` +
          `${snapshot.agentLogEntries.length} log entries ` +
          `(sync ok)`,
      );
      return 0;
    }

    const snapshot = await buildDashboardSnapshot({ vaultRoot, repoRoot });

    if (json) {
      console.log(JSON.stringify(snapshot, null, 2));
    } else {
      console.log(
        `dashboard-sync: collected ${snapshot.vaultHealth.noteCount} notes, ` +
          `${snapshot.agentLogEntries.length} log entries, ` +
          `lint ERRORS=${snapshot.vaultHealth.lintErrors} WARNINGS=${snapshot.vaultHealth.lintWarnings}` +
          (snapshot.vaultHealth.lintStale ? " (lint stale)" : "") +
          (shouldPushFromEnv(process.env) ? "" : " (push skipped: use CONVEX_URL+CONVEX_DEPLOY_KEY or omit --no-push)"),
      );
    }
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`FATAL: dashboard-sync failed: ${message}`);
    return 1;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`FATAL: dashboard-sync failed: ${message}`);
      process.exitCode = 1;
    });
}
