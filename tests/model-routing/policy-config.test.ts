import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import Ajv from "ajv";

const CONFIG_DIR = path.resolve("config/model-routing");

const CREDENTIAL_KEY_BLOCKLIST = [
  "apikey",
  "api_key",
  "token",
  "authorization",
  "auth",
  "password",
  "secret",
  "client_secret",
  "access_token",
  "refresh_token",
  "private_key",
  "x-api-key",
  "bearer",
  "jwt",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectCredentialLikeKeys(value: unknown, out: string[], parentPath = "$") {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectCredentialLikeKeys(value[i], out, `${parentPath}[${i}]`);
    }
    return;
  }

  if (!isRecord(value)) return;

  for (const [k, v] of Object.entries(value)) {
    const lower = k.toLowerCase();
    if (CREDENTIAL_KEY_BLOCKLIST.some((needle) => lower.includes(needle))) {
      out.push(`${parentPath}.${k}`);
    }
    collectCredentialLikeKeys(v, out, `${parentPath}.${k}`);
  }
}

function collectCredentialLikeValues(value: unknown, out: string[], parentPath = "$") {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (CREDENTIAL_KEY_BLOCKLIST.some((needle) => lower.includes(needle))) {
      out.push(`${parentPath} = "${value}"`);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectCredentialLikeValues(value[i], out, `${parentPath}[${i}]`);
    }
    return;
  }

  if (!isRecord(value)) return;

  for (const [k, v] of Object.entries(value)) {
    collectCredentialLikeValues(v, out, `${parentPath}.${k}`);
  }
}

async function readJson(filePath: string) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

function intersection<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): T[] {
  if (!a?.length || !b?.length) return [];
  const bSet = new Set(b);
  return a.filter((v) => bSet.has(v));
}

