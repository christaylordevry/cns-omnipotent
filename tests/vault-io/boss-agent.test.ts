import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createDefaultWeaponsCheckAdapter,
  MAX_WEAPONS_ITERATIONS,
  runBossAgent,
  WEAPONS_RUBRIC,
  type BossRunResult,
  type WeaponsCheckAdapter,
  type WeaponsCheckAdapterInput,
  type WeaponsCheckAdapterOutput,
} from "../../src/agents/boss-agent.js";
import {
  hookRunResultSchema,
  type HookRunResult,
} from "../../src/agents/hook-agent.js";
import type { VaultReadAdapter } from "../../src/agents/synthesis-agent.js";
import { CnsError } from "../../src/errors.js";

async function makeVault(): Promise<string> {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-boss-"));
  await mkdir(path.join(vaultRoot, "00-Inbox"), { recursive: true });
  await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
  await mkdir(path.join(vaultRoot, "_meta", "logs"), { recursive: true });
  return vaultRoot;
}

const HOOK_SET_BODY = `# Hook set: AI agents in 2026

Synthesis: [[synth-insight]]

_Each option ran at least three refinement iterations and passed a 10/10 gate._

## Hook option 1

H1 final text

### Iteration trace

- Iteration 1: score 4/10
- Iteration 2: score 8/10
- Iteration 3: score 10/10
`;

function okHookResult(
  overrides: Partial<Extract<HookRunResult, { status: "ok" }>> = {},
): HookRunResult {
  return {
    status: "ok",
    hook_set_note: {
      vault_path: "03-Resources/hook-set.md",
      pake_id: "eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee",
    },
    synthesis_insight_path: "03-Resources/synth-insight.md",
    options: [
      { slot: 1, final_hook: "H1 final", iterations: 3, trace: [{ iteration: 3, score: 10 }] },
      { slot: 2, final_hook: "H2 final", iterations: 3, trace: [{ iteration: 3, score: 10 }] },
      { slot: 3, final_hook: "H3 final", iterations: 3, trace: [{ iteration: 3, score: 10 }] },
      { slot: 4, final_hook: "H4 final", iterations: 3, trace: [{ iteration: 3, score: 10 }] },
    ],
    hook_timestamp: "2026-04-18T12:00:00.000Z",
    ...overrides,
  };
}

function makeVaultRead(body: string = HOOK_SET_BODY): VaultReadAdapter {
  return {
    async readNote() {
      return {
        body,
        frontmatter: { title: "Hooks: AI agents in 2026 (2026-04-18)" },
      };
    },
  };
}

