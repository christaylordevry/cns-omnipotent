import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RuntimeConfig } from "./config.js";
import { CnsError } from "./errors.js";
import { callToolErrorFromCns, handleToolInvocationCatch } from "./mcp-result.js";
import { pakeTypeSchema } from "./pake/schemas.js";
import { vaultListDirectory } from "./tools/vault-list.js";
import { vaultSearch } from "./tools/vault-search.js";
import { vaultReadFrontmatter } from "./tools/vault-read-frontmatter.js";
import { vaultReadFile } from "./tools/vault-read.js";
import { vaultCreateNote } from "./tools/vault-create-note.js";
import { vaultUpdateFrontmatter } from "./tools/vault-update-frontmatter.js";
import {
  type VaultAppendDailyInput,
  vaultAppendDaily,
  vaultAppendDailyInputSchema,
} from "./tools/vault-append-daily.js";
import { vaultMove } from "./tools/vault-move.js";
import {
  vaultLogAction,
  vaultLogActionInputSchema,
} from "./tools/vault-log-action.js";

/**
 * Canonical Phase 1 Vault IO tool names (FR26 / CNS-Phase-1-Spec Tool Definitions).
 * Order matches the normative list in Story 6.1 AC1 for stable diffs and audits.
 */
export const PHASE1_VAULT_IO_TOOL_NAMES = [
  "vault_search",
  "vault_read",
  "vault_read_frontmatter",
  "vault_create_note",
  "vault_append_daily",
  "vault_update_frontmatter",
  "vault_list",
  "vault_move",
  "vault_log_action",
] as const;

export type Phase1VaultIoToolName = (typeof PHASE1_VAULT_IO_TOOL_NAMES)[number];

function assertPhase1ToolSurface(handles: Record<string, unknown>): void {
  const actual = Object.keys(handles).sort();
  const expected = [...PHASE1_VAULT_IO_TOOL_NAMES].sort();
  if (actual.length !== expected.length || !actual.every((k, i) => k === expected[i])) {
    throw new Error(
      `Phase 1 Vault IO tool surface mismatch.\nExpected: ${expected.join(", ")}\nActual: ${actual.join(", ")}`,
    );
  }
}

const vaultReadFrontmatterInput = z
  .object({
    path: z.string().min(1).optional(),
    paths: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasPath = data.path !== undefined;
    const hasPaths = data.paths !== undefined;
    if (hasPath === hasPaths) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide exactly one of: path (string) or paths (non-empty array of strings)",
      });
    }
  });

const vaultListInput = z
  .object({
    path: z.string().min(1, "path is required"),
    recursive: z.boolean().optional(),
    filter_by_type: pakeTypeSchema.optional(),
    filter_by_status: z.string().min(1).optional(),
  })
  .strict();

const vaultSearchInput = z
  .object({
    query: z.string().min(1, "query is required").max(2000),
    scope: z.string().min(1).optional(),
    max_results: z.number().int().min(1).max(50).optional(),
  })
  .strict();

const vaultCreateNoteInput = z
  .object({
    title: z.string().min(1, "title is required"),
    content: z.string(),
    pake_type: pakeTypeSchema,
    tags: z.array(z.string()),
    confidence_score: z.number().min(0).max(1).optional(),
    source_uri: z.string().optional(),
    project: z.string().optional(),
    area: z.string().optional(),
  })
  .strict();

const vaultUpdateFrontmatterInput = z
  .object({
    path: z.string().min(1, "path is required"),
    updates: z.record(z.string(), z.unknown()),
  })
  .strict();

const vaultMoveInput = z
  .object({
    source_path: z.string().min(1, "source_path is required"),
    destination_path: z.string().min(1, "destination_path is required"),
  })
  .strict();

/**
 * Registers all Phase 1 Vault IO tools on the MCP server.
 * Returns handles so tests can invoke registered handlers without stdio transport.
 */
