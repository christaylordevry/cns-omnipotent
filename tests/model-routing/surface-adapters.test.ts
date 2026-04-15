import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyClaudeCodeAdapter } from "../../src/routing/adapters/claude-code.js";
import { applyCursorAdapter } from "../../src/routing/adapters/cursor.js";
import { applyGeminiCliAdapter } from "../../src/routing/adapters/gemini-cli.js";
import { resolveAlias } from "../../src/routing/adapters/resolve-alias.js";
import type { AliasRegistry, DecisionRecord, FallbackResult, RoutingPolicy } from "../../src/routing/types.js";

// ── Shared fixtures ────────────────────────────────────────────

const REGISTRY: AliasRegistry = {
  registry_version: "1.0.0",
  aliases: {
    "default-coding": {
      provider: "anthropic",
      model_id: "claude-sonnet",
    },
    "default-reasoning": {
      provider: "anthropic",
      model_id: "claude-opus",
    },
    fast: {
      provider: "anthropic",
      model_id: "claude-haiku",
    },
  },
};

function makeRegistryWithAliasEntry(entry: unknown): AliasRegistry {
  return {
    registry_version: "1.0.0",
    aliases: {
      broken: entry as AliasRegistry["aliases"][string],
    },
  };
}

function makeDecision(overrides?: Partial<DecisionRecord>): DecisionRecord {
  return {
    surface: "cursor",
    taskCategory: "coding",
    scope: "task",
    policy_version: "1.0.0",
    selected_model_alias: "default-coding",
    reason_code: "DEFAULT",
    fallback_chain: ["fast"],
    operator_override: false,
    ...overrides,
  };
}

// ── Temp directory lifecycle ───────────────────────────────────

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "cns-adapter-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ── resolveAlias ───────────────────────────────────────────────

describe("resolveAlias", () => {
  it("resolves a known alias to model_id and provider", () => {
    const result = resolveAlias("default-coding", REGISTRY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.modelId).toBe("claude-sonnet");
    expect(result.provider).toBe("anthropic");
  });

  it("returns error for an alias not in the registry", () => {
    const result = resolveAlias("nonexistent-model", REGISTRY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("nonexistent-model");
    expect(result.error).toContain("not found in registry");
  });

  it("returns error when alias entry model_id is missing", () => {
    const registry = makeRegistryWithAliasEntry({ provider: "anthropic" });

    const result = resolveAlias("broken", registry);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("broken");
    expect(result.error).toContain("invalid model_id");
  });

  it("returns error when alias entry model_id is not a non-empty string", () => {
    const registry = makeRegistryWithAliasEntry({ provider: "anthropic", model_id: 42 });

    const result = resolveAlias("broken", registry);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("broken");
    expect(result.error).toContain("invalid model_id");
  });
});

// ── Cursor adapter ─────────────────────────────────────────────

describe("applyCursorAdapter", () => {
  it("writes the resolved model to a new config file", async () => {
    const configPath = path.join(tempDir, "settings.json");
    const decision = makeDecision();

    const result = await applyCursorAdapter(decision, REGISTRY, configPath);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.writtenPath).toBe(configPath);
    expect(result.modelResolved).toBe("claude-sonnet");

    const written = JSON.parse(await readFile(configPath, "utf8"));
    expect(written["cns.routing.model"]).toBe("claude-sonnet");
  });

  it("preserves existing config keys when merging", async () => {
    const configPath = path.join(tempDir, "settings.json");
    await writeFile(configPath, JSON.stringify({ "editor.fontSize": 14, "theme": "dark" }, null, 2) + "\n");

    const result = await applyCursorAdapter(makeDecision(), REGISTRY, configPath);

    expect(result.ok).toBe(true);
    const written = JSON.parse(await readFile(configPath, "utf8"));
    expect(written["editor.fontSize"]).toBe(14);
    expect(written["theme"]).toBe("dark");
    expect(written["cns.routing.model"]).toBe("claude-sonnet");
  });

  it("returns error when alias is not in registry", async () => {
    const configPath = path.join(tempDir, "settings.json");
    const decision = makeDecision({ selected_model_alias: "phantom-alias" });

    const result = await applyCursorAdapter(decision, REGISTRY, configPath);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.surface).toBe("cursor");
    expect(result.error).toContain("phantom-alias");
    expect(result.error).toContain("not found in registry");
  });

  it("returns error on atomic write failure without throwing", async () => {
    const bogusPath = path.join(tempDir, "deeply", "nested", "nonexistent", "settings.json");

    const result = await applyCursorAdapter(makeDecision(), REGISTRY, bogusPath);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.surface).toBe("cursor");
    expect(result.error).toContain("Atomic write failed");
  });

  it("returns error when existing config is not valid JSON", async () => {
    const configPath = path.join(tempDir, "settings.json");
    await writeFile(configPath, "not-json{{{{");

    const result = await applyCursorAdapter(makeDecision(), REGISTRY, configPath);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.surface).toBe("cursor");
    expect(result.error).toContain("Failed to parse existing config");
  });

  it("returns error when existing config JSON is not an object", async () => {
    const configPath = path.join(tempDir, "settings.json");
    await writeFile(configPath, JSON.stringify(["not", "an", "object"]) + "\n");

    const result = await applyCursorAdapter(makeDecision(), REGISTRY, configPath);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.surface).toBe("cursor");
    expect(result.error).toContain("must be a JSON object");
  });
});

