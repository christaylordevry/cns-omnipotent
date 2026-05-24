import { mkdir, mkdtemp, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  INGEST_MUTATION_PATH,
  MCP_NAMES,
  MAX_SYNC_ERROR_LENGTH,
  buildDashboardSnapshot,
  buildIngestMutationRequest,
  buildMcpStatusRows,
  collectAndMaybePush,
  dashboardSyncEnvPath,
  findLatestSynthesisArtifact,
  isDashboardSyncEnvPresent,
  isLintReportStale,
  isMcpConfiguredInHermesConfig,
  maxVaultIoLastCallAt,
  parseAgentLogContent,
  parseAgentLogLine,
  parseSprintStatusValue,
  parseVaultLintSummary,
  pickNewestLintBasename,
  pushDashboardSnapshot,
  runChainStateFromStoryStatus,
  scanSnapshotForSecretPatternId,
  shouldPushFromEnv,
  snapshotWithSyncError,
  truncateSyncError,
} from "../../scripts/dashboard-sync.js";

describe("dashboard-sync parsers", () => {
  it("parses AuditLogger pipe lines", () => {
    const line =
      "[2026-05-24T10:00:00.000Z] | read | vault_read | cursor | 03-Resources/test.md | read note";
    const entry = parseAgentLogLine(line);
    expect(entry).toMatchObject({
      action: "read",
      tool: "vault_read",
      surface: "cursor",
      targetPath: "03-Resources/test.md",
      summary: "read note",
    });
    expect(entry?.timestamp).toBe(Date.parse("2026-05-24T10:00:00.000Z"));
  });

  it("returns last 20 valid agent-log entries", () => {
    const lines = Array.from({ length: 25 }, (_, i) =>
      `[2026-05-24T10:00:${String(i).padStart(2, "0")}.000Z] | read | vault_read | cursor | p${i}.md | s${i}`,
    );
    const entries = parseAgentLogContent(lines.join("\n"));
    expect(entries).toHaveLength(20);
    expect(entries[0]?.targetPath).toBe("p5.md");
    expect(entries[19]?.targetPath).toBe("p24.md");
  });

  it("parses vault lint summary counts", () => {
    const report = `# Vault lint
## Summary
- Scanned: 118
- Clean: 95
- Errors: 0
- Warnings: 23
`;
    expect(parseVaultLintSummary(report)).toEqual({ errors: 0, warnings: 23 });
  });

  it("picks newest lint report by basename date", () => {
    expect(
      pickNewestLintBasename([
        "vault-lint-2026-05-20.md",
        "vault-lint-2026-05-24.md",
        "other.md",
      ]),
    ).toBe("vault-lint-2026-05-24.md");
  });

  it("flags lint stale after 7 days", () => {
    const now = new Date("2026-05-24T12:00:00Z");
    expect(isLintReportStale("2026-05-24", now)).toBe(false);
    expect(isLintReportStale("2026-05-16", now)).toBe(true);
  });

  it("derives vault-io lastCallAt from agent log tools", () => {
    const ts = Date.parse("2026-05-24T12:00:00.000Z");
    const entries = [
      {
        timestamp: ts - 1000,
        action: "read",
        tool: "vault_read",
        surface: "cursor",
        targetPath: "a.md",
        summary: "a",
      },
      {
        timestamp: ts,
        action: "read",
        tool: "perplexity_search",
        surface: "cursor",
        targetPath: "b.md",
        summary: "b",
      },
    ];
    expect(maxVaultIoLastCallAt(entries)).toBe(ts - 1000);
  });

  it("builds seven MCP rows without fabricated non-vault-io timestamps", () => {
    const now = Date.parse("2026-05-24T12:10:00.000Z");
    const rows = buildMcpStatusRows(
      [
        {
          timestamp: now - 60_000,
          action: "read",
          tool: "vault_read",
          surface: "cursor",
          targetPath: "x.md",
          summary: "x",
        },
      ],
      "mcp_servers:\n  notebooklm:\n  context7:\n",
      now,
    );
    expect(rows).toHaveLength(7);
    const vaultIo = rows.find((r) => r.name === "vault-io");
    expect(vaultIo?.lastCallAt).not.toBeNull();
    expect(vaultIo?.status).toBe("active");
    for (const name of MCP_NAMES) {
      if (name === "vault-io") continue;
      const row = rows.find((r) => r.name === name)!;
      expect(row.lastCallAt).toBeNull();
    }
  });

  it("detects MCP presence only under mcp_servers block", () => {
    const cfg = "mcp_servers:\n  cns_vault_io:\n  context7:\n";
    expect(isMcpConfiguredInHermesConfig(cfg, "vault-io")).toBe(true);
    expect(isMcpConfiguredInHermesConfig(cfg, "context7")).toBe(true);
    expect(isMcpConfiguredInHermesConfig(cfg, "discord")).toBe(false);
  });

  it("ignores MCP name matches outside mcp_servers", () => {
    const cfg = `discord:
  allowed: true
web:
  backend: firecrawl
mcp_servers:
  notebooklm:
`;
    expect(isMcpConfiguredInHermesConfig(cfg, "firecrawl")).toBe(false);
    expect(isMcpConfiguredInHermesConfig(cfg, "discord")).toBe(false);
    expect(isMcpConfiguredInHermesConfig(cfg, "notebooklm")).toBe(true);
  });

  it("maps run-chain sprint status to state", () => {
    expect(runChainStateFromStoryStatus("in-progress")).toBe("running");
    expect(runChainStateFromStoryStatus("done")).toBe("dormant");
    expect(parseSprintStatusValue("  38-2-kimi-k2-6-evaluation-run-chain: done\n", RUN_CHAIN_KEY)).toBe(
      "done",
    );
  });
});

