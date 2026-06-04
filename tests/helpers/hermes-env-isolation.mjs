import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** @param {string} key @param {string | undefined} prior */
export function restoreEnv(key, prior) {
  if (prior === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = prior;
  }
}

/**
 * Save, neutralize HERMES_HOME, optionally set HOME/tmpdir/apply keys, run fn, restore.
 * @param {{
 *   saveKeys?: string[];
 *   apply?: Record<string, string | null | undefined>;
 *   home?: string;
 *   tmpdir?: { prefix: string };
 * }} opts
 * @param {() => Promise<void>} fn
 */
export async function withSessionCloseEnvIsolation(opts, fn) {
  const saveKeys = ["HOME", "HERMES_HOME", ...(opts.saveKeys ?? [])];
  const prior = Object.fromEntries(saveKeys.map((k) => [k, process.env[k]]));
  let tmpHome;
  try {
    delete process.env.HERMES_HOME;
    if (opts.tmpdir) {
      tmpHome = await mkdtemp(join(tmpdir(), opts.tmpdir.prefix));
      process.env.HOME = tmpHome;
    } else if (opts.home) {
      process.env.HOME = opts.home;
    }
    for (const [key, value] of Object.entries(opts.apply ?? {})) {
      if (value === null || value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    await fn();
  } finally {
    for (const key of saveKeys) {
      restoreEnv(key, prior[key]);
    }
    if (tmpHome) {
      await rm(tmpHome, { recursive: true, force: true });
    }
  }
}

/**
 * Isolated HOME + NotebookLM smart-routing env for routing tests.
 * @param {string | null} smartRoutingValue
 * @param {() => Promise<void>} fn
 * @param {{ prefix?: string }} [wrapperOpts]
 */
export async function withSmartRoutingIsolatedEnv(smartRoutingValue, fn, wrapperOpts = {}) {
  const prefix = wrapperOpts.prefix ?? "sr-home-";
  return withSessionCloseEnvIsolation(
    {
      saveKeys: ["NOTEBOOKLM_NOTEBOOK_IDS", "NOTEBOOK_SMART_ROUTING"],
      apply: {
        NOTEBOOKLM_NOTEBOOK_IDS: null,
        NOTEBOOK_SMART_ROUTING:
          smartRoutingValue === null ? null : smartRoutingValue,
      },
      tmpdir: { prefix },
    },
    fn,
  );
}
