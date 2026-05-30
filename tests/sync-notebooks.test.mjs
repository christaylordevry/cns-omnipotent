import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  inferNotebookDomain,
  normalizeDomainSlug,
} from "../scripts/session-close/lib/infer-notebook-domain.mjs";
import { mergeNotebookRegistry } from "../scripts/session-close/lib/sync-notebook-registry.mjs";
import {
  DEFAULT_REGISTRY_PATH,
  parseNlmNotebookList,
  readRegistry,
  runSyncNotebooksCli,
  sanitizeRegistryEntry,
  syncNotebookRegistry,
  writeRegistry,
} from "../scripts/session-close/sync-notebooks.mjs";

async function captureStderr(fn) {
  const originalWrite = process.stderr.write;
  let output = "";
  process.stderr.write = (chunk, encoding, cb) => {
    output += String(chunk);
    if (typeof cb === "function") {
      cb();
    }
    return true;
  };

  try {
    await fn();
    return output;
  } finally {
    process.stderr.write = originalWrite;
  }
}

describe("inferNotebookDomain", () => {
  const cases = [
    ["CNS Vault Architecture", "cns-brain"],
    ["PAKE quality notes", "cns-brain"],
    ["Brain service design", "cns-brain"],
    ["AI Factory blueprint", "ai-factory"],
    ["Architecting AI systems", "ai-factory"],
    ["LinkedIn growth", "linkedin"],
    ["Directory monetization", "lead-gen"],
    ["Lead gen playbook", "lead-gen"],
    ["NotebookLM tips", "learning"],
    ["Cursor workflows", "learning"],
    ["Claude Code patterns", "learning"],
    ["Tina Huang study", "learning"],
    ["Nutrition basics", "health"],
    ["Muscle building", "health"],
    ["Fat loss guide", "health"],
    ["Random misc notebook", "general"],
  ];

  for (const [title, expected] of cases) {
    it(`maps "${title}" → ${expected}`, () => {
      assert.equal(inferNotebookDomain(title), expected);
    });
  }

  it("normalizes slug to lowercase alnum-dash", () => {
    assert.equal(normalizeDomainSlug("AI Factory"), "ai-factory");
    assert.equal(normalizeDomainSlug("  lead--gen  "), "lead-gen");
  });
});

describe("mergeNotebookRegistry", () => {
  const existing = [
    {
      id: "keep-watch",
      title: "Old title",
      watch: true,
      domain: "custom-domain",
      last_updated: "2026-01-01T00:00:00Z",
    },
    {
      id: "drop-me",
      title: "Gone",
      watch: false,
      domain: "general",
      last_updated: "2026-01-01T00:00:00Z",
    },
    {
      id: "infer-domain",
      title: "Vault hygiene",
      watch: false,
      domain: "",
      last_updated: null,
    },
  ];

  const nlmRows = [
    {
      id: "keep-watch",
      title: "CNS Vault Architecture",
      updated_at: "2026-05-28T15:52:05Z",
    },
    {
      id: "infer-domain",
      title: "Vault hygiene",
      updated_at: "2026-05-29T10:00:00Z",
    },
    {
      id: "brand-new",
      title: "NotebookLM learning",
      updated_at: "2026-05-29T12:00:00Z",
    },
  ];

  it("preserves watch and custom domain, drops removed IDs, adds new IDs", () => {
    const merged = mergeNotebookRegistry(existing, nlmRows);

    assert.equal(merged.length, 3);
    assert.deepEqual(
      merged.map((r) => r.id).sort(),
      ["brand-new", "infer-domain", "keep-watch"].sort(),
    );

    const kept = merged.find((r) => r.id === "keep-watch");
    assert.equal(kept?.watch, true);
    assert.equal(kept?.domain, "custom-domain");
    assert.equal(kept?.title, "CNS Vault Architecture");
    assert.equal(kept?.last_updated, "2026-05-28T15:52:05Z");

    const inferred = merged.find((r) => r.id === "infer-domain");
    assert.equal(inferred?.domain, "cns-brain");

    const added = merged.find((r) => r.id === "brand-new");
    assert.equal(added?.watch, false);
    assert.equal(added?.domain, "learning");
    assert.equal(added?.last_updated, "2026-05-29T12:00:00Z");
  });

  it("dedupes duplicate nlm ids (last row wins)", () => {
    const merged = mergeNotebookRegistry([], [
      { id: "dup", title: "First", updated_at: "2026-01-01T00:00:00Z" },
      { id: "dup", title: "Second", updated_at: "2026-02-01T00:00:00Z" },
    ]);

    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, "Second");
    assert.equal(merged[0].last_updated, "2026-02-01T00:00:00Z");
  });
});

