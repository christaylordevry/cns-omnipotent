import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveNlmEnv,
  runNlmAuthWatchdog,
} from "../scripts/session-close/lib/nlm-auth-watchdog.mjs";

const HERMES_HOME = "/home/christ/.hermes";
const HERMES_PROFILE_HOME = `${HERMES_HOME}/home`;
const OPERATOR_HOME = "/home/christ";

const hermesEnv = {
  HOME: HERMES_PROFILE_HOME,
  HERMES_HOME,
  USER: "christ",
  PATH: "/home/christ/.local/bin:/usr/bin",
};

describe("nlm-auth-watchdog · Hermes HOME remap (Story 59-3)", () => {
  it("remaps HOME to operator home before spawning nlm", async () => {
    /** @type {NodeJS.ProcessEnv | Record<string, string | undefined> | null} */
    let seen = null;
    const result = await runNlmAuthWatchdog({
      env: hermesEnv,
      resolveCommand: async () => "/home/christ/.local/bin/nlm",
      runCommand: async (_cmd, _args, opts) => {
        seen = opts.env;
        return { stdout: "Authentication valid!", stderr: "" };
      },
    });
    assert.equal(result.status, "authenticated");
    assert.equal(result.reason, "ok");
    assert.equal(seen?.HOME, OPERATOR_HOME);
    assert.equal(seen?.OPERATOR_HOME, OPERATOR_HOME);
  });

  it("does not remap when HERMES_HOME is missing", async () => {
    /** @type {NodeJS.ProcessEnv | Record<string, string | undefined> | null} */
    let seen = null;
    const partialEnv = { ...hermesEnv, HERMES_HOME: undefined };
    await runNlmAuthWatchdog({
      env: partialEnv,
      resolveCommand: async () => "/home/christ/.local/bin/nlm",
      runCommand: async (_cmd, _args, opts) => {
        seen = opts.env;
        return { stdout: "Authentication valid!", stderr: "" };
      },
    });
    assert.equal(seen?.HOME, HERMES_PROFILE_HOME);
  });

  it("is a no-op remap when env is already operator HOME", async () => {
    const operatorEnv = {
      HOME: OPERATOR_HOME,
      HERMES_HOME,
      USER: "christ",
      PATH: "/home/christ/.local/bin:/usr/bin",
    };
    const nlmEnv = await resolveNlmEnv(operatorEnv);
    assert.equal(nlmEnv.HOME, OPERATOR_HOME);
    assert.equal(nlmEnv.OPERATOR_HOME, OPERATOR_HOME);
  });

  it("still surfaces unauthenticated when nlm reports login required", async () => {
    const result = await runNlmAuthWatchdog({
      env: hermesEnv,
      resolveCommand: async () => "/home/christ/.local/bin/nlm",
      runCommand: async () => ({
        stdout: "",
        stderr: "Authentication failed: please login",
      }),
    });
    assert.equal(result.status, "unauthenticated");
    assert.equal(result.reason, "unauthenticated");
  });
});
