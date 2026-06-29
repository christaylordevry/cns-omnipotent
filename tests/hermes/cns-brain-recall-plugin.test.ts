import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { detectRecallChannel } from "../../src/brain/recall-inject.js";
import { StubEmbedder } from "../../src/brain/embedder.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const pluginRoot = join(root, "scripts/hermes-plugin-examples/cns-brain-recall");
const installScript = join(root, "scripts/install-hermes-plugin-cns-brain-recall.sh");
const prefetchScript = join(root, "scripts/brain-recall-prefetch.mjs");
const sourcePycache = join(pluginRoot, "__pycache__");
const bytecodeEnv = { ...process.env, PYTHONDONTWRITEBYTECODE: "1" };

const tempRoots: string[] = [];

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    rmSync(tempRoot, { force: true, recursive: true });
  }
  rmSync(sourcePycache, { force: true, recursive: true });
});

async function writeIndex(params: {
  dir: string;
  records: Array<{ path: string; embedding: number[]; text?: string }>;
}): Promise<string> {
  const indexPath = join(params.dir, "brain-index.json");
  await writeFile(
    indexPath,
    JSON.stringify(
      {
        schema_version: 2,
        embedder: { providerId: "stub", modelId: "stub-v1", vectorDimension: 8 },
        chunking: {
          target_tokens: 768,
          overlap_tokens: 64,
          tokenizer_encoding: "cl100k_base",
          tokenizer_package: "gpt-tokenizer@3.4.0",
        },
        records: params.records.map((r, i) => ({
          path: r.path,
          chunk_index: i,
          char_start: 0,
          char_end: (r.text ?? "fixture chunk").length,
          text: r.text ?? "fixture chunk",
          embedding: r.embedding,
        })),
        exclusions: [],
      },
      null,
      2,
    ),
    "utf8",
  );
  return indexPath;
}

async function writeStubIndex(params: {
  dir: string;
  anchorText: string;
  vaultRel: string;
}): Promise<string> {
  const stub = new StubEmbedder();
  const embedding = await stub.embed(params.anchorText);
  return writeIndex({
    dir: params.dir,
    records: [{ path: params.vaultRel, embedding, text: params.anchorText }],
  });
}

async function writeVaultNote(vaultRoot: string, vaultRel: string, body: string): Promise<void> {
  const abs = join(vaultRoot, vaultRel);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, `---\ntitle: Test\n---\n\n${body}`, "utf8");
}