// ── Claude Code adapter ────────────────────────────────────────

describe("applyClaudeCodeAdapter", () => {
  it("writes the resolved model to a new config file under the model key", async () => {
    const configPath = path.join(tempDir, "settings.json");
    const decision = makeDecision({ surface: "claude-code", selected_model_alias: "default-reasoning" });

    const result = await applyClaudeCodeAdapter(decision, REGISTRY, configPath);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.writtenPath).toBe(configPath);
    expect(result.modelResolved).toBe("claude-opus");

    const written = JSON.parse(await readFile(configPath, "utf8"));
    expect(written.model).toBe("claude-opus");
  });

  it("preserves existing config keys when merging", async () => {
    const configPath = path.join(tempDir, "settings.json");
    const existing = {
      permissions: { allow: ["Read"] },
      env: { SOME_VAR: "value" },
    };
    await writeFile(configPath, JSON.stringify(existing, null, 2) + "\n");

    const result = await applyClaudeCodeAdapter(makeDecision(), REGISTRY, configPath);

    expect(result.ok).toBe(true);
    const written = JSON.parse(await readFile(configPath, "utf8"));
    expect(written.permissions).toEqual({ allow: ["Read"] });
    expect(written.env).toEqual({ SOME_VAR: "value" });
    expect(written.model).toBe("claude-sonnet");
  });

  it("returns error when alias is not in registry", async () => {
    const configPath = path.join(tempDir, "settings.json");
    const decision = makeDecision({ surface: "claude-code", selected_model_alias: "phantom-alias" });

    const result = await applyClaudeCodeAdapter(decision, REGISTRY, configPath);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.surface).toBe("claude-code");
    expect(result.error).toContain("phantom-alias");
    expect(result.error).toContain("not found in registry");
  });

  it("returns error on atomic write failure without throwing", async () => {
    const bogusPath = path.join(tempDir, "deeply", "nested", "nonexistent", "settings.json");

    const result = await applyClaudeCodeAdapter(makeDecision(), REGISTRY, bogusPath);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.surface).toBe("claude-code");
    expect(result.error).toContain("Atomic write failed");
  });

  it("returns error when existing config JSON is not an object", async () => {
    const configPath = path.join(tempDir, "settings.json");
    await writeFile(configPath, JSON.stringify(["not", "an", "object"]) + "\n");

    const result = await applyClaudeCodeAdapter(makeDecision(), REGISTRY, configPath);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.surface).toBe("claude-code");
    expect(result.error).toContain("must be a JSON object");
  });

  it("overwrites a previous model value in existing config", async () => {
    const configPath = path.join(tempDir, "settings.json");
    await writeFile(configPath, JSON.stringify({ model: "old-model" }, null, 2) + "\n");

    const result = await applyClaudeCodeAdapter(
      makeDecision({ selected_model_alias: "fast" }),
      REGISTRY,
      configPath,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.modelResolved).toBe("claude-haiku");

    const written = JSON.parse(await readFile(configPath, "utf8"));
    expect(written.model).toBe("claude-haiku");
  });
});

// ── Gemini CLI adapter ─────────────────────────────────────────

const GEMINI_REGISTRY: AliasRegistry = {
  registry_version: "1.1.0",
  aliases: {
    "gemini-pro": { provider: "google", model_id: "gemini-2.5-pro" },
    "gemini-flash": { provider: "google", model_id: "gemini-2.5-flash" },
  },
};

