import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
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

describe("buildVaultContextPacket", () => {
  it("happy path: operator profile + up to 2 topic-match notes → 3 entries", async () => {
    const vaultRoot = await makeVault();

    await writeNote(
      vaultRoot,
      "03-Resources/Operator-Profile.md",
      { title: "Operator Profile", tags: ["operator"] },
      "Chris operates solo from Sydney.",
    );
    await writeNote(
      vaultRoot,
      "03-Resources/topic-note-a.md",
      { title: "Topic Note A", tags: ["agents"] },
      "This note discusses UNIQUE_TOPIC_SNIFF in depth.",
    );
    await writeNote(
      vaultRoot,
      "03-Resources/topic-note-b.md",
      { title: "Topic Note B", tags: ["agents"] },
      "Another UNIQUE_TOPIC_SNIFF reference for orchestration.",
    );
    await writeNote(
      vaultRoot,
      "03-Resources/unrelated.md",
      { title: "Unrelated" },
      "Nothing about the topic here.",
    );

    const packet = await buildVaultContextPacket(vaultRoot, "UNIQUE_TOPIC_SNIFF", []);

    expect(packet.total_notes).toBe(3);
    expect(packet.notes).toHaveLength(3);

    const reasons = packet.notes.map((n) => n.retrieval_reason);
    expect(reasons.filter((r) => r === "operator-profile")).toHaveLength(1);
    expect(reasons.filter((r) => r === "topic-match")).toHaveLength(2);

    const profile = packet.notes.find((n) => n.retrieval_reason === "operator-profile");
    expect(profile).toBeDefined();
    expect(profile!.vault_path).toBe("03-Resources/Operator-Profile.md");
    expect(profile!.title).toBe("Operator Profile");
    expect(profile!.tags).toEqual(["operator"]);
    expect(profile!.excerpt).toContain("Chris operates solo");

    const topicPaths = packet.notes
      .filter((n) => n.retrieval_reason === "topic-match")
      .map((n) => n.vault_path);
    expect(topicPaths).toContain("03-Resources/topic-note-a.md");
    expect(topicPaths).toContain("03-Resources/topic-note-b.md");

    // unrelated note must never appear
    expect(packet.notes.find((n) => n.vault_path.endsWith("unrelated.md"))).toBeUndefined();

    expect(typeof packet.retrieval_timestamp).toBe("string");
    expect(new Date(packet.retrieval_timestamp).toString()).not.toBe("Invalid Date");
  });

  it("missing operator profile: returns only topic-match notes, no operator-profile entry", async () => {
    const vaultRoot = await makeVault();

    await writeNote(
      vaultRoot,
      "03-Resources/topic-note-a.md",
      { title: "Topic Note A" },
      "UNIQUE_TOPIC_SNIFF appears here.",
    );
    await writeNote(
      vaultRoot,
      "03-Resources/topic-note-b.md",
      { title: "Topic Note B" },
      "UNIQUE_TOPIC_SNIFF — again.",
    );

    const packet = await buildVaultContextPacket(vaultRoot, "UNIQUE_TOPIC_SNIFF", []);

    expect(packet.total_notes).toBeLessThanOrEqual(2);
    expect(packet.total_notes).toBe(packet.notes.length);
    expect(
      packet.notes.find((n) => n.retrieval_reason === "operator-profile"),
    ).toBeUndefined();
    for (const n of packet.notes) {
      expect(n.retrieval_reason).toBe("topic-match");
    }
  });

  it("empty vault / no matches: returns empty packet with total_notes: 0", async () => {
    const vaultRoot = await makeVault();

    await writeNote(
      vaultRoot,
      "03-Resources/unrelated.md",
      { title: "Unrelated" },
      "No matching token here.",
    );

    const packet = await buildVaultContextPacket(vaultRoot, "NEVER_APPEARS_IN_VAULT_xyz", []);

    expect(packet.total_notes).toBe(0);
    expect(packet.notes).toEqual([]);
    expect(packet.token_budget_used).toBe(0);
    expect(typeof packet.retrieval_timestamp).toBe("string");
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