function passAllAdapter(): WeaponsCheckAdapter {
  return {
    async scoreAndRewrite(input: WeaponsCheckAdapterInput): Promise<WeaponsCheckAdapterOutput> {
      return {
        revised_hook: `${input.current_hook} (refined@${input.iteration})`,
        scores: { novelty: 10, copy_intensity: 10, rationale: "both dimensions peak" },
      };
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

describe("hookRunResultSchema (re-exported contract)", () => {
  it("parses ok and skipped shapes", () => {
    expect(hookRunResultSchema.safeParse(okHookResult()).success).toBe(true);
    expect(
      hookRunResultSchema.safeParse({
        status: "skipped",
        reason: "synthesis-skipped",
        synthesis_skip_reason: "no-source-notes",
        hook_timestamp: "t",
      }).success,
    ).toBe(true);
  });
});

describe("WEAPONS_RUBRIC", () => {
  it("is stable — snapshot-style exact literal", () => {
    // If this test fails, a contributor edited the rubric. Confirm the change
    // was intentional and update the expected value deliberately.
    expect(WEAPONS_RUBRIC).toBe(
      `**Invention novelty (1\u201310)** \u2014 Does this hook present a new angle the audience has not already internalised?\n- 1: commodity platitude, interchangeable with competitor copy\n- 4: a familiar insight dressed in fresher language\n- 7: recognisable territory with a legitimately new framing\n- 10: a reframe the reader cannot unread \u2014 the core claim did not previously exist in the category conversation\n\n**Copy intensity (1\u201310)** \u2014 Does every word pull weight, and does the line hit kinetically?\n- 1: mushy, abstract, passive; could be removed without loss\n- 4: clear but inert; no rhythm, no verbs doing work\n- 7: tight and concrete, one or two soft spots\n- 10: every word pulls \u2014 concrete nouns, active verbs, specific stakes, nothing trimmable\n\nGate: both dimensions must equal 10 (integer) simultaneously; any lower score triggers a rewrite and re-score.`,
    );
  });
});

describe("AC: input-validation", () => {
  it("throws SCHEMA_INVALID on malformed HookRunResult", async () => {
    const vaultRoot = await makeVault();
    await expect(runBossAgent(vaultRoot, { bogus: true })).rejects.toMatchObject({
      code: "SCHEMA_INVALID",
    });
  });
});

describe("AC: hook-skipped", () => {
  it("propagates synthesis-skipped shape and emits weapons_skipped", async () => {
    const vaultRoot = await makeVault();
    const input: HookRunResult = {
      status: "skipped",
      reason: "synthesis-skipped",
      synthesis_skip_reason: "no-readable-sources",
      hook_timestamp: "2026-04-18T12:00:00.000Z",
    };
    const result: BossRunResult = await runBossAgent(vaultRoot, input);
    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") throw new Error("expected skipped");
    expect(result.reason).toBe("hook-skipped");
    expect(result.hook_skip_reason).toBe("synthesis-skipped");
    expect(result.synthesis_skip_reason).toBe("no-readable-sources");

    const lines = await readAuditLog(vaultRoot);
    const skipLines = lines.filter((l) => l.includes("| weapons_skipped |"));
    expect(skipLines.length).toBe(1);
    const runLines = lines.filter((l) => l.includes("| weapons_run |"));
    expect(runLines.length).toBe(0);
  });

  it("propagates synthesis-read-failed shape", async () => {
    const vaultRoot = await makeVault();
    const input: HookRunResult = {
      status: "skipped",
      reason: "synthesis-read-failed",
      hook_timestamp: "2026-04-18T12:00:00.000Z",
    };
    const result: BossRunResult = await runBossAgent(vaultRoot, input);
    expect(result.status).toBe("skipped");
    if (result.status !== "skipped") throw new Error("expected skipped");
    expect(result.hook_skip_reason).toBe("synthesis-read-failed");
    expect(result.synthesis_skip_reason).toBeUndefined();

    const lines = await readAuditLog(vaultRoot);
    expect(lines.some((l) => l.includes("| weapons_skipped |"))).toBe(true);
  });
});

describe("AC: weapons-gate + weapons-note + audit (happy path)", () => {
  it("writes WeaponsCheckNote via ingest with four gated options and weapons_run audit", async () => {
    const vaultRoot = await makeVault();
    const adapterCalls: number[] = [0, 0, 0, 0];
    const adapter: WeaponsCheckAdapter = {
      async scoreAndRewrite(input) {
        adapterCalls[input.hook_slot - 1]++;
        return {
          revised_hook: `${input.current_hook} (refined)`,
          scores: { novelty: 10, copy_intensity: 10, rationale: "peak both dims" },
        };
      },
    };

    const result = await runBossAgent(vaultRoot, okHookResult(), {
      adapters: { vaultRead: makeVaultRead(), weaponsCheck: adapter },
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.options.length).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(adapterCalls[i]).toBe(1);
      expect(result.options[i]?.iterations).toBe(1);
      expect(result.options[i]?.trace[0]?.novelty).toBe(10);
      expect(result.options[i]?.trace[0]?.copy_intensity).toBe(10);
    }

    const notePath = path.join(
      vaultRoot,
      ...result.weapons_check_note.vault_path.split("/"),
    );
    const content = await readFile(notePath, "utf8");
    expect(content).toContain("pake_type: WeaponsCheckNote");
    expect(content).toContain("# Weapons check: AI agents in 2026");
    expect(content).toContain("## Hook option 1");
    expect(content).toContain("## Hook option 4");
    expect(content).toContain("[[hook-set]]");
    expect(content).toContain("[[synth-insight]]");
    // Rubric is embedded verbatim
    expect(content).toContain(WEAPONS_RUBRIC);
    expect(content).toContain("novelty 9+/10 \u00b7 copy intensity 9+/10");
    expect(content).toContain("tags:");
    expect(content).toContain("- \"weapons-check\"");
    expect(content).toContain("- \"research-sweep\"");
    expect(content).toContain("- \"ai-agents-in-2026\"");

    const lines = await readAuditLog(vaultRoot);
    const runLines = lines.filter((l) => l.includes("| weapons_run |"));
    expect(runLines.length).toBe(1);
    expect(runLines[0]).toContain(result.weapons_check_note.vault_path);
  });
});

describe("AC: weapons-gate — both dimensions required", () => {
  it("does NOT accept novelty 10 alone (copy_intensity 8 still triggers iterate)", async () => {
    const vaultRoot = await makeVault();
    let calls = 0;
    const adapter: WeaponsCheckAdapter = {
      async scoreAndRewrite(input) {
        calls++;
        // First pass: 10 novelty, 8 copy (below gate). Second pass: 10/10.
        if (input.iteration === 1) {
          return {
            revised_hook: `${input.current_hook}-i1`,
            scores: { novelty: 10, copy_intensity: 8, rationale: "novelty pins but copy soft" },
          };
        }
        return {
          revised_hook: `${input.current_hook}-i${input.iteration}`,
          scores: { novelty: 10, copy_intensity: 10, rationale: "both peak" },
        };
      },
    };
    const result = await runBossAgent(vaultRoot, okHookResult(), {
      adapters: { vaultRead: makeVaultRead(), weaponsCheck: adapter },
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    // Each slot iterates twice: first 10+8, then 10+10.
    expect(calls).toBe(8);
    for (const o of result.options) {
      expect(o.iterations).toBe(2);
      expect(o.trace[0]?.copy_intensity).toBe(8);
      expect(o.trace[1]?.copy_intensity).toBe(10);
    }
  });

  it("does NOT accept copy_intensity 10 alone (novelty 8 still triggers iterate)", async () => {
    const vaultRoot = await makeVault();
    const adapter: WeaponsCheckAdapter = {
      async scoreAndRewrite(input) {
        if (input.iteration === 1) {
          return {
            revised_hook: `${input.current_hook}-i1`,
            scores: { novelty: 8, copy_intensity: 10, rationale: "copy peaks but novelty near" },
          };
        }
        return {
          revised_hook: `${input.current_hook}-i${input.iteration}`,
          scores: { novelty: 10, copy_intensity: 10, rationale: "both peak" },
        };
      },
    };
    const result = await runBossAgent(vaultRoot, okHookResult(), {
      adapters: { vaultRead: makeVaultRead(), weaponsCheck: adapter },
    });
    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    for (const o of result.options) {
      expect(o.iterations).toBe(2);
      expect(o.trace[0]?.novelty).toBe(8);
    }
  });
});

describe("AC: max-iteration fail-closed", () => {
  it("throws IO_ERROR when gate never clears within MAX_WEAPONS_ITERATIONS", async () => {
    const vaultRoot = await makeVault();
    let calls = 0;
    const neverClears: WeaponsCheckAdapter = {
      async scoreAndRewrite(input) {
        calls++;
        return {
          revised_hook: `${input.current_hook}-i${input.iteration}`,
          scores: { novelty: 8, copy_intensity: 8, rationale: "close but no" },
        };
      },
    };
    await expect(
      runBossAgent(vaultRoot, okHookResult(), {
        adapters: { vaultRead: makeVaultRead(), weaponsCheck: neverClears },
      }),
    ).rejects.toMatchObject({ code: "IO_ERROR" });
    // Fails on the first slot after MAX iterations; later slots not attempted.
    expect(calls).toBe(MAX_WEAPONS_ITERATIONS);

    // No WeaponsCheckNote written.
    const lines = await readAuditLog(vaultRoot);
    expect(lines.some((l) => l.includes("| weapons_run |"))).toBe(false);
  });
});

describe("AC: malformed adapter output", () => {
  it("throws SCHEMA_INVALID when scores are outside the 1..10 range", async () => {
    const vaultRoot = await makeVault();
    const bad: WeaponsCheckAdapter = {
      async scoreAndRewrite() {
        return {
          revised_hook: "x",
          scores: { novelty: 11, copy_intensity: 10, rationale: "off-scale" },
        } as unknown as WeaponsCheckAdapterOutput;
      },
    };
    await expect(
      runBossAgent(vaultRoot, okHookResult(), {
        adapters: { vaultRead: makeVaultRead(), weaponsCheck: bad },
      }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("throws SCHEMA_INVALID when adapter returns non-integer scores", async () => {
    const vaultRoot = await makeVault();
    const bad: WeaponsCheckAdapter = {
      async scoreAndRewrite() {
        return {
          revised_hook: "x",
          scores: { novelty: 9.5, copy_intensity: 10, rationale: "partial" },
        } as unknown as WeaponsCheckAdapterOutput;
      },
    };
    await expect(
      runBossAgent(vaultRoot, okHookResult(), {
        adapters: { vaultRead: makeVaultRead(), weaponsCheck: bad },
      }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });

  it("throws SCHEMA_INVALID when rationale is missing", async () => {
    const vaultRoot = await makeVault();
    const bad: WeaponsCheckAdapter = {
      async scoreAndRewrite() {
        return {
          revised_hook: "x",
          scores: { novelty: 10, copy_intensity: 10, rationale: "" },
        } as unknown as WeaponsCheckAdapterOutput;
      },
    };
    await expect(
      runBossAgent(vaultRoot, okHookResult(), {
        adapters: { vaultRead: makeVaultRead(), weaponsCheck: bad },
      }),
    ).rejects.toMatchObject({ code: "SCHEMA_INVALID" });
  });
});

describe("AC: adapter — default throws UNSUPPORTED", () => {
  it("createDefaultWeaponsCheckAdapter rejects with UNSUPPORTED", async () => {
    const a = createDefaultWeaponsCheckAdapter();
    await expect(
      a.scoreAndRewrite({
        topic: "t",
        synthesis_insight_path: "p",
        hook_set_note_path: "q",
        hook_slot: 1,
        iteration: 1,
        current_hook: "h",
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED" });
  });
});

describe("AC: hook-set read failure hard error", () => {
  it("throws IO_ERROR (not a skip) when HookSetNote cannot be read", async () => {
    const vaultRoot = await makeVault();
    const unreadable: VaultReadAdapter = {
      async readNote() {
        throw new CnsError("IO_ERROR", "ENOENT");
      },
    };
    await expect(
      runBossAgent(vaultRoot, okHookResult(), {
        adapters: { vaultRead: unreadable, weaponsCheck: passAllAdapter() },
      }),
    ).rejects.toMatchObject({ code: "IO_ERROR" });
    const lines = await readAuditLog(vaultRoot);
    expect(lines.some((l) => l.includes("| weapons_run |"))).toBe(false);
  });
});
