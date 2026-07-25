# Brain embedder audit report (Story 74-1)

**Date:** 2026-06-24  
**Auditor:** Dev agent (bmad-dev-story)  
**Baseline commit:** `8b35d09b1c77abc0557ad25cf9e220c353a2bc72`  
**Scope:** Read-only inventory + smoke verification — no production code changes

---

## Executive summary

The Brain pipeline uses **`StubEmbedder` only** — a deterministic offline SHA-256 → 8-float vector. No production/network embedder adapter exists. Both CLIs hardcode `new StubEmbedder()`. The only env var wired to Brain index build is **`CNS_VAULT_ROOT`**. Stub embeddings are **deterministic but not semantically meaningful** for retrieval quality.

**Portal `/embeddings` verdict:** **SAFE TO ADOPT LATER** — not required for 74-2 (Hermes inference switch). Preconditions documented below.

---

## Files inspected

| Path | Finding |
|------|---------|
| `src/brain/embedder.ts` | `Embedder` interface + `StubEmbedder` (`providerId: "stub"`, `modelId: "stub-v1"`, 8-dim SHA-256 floats) |
| `src/brain/build-index-cli.ts` L108 | Hardcoded `const embedder = new StubEmbedder()` |
| `src/brain/query-index-cli.ts` L89 | Hardcoded `embedder: new StubEmbedder()` |
| `src/brain/build-index.ts` | Pipeline accepts injectable `Embedder`; persists `embedder.metadata` into artifact |
| `src/brain/retrieval/query-index.ts` | Cosine similarity; warns on `DIMENSION_MISMATCH`, `ZERO_VECTOR_*` |
| `src/brain/brain-index-manifest.ts` | Manifest includes `embedder: EmbedderMetadata` |
| `src/config.ts` | Vault root from `CNS_VAULT_ROOT` only — no embedder API keys |
| `package.json` L21–22 | Scripts: `brain:index`, `brain:query` |
| `_bmad-output/implementation-artifacts/deferred-work.md` L716 | CLI StubEmbedder deferral from 12-6 review |
| `tests/brain/build-index.test.ts` | CLI smoke patterns (`describe("build-index-cli")`) |
| `tests/brain/query-index.test.ts` | CLI smoke patterns (`describe("query-index CLI")`) |

### Grep inventory (`src/brain/` + `package.json`)

| Pattern | Matches |
|---------|---------|
| `StubEmbedder` | `embedder.ts`, `build-index-cli.ts`, `query-index-cli.ts` |
| `Embedder` (type/interface) | `embedder.ts`, `build-index.ts`, `query-index.ts`, `brain-index-manifest.ts` |
| `providerId` | `embedder.ts`, `query-index.ts` (schema), manifest fields |
| `OPENAI_API` | **None** in `src/brain/` |
| `embeddings` / `/v1/embeddings` | **None** in `src/brain/` |
| `fetch(` (network embedder) | **None** in `src/brain/` |

**Production/network embedder adapter:** **Does not exist.**

---

## Current embedder baseline

| Field | Value |
|-------|-------|
| Implementation | `StubEmbedder` class |
| `providerId` | `"stub"` |
| `modelId` | `"stub-v1"` |
| Vector dimensions | **8** (SHA-256 bytes 0–7, each ÷ 255) |
| Semantic quality | **None** — deterministic hash projection, not language-model embeddings |
| Network calls | **None** |

### Env vars wired today

| Variable | Used by Brain? | Purpose |
|----------|----------------|---------|
| `CNS_VAULT_ROOT` | **Yes** (required for `brain:index`) | Vault root for allowlist + note discovery |
| `OPENAI_API_KEY` | **No** | — |
| Portal JWT / proxy URL | **No** | — |
| `CNS_BRAIN_EMBED_*` | **No** (not implemented) | Future adapter selection |

---

## Deferred-work reference (12-6)

From `deferred-work.md` §12-6 code review:

> CLI always uses StubEmbedder — `query-index-cli.ts` hardcodes `new StubEmbedder()`; running `npm run brain:query` against a real-embedder-built index produces meaningless scores. Wire a real embedder adapter when the production embedder story ships.

**Current state:** Both CLIs use the same stub — **consistent for stub-indexed artifacts**. Mismatch risk arises only if a future production embedder indexes notes but query CLI remains on stub (or vice versa).

**Critical invariant:** Query embedder **must match** index embedder provider, model, and dimensions. Today `query-index.ts` warns on vector dimension mismatch, but it does **not** enforce `providerId` / `modelId` equality; a future production adapter story must add that manifest/runtime metadata guard before Portal-indexed artifacts are queried.

---

## Smoke verification — index build (AC #2)

**Date:** 2026-06-24