describe("config/model-routing shipped config", () => {
  it("validates example configs against schemas and contains no credential-like keys", async () => {
    const files = (await readdir(CONFIG_DIR)).sort();

    const schemasByName = new Map<string, unknown>();
    const jsonByName = new Map<string, unknown>();

    for (const name of files) {
      if (!name.endsWith(".json")) continue;
      const fullPath = path.join(CONFIG_DIR, name);
      const parsed = await readJson(fullPath);

      if (name.endsWith(".schema.json")) {
        schemasByName.set(name, parsed);
      } else {
        jsonByName.set(name, parsed);
      }

      const badKeys: string[] = [];
      collectCredentialLikeKeys(parsed, badKeys);
      expect(badKeys, `${name} contains forbidden credential-like keys`).toEqual([]);

      if (!name.endsWith(".schema.json")) {
        const badValues: string[] = [];
        collectCredentialLikeValues(parsed, badValues);
        expect(badValues, `${name} contains credential-like string values`).toEqual([]);
      }
    }

    const ajv = new Ajv({
      allErrors: true,
      strict: true,
      strictSchema: false,
      validateSchema: false,
      validateFormats: false,
    });

    for (const [schemaName, schema] of schemasByName.entries()) {
      ajv.addSchema(schema, schemaName);
    }

    const schemaForConfig: Record<string, string> = {
      "reason-codes.json": "reason-codes.schema.json",
      "model-alias-registry.json": "model-alias-registry.schema.json",
      "policy.defaults.json": "policy.schema.json",
    };

    for (const [configName, schemaName] of Object.entries(schemaForConfig)) {
      const config = jsonByName.get(configName);
      const schema = schemasByName.get(schemaName);
      expect(config, `missing config file: ${configName}`).toBeDefined();
      expect(schema, `missing schema file: ${schemaName}`).toBeDefined();

      const validate = ajv.compile(schema as object);
      const ok = validate(config);
      if (!ok) {
        const message = ajv.errorsText(validate.errors, { separator: "\n" });
        throw new Error(`${configName} failed schema validation:\n${message}`);
      }
    }

    const policy = jsonByName.get("policy.defaults.json");
    expect(isRecord(policy), "policy.defaults.json must be an object").toBe(true);
    if (!isRecord(policy)) return;
    const surfaces = policy.surfaces;
    expect(isRecord(surfaces), "policy.defaults.json missing surfaces").toBe(true);
    if (!isRecord(surfaces)) return;

    for (const [surface, surfacePolicy] of Object.entries(surfaces)) {
      const sp = isRecord(surfacePolicy) ? surfacePolicy : undefined;
      const allow = sp && isRecord(sp.allow) ? sp.allow : undefined;
      const deny = sp && isRecord(sp.deny) ? sp.deny : undefined;

      const allowModelAliases = Array.isArray(allow?.model_aliases)
        ? (allow.model_aliases.filter((v): v is string => typeof v === "string") as string[])
        : undefined;
      const denyModelAliases = Array.isArray(deny?.model_aliases)
        ? (deny.model_aliases.filter((v): v is string => typeof v === "string") as string[])
        : undefined;

      const allowTools = Array.isArray(allow?.tools)
        ? (allow.tools.filter((v): v is string => typeof v === "string") as string[])
        : undefined;
      const denyTools = Array.isArray(deny?.tools)
        ? (deny.tools.filter((v): v is string => typeof v === "string") as string[])
        : undefined;

      const bothModelAliases = intersection(allowModelAliases, denyModelAliases);
      const bothTools = intersection(allowTools, denyTools);

      expect(
        { bothModelAliases, bothTools },
        [
          `policy.defaults.json surface "${surface}" has allow/deny conflicts.`,
          `Determinism rule is "deny wins", but shipped examples must avoid conflicts.`,
        ].join(" "),
      ).toEqual({ bothModelAliases: [], bothTools: [] });
    }
  });

  it("rejects non-SemVer policy and registry versions", async () => {
    const policySchema = await readJson(path.join(CONFIG_DIR, "policy.schema.json"));
    const registrySchema = await readJson(path.join(CONFIG_DIR, "model-alias-registry.schema.json"));
    const reasonCodesSchema = await readJson(path.join(CONFIG_DIR, "reason-codes.schema.json"));

    const ajv = new Ajv({
      allErrors: true,
      strict: true,
      strictSchema: false,
      validateSchema: false,
      validateFormats: false,
    });
    ajv.addSchema(reasonCodesSchema, "reason-codes.schema.json");

    const validatePolicy = ajv.compile(policySchema as object);
    const validateRegistry = ajv.compile(registrySchema as object);

    const badPolicy = {
      policy_version: "v1",
      surfaces: {
        cursor: {
          defaults: {
            coding: { model_alias: "gpt-4o", fallback_chain: [] },
            writing: { model_alias: "gpt-4o", fallback_chain: [] },
            analysis: { model_alias: "gpt-4o", fallback_chain: [] },
          },
        },
        "claude-code": {
          defaults: {
            coding: { model_alias: "claude-3-7-sonnet", fallback_chain: [] },
            writing: { model_alias: "claude-3-7-sonnet", fallback_chain: [] },
            analysis: { model_alias: "claude-3-7-sonnet", fallback_chain: [] },
          },
        },
        "vault-io": {
          defaults: {
            coding: { model_alias: "gpt-4o", fallback_chain: [] },
            writing: { model_alias: "gpt-4o", fallback_chain: [] },
            analysis: { model_alias: "gpt-4o", fallback_chain: [] },
          },
        },
        unknown: {
          defaults: {
            coding: { model_alias: "gpt-4o", fallback_chain: [] },
            writing: { model_alias: "gpt-4o", fallback_chain: [] },
            analysis: { model_alias: "gpt-4o", fallback_chain: [] },
          },
        },
      },
    };

    const badRegistry = {
      registry_version: "1.2",
      aliases: {
        "gpt-4o": {
          provider: "openai",
          model_id: "gpt-4o",
        },
      },
    };

    expect(validatePolicy(badPolicy)).toBe(false);
    expect(validatePolicy.errors?.some((err) => err.instancePath === "/policy_version")).toBe(true);

    expect(validateRegistry(badRegistry)).toBe(false);
    expect(validateRegistry.errors?.some((err) => err.instancePath === "/registry_version")).toBe(true);
  });
});

