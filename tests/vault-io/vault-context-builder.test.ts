import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  __resetTokenBudgetForTests,
  __setTokenBudgetForTests,
  buildVaultContextPacket,
  loadOperatorContextFromVault,
} from "../../src/agents/vault-context-builder.js";
import { DEFAULT_OPERATOR_CONTEXT } from "../../src/agents/operator-context.js";

async function makeVault(): Promise<string> {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "cns-vctx-"));
  await mkdir(path.join(vaultRoot, "03-Resources"), { recursive: true });
  return vaultRoot;
}

function yamlScalar(v: unknown): string {
  if (typeof v === "string") {
    // Minimal quoting to avoid breaking on ':' and friends.
    return JSON.stringify(v);
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v === null) return "null";
  return JSON.stringify(v);
}

function yamlForFrontmatter(frontmatter: Record<string, unknown>): string {
  return Object.entries(frontmatter)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        if (v.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
          const items = v
            .map((obj) => {
              const entries = Object.entries(obj as Record<string, unknown>);
              if (entries.length === 0) return `  - {}`;
              const [firstKey, firstVal] = entries[0];
              const rest = entries.slice(1);
              const lines = [`  - ${firstKey}: ${yamlScalar(firstVal)}`];
              for (const [rk, rv] of rest) {
                lines.push(`    ${rk}: ${yamlScalar(rv)}`);
              }
              return lines.join("\n");
            })
            .join("\n");
          return `${k}:\n${items}`;
        }

        return `${k}:\n${v.map((x) => `  - ${yamlScalar(x)}`).join("\n")}`;
      }

      return `${k}: ${yamlScalar(v)}`;
    })
    .join("\n");
}

