import { describe, expect, it } from "vitest";
import {
  INGEST_INTERNAL_DEV_STATE_PATH,
  buildIngestInternalDevStateRequest,
  pushInternalDevState,
  scanInternalDevStateForSecretPatternId,
} from "../../scripts/dashboard-sync.js";
import {
  collectInternalDevState,
  parseAgentLogCandidatesFromContent,
  parseDeferredWorkContent,
  parseSprintStatusContent,
  parseVaultScanContent,
  scoreAndRankCandidates,
  type PrioritizedItem,
} from "../../scripts/lib/collect-internal-dev-state.js";

const NOW = Date.parse("2026-07-05T12:00:00.000Z");

describe("parseDeferredWorkContent", () => {
  it("parses multiple ## sections into deferred candidates", () => {
    const content = `# Deferred work

## Hermes self-improvement ungoverned skill writes (2026-07-04)

**Surfaced by:** Story 77-4 awareness-sync data-accuracy fix (live Discord test).

**Problem:** Ungoverned skill writes bypass review.

---

## cns-dashboard CI failure — @esbuild/aix-ppc64 (2026-06-25)

GitHub CI fails on npm ci with EBADPLATFORM.
`;
    const items = parseDeferredWorkContent(content);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: "Hermes self-improvement ungoverned skill writes (2026-07-04)",
      category: "deferred",
      sourcePath: "_bmad-output/implementation-artifacts/deferred-work.md",
      rationale: "**Surfaced by:** Story 77-4 awareness-sync data-accuracy fix (live Discord test).",
    });
    expect(items[0]?.surfacedAt).toBe(Date.parse("2026-07-04T12:00:00.000Z"));
    expect(items[1]?.title).toContain("cns-dashboard CI failure");
  });

  it("uses first body line as rationale when Surfaced by is absent", () => {
    const content = `# Deferred work

## Ops health items (2026-06-25)

Run-chain dormant 25 days — trigger a manual chain run when ready.
`;
    const items = parseDeferredWorkContent(content);
    expect(items[0]?.rationale).toBe("Run-chain dormant 25 days — trigger a manual chain run when ready.");
  });
});

describe("parseSprintStatusContent", () => {
  const fixtureYaml = `# comments
development_status:
  epic-81: in-progress
  # Epic 81 — Morning Intelligence
  81-1b-internal-dev-state-collector-dashboard-sync-push: ready-for-dev
  81-2-morning-digest-discovery-block: backlog
  80-1-pin-auxiliary-block-to-portal-haiku: done
  79-5-production-cns-brain-recall-plugin-prefetch-cli: review
  79-4-live-cutover: in-progress
  epic-81-retrospective: optional
  pre-epic-68-checklist: backlog
`;

  it("includes only review, in-progress, and ready-for-dev story keys", () => {
    const items = parseSprintStatusContent(fixtureYaml);
    const titles = items.map((i) => i.title).sort();
    expect(titles).toEqual([
      "79-4-live-cutover",
      "79-5-production-cns-brain-recall-plugin-prefetch-cli",
      "81-1b-internal-dev-state-collector-dashboard-sync-push",
    ]);
    expect(items.every((i) => i.category === "sprint")).toBe(true);
  });

  it("excludes backlog, done, epic keys, retrospective, and pre-* keys", () => {
    const items = parseSprintStatusContent(fixtureYaml);
    const titles = new Set(items.map((i) => i.title));
    expect(titles.has("81-2-morning-digest-discovery-block")).toBe(false);
    expect(titles.has("80-1-pin-auxiliary-block-to-portal-haiku")).toBe(false);
    expect(titles.has("epic-81")).toBe(false);
    expect(titles.has("epic-81-retrospective")).toBe(false);
    expect(titles.has("pre-epic-68-checklist")).toBe(false);
  });

  it("includes epic comment in rationale when present", () => {
    const items = parseSprintStatusContent(fixtureYaml);
    const story81 = items.find((i) => i.title.startsWith("81-1b"));
    expect(story81?.rationale).toContain("Sprint status: ready-for-dev");
    expect(story81?.rationale).toContain("Epic 81");
  });
});