function makeGeminiDecision(overrides?: Partial<DecisionRecord>): DecisionRecord {
  return {
    surface: "gemini-cli",
    taskCategory: "coding",
    scope: "session",
    policy_version: "1.1.0",
    selected_model_alias: "gemini-pro",
    reason_code: "DEFAULT",
    fallback_chain: ["gemini-flash"],
    operator_override: false,
    ...overrides,
  };
}

describe("applyGeminiCliAdapter", () => {
  it("resolves gemini-pro and writes model.name to a new config file", async () => {
    const configPath = path.join(tempDir, "settings.json");
    const decision = makeGeminiDecision();

    const result = await applyGeminiCliAdapter(decision, GEMINI_REGISTRY, configPath);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.writtenPath).toBe(configPath);
    expect(result.modelResolved).toBe("gemini-2.5-pro");

    const written = JSON.parse(await readFile(configPath, "utf8"));
    expect(written.model).toEqual({ name: "gemini-2.5-pro" });
  });

  it("resolves gemini-flash and writes model.name", async () => {
    const configPath = path.join(tempDir, "settings.json");
    const decision = makeGeminiDecision({ selected_model_alias: "gemini-flash" });

    const result = await applyGeminiCliAdapter(decision, GEMINI_REGISTRY, configPath);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.modelResolved).toBe("gemini-2.5-flash");

    const written = JSON.parse(await readFile(configPath, "utf8"));
    expect(written.model).toEqual({ name: "gemini-2.5-flash" });
  });

  it("returns error when alias is not in registry", async () => {
    const configPath = path.join(tempDir, "settings.json");
    const decision = makeGeminiDecision({ selected_model_alias: "phantom-alias" });

    const result = await applyGeminiCliAdapter(decision, GEMINI_REGISTRY, configPath);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.surface).toBe("gemini-cli");
    expect(result.error).toContain("phantom-alias");
    expect(result.error).toContain("not found in registry");
  });

  it("returns error when alias has malformed model_id", async () => {
    const badRegistry = makeRegistryWithAliasEntry({ provider: "google", model_id: "" });
    const configPath = path.join(tempDir, "settings.json");
    const decision = makeGeminiDecision({ selected_model_alias: "broken" });

    const result = await applyGeminiCliAdapter(decision, badRegistry, configPath);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.surface).toBe("gemini-cli");
    expect(result.error).toContain("invalid model_id");
  });

  it("returns error when existing config JSON is not an object", async () => {
    const configPath = path.join(tempDir, "settings.json");
    await writeFile(configPath, JSON.stringify(["not", "an", "object"]) + "\n");

    const result = await applyGeminiCliAdapter(makeGeminiDecision(), GEMINI_REGISTRY, configPath);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.surface).toBe("gemini-cli");
    expect(result.error).toContain("must be a JSON object");
  });

  it("returns error on atomic write failure without throwing", async () => {
    const bogusPath = path.join(tempDir, "deeply", "nested", "nonexistent", "settings.json");

    const result = await applyGeminiCliAdapter(makeGeminiDecision(), GEMINI_REGISTRY, bogusPath);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.surface).toBe("gemini-cli");
    expect(result.error).toContain("Atomic write failed");
  });

  it("preserves sibling keys under model and top-level keys (nested merge)", async () => {
    const configPath = path.join(tempDir, "settings.json");
    const existing = {
      model: { name: "gemini-1.5-pro", safety: "block_medium_and_above", temperature: 0.7 },
      codeExecution: true,
      otherKey: 42,
    };
    await writeFile(configPath, JSON.stringify(existing, null, 2) + "\n");

    const result = await applyGeminiCliAdapter(makeGeminiDecision(), GEMINI_REGISTRY, configPath);

    expect(result.ok).toBe(true);
    const written = JSON.parse(await readFile(configPath, "utf8"));
    expect(written.model.name).toBe("gemini-2.5-pro");
    expect(written.model.safety).toBe("block_medium_and_above");
    expect(written.model.temperature).toBe(0.7);
    expect(written.codeExecution).toBe(true);
    expect(written.otherKey).toBe(42);
  });

  it("creates model object when it does not exist in existing config", async () => {
    const configPath = path.join(tempDir, "settings.json");
    await writeFile(configPath, JSON.stringify({ otherKey: 42 }, null, 2) + "\n");

    const result = await applyGeminiCliAdapter(makeGeminiDecision(), GEMINI_REGISTRY, configPath);

    expect(result.ok).toBe(true);
    const written = JSON.parse(await readFile(configPath, "utf8"));
    expect(written.model).toEqual({ name: "gemini-2.5-pro" });
    expect(written.otherKey).toBe(42);
  });

  it("replaces model with object when existing model is not an object", async () => {
    const configPath = path.join(tempDir, "settings.json");
    await writeFile(configPath, JSON.stringify({ model: "just-a-string", otherKey: 42 }, null, 2) + "\n");

    const result = await applyGeminiCliAdapter(makeGeminiDecision(), GEMINI_REGISTRY, configPath);

    expect(result.ok).toBe(true);
    const written = JSON.parse(await readFile(configPath, "utf8"));
    expect(written.model).toEqual({ name: "gemini-2.5-pro" });
    expect(written.otherKey).toBe(42);
  });
});