```bash
VAULT_ROOT="$(mktemp -d)"
OUT_DIR="$(mktemp -d)"
mkdir -p "$VAULT_ROOT/_meta/schemas" "$VAULT_ROOT/notes"

# Allowlist
cat > "$VAULT_ROOT/_meta/schemas/brain-corpus-allowlist.json" <<'EOF'
{"schema_version":1,"subtrees":["notes"],"inbox":{"enabled":false}}
EOF

# One PAKE-valid note
cat > "$VAULT_ROOT/notes/smoke-note.md" <<'EOF'
---
pake_id: 11111111-1111-4111-8111-111111111111
pake_type: SourceNote
title: "Smoke test note"
created: 2026-01-01
modified: 2026-01-01
status: draft
confidence_score: 0.5
verification_status: pending
creation_method: human
tags: []
---
This is a smoke test note for brain embedder audit story 74-1.
EOF

export CNS_VAULT_ROOT="$VAULT_ROOT"
npm run brain:index -- --output-dir "$OUT_DIR"
```

**Exit code:** 0

**Key stdout:**
```
Wrote /tmp/tmp.99W7gvs8AN/brain-index.json
Wrote /tmp/tmp.99W7gvs8AN/brain-index-manifest.json
```

**Artifacts written:** `brain-index.json`, `brain-index-manifest.json`

**Manifest embedder fields (verified):**
```json
{
  "providerId": "stub",
  "modelId": "stub-v1"
}
```

---

## Smoke verification — query (AC #3)

```bash
npm run brain:query -- \
  --index-path "$OUT_DIR/brain-index.json" \
  --query "smoke test" \
  --top-k 5 \
  --explain
```

**Exit code:** 0

**Truncated JSON sample:**
```json
{
  "embedder": {
    "providerId": "stub",
    "modelId": "stub-v1"
  },
  "results": [
    {
      "path": "notes/smoke-note.md",
      "score": 0.16738665475735484,
      "components": {
        "rawSimilarity": 0.6437948259898263,
        "qualityMultiplier": 0.26,
        "freshnessPenalty": 1,
        "finalScore": 0.16738665475735484
      }
    }
  ],
  "provenance": {
    "last_build_utc": "2026-06-23T23:41:14.745Z"
  }
}
```

**Note:** Scores are mathematically valid (cosine + quality weighting) but **not semantically meaningful** because stub vectors do not encode language semantics.

---

## Automated test backstop

```bash
npm run -s test:vitest -- tests/brain
# Test Files  5 passed (5)
# Tests       64 passed (64)
```

Includes offline CLI coverage in `build-index-cli` and `query-index CLI` describe blocks.

---

## Verify gate (AC #4)

```bash
bash scripts/verify.sh
```

**Result:** **PASS** (rerun 2026-06-24)

| Suite | Result |
|-------|--------|
| `tests/brain/*` (vitest) | 64/64 pass |
| `node --test tests/session-close-token-gate.test.mjs tests/session-close-pipeline.test.mjs` | 96/96 pass |
| `bash scripts/verify.sh` | PASS: CNS tests, lint, typecheck, build, sibling cns-dashboard tests, Python trend ingest tests, Hermes skill install gate |

**Story scope:** Audit plus verification hygiene. No production Brain, Portal, Hermes config, WriteGate, or `src/` code changed.

---

## Portal /embeddings adoption assessment

**Verdict:** **SAFE TO ADOPT LATER**

**Why safe to defer through 74-2:** Brain does not call Portal or any external embedding API today. Portal provider switch in 74-2 affects Hermes inference routing, not `src/brain/` CLIs.

**Preconditions before switching Brain to Portal embeddings:**

1. Story 74-2 complete — `hermes proxy start` reachable at `http://127.0.0.1:8645/v1` (OpenAI-compatible)
2. New `PortalEmbedder` (or env-selected adapter) in `src/brain/embedder.ts` calling `POST /v1/embeddings`
3. **Both** `build-index-cli.ts` and `query-index-cli.ts` use the **same** adapter (fixes deferred 12-6 CLI mismatch)
4. Document chosen model ID + vector dimensions; **full re-index** required — stub-indexed artifacts are not compatible
5. Optional: `CNS_BRAIN_EMBED_BASE_URL` env (default proxy URL) — keep secrets out of repo (NFR4)

**Risks if adopted carelessly:**

- Index/query embedder mismatch → meaningless retrieval. Dimension mismatches warn today; same-dimension provider/model mismatches need an explicit future metadata guard.
- Mixing stub-indexed and Portal-indexed artifacts without manifest discipline
- Embedding cost/volume on large corpus — operator-triggered rebuild only (no daemon)

**FR16 (stretch):** Hermes semantic recall via Brain remains deferred until production embedder + skill wiring land.

---

## Scope boundary confirmation (AC #5)

| Item | Changed? |
|------|----------|
| Portal subscription/OAuth | **No** |
| Production embedder adapter | **No** |
| Hermes config | **No** |
| WriteGate / `vault_log_action` | **No** |
| `specs/cns-vault-contract/security.md` | **No** |
| Production `src/` code | **No** |

**Deliverables:** This report, story/tracker status updates, and session-close test fixture hygiene required to make AC #4 pass.

---

## References

- Story: `_bmad-output/implementation-artifacts/74-1-brain-embedder-audit-before-portal-switch.md`
- PRD NFR3: `_bmad-output/planning-artifacts/prd-hermes-consolidation.md`
- Epic 74: `_bmad-output/planning-artifacts/epics-hermes-consolidation.md` §Story 74-1
- Deferred CLI embedder: `_bmad-output/implementation-artifacts/deferred-work.md` L714–717