describe("parseAgentLogCandidatesFromContent", () => {
  it("dedupes by targetPath keeping newest timestamp", () => {
    const content = [
      "[2026-07-05T08:00:00.000Z] | read | vault_read | cursor | 03-Resources/foo.md | older",
      "[2026-07-05T10:00:00.000Z] | update | vault_update_frontmatter | cursor | 03-Resources/foo.md | newer",
      "[2026-07-05T09:00:00.000Z] | read | vault_read | cursor | 03-Resources/bar.md | bar",
    ].join("\n");
    const items = parseAgentLogCandidatesFromContent(content);
    expect(items).toHaveLength(2);
    const foo = items.find((i) => i.title.includes("foo.md"));
    expect(foo?.title).toBe("update 03-Resources/foo.md");
    expect(foo?.rationale).toContain("vault_update_frontmatter");
  });

  it("respects last-20 tail limit from shared parser", () => {
    const lines = Array.from({ length: 25 }, (_, i) =>
      `[2026-07-05T10:00:${String(i).padStart(2, "0")}.000Z] | read | vault_read | cursor | p${i}.md | s${i}`,
    );
    const items = parseAgentLogCandidatesFromContent(lines.join("\n"));
    expect(items).toHaveLength(20);
    expect(items.some((i) => i.title.includes("p0.md"))).toBe(false);
    expect(items.some((i) => i.title.includes("p24.md"))).toBe(true);
  });
});

describe("parseVaultScanContent", () => {
  it("parses normative fast-scan rows and skips comment lines", () => {
    const content = `# Vault Fast-Scan Index (auto — /session-close)
# Format: [TYPE] [path] | [title] | [created]

SYN 03-Resources/Synthesis-A.md | Synthesis A | 2026-07-01
SRC 03-Resources/Source-B.md | Source B | 2026-06-20
INS 02-Areas/Insight-C.md | Insight C | 2026-07-04
invalid line
DLY 01-Projects/Daily-D.md | Daily D | 2026-07-03
`;
    const items = parseVaultScanContent(content);
    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({
      title: "Synthesis A",
      category: "vault_scan",
      sourcePath: "03-Resources/Synthesis-A.md",
      rationale: "Fast-scan: SYN note modified 2026-07-01",
      scanType: "SYN",
    });
  });
});