// ── Adapter fallback integration ───────────────────────────────

const FALLBACK_REASON_CODES = [
  "DEFAULT",
  "FALLBACK_CROSS_PROVIDER",
  "FALLBACK_EXHAUSTED",
  "FALLBACK_RATE_LIMIT",
  "FALLBACK_USED",
  "OPERATOR_OVERRIDE",
  "POLICY_DENY",
  "NO_MATCH_FAIL_CLOSED",
] as const;

const FALLBACK_REGISTRY: AliasRegistry = {
  registry_version: "1.1.0",
  aliases: {
    "default-coding": { provider: "anthropic", model_id: "claude-sonnet" },
    fast: { provider: "anthropic", model_id: "claude-haiku" },
    "gemini-pro": { provider: "google", model_id: "gemini-2.5-pro" },
  },
};

const FALLBACK_POLICY: RoutingPolicy = {
  policy_version: "1.1.0",
  surfaces: {
    cursor: {
      default_scope: "task",
      defaults: {
        coding: { model_alias: "default-coding", fallback_chain: ["fast"] },
        writing: { model_alias: "fast", fallback_chain: [] },
        analysis: { model_alias: "fast", fallback_chain: [] },
      },
    },
    "claude-code": {
      default_scope: "task",
      defaults: {
        coding: { model_alias: "default-coding", fallback_chain: ["fast"] },
        writing: { model_alias: "fast", fallback_chain: [] },
        analysis: { model_alias: "fast", fallback_chain: [] },
      },
    },
    "gemini-cli": {
      default_scope: "session",
      defaults: {
        coding: { model_alias: "gemini-pro", fallback_chain: ["fast"] },
        writing: { model_alias: "gemini-pro", fallback_chain: [] },
        analysis: { model_alias: "gemini-pro", fallback_chain: [] },
      },
    },
  },
};

describe("applyCursorAdapter fallback integration", () => {
  it("calls onFallback with FallbackResult when initial write fails and fallback is available", async () => {
    const bogusPath = path.join(tempDir, "deeply", "nested", "nonexistent", "settings.json");
    const decision = makeDecision({
      selected_model_alias: "default-coding",
      fallback_chain: ["fast"],
    });

    const captured: FallbackResult[] = [];
    const result = await applyCursorAdapter(
      decision, FALLBACK_REGISTRY, bogusPath,
      FALLBACK_POLICY, FALLBACK_REASON_CODES,
      (fb) => { captured.push(fb); },
    );

    expect(captured).toHaveLength(1);
    expect(captured[0].ok).toBe(true);
    if (!captured[0].ok) return;
    expect(captured[0].tier).toBe("silent");
    expect(captured[0].decision.selected_model_alias).toBe("fast");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Atomic write failed");
  });

  it("completes successfully when onFallback is not provided (3-arg call)", async () => {
    const configPath = path.join(tempDir, "settings.json");
    const decision = makeDecision();

    const result = await applyCursorAdapter(decision, REGISTRY, configPath);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.modelResolved).toBe("claude-sonnet");
  });

  it("writes fallback audit entries when vaultRoot is provided", async () => {
    const bogusPath = path.join(tempDir, "deeply", "nested", "nonexistent", "settings.json");
    const vaultRoot = path.join(tempDir, "vault-cursor");
    const auditPath = path.join(vaultRoot, "AI-Context", "agent-log.md");
    await mkdir(path.dirname(auditPath), { recursive: true });
    await writeFile(auditPath, "");

    const result = await applyCursorAdapter(
      makeDecision({ selected_model_alias: "default-coding", fallback_chain: ["fast"] }),
      FALLBACK_REGISTRY,
      bogusPath,
      FALLBACK_POLICY,
      FALLBACK_REASON_CODES,
      undefined,
      vaultRoot,
    );

    expect(result.ok).toBe(false);
    const logContent = await readFile(auditPath, "utf8");
    expect(logContent).toContain("ROUTING silent FALLBACK_USED cursor/coding");
  });
});

