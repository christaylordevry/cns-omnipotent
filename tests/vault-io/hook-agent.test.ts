import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDefaultHookGenerationAdapter,
  HOOK_SLOT_COUNT,
  MAX_HOOK_ITERATIONS,
  MIN_HOOK_ITERATIONS,
  runHookAgent,
  synthesisRunResultSchema,
  type HookGenerationAdapter,
  type HookGenerationAdapterInput,
  type HookRunResult,
} from "../../src/agents/hook-agent.js";
import type { SynthesisRunResult as SynthResult } from "../../src/agents/synthesis-agent.js";
import type { VaultReadAdapter } from "../../src/agents/synthesis-agent.js";
import { CnsError } from "../../src/errors.js";

async function makeVault(): Promise<string> {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-hook-"));
  await mkdir(path.join(vaultRoot, "00-Inbox"), { recursive: true });
  await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
  await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
  return vaultRoot;
}

function okSynthesis(overrides: Partial<Extract<SynthResult, { status: "ok" }>> = {}): SynthResult {
  return {
    status: "ok",
    insight_note: {
      vault_path: "03-Resources/synth-insight.md",
      pake_id: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
    },
    sources_used: ["03-Resources/a.md"],
    sources_read_failed: [],
    synthesis_timestamp: "2026-04-18T12:00:00.000Z",
    ...overrides,
  };
}

const SYNTH_BODY = `# Synthesis: AI agents in 2026

We see strong adoption curves.

## Patterns
- x

## Gaps
- y

## Opportunities
- z

## Sources
- [[note-a]]
`;

function makeVaultRead(behavior: {
  readNote?: (vaultPath: string) => ReturnType<VaultReadAdapter["readNote"]>;
}): VaultReadAdapter {
  return {
    readNote:
      behavior.readNote ??
      (async () => ({
        body: SYNTH_BODY,
        frontmatter: { title: "Synthesis: AI agents in 2026 (2026-04-18)" },
      })),
  };
}

function gateNeverPassesAdapter(): HookGenerationAdapter {
  return {
    async generateOrRefine() {
      return { hook_text: "still weak", score: 9 };
    },
  };
}

async function readAuditLog(vaultRoot: string): Promise<string[]> {
  const logPath = path.join(vaultRoot, "_meta", "logs", "agent-log.md");
  try {
    const raw = await readFile(logPath, "utf8");
    return raw.split("\n").filter((l) => l.length > 0);
  } catch {
    return [];
  }
}

describe("synthesisRunResultSchema", () => {
  it("parses ok and skipped shapes", () => {
    expect(synthesisRunResultSchema.safeParse(okSynthesis()).success).toBe(true);
    expect(
      synthesisRunResultSchema.safeParse({
        status: "skipped",
        reason: "no-source-notes",
        sources_read_failed: [],
        synthesis_timestamp: "t",
      }).success,
    ).toBe(true);
  });
});

describe("AC: input-validation", () => {
  it("throws SCHEMA_INVALID on malformed synthesis result", async () => {
    const vaultRoot = await makeVault();
    await expect(runHookAgent(vaultRoot, { bogus: true })).rejects.toMatchObject({
      code: "SCHEMA_INVALID",
    });
  });
});

describe("AC: synthesis-skipped", () => {
  it("emits hook_skipped and returns skipped when synthesis was skipped", async () => {
    const vaultRoot = await makeVault();
    const input: SynthResult = {
      status: "skipped",
      reason: "no-readable-sources",
      sources_read_failed: ["x.md"],
      synthesis_timestamp: "2026-04-18T12:00:00.000Z",
    };
    const result: HookRunResult = await runHookAgent(vaultRoot, input);
    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") throw new Error("expected skipped");
    expect(result.reason).toBe("synthesis-skipped");
    expect(result.synthesis_skip_reason).toBe("no-readable-sources");

    const lines = await readAuditLog(vaultRoot);
    expect(lines.some((l) => l.includes("| hook_skipped |"))).toBe(true);
  });
});