const RUN_CHAIN_KEY = "38-2-kimi-k2-6-evaluation-run-chain";

describe("findLatestSynthesisArtifact", () => {
  it("picks newest synthesis file by mtime and parses title", async () => {
    const repoRoot = await mkdtemp(path.join(os.tmpdir(), "cns-dash-synth-"));
    const artifactsDir = path.join(repoRoot, "_bmad-output/implementation-artifacts");
    await mkdir(artifactsDir, { recursive: true });

    const olderPath = path.join(artifactsDir, "older-synthesis-notes.md");
    const newerPath = path.join(artifactsDir, "newer-synthesis-output.md");
    await writeFile(olderPath, "# Old Synthesis\n", "utf8");
    await writeFile(newerPath, "# New Synthesis Title\n", "utf8");
    await utimes(olderPath, new Date("2020-01-01"), new Date("2020-01-01"));
    await utimes(newerPath, new Date("2026-05-24"), new Date("2026-05-24"));

    const result = await findLatestSynthesisArtifact(repoRoot);
    expect(result.title).toBe("New Synthesis Title");
    expect(result.mtimeMs).toBe(new Date("2026-05-24").getTime());
  });
});

describe("dashboard-sync push", () => {
  it("builds Convex ingest mutation request", async () => {
    const { vaultRoot, repoRoot } = await makeFixtureVault();
    const snapshot = await buildDashboardSnapshot({ vaultRoot, repoRoot });
    expect(buildIngestMutationRequest(snapshot)).toEqual({
      path: INGEST_MUTATION_PATH,
      args: { snapshot },
      format: "json",
    });
  });

  it("aborts push when snapshot matches a secret pattern", async () => {
    const { vaultRoot, repoRoot } = await makeFixtureVault();
    await writeFile(
      path.join(vaultRoot, "_meta/logs/agent-log.md"),
      "[2026-05-24T10:00:00.000Z] | read | vault_read | cursor | 03-Resources/sample.md | sk-proj-abcdefghijklmnopqrstuvwxyz123456\n",
      "utf8",
    );

    const snapshot = await buildDashboardSnapshot({ vaultRoot, repoRoot });
    const patternId = await scanSnapshotForSecretPatternId(snapshot, vaultRoot);
    expect(patternId).toBe("openai_proj_key");

    const fetchCalls: unknown[] = [];
    const result = await collectAndMaybePush({
      vaultRoot,
      repoRoot,
      convexUrl: "https://example.convex.cloud",
      deployKey: "test-key",
      fetchImpl: async (...args) => {
        fetchCalls.push(args);
        return new Response(JSON.stringify({ status: "success", value: null }), { status: 200 });
      },
    });
    expect(result.exitCode).toBe(1);
    expect(fetchCalls).toHaveLength(0);
  });

  it("POSTs ingest mutation with deploy key header", async () => {
    const { vaultRoot, repoRoot } = await makeFixtureVault();
    const snapshot = await buildDashboardSnapshot({ vaultRoot, repoRoot });
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    await pushDashboardSnapshot(snapshot, {
      convexUrl: "https://happy-otter-123.convex.cloud/",
      deployKey: "deploy-key-secret",
      fetchImpl: async (url, init) => {
        capturedUrl = String(url);
        capturedInit = init;
        return new Response(JSON.stringify({ status: "success", value: null }), { status: 200 });
      },
    });

    expect(capturedUrl).toBe("https://happy-otter-123.convex.cloud/api/mutation");
    expect(capturedInit?.method).toBe("POST");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Convex deploy-key-secret");
    const body = JSON.parse(String(capturedInit?.body)) as { path: string };
    expect(body.path).toBe(INGEST_MUTATION_PATH);
  });

  it("pushes error syncMetadata after mutation failure", async () => {
    const { vaultRoot, repoRoot } = await makeFixtureVault();
    const bodies: string[] = [];
    const result = await collectAndMaybePush({
      vaultRoot,
      repoRoot,
      convexUrl: "https://example.convex.cloud",
      deployKey: "key",
      fetchImpl: async (_url, init) => {
        bodies.push(String(init?.body ?? ""));
        if (bodies.length === 1) {
          return new Response(
            JSON.stringify({ status: "error", errorMessage: "validation failed" }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ status: "success", value: null }), { status: 200 });
      },
    });
    expect(result.exitCode).toBe(1);
    expect(result.snapshot.syncMetadata.lastSyncStatus).toBe("error");
    expect(bodies).toHaveLength(2);
    const lastBody = JSON.parse(bodies[bodies.length - 1]!) as {
      args: { snapshot: { syncMetadata: { lastSyncError: string; lastSyncStatus: string } } };
    };
    expect(lastBody.args.snapshot.syncMetadata.lastSyncStatus).toBe("error");
    expect(lastBody.args.snapshot.syncMetadata.lastSyncError).toContain("validation failed");
  });

  it("throws on HTTP error responses from Convex", async () => {
    const { vaultRoot, repoRoot } = await makeFixtureVault();
    const snapshot = await buildDashboardSnapshot({ vaultRoot, repoRoot });

    await expect(
      pushDashboardSnapshot(snapshot, {
        convexUrl: "https://example.convex.cloud",
        deployKey: "key",
        fetchImpl: async () => new Response("Unauthorized", { status: 401, statusText: "Unauthorized" }),
      }),
    ).rejects.toThrow("Convex HTTP 401");
  });

  it("skips error-metadata push when error snapshot matches a secret pattern", async () => {
    const { vaultRoot, repoRoot } = await makeFixtureVault();
    const fetchCalls: unknown[] = [];
    const result = await collectAndMaybePush({
      vaultRoot,
      repoRoot,
      convexUrl: "https://example.convex.cloud",
      deployKey: "key",
      fetchImpl: async (...args) => {
        fetchCalls.push(args);
        throw new Error("sk-proj-abcdefghijklmnopqrstuvwxyz123456 leaked in upstream error");
      },
    });
    expect(result.exitCode).toBe(1);
    expect(fetchCalls).toHaveLength(1);
  });

  it("detects push mode from Convex env vars", () => {
    expect(shouldPushFromEnv({ CONVEX_URL: "https://x.convex.cloud", CONVEX_DEPLOY_KEY: "k" })).toBe(
      true,
    );
    expect(shouldPushFromEnv({ CONVEX_URL: "https://x.convex.cloud" })).toBe(false);
  });

  it("snapshotWithSyncError sets error metadata", () => {
    const base = {
      syncMetadata: { lastSyncAt: 1, lastSyncStatus: "ok" as const, lastSyncError: null },
    };
    const err = snapshotWithSyncError(base as never, "network down", 99);
    expect(err.syncMetadata).toEqual({
      lastSyncAt: 99,
      lastSyncStatus: "error",
      lastSyncError: "network down",
    });
  });

  it("truncateSyncError caps long messages", () => {
    const long = "x".repeat(MAX_SYNC_ERROR_LENGTH + 50);
    const truncated = truncateSyncError(long);
    expect(truncated.length).toBeLessThanOrEqual(MAX_SYNC_ERROR_LENGTH);
    expect(truncated.endsWith("...")).toBe(true);
  });

  it("dashboardSyncEnvPath honors DASHBOARD_SYNC_ENV override", () => {
    expect(dashboardSyncEnvPath({ DASHBOARD_SYNC_ENV: "/tmp/custom.env" })).toBe("/tmp/custom.env");
  });

  it("isDashboardSyncEnvPresent returns false when env file missing", async () => {
    expect(await isDashboardSyncEnvPresent({ DASHBOARD_SYNC_ENV: "/tmp/nonexistent-dashboard-sync.env" })).toBe(
      false,
    );
  });
});