describe("Story 79-5 cns-brain-recall production plugin", () => {
  it("has version-controlled plugin source files", () => {
    expect(existsSync(join(pluginRoot, "plugin.py"))).toBe(true);
    expect(existsSync(join(pluginRoot, "plugin.yaml"))).toBe(true);
    expect(existsSync(join(pluginRoot, "__init__.py"))).toBe(true);
    expect(existsSync(join(pluginRoot, "references/config-snippet.md"))).toBe(true);
    expect(existsSync(prefetchScript)).toBe(true);
  });

  it("plugin.yaml declares pre_llm_call hook and Story 79-5 version", () => {
    const yaml = readFileSync(join(pluginRoot, "plugin.yaml"), "utf8");
    expect(yaml).toMatch(/name:\s*cns-brain-recall/);
    expect(yaml).toMatch(/pre_llm_call/);
    expect(yaml).toMatch(/version:\s*0\.2\.1/);
  });

  it("plugin.py subprocesses brain-recall-prefetch.mjs and returns empty context in shadow mode", () => {
    const out = execFileSync(
      "python3",
      [
        "-B",
        "-c",
        `import importlib.util, json, os, sys, tempfile, textwrap
from unittest.mock import patch

path = sys.argv[1]
repo = sys.argv[2]
spec = importlib.util.spec_from_file_location("cns_brain_recall_plugin", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

shadow_payload = json.dumps({
    "context": None,
    "citations": [{"path": "notes/recall.md", "score": 0.9}],
    "channel": "standard_text",
    "shadow": True,
})

class FakeProc:
    returncode = 0
    stdout = shadow_payload + "\\n"
    stderr = "[cns-brain-recall:shadow] would-inject\\n"

with patch.dict(os.environ, {"CNS_OMNIPOTENT_ROOT": repo}, clear=False):
    with patch.object(mod.subprocess, "run", return_value=FakeProc()) as run_mock:
        result = mod.recall_hook(user_message="What is CNS?", platform="discord")
        assert result == {}, result
        cmd = run_mock.call_args[0][0]
        assert "brain-recall-prefetch.mjs" in cmd[-2] or cmd[-1].endswith("brain-recall-prefetch.mjs") or any("brain-recall-prefetch.mjs" in str(x) for x in cmd)
        assert cmd[0] == mod._resolve_node_bin()
print("ok")`,
        join(pluginRoot, "plugin.py"),
        root,
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );
    expect(out.trim()).toBe("ok");
    expect(existsSync(sourcePycache)).toBe(false);
  });

  it("__init__.py registers pre_llm_call through the Hermes loader path", () => {
    const out = execFileSync(
      "python3",
      [
        "-B",
        "-c",
        `import importlib.util, json, os, sys
from unittest.mock import patch

path = sys.argv[1]
repo = sys.argv[2]
spec = importlib.util.spec_from_file_location("cns_brain_recall", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

live_payload = json.dumps({
    "context": "### vault:notes/live.md",
    "citations": [{"path": "notes/live.md", "score": 0.8}],
    "channel": "standard_text",
    "shadow": False,
})

class FakeProc:
    returncode = 0
    stdout = live_payload
    stderr = ""

class Ctx:
    def __init__(self):
        self.calls = []
    def register_hook(self, name, callback):
        self.calls.append((name, callback))

ctx = Ctx()
mod.register(ctx)
assert len(ctx.calls) == 1, ctx.calls
name, callback = ctx.calls[0]
assert name == "pre_llm_call", name

with patch.dict(os.environ, {"CNS_OMNIPOTENT_ROOT": repo}, clear=False):
    with patch("subprocess.run", return_value=FakeProc()):
        result = callback(user_message="hello", platform="discord")
        assert result == {"context": "### vault:notes/live.md"}, result
print("ok")`,
        join(pluginRoot, "__init__.py"),
        root,
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );
    expect(out.trim()).toBe("ok");
    expect(existsSync(sourcePycache)).toBe(false);
  });

  it("install script uses HERMES_HOME, replaces stale files, and skips bytecode", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "cns-brain-recall-test-"));
    tempRoots.push(tempRoot);
    const hermesHome = join(tempRoot, "hermes-home");
    const destRoot = join(hermesHome, "plugins/cns-brain-recall");
    const staleFile = join(destRoot, "stale.txt");
    const sourceBytecode = join(sourcePycache, "plugin.cpython-312.pyc");

    mkdirSync(destRoot, { recursive: true });
    writeFileSync(staleFile, "stale");
    mkdirSync(sourcePycache, { recursive: true });
    writeFileSync(sourceBytecode, "bytecode");

    const out = execFileSync("bash", [installScript], {
      encoding: "utf8",
      env: { ...process.env, HERMES_HOME: hermesHome },
    });

    expect(out).toContain(`Installed Hermes plugin to: ${destRoot}`);
    expect(existsSync(join(destRoot, "plugin.py"))).toBe(true);
    expect(existsSync(staleFile)).toBe(false);
    expect(existsSync(join(destRoot, "__pycache__"))).toBe(false);
  });

  it("recall_hook fail-opens on subprocess TimeoutExpired", () => {
    const out = execFileSync(
      "python3",
      [
        "-B",
        "-c",
        `import importlib.util, os, sys
from unittest.mock import patch
import subprocess

path = sys.argv[1]
repo = sys.argv[2]
spec = importlib.util.spec_from_file_location("cns_brain_recall_plugin", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

with patch.dict(os.environ, {"CNS_OMNIPOTENT_ROOT": repo}, clear=False):
    with patch.object(mod.subprocess, "run", side_effect=subprocess.TimeoutExpired("node", 5)):
        result = mod.recall_hook(user_message="What is CNS?", platform="discord")
        assert result == {}, result
print("ok")`,
        join(pluginRoot, "plugin.py"),
        root,
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );
    expect(out.trim()).toBe("ok");
  });

  it("recall_hook fail-opens when omnipotent root is missing", () => {
    const out = execFileSync(
      "python3",
      [
        "-B",
        "-c",
        `import importlib.util, os, sys
from unittest.mock import patch

path = sys.argv[1]
spec = importlib.util.spec_from_file_location("cns_brain_recall_plugin", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

with patch.dict(os.environ, {"CNS_OMNIPOTENT_ROOT": "/nonexistent/omnipotent"}, clear=True):
    result = mod.recall_hook(user_message="What is CNS?", platform="discord")
    assert result == {}, result
print("ok")`,
        join(pluginRoot, "plugin.py"),
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );
    expect(out.trim()).toBe("ok");
  });

  it("_resolve_node_bin honors CNS_NODE_BIN", () => {
    const out = execFileSync(
      "python3",
      [
        "-B",
        "-c",
        `import importlib.util, os, sys
from unittest.mock import patch

path = sys.argv[1]
fake_node = sys.argv[2]
spec = importlib.util.spec_from_file_location("cns_brain_recall_plugin", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

with patch.dict(os.environ, {"CNS_NODE_BIN": fake_node}, clear=False):
    assert mod._resolve_node_bin() == fake_node
print("ok")`,
        join(pluginRoot, "plugin.py"),
        process.execPath,
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );
    expect(out.trim()).toBe("ok");
  });
});

describe("Story 79-5 brain-recall-prefetch CLI", () => {
  it("detectRecallChannel uses nexus-voice platform hint for voice_pane", () => {
    expect(
      detectRecallChannel({
        userMessage: "short",
        platformHint: "nexus-voice",
        yappedTextMinChars: 400,
      }),
    ).toBe("voice_pane");
  });

  it("brain-recall-prefetch.mjs wrapper prints JSON stdout contract", async () => {
    const anchor = "Wrapper CLI body for recall.";
    const vaultRoot = await mkdtemp(join(tmpdir(), "cns-79-5-wrap-v-"));
    tempRoots.push(vaultRoot);
    const indexDir = await mkdtemp(join(tmpdir(), "cns-79-5-wrap-i-"));
    tempRoots.push(indexDir);
    await writeVaultNote(vaultRoot, "notes/wrap.md", anchor);
    const indexPath = await writeStubIndex({
      dir: indexDir,
      anchorText: anchor,
      vaultRel: "notes/wrap.md",
    });

    // Isolate shadow_mode from the live committed config (go-live sets it to
    // false); this test asserts the shadow=true contract deterministically.
    const shadowRepo = await mkdtemp(join(tmpdir(), "cns-79-5-wrap-repo-"));
    tempRoots.push(shadowRepo);
    await mkdir(join(shadowRepo, "config"), { recursive: true });
    const livePolicyWrap = JSON.parse(
      readFileSync(join(root, "config/brain-recall-policy.json"), "utf8"),
    );
    await writeFile(
      join(shadowRepo, "config/brain-recall-policy.json"),
      JSON.stringify({ ...livePolicyWrap, shadow_mode: true }),
    );

    const res = spawnSync(
      "node",
      [
        prefetchScript,
        "--query",
        anchor,
        "--index-path",
        indexPath,
        "--vault-root",
        vaultRoot,
        "--repo-root",
        shadowRepo,
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, CNS_BRAIN_EMBEDDER: "stub" } },
    );

    expect(res.status).toBe(0);
    const payload = JSON.parse(res.stdout.trim());
    expect(payload).toMatchObject({
      context: null,
      channel: "standard_text",
      shadow: true,
    });
    expect(payload.citations.length).toBeGreaterThan(0);
    expect(payload.citations[0]?.path).toBe("notes/wrap.md");
    expect(res.stderr).toMatch(/cns-brain-recall:shadow/);
  });

  it("voice_pane channel when platform is nexus-voice via wrapper", async () => {
    const anchor = "Voice pane recall body.";
    const vaultRoot = await mkdtemp(join(tmpdir(), "cns-79-5-voice-v-"));
    tempRoots.push(vaultRoot);
    const indexDir = await mkdtemp(join(tmpdir(), "cns-79-5-voice-i-"));
    tempRoots.push(indexDir);
    await writeVaultNote(vaultRoot, "notes/voice.md", anchor);
    const indexPath = await writeStubIndex({
      dir: indexDir,
      anchorText: anchor,
      vaultRel: "notes/voice.md",
    });

    const res = spawnSync(
      "node",
      [
        prefetchScript,
        "--query",
        anchor,
        "--platform",
        "nexus-voice",
        "--index-path",
        indexPath,
        "--vault-root",
        vaultRoot,
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, CNS_BRAIN_EMBEDDER: "stub" } },
    );

    expect(res.status).toBe(0);
    const payload = JSON.parse(res.stdout.trim());
    expect(payload.channel).toBe("voice_pane");
  });

  it("recall_hook end-to-end passes user_message to prefetch CLI (live inject + real citations)", async () => {
    const anchor = "Hermes pre_llm_call hook probe for Story 79-5 evidence.";
    const vaultRoot = await mkdtemp(join(tmpdir(), "cns-79-5-hook-v-"));
    tempRoots.push(vaultRoot);
    const indexDir = await mkdtemp(join(tmpdir(), "cns-79-5-hook-i-"));
    tempRoots.push(indexDir);
    await writeVaultNote(vaultRoot, "notes/hook-probe.md", anchor);
    const indexPath = await writeStubIndex({
      dir: indexDir,
      anchorText: anchor,
      vaultRel: "notes/hook-probe.md",
    });

    const out = execFileSync(
      "python3",
      [
        "-B",
        "-c",
        `import importlib.util, json, os, sys

path = sys.argv[1]
repo = sys.argv[2]
index_path = sys.argv[3]
vault_root = sys.argv[4]
node_bin = sys.argv[5]
query = sys.argv[6]

spec = importlib.util.spec_from_file_location("cns_brain_recall_plugin", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

env = {
    **os.environ,
    "CNS_OMNIPOTENT_ROOT": repo,
    "CNS_BRAIN_INDEX_PATH": index_path,
    "CNS_VAULT_ROOT": vault_root,
    "CNS_BRAIN_EMBEDDER": "stub",
    "CNS_NODE_BIN": node_bin,
}

with __import__("unittest.mock").mock.patch.dict(os.environ, env, clear=False):
    result = mod.recall_hook(user_message=query, platform="discord", session_id="probe-s")

# Post go-live (shadow_mode:false in the committed policy), the hook injects real
# cited context instead of returning empty. Assert the live-inject contract.
ctx = result.get("context")
assert isinstance(ctx, str) and "notes/hook-probe.md" in ctx, result
print(json.dumps({"hook_injected": True}))
`,
        join(pluginRoot, "plugin.py"),
        root,
        indexPath,
        vaultRoot,
        process.execPath,
        anchor,
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );

    expect(out.trim()).toContain('"hook_injected": true');
  });
});

describe("Story 82-2 SPIKE-OMNI-002 voice_pane channel (Path C + Path A fallback)", () => {
  it("Path C: session.source nexus-voice in state.db yields voice_pane via --recall-channel", async () => {
    const anchor = "Voice pane Path C recall probe.";
    const vaultRoot = await mkdtemp(join(tmpdir(), "cns-82-2-voice-v-"));
    tempRoots.push(vaultRoot);
    const indexDir = await mkdtemp(join(tmpdir(), "cns-82-2-voice-i-"));
    tempRoots.push(indexDir);
    const hermesHome = await mkdtemp(join(tmpdir(), "cns-82-2-hermes-"));
    tempRoots.push(hermesHome);
    await writeVaultNote(vaultRoot, "notes/voice-path-c.md", anchor);
    const indexPath = await writeStubIndex({
      dir: indexDir,
      anchorText: anchor,
      vaultRel: "notes/voice-path-c.md",
    });

    const sessionKey = "20260628_200000_spike82";
    const dbPath = join(hermesHome, "state.db");
    execFileSync(
      "python3",
      [
        "-c",
        `import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
db.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, source TEXT NOT NULL)")
db.execute("INSERT INTO sessions (id, source) VALUES (?, ?)", (sys.argv[2], "nexus-voice"))
db.commit()
db.close()`,
        dbPath,
        sessionKey,
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );

    const out = execFileSync(
      "python3",
      [
        "-B",
        "-c",
        `import importlib.util, json, os, sys

path = sys.argv[1]
repo = sys.argv[2]
index_path = sys.argv[3]
vault_root = sys.argv[4]
node_bin = sys.argv[5]
hermes_home = sys.argv[6]
session_key = sys.argv[7]
query = sys.argv[8]

spec = importlib.util.spec_from_file_location("cns_brain_recall_plugin", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

env = {
    **os.environ,
    "CNS_OMNIPOTENT_ROOT": repo,
    "CNS_BRAIN_INDEX_PATH": index_path,
    "CNS_VAULT_ROOT": vault_root,
    "CNS_BRAIN_EMBEDDER": "stub",
    "CNS_NODE_BIN": node_bin,
    "HERMES_HOME": hermes_home,
}

with __import__("unittest.mock").mock.patch.dict(os.environ, env, clear=False):
    payload = mod._run_prefetch(
        user_message=query,
        platform="tui",
        recall_channel="voice_pane",
    )
print(json.dumps(payload))`,
        join(pluginRoot, "plugin.py"),
        root,
        indexPath,
        vaultRoot,
        process.execPath,
        hermesHome,
        sessionKey,
        anchor,
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );

    const payload = JSON.parse(out.trim());
    expect(payload.channel).toBe("voice_pane");
  });

  it("Path C: recall_hook resolves voice_pane from state.db without mutating user_message", async () => {
    const anchor = "Plain voice turn without prefix.";
    const vaultRoot = await mkdtemp(join(tmpdir(), "cns-82-2-hook-v-"));
    tempRoots.push(vaultRoot);
    const indexDir = await mkdtemp(join(tmpdir(), "cns-82-2-hook-i-"));
    tempRoots.push(indexDir);
    const hermesHome = await mkdtemp(join(tmpdir(), "cns-82-2-hook-hermes-"));
    tempRoots.push(hermesHome);
    await writeVaultNote(vaultRoot, "notes/voice-hook.md", anchor);
    const indexPath = await writeStubIndex({
      dir: indexDir,
      anchorText: anchor,
      vaultRel: "notes/voice-hook.md",
    });

    const sessionKey = "20260628_200001_spike82";
    const dbPath = join(hermesHome, "state.db");
    execFileSync(
      "python3",
      [
        "-c",
        `import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
db.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, source TEXT NOT NULL)")
db.execute("INSERT INTO sessions (id, source) VALUES (?, ?)", (sys.argv[2], "nexus-voice"))
db.commit()
db.close()`,
        dbPath,
        sessionKey,
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );

    const out = execFileSync(
      "python3",
      [
        "-B",
        "-c",
        `import importlib.util, json, os, sys
from unittest.mock import patch

path = sys.argv[1]
repo = sys.argv[2]
index_path = sys.argv[3]
vault_root = sys.argv[4]
node_bin = sys.argv[5]
hermes_home = sys.argv[6]
session_key = sys.argv[7]
query = sys.argv[8]

spec = importlib.util.spec_from_file_location("cns_brain_recall_plugin", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

calls = []

def capture_run(cmd, **kwargs):
    calls.append(list(cmd))
    class FakeProc:
        returncode = 0
        stdout = json.dumps({"context": None, "citations": [], "channel": "voice_pane", "shadow": True})
        stderr = ""
    return FakeProc()

env = {
    **os.environ,
    "CNS_OMNIPOTENT_ROOT": repo,
    "CNS_BRAIN_INDEX_PATH": index_path,
    "CNS_VAULT_ROOT": vault_root,
    "CNS_BRAIN_EMBEDDER": "stub",
    "CNS_NODE_BIN": node_bin,
    "HERMES_HOME": hermes_home,
}

with patch.dict(os.environ, env, clear=False):
    with patch.object(mod.subprocess, "run", side_effect=capture_run):
        mod.recall_hook(
            session_id=session_key,
            user_message=query,
            platform="tui",
            task_id="task-uuid",
            turn_id=f"{session_key}:task-uuid:abc12345",
            sender_id="",
            is_first_turn=True,
            model="anthropic/claude-sonnet-4.6",
        )

cmd = calls[0]
assert "--recall-channel" in cmd and "voice_pane" in cmd, cmd
assert query in cmd, cmd
assert "[cns-recall:" not in " ".join(cmd), cmd
print(json.dumps({"argv_ok": True, "platform_passed": "tui" in cmd}))`,
        join(pluginRoot, "plugin.py"),
        root,
        indexPath,
        vaultRoot,
        process.execPath,
        hermesHome,
        sessionKey,
        anchor,
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );

    expect(JSON.parse(out.trim())).toEqual({ argv_ok: true, platform_passed: true });
  });

  it("Path A fallback: prefix stripped for prefetch --query only", () => {
    const hermesHome = mkdtempSync(join(tmpdir(), "cns-82-2-path-a-hermes-"));
    tempRoots.push(hermesHome);

    const out = execFileSync(
      "python3",
      [
        "-B",
        "-c",
        `import importlib.util, json, os, sys
from unittest.mock import patch

path = sys.argv[1]
repo = sys.argv[2]
hermes_home = sys.argv[3]
spec = importlib.util.spec_from_file_location("cns_brain_recall_plugin", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

calls = []

def capture_run(cmd, **kwargs):
    calls.append(list(cmd))
    class FakeProc:
        returncode = 0
        stdout = json.dumps({"context": None, "citations": [], "channel": "voice_pane", "shadow": True})
        stderr = ""
    return FakeProc()

env = {
    **os.environ,
    "CNS_OMNIPOTENT_ROOT": repo,
    "HERMES_HOME": hermes_home,
}

with patch.dict(os.environ, env, clear=False):
    with patch.object(mod.subprocess, "run", side_effect=capture_run):
        mod.recall_hook(
            user_message="[cns-recall:voice_pane] hello voice",
            platform="tui",
            session_id="",
        )

cmd = calls[0]
q_idx = cmd.index("--query")
assert cmd[q_idx + 1] == "hello voice", cmd
assert "--recall-channel" in cmd and "voice_pane" in cmd, cmd
print("ok")`,
        join(pluginRoot, "plugin.py"),
        root,
        hermesHome,
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );
    expect(out.trim()).toBe("ok");
  });

  it("regression: discord platform unchanged (no --recall-channel for standard text)", () => {
    const hermesHome = mkdtempSync(join(tmpdir(), "cns-82-2-discord-hermes-"));
    tempRoots.push(hermesHome);
    const sessionKey = "20260628_124027_89e373ac";
    const dbPath = join(hermesHome, "state.db");
    execFileSync(
      "python3",
      [
        "-c",
        `import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
db.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, source TEXT NOT NULL)")
db.execute("INSERT INTO sessions (id, source) VALUES (?, ?)", (sys.argv[2], "discord"))
db.commit()
db.close()`,
        dbPath,
        sessionKey,
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );

    const out = execFileSync(
      "python3",
      [
        "-B",
        "-c",
        `import importlib.util, json, os, sys
from unittest.mock import patch

path = sys.argv[1]
repo = sys.argv[2]
hermes_home = sys.argv[3]
session_key = sys.argv[4]
spec = importlib.util.spec_from_file_location("cns_brain_recall_plugin", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

calls = []

def capture_run(cmd, **kwargs):
    calls.append(list(cmd))
    class FakeProc:
        returncode = 0
        stdout = json.dumps({"context": None, "citations": [], "channel": "standard_text", "shadow": True})
        stderr = ""
    return FakeProc()

env = {
    **os.environ,
    "CNS_OMNIPOTENT_ROOT": repo,
    "HERMES_HOME": hermes_home,
}

with patch.dict(os.environ, env, clear=False):
    with patch.object(mod.subprocess, "run", side_effect=capture_run):
        mod.recall_hook(user_message="hello", platform="discord", session_id=session_key)

cmd = calls[0]
assert "--recall-channel" not in cmd, cmd
assert cmd[cmd.index("--platform") + 1] == "discord", cmd
print("ok")`,
        join(pluginRoot, "plugin.py"),
        root,
        hermesHome,
        sessionKey,
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );
    expect(out.trim()).toBe("ok");
  });
});