describe("scoreAndRankCandidates combined rank", () => {
  it("returns ≤20 items with contiguous rank and descending rankScore", () => {
    const deferred = parseDeferredWorkContent(
      Array.from({ length: 10 }, (_, i) => `## Deferred item ${i} (2026-06-${String(i + 1).padStart(2, "0")})\n\nBody ${i}.`).join(
        "\n\n",
      ),
    );
    const sprint = parseSprintStatusContent(
      `development_status:\n${Array.from({ length: 10 }, (_, i) => `  ${70 + i}-1-story-${i}: review`).join("\n")}`,
    );
    const agentLog = parseAgentLogCandidatesFromContent(
      Array.from(
        { length: 10 },
        (_, i) =>
          `[2026-07-05T1${i}:00:00.000Z] | read | vault_read | cursor | note-${i}.md | summary ${i}`,
      ).join("\n"),
    );
    const vaultScan = parseVaultScanContent(
      Array.from(
        { length: 10 },
        (_, i) => `SRC 03-Resources/n${i}.md | Note ${i} | 2026-07-0${(i % 5) + 1}`,
      ).join("\n"),
    );

    const deferredBodies = new Map(deferred.map((d) => [d.title, "plain body"]));
    const ranked = scoreAndRankCandidates(
      deferred,
      sprint,
      agentLog,
      vaultScan,
      deferredBodies,
      NOW,
    );

    expect(ranked.length).toBeLessThanOrEqual(20);
    expect(ranked.length).toBe(20);
    ranked.forEach((item, idx) => {
      expect(item.rank).toBe(idx + 1);
    });
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.rankScore).toBeGreaterThanOrEqual(ranked[i]!.rankScore);
    }
    const categories = new Set(ranked.map((r) => r.category));
    expect(categories.size).toBeGreaterThan(1);
  });

  it("applies approved recency formulas", () => {
    const freshLog = parseAgentLogCandidatesFromContent(
      "[2026-07-05T11:00:00.000Z] | read | vault_read | cursor | fresh.md | ok",
    );
    const staleLog = parseAgentLogCandidatesFromContent(
      "[2026-07-01T12:00:00.000Z] | read | vault_read | cursor | stale.md | ok",
    );
    const freshScan = parseVaultScanContent("SYN 03-Resources/new.md | New | 2026-07-05");
    const staleScan = parseVaultScanContent("SYN 03-Resources/old.md | Old | 2026-06-15");

    const ranked = scoreAndRankCandidates([], [], [...freshLog, ...staleLog], [...freshScan, ...staleScan], new Map(), NOW);

    const freshAgent = ranked.find((r) => r.title.includes("fresh.md"));
    const staleAgent = ranked.find((r) => r.title.includes("stale.md"));
    expect(freshAgent!.rankScore).toBeGreaterThan(staleAgent!.rankScore);
    expect(freshAgent!.rankScore).toBeCloseTo(48 + 11.5, 0);

    const freshVault = ranked.find((r) => r.title === "New");
    const staleVault = ranked.find((r) => r.title === "Old");
    expect(freshVault!.rankScore).toBeGreaterThan(staleVault!.rankScore);
    expect(freshVault!.rankScore).toBeCloseTo(42 + 10, 0);
  });

  it("rewards older deferred debt within 30 days", () => {
    const older = parseDeferredWorkContent("## Old debt (2026-06-20)\n\nBody.");
    const newer = parseDeferredWorkContent("## New debt (2026-07-04)\n\nBody.");
    const bodies = new Map([
      [older[0]!.title, "Body."],
      [newer[0]!.title, "Body."],
    ]);
    const rankedOlder = scoreAndRankCandidates(older, [], [], [], bodies, NOW);
    const rankedNewer = scoreAndRankCandidates(newer, [], [], [], bodies, NOW);
    expect(rankedOlder[0]!.rankScore).toBeGreaterThan(rankedNewer[0]!.rankScore);
  });
});

describe("internal dev-state push builder", () => {
  it("builds Convex ingest mutation request for dev-state items", () => {
    const items: PrioritizedItem[] = [
      {
        rank: 1,
        rankScore: 92,
        title: "81-1b-internal-dev-state-collector-dashboard-sync-push",
        category: "sprint",
        rationale: "Sprint status: ready-for-dev",
        sourcePath: "_bmad-output/implementation-artifacts/sprint-status.yaml",
      },
    ];
    expect(buildIngestInternalDevStateRequest(items)).toEqual({
      path: INGEST_INTERNAL_DEV_STATE_PATH,
      args: { items },
      format: "json",
    });
  });

  it("POSTs ingestInternalDevState mutation with deploy key header", async () => {
    const items: PrioritizedItem[] = [
      {
        rank: 1,
        rankScore: 88,
        title: "test-story",
        category: "sprint",
        rationale: "Sprint status: in-progress",
        sourcePath: "_bmad-output/implementation-artifacts/sprint-status.yaml",
      },
    ];
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    await pushInternalDevState(items, {
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
    const body = JSON.parse(String(capturedInit?.body)) as { path: string; args: { items: unknown[] } };
    expect(body.path).toBe(INGEST_INTERNAL_DEV_STATE_PATH);
    expect(body.args.items).toHaveLength(1);
  });

  it("secret-scans dev-state payload before push", async () => {
    const items: PrioritizedItem[] = [
      {
        rank: 1,
        rankScore: 48,
        title: "read leaked.md",
        category: "agent_log",
        rationale: "vault_read via cursor: sk-proj-abcdefghijklmnopqrstuvwxyz123456",
        sourcePath: "_meta/logs/agent-log.md",
      },
    ];
    const patternId = await scanInternalDevStateForSecretPatternId(items, process.cwd());
    expect(patternId).toBe("openai_proj_key");
  });
});

describe("collectInternalDevState orchestrator", () => {
  it("returns empty array when all source files are missing", async () => {
    const items = await collectInternalDevState({
      repoRoot: "/nonexistent/repo",
      vaultRoot: "/nonexistent/vault",
      now: NOW,
    });
    expect(items).toEqual([]);
  });
});