async function writeNote(
  vaultRoot: string,
  relPath: string,
  frontmatter: Record<string, unknown>,
  body: string,
): Promise<void> {
  const abs = path.join(vaultRoot, relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  const yaml = yamlForFrontmatter(frontmatter);
  const content = `---\n${yaml}\n---\n\n${body}\n`;
  await writeFile(abs, content, "utf8");
}

describe("buildVaultContextPacket — bounded hybrid retrieval", () => {
  afterEach(() => {
    __resetTokenBudgetForTests();
  });

  it("operator-profile present → first note with retrieval_reason=operator-profile", async () => {
    const vaultRoot = await makeVault();

    await writeNote(
      vaultRoot,
      "03-Resources/Operator-Profile.md",
      { title: "Operator Profile", tags: ["operator"] },
      "Chris operates solo from Sydney.",
    );

    const packet = await buildVaultContextPacket(vaultRoot, "UNUSED_TOPIC_xyz", []);

    expect(packet.notes.length).toBeGreaterThanOrEqual(1);
    expect(packet.notes[0]?.retrieval_reason).toBe("operator-profile");
    expect(packet.notes[0]?.vault_path).toBe("03-Resources/Operator-Profile.md");
    expect(packet.notes[0]?.excerpt).toContain("Chris operates solo");
  });

  it("tag-lane: notes tagged with an active track name appear with retrieval_reason=tag-lane", async () => {
    const vaultRoot = await makeVault();

    await writeNote(
      vaultRoot,
      "03-Resources/Operator-Profile.md",
      {
        title: "Operator Profile",
        operator_name: "Chris Taylor",
        operator_location: "Sydney, Australia",
        operator_positioning: "Creative Technologist",
        operator_tracks: [
          { name: "Escape Job", status: "active", priority: "primary" },
        ],
        operator_constraints: ["solo operator"],
      },
      "Profile body.",
    );

    await writeNote(
      vaultRoot,
      "03-Resources/escape-note.md",
      { title: "Escape Note", tags: ["escape-job"] },
      "Body for the escape-tagged note.",
    );

    await writeNote(
      vaultRoot,
      "03-Resources/decoy.md",
      { title: "Decoy", tags: ["unrelated-tag"] },
      "Decoy note that should not match the tag-lane query.",
    );

    const packet = await buildVaultContextPacket(vaultRoot, "no-topic-match-here_xyz", []);

    const tagLane = packet.notes.filter((n) => n.retrieval_reason === "tag-lane");
    expect(tagLane.map((n) => n.vault_path)).toContain("03-Resources/escape-note.md");
  });

  it("topic-match: vault_search hits appear with retrieval_reason=topic-match", async () => {
    const vaultRoot = await makeVault();

    await writeNote(
      vaultRoot,
      "03-Resources/topic-note-a.md",
      { title: "Topic Note A" },
      "This mentions UNIQUE_TOPIC_SNIFF clearly.",
    );
    await writeNote(
      vaultRoot,
      "03-Resources/topic-note-b.md",
      { title: "Topic Note B" },
      "Another UNIQUE_TOPIC_SNIFF reference.",
    );

    const packet = await buildVaultContextPacket(vaultRoot, "UNIQUE_TOPIC_SNIFF", []);

    const topic = packet.notes.filter((n) => n.retrieval_reason === "topic-match");
    expect(topic.length).toBeGreaterThanOrEqual(1);
    expect(topic.map((n) => n.vault_path)).toEqual(
      expect.arrayContaining(["03-Resources/topic-note-a.md"]),
    );
  });

  it("recency: when topic-match returns nothing new, recency notes fill remaining slots", async () => {
    const vaultRoot = await makeVault();

    await writeNote(
      vaultRoot,
      "03-Resources/Operator-Profile.md",
      {
        title: "Operator Profile",
        operator_name: "Chris Taylor",
        operator_location: "Sydney, Australia",
        operator_positioning: "Creative Technologist",
        operator_tracks: [{ name: "Escape Job", status: "active", priority: "primary" }],
        operator_constraints: ["solo operator"],
      },
      "Profile body.",
    );

    // This note matches BOTH tag-lane AND topic-match — topic-match will see it
    // already-seen and have nothing new to add.
    await writeNote(
      vaultRoot,
      "03-Resources/dual-match.md",
      { title: "Dual Match", tags: ["escape-job"] },
      "Body mentions UNIQUE_TOPIC_SNIFF and escape-job both.",
    );

    // Recency-only candidates (no topic match, no tag match).
    await writeNote(
      vaultRoot,
      "03-Resources/recent-1.md",
      { title: "Recent 1" },
      "Plain body, no topic match.",
    );
    await writeNote(
      vaultRoot,
      "03-Resources/recent-2.md",
      { title: "Recent 2" },
      "Another plain body.",
    );

    const packet = await buildVaultContextPacket(vaultRoot, "UNIQUE_TOPIC_SNIFF", []);

    const recency = packet.notes.filter((n) => n.retrieval_reason === "recency");
    expect(recency.length).toBeGreaterThanOrEqual(1);
    expect(recency.length).toBeLessThanOrEqual(2);

    // Tag-lane took dual-match; topic-match found no new path.
    expect(packet.notes.filter((n) => n.retrieval_reason === "topic-match")).toHaveLength(0);
    expect(
      packet.notes.find((n) => n.vault_path === "03-Resources/dual-match.md")?.retrieval_reason,
    ).toBe("tag-lane");
  });

  it("budget cap: notes whose excerpt would exceed TOKEN_BUDGET are skipped and the packet stops early", async () => {
    const vaultRoot = await makeVault();

    // Long bodies → excerpts are full 400 chars → ~100 token estimate each.
    const longBody = "x".repeat(500);
    for (let i = 0; i < 5; i++) {
      await writeNote(
        vaultRoot,
        `03-Resources/topic-note-${i}.md`,
        { title: `Topic Note ${i}` },
        `BUDGET_TEST_TOKEN ${longBody}`,
      );
    }

    // Set the budget to 150: first note (~100 tokens) fits, second (+100=200>150) is skipped.
    __setTokenBudgetForTests(150);
    const packet = await buildVaultContextPacket(vaultRoot, "BUDGET_TEST_TOKEN", []);

    expect(packet.notes.length).toBe(1);
    expect(packet.token_budget_used).toBeLessThanOrEqual(150);
    expect(packet.token_budget_used).toBeGreaterThan(0);
    // Must equal the first note's actual cost.
    const firstCost = Math.ceil(packet.notes[0]!.excerpt.length / 4);
    expect(packet.token_budget_used).toBe(firstCost);
  });

  it("deduplication: a path eligible via multiple tiers appears only once", async () => {
    const vaultRoot = await makeVault();

    await writeNote(
      vaultRoot,
      "03-Resources/Operator-Profile.md",
      {
        title: "Operator Profile",
        operator_name: "Chris Taylor",
        operator_location: "Sydney, Australia",
        operator_positioning: "Creative Technologist",
        operator_tracks: [{ name: "Escape Job", status: "active", priority: "primary" }],
        operator_constraints: ["solo operator"],
      },
      "Profile body.",
    );

    // Tagged AND mentions topic — eligible for tag-lane, topic-match, and recency.
    await writeNote(
      vaultRoot,
      "03-Resources/multi-tier.md",
      { title: "Multi Tier", tags: ["escape-job"] },
      "UNIQUE_TOPIC_SNIFF body for the multi-tier note.",
    );

    const packet = await buildVaultContextPacket(vaultRoot, "UNIQUE_TOPIC_SNIFF", []);

    const occurrences = packet.notes.filter(
      (n) => n.vault_path === "03-Resources/multi-tier.md",
    );
    expect(occurrences).toHaveLength(1);
  });

  it("all tiers throw: returns empty notes, token_budget_used=0, never throws", async () => {
    // vaultRoot points to a path that does not exist → every tier fails.
    const vaultRoot = path.join(os.tmpdir(), `cns-vctx-missing-${Date.now()}-${Math.random()}`);

    const packet = await buildVaultContextPacket(vaultRoot, "anything", []);

    expect(packet.notes).toEqual([]);
    expect(packet.total_notes).toBe(0);
    expect(packet.token_budget_used).toBe(0);
    expect(typeof packet.retrieval_timestamp).toBe("string");
  });

  it("token_budget_used reflects accumulated excerpt-token estimates (never 0 when notes exist)", async () => {
    const vaultRoot = await makeVault();

    await writeNote(
      vaultRoot,
      "03-Resources/Operator-Profile.md",
      { title: "Operator Profile" },
      "Profile body content.",
    );
    await writeNote(
      vaultRoot,
      "03-Resources/topic-note.md",
      { title: "Topic" },
      "UNIQUE_TOPIC_SNIFF appears here in this note.",
    );

    const packet = await buildVaultContextPacket(vaultRoot, "UNIQUE_TOPIC_SNIFF", []);

    expect(packet.notes.length).toBeGreaterThan(0);
    const expected = packet.notes.reduce(
      (sum, n) => sum + Math.ceil(n.excerpt.length / 4),
      0,
    );
    expect(packet.token_budget_used).toBe(expected);
    expect(packet.token_budget_used).toBeGreaterThan(0);
  });
});


describe("loadOperatorContextFromVault", () => {
  it("valid profile note → returns hydrated OperatorContext", async () => {
    const vaultRoot = await makeVault();

    await writeNote(
      vaultRoot,
      "03-Resources/Operator-Profile.md",
      {
        operator_name: "Jane Doe",
        operator_location: "Berlin, Germany",
        operator_positioning: "Independent Researcher",
        operator_tracks: [
          { name: "CNS Phase 1", status: "active", priority: "primary" },
          { name: "Ops Hygiene", status: "maint", priority: "secondary" },
        ],
        operator_constraints: ["solo operator", "limited time"],
      },
      "Profile body is ignored for hydration.",
    );

    const ctx = await loadOperatorContextFromVault(vaultRoot);
    expect(ctx).toEqual({
      name: "Jane Doe",
      location: "Berlin, Germany",
      positioning: "Independent Researcher",
      tracks: [
        { name: "CNS Phase 1", status: "active", priority: "primary" },
        { name: "Ops Hygiene", status: "maint", priority: "secondary" },
      ],
      constraints: ["solo operator", "limited time"],
    });
  });

  it("missing file → returns DEFAULT_OPERATOR_CONTEXT", async () => {
    const vaultRoot = await makeVault();
    const ctx = await loadOperatorContextFromVault(vaultRoot);
    expect(ctx).toEqual(DEFAULT_OPERATOR_CONTEXT);
  });

  it("invalid frontmatter (missing required field) → returns DEFAULT_OPERATOR_CONTEXT", async () => {
    const vaultRoot = await makeVault();

    await writeNote(
      vaultRoot,
      "03-Resources/Operator-Profile.md",
      {
        operator_name: "Jane Doe",
        // operator_location missing
        operator_positioning: "Independent Researcher",
        operator_tracks: [{ name: "CNS", status: "active", priority: "primary" }],
        operator_constraints: ["solo operator"],
      },
      "Missing operator_location should fail schema.",
    );

    const ctx = await loadOperatorContextFromVault(vaultRoot);
    expect(ctx).toEqual(DEFAULT_OPERATOR_CONTEXT);
  });

  it("operator_tracks with bad shape → returns DEFAULT_OPERATOR_CONTEXT", async () => {
    const vaultRoot = await makeVault();

    await writeNote(
      vaultRoot,
      "03-Resources/Operator-Profile.md",
      {
        operator_name: "Jane Doe",
        operator_location: "Berlin, Germany",
        operator_positioning: "Independent Researcher",
        operator_tracks: ["not-an-object"],
        operator_constraints: ["solo operator"],
      },
      "Bad tracks shape should fail schema.",
    );

    const ctx = await loadOperatorContextFromVault(vaultRoot);
    expect(ctx).toEqual(DEFAULT_OPERATOR_CONTEXT);
  });
});
