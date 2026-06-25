import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const pluginRoot = join(root, "scripts/hermes-plugin-examples/cns-brain-recall");
const installScript = join(root, "scripts/install-hermes-plugin-cns-brain-recall.sh");
const sourcePycache = join(pluginRoot, "__pycache__");
const bytecodeEnv = { ...process.env, PYTHONDONTWRITEBYTECODE: "1" };

const tempRoots: string[] = [];

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    rmSync(tempRoot, { force: true, recursive: true });
  }
  rmSync(sourcePycache, { force: true, recursive: true });
});

describe("Story 79-1 cns-brain-recall plugin stub", () => {
  it("has version-controlled plugin source files", () => {
    expect(existsSync(join(pluginRoot, "plugin.py"))).toBe(true);
    expect(existsSync(join(pluginRoot, "plugin.yaml"))).toBe(true);
    expect(existsSync(join(pluginRoot, "__init__.py"))).toBe(true);
    expect(existsSync(join(pluginRoot, "references/config-snippet.md"))).toBe(true);
  });

  it("plugin.yaml declares pre_llm_call hook", () => {
    const yaml = readFileSync(join(pluginRoot, "plugin.yaml"), "utf8");
    expect(yaml).toMatch(/name:\s*cns-brain-recall/);
    expect(yaml).toMatch(/pre_llm_call/);
  });

  it("plugin.py returns probe marker from pre_llm_call hook", () => {
    const out = execFileSync(
      "python3",
      [
        "-B",
        "-c",
        `import importlib.util, sys
path = sys.argv[1]
spec = importlib.util.spec_from_file_location("cns_brain_recall_plugin", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
result = mod.recall_probe_hook(session_id="s", user_message="hi")
assert result == {"context": "[brain-recall:probe]"}, result
print("ok")`,
        join(pluginRoot, "plugin.py"),
      ],
      { encoding: "utf8", env: bytecodeEnv },
    );
    expect(out.trim()).toBe("ok");
    expect(existsSync(sourcePycache)).toBe(false);
  });

  it("__init__.py registers the pre_llm_call hook through the Hermes loader path", () => {
    const out = execFileSync(
      "python3",
      [
        "-B",
        "-c",
        `import importlib.util, sys
path = sys.argv[1]
spec = importlib.util.spec_from_file_location("cns_brain_recall", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
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
assert callback(session_id="s", user_message="hi") == {"context": "[brain-recall:probe]"}
print("ok")`,
        join(pluginRoot, "__init__.py"),
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
    expect(out).toContain(`Config snippet: ${join(destRoot, "references/config-snippet.md")}`);
    expect(existsSync(join(destRoot, "plugin.py"))).toBe(true);
    expect(existsSync(join(destRoot, "__init__.py"))).toBe(true);
    expect(existsSync(join(destRoot, "plugin.yaml"))).toBe(true);
    expect(existsSync(join(destRoot, "references/config-snippet.md"))).toBe(true);
    expect(existsSync(staleFile)).toBe(false);
    expect(existsSync(join(destRoot, "__pycache__"))).toBe(false);
    expect(existsSync(join(destRoot, "__pycache__/plugin.cpython-312.pyc"))).toBe(false);
  });
});