describe("applyClaudeCodeAdapter fallback integration", () => {
  it("calls onFallback with FallbackResult when initial write fails", async () => {
    const bogusPath = path.join(tempDir, "deeply", "nested", "nonexistent", "settings.json");
    const decision = makeDecision({
      surface: "claude-code",
      selected_model_alias: "default-coding",
      fallback_chain: ["fast"],
    });

    const captured: FallbackResult[] = [];
    const result = await applyClaudeCodeAdapter(
      decision, FALLBACK_REGISTRY, bogusPath,
      FALLBACK_POLICY, FALLBACK_REASON_CODES,
      (fb) => { captured.push(fb); },
    );

    expect(captured).toHaveLength(1);
    expect(captured[0].ok).toBe(true);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Atomic write failed");
  });

  it("completes successfully when onFallback is not provided (3-arg call)", async () => {
    const configPath = path.join(tempDir, "settings.json");
    const decision = makeDecision({ surface: "claude-code" });

    const result = await applyClaudeCodeAdapter(decision, REGISTRY, configPath);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.modelResolved).toBe("claude-sonnet");
  });

  it("writes fallback audit entries when vaultRoot is provided", async () => {
    const bogusPath = path.join(tempDir, "deeply", "nested", "nonexistent", "settings.json");
    const vaultRoot = path.join(tempDir, "vault-claude");
    const auditPath = path.join(vaultRoot, "AI-Context", "agent-log.md");
    await mkdir(path.dirname(auditPath), { recursive: true });
    await writeFile(auditPath, "");

    const result = await applyClaudeCodeAdapter(
      makeDecision({ surface: "claude-code", selected_model_alias: "default-coding", fallback_chain: ["fast"] }),
      FALLBACK_REGISTRY,
      bogusPath,
      FALLBACK_POLICY,
      FALLBACK_REASON_CODES,
      undefined,
      vaultRoot,
    );

    expect(result.ok).toBe(false);
    const logContent = await readFile(auditPath, "utf8");
    expect(logContent).toContain("ROUTING silent FALLBACK_USED claude-code/coding");
  });
});

describe("applyGeminiCliAdapter fallback integration", () => {
  it("calls onFallback with FallbackResult when initial write fails", async () => {
    const bogusPath = path.join(tempDir, "deeply", "nested", "nonexistent", "settings.json");
    const decision = makeGeminiDecision({
      selected_model_alias: "gemini-pro",
      fallback_chain: ["fast"],
    });

    const captured: FallbackResult[] = [];
    const result = await applyGeminiCliAdapter(
      decision,
      { ...FALLBACK_REGISTRY, registry_version: "1.1.0" },
      bogusPath,
      FALLBACK_POLICY, FALLBACK_REASON_CODES,
      (fb) => { captured.push(fb); },
    );

    expect(captured).toHaveLength(1);
    expect(captured[0].ok).toBe(true);
    if (!captured[0].ok) return;
    expect(captured[0].tier).toBe("visible");
    expect(captured[0].decision.reason_code).toBe("FALLBACK_CROSS_PROVIDER");

    expect(result.ok).toBe(false);
  });

  it("completes successfully when onFallback is not provided (3-arg call)", async () => {
    const configPath = path.join(tempDir, "settings.json");
    const decision = makeGeminiDecision();

    const result = await applyGeminiCliAdapter(decision, GEMINI_REGISTRY, configPath);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.modelResolved).toBe("gemini-2.5-pro");
  });

  it("writes fallback audit entries when vaultRoot is provided", async () => {
    const bogusPath = path.join(tempDir, "deeply", "nested", "nonexistent", "settings.json");
    const vaultRoot = path.join(tempDir, "vault-gemini");
    const auditPath = path.join(vaultRoot, "AI-Context", "agent-log.md");
    await mkdir(path.dirname(auditPath), { recursive: true });
    await writeFile(auditPath, "");

    const result = await applyGeminiCliAdapter(
      makeGeminiDecision({ selected_model_alias: "gemini-pro", fallback_chain: ["fast"] }),
      { ...FALLBACK_REGISTRY, registry_version: "1.1.0" },
      bogusPath,
      FALLBACK_POLICY,
      FALLBACK_REASON_CODES,
      undefined,
      vaultRoot,
    );

    expect(result.ok).toBe(false);
    const logContent = await readFile(auditPath, "utf8");
    expect(logContent).toContain("ROUTING visible FALLBACK_CROSS_PROVIDER gemini-cli/coding");
  });
});
