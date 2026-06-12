import assert from "node:assert";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, it } from "node:test";
import {
  classifySourceAddError,
  parseHttpStatus,
  sanitizeFanoutErrorText,
} from "../scripts/session-close/lib/classify-source-add-error.mjs";
import {
  mergeFanoutIntoCloseReport,
  mergeFanoutUpdatesAtPath,
} from "../scripts/session-close/merge-notebooklm-fanout.mjs";

const execFileAsync = promisify(execFile);

describe("classifySourceAddError", () => {
  it("classifies size_limit including HTTP 413", () => {
    assert.equal(classifySourceAddError("Could not add file source. HTTP 413"), "size_limit");
    assert.equal(classifySourceAddError("payload too large"), "size_limit");
  });

  it("classifies auth_error", () => {
    assert.equal(classifySourceAddError("login required"), "auth_error");
    assert.equal(classifySourceAddError("status code: 401"), "auth_error");
  });

  it("classifies duplicate_source", () => {
    assert.equal(classifySourceAddError("source already exists"), "duplicate_source");
  });

  it("classifies api_error", () => {
    assert.equal(classifySourceAddError("HTTP 503 service unavailable"), "api_error");
  });

  it("classifies nlm_source_rejected for generic NLM add failure", () => {
    assert.equal(classifySourceAddError("Could not add file source."), "nlm_source_rejected");
    assert.equal(classifySourceAddError("Could not add source."), "nlm_source_rejected");
  });

  it("classifies nlm_cli_exception for Python tracebacks and Rich box errors", () => {
    const traceback = `Traceback (most recent call last):
  File "nlm/cli.py", line 1, in <module>
    raise RuntimeError("boom")`;
    assert.equal(classifySourceAddError(traceback), "nlm_cli_exception");
    assert.equal(
      classifySourceAddError("╭─ Error ─────────────────────╮\n│ nlm source sync failed      │\n╰─────────────────────────────╯"),
      "nlm_cli_exception",
    );
    assert.equal(
      classifySourceAddError(
        "Command failed\n╭─ Error ─────────────────────╮\n│ nlm source sync failed      │\n╰─────────────────────────────╯",
      ),
      "nlm_cli_exception",
    );
  });
});

describe("parseHttpStatus", () => {
  it("parses common stderr patterns", () => {
    assert.equal(parseHttpStatus("HTTP 413"), 413);
    assert.equal(parseHttpStatus("status code: 403"), 403);
    assert.equal(parseHttpStatus("no status here"), null);
  });
});

describe("sanitizeFanoutErrorText", () => {
  it("redacts secrets and caps length", () => {
    const email = "operator@example.com";
    const out = sanitizeFanoutErrorText(`${email} ${"x".repeat(200)}`);
    assert.ok(!out.includes(email));
    assert.ok(out.length <= 160);
  });
});

describe("mergeFanoutIntoCloseReport", () => {
  it("updates matching notebook_id in place with failure diagnostics", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fanout-merge-"));
    const exportPath = join(dir, "export.md");
    await writeFile(exportPath, "export body", "utf8");

    const report = {
      steps: { export: { status: "ok" } },
      nlm_auth: { status: "skipped" },
      notebooklm_routing: { notebooks: [] },
      failure_class: null,
      deterministic: { export_bytes: 11 },
      notebooklm_targets: [
        {
          notebook_id: "dc6abf1a-0000-4000-8000-000000000099",
          title: "AI Factory Blueprint",
          export_path: exportPath,
        },
      ],
    };

    const { merged } = await mergeFanoutIntoCloseReport(report, {
      notebook_id: "dc6abf1a-0000-4000-8000-000000000099",
      status: "failed",
      stderr: "Could not add file source. HTTP 413 payload too large",
    });
    assert.equal(merged, true);

    const row = report.notebooklm_targets[0];
    assert.equal(row.fanout_status, "failed");
    assert.equal(row.error_class, "size_limit");
    assert.equal(row.export_bytes, 11);
    assert.equal(row.http_status, 413);
    assert.ok(typeof row.error_snippet === "string");
    assert.ok(row.error_snippet.length <= 160);
    assert.equal(report.steps.export.status, "ok");
    assert.equal(report.nlm_auth.status, "skipped");
  });

  it("sets ok status and omits error fields on success", async () => {
    const report = {
      notebooklm_targets: [
        { notebook_id: "id-1", title: "T", export_path: "/missing" },
      ],
    };
    await mergeFanoutIntoCloseReport(report, {
      notebook_id: "id-1",
      status: "ok",
    });
    const row = report.notebooklm_targets[0];
    assert.equal(row.fanout_status, "ok");
    assert.equal(row.error_class, undefined);
    assert.equal(row.error_snippet, undefined);
  });

  it("uses stat(export_path) when deterministic.export_bytes is absent", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fanout-stat-"));
    const exportPath = join(dir, "export.md");
    const body = "x".repeat(99);
    await writeFile(exportPath, body, "utf8");

    const report = {
      notebooklm_targets: [
        { notebook_id: "nb-stat", title: "T", export_path: exportPath },
      ],
    };

    await mergeFanoutIntoCloseReport(report, {
      notebook_id: "nb-stat",
      status: "failed",
      stderr: "Could not add file source.",
    });

    const row = report.notebooklm_targets[0];
    assert.equal(row.export_bytes, Buffer.byteLength(body, "utf8"));
    assert.equal(row.error_class, "nlm_source_rejected");
  });
});