async function makeFixtureVault(): Promise<{ vaultRoot: string; repoRoot: string }> {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "cns-dash-repo-"));
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-dash-vault-"));

  await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
  await mkdir(path.join(vaultRoot, "00-Inbox"), { recursive: true });
  await mkdir(path.join(vaultRoot, "_meta/reports"), { recursive: true });
  await mkdir(path.join(vaultRoot, "_meta/logs"), { recursive: true });
  await mkdir(path.join(repoRoot, "_bmad-output/implementation-artifacts"), { recursive: true });

  await writeFile(
    path.join(vaultRoot, "03-Resources/sample.md"),
    `---
title: Sample Note
pake_type: InsightNote
tags: [cns, test]
---
Body
`,
    "utf8",
  );
  await writeFile(path.join(vaultRoot, "00-Inbox/inbox-one.md"), "# Inbox\n", "utf8");
  await writeFile(
    path.join(vaultRoot, "_meta/reports/vault-lint-2026-05-24.md"),
    "## Summary\n- Errors: 0\n- Warnings: 2\n",
    "utf8",
  );
  await writeFile(
    path.join(vaultRoot, "_meta/logs/agent-log.md"),
    "[2026-05-24T10:00:00.000Z] | read | vault_read | cursor | 03-Resources/sample.md | ok\n",
    "utf8",
  );
  await writeFile(
    path.join(repoRoot, "_bmad-output/implementation-artifacts/sprint-status.yaml"),
    "development_status:\n  38-2-kimi-k2-6-evaluation-run-chain: done\n",
    "utf8",
  );

  return { vaultRoot, repoRoot };
}

