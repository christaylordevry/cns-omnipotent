import { chmod, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { writeAuditEntry, createAuditingCallback } from "../../src/routing/audit-log.js";
import type { FallbackLogEntry, FallbackResult, RoutingContext } from "../../src/routing/types.js";

// ── Shared fixtures ────────────────────────────────────────────

function makeEntry(overrides?: Partial<FallbackLogEntry>): FallbackLogEntry {
  return {
    timestamp: "2026-04-15T22:00:00.000Z",
    surface: "cursor",
    taskCategory: "coding",
    originalAlias: "default-coding",
    selectedAlias: "fast",
    tier: "silent",
    reason: "same-provider fallback",
    reason_code: "FALLBACK_USED",
    ...overrides,
  };
}

function ctx(overrides?: Partial<RoutingContext>): RoutingContext {
  return {
    surface: "cursor",
    taskCategory: "coding",
    operatorOverride: false,
    ...overrides,
  };
}

// ── writeAuditEntry ────────────────────────────────────────────

describe("writeAuditEntry", () => {
  let tempDir: string;
  let vaultRoot: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cns-audit-"));
    vaultRoot = tempDir;
    const aiContextDir = join(vaultRoot, "AI-Context");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(aiContextDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("appends a formatted line to an existing agent-log.md", async () => {
    const logPath = join(vaultRoot, "AI-Context", "agent-log.md");
    await writeFile(logPath, "# Agent Log\n");

    const result = await writeAuditEntry(makeEntry(), vaultRoot);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toBe(logPath);

    const content = await readFile(logPath, "utf-8");
    expect(content).toContain("# Agent Log\n");
    expect(content).toContain("- [2026-04-15T22:00:00.000Z] ROUTING silent FALLBACK_USED cursor/coding: default-coding → fast\n");
  });

  it("returns ok: false when agent-log.md does not exist", async () => {
    const result = await writeAuditEntry(makeEntry(), vaultRoot);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("agent-log.md does not exist");
  });

  it("returns permission/IO error when stat fails for non-ENOENT reasons", async () => {
    const aiContextPath = join(vaultRoot, "AI-Context");
    const logPath = join(aiContextPath, "agent-log.md");
    await writeFile(logPath, "");
    await chmod(aiContextPath, 0o000);

    try {
      const result = await writeAuditEntry(makeEntry(), vaultRoot);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toContain("permission/IO error");
    } finally {
      await chmod(aiContextPath, 0o755);
    }
  });

  it("formats the log line correctly matching the expected pattern", async () => {
    const logPath = join(vaultRoot, "AI-Context", "agent-log.md");
    await writeFile(logPath, "");

    const entry = makeEntry({
      timestamp: "2026-04-15T22:01:00.000Z",
      tier: "visible",
      reason_code: "FALLBACK_CROSS_PROVIDER",
      surface: "cursor",
      taskCategory: "coding",
      originalAlias: "default-coding",
      selectedAlias: "gemini-pro",
    });

    await writeAuditEntry(entry, vaultRoot);
    const content = await readFile(logPath, "utf-8");

    const pattern = /^- \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] ROUTING (silent|visible) \S+ \S+\/\S+: \S+ → \S+$/m;
    expect(content).toMatch(pattern);
  });

  it("writes silent-tier entries (not suppressed)", async () => {
    const logPath = join(vaultRoot, "AI-Context", "agent-log.md");
    await writeFile(logPath, "");

    const entry = makeEntry({ tier: "silent", reason_code: "FALLBACK_USED" });
    const result = await writeAuditEntry(entry, vaultRoot);

    expect(result.ok).toBe(true);
    const content = await readFile(logPath, "utf-8");
    expect(content).toContain("ROUTING silent FALLBACK_USED");
  });

  it("formats exhausted entries with 'exhausted' when selectedAlias is null", async () => {
    const logPath = join(vaultRoot, "AI-Context", "agent-log.md");
    await writeFile(logPath, "");

    const entry = makeEntry({
      selectedAlias: null,
      reason_code: "FALLBACK_EXHAUSTED",
      tier: "visible",
    });
    await writeAuditEntry(entry, vaultRoot);

    const content = await readFile(logPath, "utf-8");
    expect(content).toContain("→ exhausted");
  });
});

// ── createAuditingCallback ─────────────────────────────────────

describe("createAuditingCallback", () => {
  let tempDir: string;
  let vaultRoot: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "cns-audit-cb-"));
    vaultRoot = tempDir;
    const aiContextDir = join(vaultRoot, "AI-Context");
    const { mkdir } = await import("node:fs/promises");
    await mkdir(aiContextDir, { recursive: true });
    await writeFile(join(aiContextDir, "agent-log.md"), "");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("calls the user callback after writing the audit entry", async () => {
    let callbackCalled = false;
    const userCallback = () => { callbackCalled = true; };

    const cb = createAuditingCallback(vaultRoot, ctx(), userCallback);
    const result: FallbackResult = {
      ok: true,
      tier: "silent",
      decision: {
        surface: "cursor",
        taskCategory: "coding",
        scope: "task",
        policy_version: "1.0.0",
        selected_model_alias: "fast",
        reason_code: "FALLBACK_USED",
        fallback_chain: [],
        operator_override: false,
      },
      originalAlias: "default-coding",
    };

    cb(result);
    expect(callbackCalled).toBe(true);

    await new Promise((r) => setTimeout(r, 50));
    const content = await readFile(join(vaultRoot, "AI-Context", "agent-log.md"), "utf-8");
    expect(content).toContain("ROUTING silent FALLBACK_USED");
  });

  it("works without a user callback", () => {
    const cb = createAuditingCallback(vaultRoot, ctx());
    const result: FallbackResult = {
      ok: true,
      tier: "silent",
      decision: {
        surface: "cursor",
        taskCategory: "coding",
        scope: "task",
        policy_version: "1.0.0",
        selected_model_alias: "fast",
        reason_code: "FALLBACK_USED",
        fallback_chain: [],
        operator_override: false,
      },
      originalAlias: "default-coding",
    };

    expect(() => cb(result)).not.toThrow();
  });

  it("logs to console.error when audit write fails", async () => {
    const userCallback = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await unlink(join(vaultRoot, "AI-Context", "agent-log.md"));
    const cb = createAuditingCallback(vaultRoot, ctx(), userCallback);

    const result: FallbackResult = {
      ok: true,
      tier: "silent",
      decision: {
        surface: "cursor",
        taskCategory: "coding",
        scope: "task",
        policy_version: "1.0.0",
        selected_model_alias: "fast",
        reason_code: "FALLBACK_USED",
        fallback_chain: [],
        operator_override: false,
      },
      originalAlias: "default-coding",
    };

    cb(result);
    await new Promise((r) => setTimeout(r, 50));

    expect(userCallback).toHaveBeenCalledWith(result);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to write routing audit entry: agent-log.md does not exist"),
    );
    errorSpy.mockRestore();
  });
});
