import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(import.meta.dirname, "..");
const scriptPath = join(root, "scripts/hermes-gateway-start.sh");

describe("Story 67-9 hermes-gateway-start.sh", () => {
  const body = readFileSync(scriptPath, "utf8");

  it("contains stale pid cleanup with gateway.pid, gateway.lock, and kill -0", () => {
    assert.ok(body.includes("gateway.pid"));
    assert.ok(body.includes("gateway.lock"));
    assert.ok(body.includes("kill -0"));
    assert.ok(body.includes("cleared stale gateway lock"));
  });

  it("parses gateway.pid JSON for live process check", () => {
    assert.ok(body.includes("json.load(open('$PID_FILE'))"));
    assert.ok(body.includes(".get('pid'"));
  });

  it("uses 67-8 aligned status grep pattern", () => {
    assert.ok(body.includes("gateway service is running|gateway is running"));
  });

  it("extracts PID from Main PID and PID status lines", () => {
    assert.ok(body.includes("Main PID:"));
    assert.ok(body.includes("PID:"));
  });

  it("idempotent early exit when live pid exists", () => {
    assert.ok(body.includes("already running"));
    assert.ok(body.includes("exit 0"));
  });

  it("invokes check_gateway_pid_file under set -e without bare non-zero return", () => {
    assert.ok(body.includes("if check_gateway_pid_file; then"));
    assert.match(body, /if check_gateway_pid_file;\s*then[\s\S]*exit 0/);
    assert.doesNotMatch(body, /^check_gateway_pid_file$/m);
  });

  it("echoes start messages for cron log capture", () => {
    assert.ok(body.includes("hermes-gateway-start:"));
    assert.ok(body.includes("started gateway in background"));
  });

  it("uses nohup hermes gateway run for background start", () => {
    assert.ok(body.includes("nohup hermes gateway run"));
  });
});