describe("buildDashboardSnapshot", () => {
  it("assembles a valid DashboardSnapshot from fixture vault", async () => {
    const { vaultRoot, repoRoot } = await makeFixtureVault();
    const now = Date.parse("2026-05-24T12:00:00.000Z");
    const snapshot = await buildDashboardSnapshot({
      vaultRoot,
      repoRoot,
      now,
      hermesConfigText: "mcp_servers:\n  context7:\n  notebooklm:\n",
    });

    expect(snapshot.vaultHealth.noteCount).toBe(1);
    expect(snapshot.vaultHealth.inboxDepth).toBe(1);
    expect(snapshot.vaultHealth.lintErrors).toBe(0);
    expect(snapshot.vaultHealth.lintWarnings).toBe(2);
    expect(snapshot.vaultHealth.lintStale).toBe(false);
    expect(snapshot.vaultHealth.pakeDistribution.InsightNote).toBe(1);
    expect(snapshot.noteIndex[0]?.path).toBe("03-Resources/sample.md");
    expect(snapshot.agentLogEntries).toHaveLength(1);
    expect(snapshot.mcpStatus).toHaveLength(7);
    expect(snapshot.runChainStatus.state).toBe("dormant");
    expect(snapshot.syncMetadata.lastSyncStatus).toBe("ok");
  });
});
