/**
 * Story 6.2: integration tests against a committed fixture under `tests/fixtures/minimal-vault/`.
 *
 * Each test copies the fixture into an isolated temp directory (never uses the operator's live vault).
 * Tool calls mirror MCP `validateToolInput` + handler: parse with the registered `inputSchema`, then invoke `.handler`.
 */

import { cp, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodIssueCode, type ZodTypeAny } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeConfig } from "../../src/config.js";
import { registerVaultIoTools } from "../../src/register-vault-io-tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Committed static fixture; tests always copy from here into a temp vault root. */
const FIXTURE_VAULT_SOURCE = path.join(__dirname, "../fixtures/minimal-vault");

const INTEGRATION_DAY = "2026-01-15";

function agentLogAbs(vaultRoot: string): string {
  return path.join(vaultRoot, "_meta", "logs", "agent-log.md");
}

async function readAuditRaw(vaultRoot: string): Promise<string> {
  return readFile(agentLogAbs(vaultRoot), "utf8");
}

async function prepareIsolatedVault(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "cns-fixture-6-2-"));
  await cp(FIXTURE_VAULT_SOURCE, dir, { recursive: true, errorOnExist: true });
  return dir;
}

function cfgForVault(vaultRoot: string): RuntimeConfig {
  return {
    vaultRoot,
    defaultSearchScope: "03-Resources",
  };
}

type ToolHandle = {
  inputSchema?: ZodTypeAny | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any, extra: any) => Promise<unknown>;
};

async function callRegisteredTool(tool: ToolHandle, args: unknown) {
  const data = tool.inputSchema ? tool.inputSchema.parse(args) : args;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tool.handler(data, {} as any);
}

function expectSuccessJson(text: string): unknown {
  const v = JSON.parse(text) as unknown;
  return v;
}