describe("merge-notebooklm-fanout CLI", () => {
  it("exits 0 with warning when report is missing", async () => {
    const { stderr } = await execFileAsync(
      process.execPath,
      ["scripts/session-close/merge-notebooklm-fanout.mjs", "--notebook-id", "x", "--status", "failed"],
      {
        cwd: join(import.meta.dirname, ".."),
        env: { ...process.env, OMNIPOTENT_REPO: join(import.meta.dirname, "..", "nonexistent-fanout-repo") },
      },
    );
    assert.match(stderr, /could not update close-report/);
  });

  it("merges via CLI into temp close-report", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fanout-cli-"));
    const reportPath = join(dir, "close-report.json");
    await writeFile(
      reportPath,
      JSON.stringify({
        notebooklm_targets: [{ notebook_id: "nb-1", title: "T", export_path: "/p" }],
        deterministic: { export_bytes: 42 },
      }),
      "utf8",
    );

    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "scripts/session-close/merge-notebooklm-fanout.mjs",
        "--report",
        reportPath,
        "--notebook-id",
        "nb-1",
        "--status",
        "failed",
        "--stderr",
        "duplicate source already added",
      ],
      { cwd: join(import.meta.dirname, "..") },
    );
    assert.match(stdout, /"merged":1/);

    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(saved.notebooklm_targets[0].error_class, "duplicate_source");
    assert.equal(saved.notebooklm_targets[0].export_bytes, 42);
  });

  it("warns when --batch receives no updates", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fanout-batch-empty-"));
    const reportPath = join(dir, "close-report.json");
    await writeFile(
      reportPath,
      JSON.stringify({ notebooklm_targets: [{ notebook_id: "a", title: "A", export_path: "/a" }] }),
      "utf8",
    );

    const repoRoot = join(import.meta.dirname, "..");
    const { stderr } = await execFileAsync(
      process.execPath,
      ["scripts/session-close/merge-notebooklm-fanout.mjs", "--report", reportPath, "--batch"],
      { cwd: repoRoot },
    );
    assert.match(stderr, /--batch received no updates/);
  });

  it("warns when notebook_id is not in close-report", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fanout-unknown-id-"));
    const reportPath = join(dir, "close-report.json");
    await writeFile(
      reportPath,
      JSON.stringify({ notebooklm_targets: [{ notebook_id: "a", title: "A", export_path: "/a" }] }),
      "utf8",
    );

    const repoRoot = join(import.meta.dirname, "..");
    const { stderr } = await execFileAsync(
      process.execPath,
      [
        "scripts/session-close/merge-notebooklm-fanout.mjs",
        "--report",
        reportPath,
        "--notebook-id",
        "missing-id",
        "--status",
        "failed",
        "--stderr",
        "err",
      ],
      { cwd: repoRoot },
    );
    assert.match(stderr, /merged 0\/1 targets/);
  });

  it("supports batch mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fanout-batch-"));
    const reportPath = join(dir, "close-report.json");
    await writeFile(
      reportPath,
      JSON.stringify({
        notebooklm_targets: [
          { notebook_id: "a", title: "A", export_path: "/a" },
          { notebook_id: "b", title: "B", export_path: "/b" },
        ],
      }),
      "utf8",
    );

    const batch = JSON.stringify([
      { notebook_id: "a", status: "ok" },
      { notebook_id: "b", status: "failed", stderr: "HTTP 502 bad gateway" },
    ]);

    const repoRoot = join(import.meta.dirname, "..");
    await execFileAsync(
      "bash",
      [
        "-c",
        `printf '%s' "$BATCH" | node scripts/session-close/merge-notebooklm-fanout.mjs --report "$REPORT" --batch`,
      ],
      {
        cwd: repoRoot,
        env: { ...process.env, BATCH: batch, REPORT: reportPath },
      },
    );

    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(saved.notebooklm_targets[0].fanout_status, "ok");
    assert.equal(saved.notebooklm_targets[1].error_class, "api_error");
  });
});

describe("mergeFanoutUpdatesAtPath", () => {
  it("preserves unrelated top-level keys", async () => {
    const dir = await mkdtemp(join(tmpdir(), "fanout-preserve-"));
    const reportPath = join(dir, "close-report.json");
    await writeFile(
      reportPath,
      JSON.stringify({
        failure_class: "export",
        notebooklm_routing: { notebooks: [{ id: "x" }] },
        notebooklm_targets: [{ notebook_id: "n1", title: "T", export_path: "/p" }],
      }),
      "utf8",
    );

    await mergeFanoutUpdatesAtPath(reportPath, [
      { notebook_id: "n1", status: "failed", stderr: "forbidden 403" },
    ]);

    const saved = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(saved.failure_class, "export");
    assert.deepEqual(saved.notebooklm_routing, { notebooks: [{ id: "x" }] });
    assert.equal(saved.notebooklm_targets[0].error_class, "auth_error");
  });
});