export function registerVaultIoTools(server: McpServer, cfg: RuntimeConfig) {
  const vault_read = server.registerTool(
    "vault_read",
    {
      description: "Read a vault note by path relative to the vault root (full file contents).",
      inputSchema: z
        .object({
          path: z.string().min(1, "path is required"),
        })
        .strict(),
    },
    async (args) => {
      try {
        const text = await vaultReadFile(cfg.vaultRoot, args.path);
        return {
          content: [{ type: "text", text }],
        };
      } catch (e) {
        return handleToolInvocationCatch(e, { mcpVaultRoot: cfg.vaultRoot });
      }
    },
  );

  const vault_read_frontmatter = server.registerTool(
    "vault_read_frontmatter",
    {
      description:
        "Read YAML frontmatter only for one or more vault-relative paths (token-efficient). Use path or paths, not both.",
      inputSchema: vaultReadFrontmatterInput,
    },
    async (args) => {
      try {
        const paths = args.path !== undefined ? [args.path] : args.paths!;
        const out = await vaultReadFrontmatter(cfg.vaultRoot, paths);
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
        };
      } catch (e) {
        return handleToolInvocationCatch(e, { mcpVaultRoot: cfg.vaultRoot });
      }
    },
  );

  const vault_list = server.registerTool(
    "vault_list",
    {
      description:
        "List a vault directory (metadata only). Optional recursive walk; optional filter_by_type / filter_by_status use frontmatter on .md files.",
      inputSchema: vaultListInput,
    },
    async (args) => {
      try {
        const out = await vaultListDirectory(cfg.vaultRoot, {
          userPath: args.path,
          recursive: args.recursive ?? false,
          filter_by_type: args.filter_by_type,
          filter_by_status: args.filter_by_status,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
        };
      } catch (e) {
        return handleToolInvocationCatch(e, { mcpVaultRoot: cfg.vaultRoot });
      }
    },
  );

  const vault_search = server.registerTool(
    "vault_search",
    {
      description:
        "Full-text search for a literal query within a scoped vault directory (max 50 hits). Requires scope unless CNS_VAULT_DEFAULT_SEARCH_SCOPE is set. Respects .gitignore; excludes _meta/logs unless scope is under logs.",
      inputSchema: vaultSearchInput,
    },
    async (args) => {
      try {
        const out = await vaultSearch(cfg.vaultRoot, {
          query: args.query,
          scope: args.scope,
          maxResults: args.max_results,
          defaultSearchScope: cfg.defaultSearchScope,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
        };
      } catch (e) {
        return handleToolInvocationCatch(e, { mcpVaultRoot: cfg.vaultRoot });
      }
    },
  );

  const vault_create_note = server.registerTool(
    "vault_create_note",
    {
      description:
        "Create a new markdown note with PAKE frontmatter. Routes by pake_type (WorkflowNote uses optional project or area). WriteGate, PAKE validation, and secret scanning run in order before write.",
      inputSchema: vaultCreateNoteInput,
    },
    async (args) => {
      try {
        const out = await vaultCreateNote(
          cfg.vaultRoot,
          {
            title: args.title,
            content: args.content,
            pake_type: args.pake_type,
            tags: args.tags,
            confidence_score: args.confidence_score,
            source_uri: args.source_uri,
            project: args.project,
            area: args.area,
          },
          { surface: "mcp" },
        );
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
        };
      } catch (e) {
        return handleToolInvocationCatch(e, { mcpVaultRoot: cfg.vaultRoot });
      }
    },
  );

  const vault_update_frontmatter = server.registerTool(
    "vault_update_frontmatter",
    {
      description:
        "Merge key-value updates into an existing note's YAML frontmatter without dropping unspecified fields. Shallow merge; nested keys replace whole values. Sets modified to today (YYYY-MM-DD); response updated_fields lists request keys plus modified when the tool applied the auto bump. WriteGate, read, parse, PAKE validation, and secret scanning run in order before atomic replace.",
      inputSchema: vaultUpdateFrontmatterInput,
    },
    async (args) => {
      try {
        const out = await vaultUpdateFrontmatter(cfg.vaultRoot, args.path, args.updates, {
          surface: "mcp",
        });
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
        };
      } catch (e) {
        return handleToolInvocationCatch(e, { mcpVaultRoot: cfg.vaultRoot });
      }
    },
  );

  const vault_append_daily = server.registerTool(
    "vault_append_daily",
    {
      description:
        "Append markdown to today's UTC daily note at DailyNotes/YYYY-MM-DD.md (path is not configurable). Optional `section` names a level-2 heading (e.g. Agent Log or ## Agent Log); omit to append at end of body. If the daily file is missing, bootstraps PAKE WorkflowNote structure per vault constitution. WriteGate, read-or-create, body edit, PAKE validation, and full-note secret scanning run in order before atomic write.",
      inputSchema: vaultAppendDailyInputSchema,
    },
    async (args) => {
      try {
        const out = await vaultAppendDaily(cfg.vaultRoot, args as VaultAppendDailyInput, {
          surface: "mcp",
        });
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
        };
      } catch (e) {
        return handleToolInvocationCatch(e, { mcpVaultRoot: cfg.vaultRoot });
      }
    },
  );

  const vault_log_action = server.registerTool(
    "vault_log_action",
    {
      description:
        "Append one line to _meta/logs/agent-log.md (audit trail). Use for operator-significant events; mutating tools already log automatically.",
      inputSchema: vaultLogActionInputSchema,
    },
    async (args) => {
      try {
        const parsed = vaultLogActionInputSchema.safeParse(args);
        if (!parsed.success) {
          return callToolErrorFromCns(
            new CnsError("SCHEMA_INVALID", "Invalid vault_log_action input.", {
              issues: parsed.error.issues.map((i) => ({
                path: i.path.length > 0 ? i.path.map(String).join(".") : "(root)",
                message: i.message,
                code: i.code,
              })),
            }),
            { mcpVaultRoot: cfg.vaultRoot },
          );
        }
        const out = await vaultLogAction(cfg.vaultRoot, parsed.data, { surface: "mcp" });
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
        };
      } catch (e) {
        return handleToolInvocationCatch(e, { mcpVaultRoot: cfg.vaultRoot });
      }
    },
  );

  const vault_move = server.registerTool(
    "vault_move",
    {
      description:
        "Move or rename a vault note by vault-relative paths. Enforces WriteGate on source (rename) and destination (create-equivalent), PAKE validation keyed to the destination path, atomic rename fallback (no clobber), optional Obsidian CLI when CNS_OBSIDIAN_CLI is set, modified timestamp bump, limited wikilink repair, and audit append. On success, partial_wikilink_repair true and/or a non-empty wikilink_repair_warnings array means the note moved but some backlink files were not updated—inspect warnings and fix links manually if needed.",
      inputSchema: vaultMoveInput,
    },
    async (args) => {
      try {
        const out = await vaultMove(cfg.vaultRoot, args.source_path, args.destination_path, {
          surface: "mcp",
          obsidianCliPath: cfg.obsidianCliPath,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(out) }],
        };
      } catch (e) {
        return handleToolInvocationCatch(e, { mcpVaultRoot: cfg.vaultRoot });
      }
    },
  );

  const handles = {
    vault_search,
    vault_read,
    vault_read_frontmatter,
    vault_create_note,
    vault_append_daily,
    vault_update_frontmatter,
    vault_list,
    vault_move,
    vault_log_action,
  };
  assertPhase1ToolSurface(handles);
  return handles;
}