describe("fixture vault integration (Story 6.2)", () => {
  const tempVaults = new Set<string>();

  afterEach(async () => {
    for (const dir of tempVaults) {
      await rm(dir, { recursive: true, force: true });
    }
    tempVaults.clear();
  });

  async function prepareTestVault(): Promise<string> {
    const vaultRoot = await prepareIsolatedVault();
    tempVaults.add(vaultRoot);
    return vaultRoot;
  }

  it("fixture source layout exists and is committed under tests/fixtures/minimal-vault", async () => {
    const agents = path.join(FIXTURE_VAULT_SOURCE, "AI-Context", "AGENTS.md");
    const inbox = path.join(FIXTURE_VAULT_SOURCE, "00-Inbox", "raw-capture.md");
    const daily = path.join(FIXTURE_VAULT_SOURCE, "DailyNotes", `${INTEGRATION_DAY}.md`);
    const log = path.join(FIXTURE_VAULT_SOURCE, "_meta", "logs", "agent-log.md");
    const modules = path.join(FIXTURE_VAULT_SOURCE, "AI-Context", "modules");
    const schemas = path.join(FIXTURE_VAULT_SOURCE, "_meta", "schemas");

    await expect(stat(agents)).resolves.toBeDefined();
    await expect(stat(inbox)).resolves.toBeDefined();
    await expect(stat(daily)).resolves.toBeDefined();
    await expect(stat(log)).resolves.toBeDefined();
    await expect(stat(modules)).resolves.toBeDefined();
    await expect(stat(schemas)).resolves.toBeDefined();

    const rawInbox = await readFile(inbox, "utf8");
    expect(rawInbox.trimStart().startsWith("---")).toBe(false);

    for (const rel of [
      "03-Resources/source-note.md",
      "03-Resources/insight-note.md",
      "03-Resources/synthesis-note.md",
      "03-Resources/validation-note.md",
      "01-Projects/p-fix/workflow-note.md",
    ]) {
      await expect(stat(path.join(FIXTURE_VAULT_SOURCE, rel))).resolves.toBeDefined();
    }
  });

  it("vault_read: full call chain returns inbox body", async () => {
    const vaultRoot = await prepareTestVault();
    const server = new McpServer({ name: "cns-fixture-it", version: "0.0.0" });
    const { vault_read } = registerVaultIoTools(server, cfgForVault(vaultRoot));

    const out = (await callRegisteredTool(vault_read, {
      path: "00-Inbox/raw-capture.md",
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(out.isError).toBeUndefined();
    expect(out.content[0].text).toContain("Raw inbox capture");
  });

  it("vault_read: rejects traversal with VAULT_BOUNDARY", async () => {
    const vaultRoot = await prepareTestVault();
    const server = new McpServer({ name: "cns-fixture-it", version: "0.0.0" });
    const { vault_read } = registerVaultIoTools(server, cfgForVault(vaultRoot));

    const out = (await callRegisteredTool(vault_read, {
      path: "../../../etc/passwd",
    })) as { content: Array<{ type: string; text: string }>; isError: boolean };

    expect(out.isError).toBe(true);
    const body = JSON.parse(out.content[0].text) as { code: string };
    expect(body.code).toBe("VAULT_BOUNDARY");
  });

  it("vault_read_frontmatter: parses multiple fixture paths", async () => {
    const vaultRoot = await prepareTestVault();
    const server = new McpServer({ name: "cns-fixture-it", version: "0.0.0" });
    const { vault_read_frontmatter } = registerVaultIoTools(server, cfgForVault(vaultRoot));

    const out = (await callRegisteredTool(vault_read_frontmatter, {
      paths: ["03-Resources/source-note.md", "03-Resources/insight-note.md"],
    })) as { content: Array<{ type: string; text: string }> };

    const payload = expectSuccessJson(out.content[0].text) as {
      results: Array<{ path: string; frontmatter: Record<string, unknown> }>;
    };
    expect(payload.results.length).toBe(2);
    expect(payload.results.some((r) => r.frontmatter.pake_type === "SourceNote")).toBe(true);
    expect(payload.results.some((r) => r.frontmatter.pake_type === "InsightNote")).toBe(true);
  });

  it("vault_list: lists 03-Resources entries with metadata", async () => {
    const vaultRoot = await prepareTestVault();
    const server = new McpServer({ name: "cns-fixture-it", version: "0.0.0" });
    const { vault_list } = registerVaultIoTools(server, cfgForVault(vaultRoot));

    const out = (await callRegisteredTool(vault_list, {
      path: "03-Resources",
      recursive: false,
    })) as { content: Array<{ type: string; text: string }> };

    const listed = expectSuccessJson(out.content[0].text) as {
      entries: Array<{ name: string }>;
    };
    const names = listed.entries.map((e) => e.name);
    expect(names).toContain("source-note.md");
    expect(names).toContain("movable-note.md");
  });

  it("vault_search: scoped search finds fixture marker", async () => {
    const vaultRoot = await prepareTestVault();
    const server = new McpServer({ name: "cns-fixture-it", version: "0.0.0" });
    const { vault_search } = registerVaultIoTools(server, cfgForVault(vaultRoot));

    const out = (await callRegisteredTool(vault_search, {
      query: "UNIQUE_FIXTURE_SNIFF_6_2",
    })) as { content: Array<{ type: string; text: string }> };

    const payload = expectSuccessJson(out.content[0].text) as {
      hits: Array<{ path: string }>;
      scope: string;
    };
    expect(payload.scope).toBe("03-Resources");
    expect(payload.hits.length).toBeGreaterThanOrEqual(1);
    expect(payload.hits.some((h) => h.path.includes("source-note.md"))).toBe(true);
  });

  it("vault_create_note: writes note, audits, and omits body from log", async () => {
    const vaultRoot = await prepareTestVault();
    const logBefore = await readAuditRaw(vaultRoot);

    const server = new McpServer({ name: "cns-fixture-it", version: "0.0.0" });
    const { vault_create_note } = registerVaultIoTools(server, cfgForVault(vaultRoot));

    const bodyMarker = "AWS_SECRET_ACCESS_KEY=ABCD1234EFGH5678IJKL9012MNOP3456";
    const out = (await callRegisteredTool(vault_create_note, {
      title: "Integration Fixture Create",
      content: `# Created\n\n${bodyMarker}`,
      pake_type: "SourceNote",
      tags: ["integration"],
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(out.isError).toBeUndefined();
    const created = JSON.parse(out.content[0].text) as { file_path: string };
    expect(created.file_path).toMatch(/^03-Resources\/integration-fixture-create\.md$/);

    const rawLog = await readAuditRaw(vaultRoot);
    expect(rawLog.length).toBeGreaterThan(logBefore.length);
    expect(rawLog).toContain("| vault_create_note |");
    expect(rawLog).toContain("| create |");
    expect(rawLog).not.toContain(bodyMarker);
  });

  describe("vault_append_daily", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(`${INTEGRATION_DAY}T12:00:00.000Z`));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("appends under Agent Log, audits once, omits raw append from log", async () => {
      const vaultRoot = await prepareTestVault();
      const logBefore = await readAuditRaw(vaultRoot);

      const server = new McpServer({ name: "cns-fixture-it", version: "0.0.0" });
      const { vault_append_daily } = registerVaultIoTools(server, cfgForVault(vaultRoot));

      const appendMarker = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fixture.payload";
      const out = (await callRegisteredTool(vault_append_daily, {
        content: appendMarker,
        section: "Agent Log",
      })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

      expect(out.isError).toBeUndefined();
      const meta = JSON.parse(out.content[0].text) as { path: string };
      expect(meta.path).toBe(`DailyNotes/${INTEGRATION_DAY}.md`);

      const dailyText = await readFile(path.join(vaultRoot, meta.path), "utf8");
      expect(dailyText).toContain(appendMarker);

      const rawLog = await readAuditRaw(vaultRoot);
      expect(rawLog.length).toBeGreaterThan(logBefore.length);
      expect(rawLog).toContain("| vault_append_daily |");
      expect(rawLog).not.toContain(appendMarker);
    });
  });

  it("vault_update_frontmatter: merges, audits, and does not leak updated value in log", async () => {
    const vaultRoot = await prepareTestVault();
    const logBefore = await readAuditRaw(vaultRoot);

    const server = new McpServer({ name: "cns-fixture-it", version: "0.0.0" });
    const { vault_update_frontmatter } = registerVaultIoTools(server, cfgForVault(vaultRoot));

    const secretSummary =
      "bearer_token_placeholder_a1b2c3d4e5f678901234567890abcdef0123456789abcdef012345";
    const out = (await callRegisteredTool(vault_update_frontmatter, {
      path: "03-Resources/insight-note.md",
      updates: { ai_summary: secretSummary },
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(out.isError).toBeUndefined();

    const note = await readFile(path.join(vaultRoot, "03-Resources/insight-note.md"), "utf8");
    expect(note).toContain(secretSummary);

    const rawLog = await readAuditRaw(vaultRoot);
    expect(rawLog.length).toBeGreaterThan(logBefore.length);
    expect(rawLog).toContain("| vault_update_frontmatter |");
    expect(rawLog).not.toContain(secretSummary);
  });

  it("vault_move: relocates note and writes audit line", async () => {
    const vaultRoot = await prepareTestVault();
    const logBefore = await readAuditRaw(vaultRoot);

    const server = new McpServer({ name: "cns-fixture-it", version: "0.0.0" });
    const { vault_move } = registerVaultIoTools(server, cfgForVault(vaultRoot));

    const out = (await callRegisteredTool(vault_move, {
      source_path: "03-Resources/movable-note.md",
      destination_path: "03-Resources/movable-note-renamed.md",
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(out.isError).toBeUndefined();
    await expect(stat(path.join(vaultRoot, "03-Resources/movable-note-renamed.md"))).resolves.toBeDefined();
    await expect(stat(path.join(vaultRoot, "03-Resources/movable-note.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });

    const rawLog = await readAuditRaw(vaultRoot);
    expect(rawLog.length).toBeGreaterThan(logBefore.length);
    expect(rawLog).toContain("| vault_move |");
  });

  it("vault_log_action: appends audit via WriteGate", async () => {
    const vaultRoot = await prepareTestVault();
    const logBefore = await readAuditRaw(vaultRoot);

    const server = new McpServer({ name: "cns-fixture-it", version: "0.0.0" });
    const { vault_log_action } = registerVaultIoTools(server, cfgForVault(vaultRoot));

    const out = (await callRegisteredTool(vault_log_action, {
      action: "integration_probe",
      tool_used: "fixture_test",
      details: "marker_detail_only",
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(out.isError).toBeUndefined();
    JSON.parse(out.content[0].text) as { logged_at: string };

    const rawLog = await readAuditRaw(vaultRoot);
    expect(rawLog.length).toBeGreaterThan(logBefore.length);
    expect(rawLog).toContain("| integration_probe |");
    expect(rawLog).toContain("| fixture_test |");
  });

  it("rejects unknown input keys (strict schema) and does not mutate vault or audit", async () => {
    const vaultRoot = await prepareTestVault();
    const logBefore = await readAuditRaw(vaultRoot);
    const noteBefore = await readFile(
      path.join(vaultRoot, "03-Resources/insight-note.md"),
      "utf8",
    );

    const server = new McpServer({ name: "cns-fixture-it", version: "0.0.0" });
    const { vault_update_frontmatter } = registerVaultIoTools(server, cfgForVault(vaultRoot));

    const schema = vault_update_frontmatter.inputSchema!;
    const bad = schema.safeParse({
      path: "03-Resources/insight-note.md",
      updates: { title: "Should Not Apply" },
      evil_extra_key: true,
    });

    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues.some((i) => i.code === ZodIssueCode.unrecognized_keys)).toBe(true);
    }

    const noteAfter = await readFile(path.join(vaultRoot, "03-Resources/insight-note.md"), "utf8");
    expect(noteAfter).toBe(noteBefore);

    const logAfter = await readAuditRaw(vaultRoot);
    expect(logAfter).toBe(logBefore);
  });

  it("all nine registered tool schemas reject unknown root keys (.strict sweep)", async () => {
    const vaultRoot = await prepareTestVault();
    const server = new McpServer({ name: "cns-fixture-it", version: "0.0.0" });
    const handles = registerVaultIoTools(server, cfgForVault(vaultRoot));

    const validInputs: Record<string, Record<string, unknown>> = {
      vault_search: { query: "fixture" },
      vault_read: { path: "00-Inbox/raw-capture.md" },
      vault_read_frontmatter: { path: "03-Resources/source-note.md" },
      vault_create_note: {
        title: "Schema Sweep",
        content: "# content",
        pake_type: "SourceNote",
        tags: ["integration"],
      },
      vault_append_daily: { content: "hello" },
      vault_update_frontmatter: {
        path: "03-Resources/insight-note.md",
        updates: { title: "Updated" },
      },
      vault_list: { path: "03-Resources" },
      vault_move: {
        source_path: "03-Resources/movable-note.md",
        destination_path: "03-Resources/movable-note-renamed.md",
      },
      vault_log_action: { action: "probe", tool_used: "schema_sweep" },
    };

    for (const [toolName, handle] of Object.entries(handles)) {
      const schema = (handle as ToolHandle).inputSchema;
      expect(schema).toBeDefined();
      const bad = schema!.safeParse({
        ...validInputs[toolName],
        unexpected_extra_key: true,
      });
      expect(bad.success, `${toolName} should reject unknown root keys`).toBe(false);
      if (!bad.success) {
        expect(bad.error.issues.some((i) => i.code === ZodIssueCode.unrecognized_keys)).toBe(true);
      }
    }
  });
});