describe("AC: vault-read / synthesis-read-failed", () => {
  it("skips when synthesis insight cannot be read", async () => {
    const vaultRoot = await makeVault();
    const result = await runHookAgent(vaultRoot, okSynthesis(), {
      adapters: {
        vaultRead: {
          readNote: async () => {
            throw new CnsError("IO_ERROR", "ENOENT");
          },
        },
      },
    });
    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") throw new Error("expected skipped");
    expect(result.reason).toBe("synthesis-read-failed");

    const lines = await readAuditLog(vaultRoot);
    expect(lines.some((l) => l.includes("| hook_skipped |"))).toBe(true);
  });
});

describe("AC: hooks-gate + hook-set-note + audit", () => {
  it("writes HookSetNote via ingest with four gated options and hook_run audit", async () => {
    const vaultRoot = await makeVault();
    const perSlotCalls = [0, 0, 0, 0];
    const adapter: HookGenerationAdapter = {
      async generateOrRefine(input) {
        perSlotCalls[input.hook_slot - 1]++;
        const score = input.iteration >= MIN_HOOK_ITERATIONS ? 10 : 4;
        return { hook_text: `H${input.hook_slot}-i${input.iteration}`, score };
      },
    };

    const result = await runHookAgent(vaultRoot, okSynthesis(), {
      adapters: { vaultRead: makeVaultRead({}), hookGeneration: adapter },
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.options.length).toBe(HOOK_SLOT_COUNT);
    for (const o of result.options) {
      expect(o.iterations).toBeGreaterThanOrEqual(MIN_HOOK_ITERATIONS);
      expect(o.trace.length).toBe(o.iterations);
      expect(o.trace[o.trace.length - 1]?.score).toBe(10);
    }
    for (const c of perSlotCalls) {
      expect(c).toBeGreaterThanOrEqual(MIN_HOOK_ITERATIONS);
    }

    const notePath = path.join(vaultRoot, ...result.hook_set_note.vault_path.split("/"));
    const content = await readFile(notePath, "utf8");
    expect(content).toContain("pake_type: HookSetNote");
    expect(content).toContain("## Hook option 1");
    expect(content).toContain("## Hook option 4");
    expect(content).toContain("[[synth-insight]]");
    expect(content).toContain("tags:");
    expect(content).toContain("- \"hook-set\"");

    const lines = await readAuditLog(vaultRoot);
    const hookRun = lines.filter((l) => l.includes("| hook_run |"));
    expect(hookRun.length).toBe(1);
    expect(hookRun[0]).toContain(result.hook_set_note.vault_path.replaceAll("\\", "/"));
  });
});

describe("AC: gate failure", () => {
  it("throws when score never reaches 10 within max iterations", async () => {
    const vaultRoot = await makeVault();
    await expect(
      runHookAgent(vaultRoot, okSynthesis(), {
        adapters: {
          vaultRead: makeVaultRead({}),
          hookGeneration: gateNeverPassesAdapter(),
        },
      }),
    ).rejects.toMatchObject({ code: "IO_ERROR" });
  });

  it("runs exactly MAX_HOOK_ITERATIONS when score stays low", async () => {
    let calls = 0;
    const vaultRoot = await makeVault();
    const counting: HookGenerationAdapter = {
      async generateOrRefine() {
        calls++;
        return { hook_text: "x", score: 1 };
      },
    };
    await expect(
      runHookAgent(vaultRoot, okSynthesis(), {
        adapters: { vaultRead: makeVaultRead({}), hookGeneration: counting },
      }),
    ).rejects.toMatchObject({ code: "IO_ERROR" });
    expect(calls).toBe(MAX_HOOK_ITERATIONS);
  });
});

describe("AC: malformed adapter output", () => {
  it("throws SCHEMA_INVALID when adapter returns invalid shape", async () => {
    const vaultRoot = await makeVault();
    const bad: HookGenerationAdapter = {
      async generateOrRefine() {
        return { hook_text: "", score: 10 } as unknown as { hook_text: string; score: number };
      },
    };
    await expect(
      runHookAgent(vaultRoot, okSynthesis(), {
        adapters: { vaultRead: makeVaultRead({}), hookGeneration: bad },
      }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });
});

describe("AC: default hook adapter", () => {
  it("createDefaultHookGenerationAdapter throws UNSUPPORTED", async () => {
    const a = createDefaultHookGenerationAdapter();
    await expect(
      a.generateOrRefine({
        synthesis_body: "x",
        synthesis_vault_path: "p",
        synthesis_title: undefined,
        hook_slot: 1,
        iteration: 1,
        current_draft: "",
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });
});