describe("sanitizeRegistryEntry", () => {
  it("returns null when id is missing", () => {
    assert.equal(sanitizeRegistryEntry({ title: "orphan" }), null);
  });

  it("normalizes a well-formed row", () => {
    assert.deepEqual(
      sanitizeRegistryEntry({
        id: " abc ",
        title: "T",
        watch: 1,
        domain: "custom",
        last_updated: "2026-01-01T00:00:00Z",
      }),
      {
        id: "abc",
        title: "T",
        watch: true,
        domain: "custom",
        last_updated: "2026-01-01T00:00:00Z",
      },
    );
  });
});

describe("parseNlmNotebookList + syncNotebookRegistry", () => {
  it("parses nlm JSON array stdout", () => {
    const stdout = JSON.stringify([
      {
        id: "abc",
        title: "CNS test",
        source_count: 9,
        updated_at: "2026-05-28T15:52:05Z",
      },
    ]);
    const rows = parseNlmNotebookList(stdout);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "abc");
    assert.equal(rows[0].title, "CNS test");
    assert.equal(rows[0].updated_at, "2026-05-28T15:52:05Z");
  });

  it("rejects non-array JSON", () => {
    assert.throws(() => parseNlmNotebookList('{"notebooks":[]}'), /JSON array/);
  });

  it("writes registry via injectable runNlm (no live CLI)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "notebook-registry-"));
    const registryPath = join(dir, "notebook-registry.json");

    try {
      const nlmFixture = [
        {
          id: "981466f0-de1c-4551-93a9-f3bc2a24b184",
          title: "CNS Vault Architecture",
          updated_at: "2026-05-28T15:52:05Z",
        },
      ];

      const merged = await syncNotebookRegistry({
        registryPath,
        runNlmFn: async () => JSON.stringify(nlmFixture),
      });

      assert.equal(merged.length, 1);
      assert.equal(merged[0].domain, "cns-brain");
      assert.equal(merged[0].watch, false);

      const onDisk = JSON.parse(await readFile(registryPath, "utf8"));
      assert.ok(Array.isArray(onDisk));
      assert.equal(onDisk[0].id, "981466f0-de1c-4551-93a9-f3bc2a24b184");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("CLI path invokes stale alerts after writing the registry", async () => {
    const dir = await mkdtemp(join(tmpdir(), "notebook-registry-"));
    const registryPath = join(dir, "notebook-registry.json");

    try {
      const nlmFixture = [
        {
          id: "alert-me",
          title: "CNS Vault Architecture",
          updated_at: "2026-05-28T15:52:05Z",
        },
      ];
      const alertCalls = [];

      await runSyncNotebooksCli({
        registryPath,
        runNlmFn: async () => JSON.stringify(nlmFixture),
        alertStaleNotebooksFn: async (entries, options) => {
          alertCalls.push({ entries, options });
          const onDisk = JSON.parse(await readFile(registryPath, "utf8"));
          assert.deepEqual(onDisk, entries);
        },
        env: { CNS_DISCORD_HERMES_CHANNEL_ID: "channel" },
      });

      assert.equal(alertCalls.length, 1);
      assert.equal(alertCalls[0].entries.length, 1);
      assert.equal(alertCalls[0].options.registryPath, registryPath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("CLI path logs stale-alert failures without failing sync", async () => {
    const dir = await mkdtemp(join(tmpdir(), "notebook-registry-"));
    const registryPath = join(dir, "notebook-registry.json");
    const priorExitCode = process.exitCode;

    try {
      const stderr = await captureStderr(async () => {
        await runSyncNotebooksCli({
          registryPath,
          runNlmFn: async () =>
            JSON.stringify([
              {
                id: "alert-error",
                title: "CNS Vault Architecture",
                updated_at: "2026-05-28T15:52:05Z",
              },
            ]),
          alertStaleNotebooksFn: async () => {
            throw new Error("alert down");
          },
        });
      });

      assert.equal(process.exitCode, priorExitCode);
      assert.match(stderr, /\[stale-alerts\] unexpected error: alert down/);
      const onDisk = JSON.parse(await readFile(registryPath, "utf8"));
      assert.equal(onDisk.length, 1);
    } finally {
      process.exitCode = priorExitCode;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("readRegistry returns [] when file missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "notebook-registry-"));
    try {
      const rows = await readRegistry(join(dir, "missing.json"));
      assert.deepEqual(rows, []);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("readRegistry defaults to the installed registry path", async () => {
    const rows = await readRegistry();
    assert.ok(rows.length > 0);
    assert.equal(typeof DEFAULT_REGISTRY_PATH, "string");
  });

  it("readRegistry drops rows without id", async () => {
    const dir = await mkdtemp(join(tmpdir(), "notebook-registry-"));
    const registryPath = join(dir, "notebook-registry.json");
    try {
      await writeFile(
        registryPath,
        `${JSON.stringify([
          { title: "no id" },
          {
            id: "ok",
            title: "t",
            watch: false,
            domain: "general",
            last_updated: null,
          },
        ])}\n`,
        "utf8",
      );
      const rows = await readRegistry(registryPath);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, "ok");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not overwrite registry when runNlm fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "notebook-registry-"));
    const registryPath = join(dir, "notebook-registry.json");
    const seed = [
      {
        id: "seed",
        title: "Keep me",
        watch: true,
        domain: "custom",
        last_updated: null,
      },
    ];

    try {
      await writeRegistry(seed, registryPath);
      const before = await readFile(registryPath, "utf8");

      await assert.rejects(
        () =>
          syncNotebookRegistry({
            registryPath,
            runNlmFn: async () => {
              throw new Error("nlm down");
            },
          }),
        /nlm down/,
      );

      assert.equal(await readFile(registryPath, "utf8"), before);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not overwrite registry when nlm stdout is invalid JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "notebook-registry-"));
    const registryPath = join(dir, "notebook-registry.json");

    try {
      await writeRegistry(
        [
          {
            id: "seed",
            title: "Keep me",
            watch: false,
            domain: "general",
            last_updated: null,
          },
        ],
        registryPath,
      );
      const before = await readFile(registryPath, "utf8");

      await assert.rejects(
        () =>
          syncNotebookRegistry({
            registryPath,
            runNlmFn: async () => "not-json",
          }),
        /not valid JSON/,
      );

      assert.equal(await readFile(registryPath, "utf8"), before);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("writeRegistry emits top-level JSON array", async () => {
    const dir = await mkdtemp(join(tmpdir(), "notebook-registry-"));
    const registryPath = join(dir, "notebook-registry.json");
    try {
      await writeRegistry(
        [
          {
            id: "x",
            title: "t",
            watch: false,
            domain: "general",
            last_updated: null,
          },
        ],
        registryPath,
      );
      const raw = await readFile(registryPath, "utf8");
      assert.ok(raw.endsWith("\n"));
      const parsed = JSON.parse(raw);
      assert.ok(Array.isArray(parsed));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
