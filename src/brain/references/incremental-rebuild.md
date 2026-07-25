# Brain index — incremental rebuild (Story 79-2, schema v2 in 79-6)

Operator-facing notes for production Portal vectors. Full incremental engine is a follow-on; this documents the intended cadence per NFR-RECALL-2.

## Breaking change: schema v1 → v2 (Story 79-6)

**Mandatory full rebuild** after deploying Story 79-6. Chunked index artifacts (`schema_version: 2`) are incompatible with v1 whole-note vectors. Query rejects v1 indexes with `INDEX_SCHEMA_STALE`.

- Each record is one **passage chunk** (`chunk_index`, `char_start`, `char_end`, `text`, `embedding`).
- Default chunking: **768** target tokens, **64** overlap, `cl100k_base` via `gpt-tokenizer`.
- Manifest `counts.embedded` = chunk count; `counts.notes_embedded` = unique parent notes.
- Embedder model may be unchanged (`text-embedding-3-large`) but vectors must be rebuilt.

## Full rebuild (today)

```bash
export CNS_VAULT_ROOT=/path/to/Knowledge-Vault-ACTIVE
export CNS_BRAIN_EMBEDDER=portal
export CNS_BRAIN_EMBED_MODEL='<embedding-model-from-portal>'
# optional: CNS_BRAIN_EMBED_BASE_URL=http://127.0.0.1:8645/v1
# optional chunk tuning: CNS_BRAIN_CHUNK_TARGET_TOKENS=768 CNS_BRAIN_CHUNK_OVERLAP_TOKENS=64
hermes proxy start   # separate terminal — Portal JWT proxy

npm run brain:index -- --output-dir /abs/path/outside/vault/brain-index
```

Manifest `freshness.last_build_utc`, `embedder` (`providerId: portal`, `modelId`), and `chunking` record build metadata.

## Rebuild triggers

| Event | Action |
|-------|--------|
| Deploy Story 79-6 (chunked index) | **Mandatory full re-index** — v1 artifacts rejected |
| Embedder model change (`CNS_BRAIN_EMBED_MODEL`) | **Full re-index** — stub and portal vectors are incompatible |
| Corpus allowlist change | Full re-index |
| Note content change | Incremental target: re-embed only changed paths (future); until then, full re-index or operator-triggered rebuild |
| Secret-pattern false positive fix | Re-index affected paths after gate fix |

## Cron target (15–30 min)

Schedule the same `brain:index` command on a 15–30 minute cron when `hermes proxy` is managed by systemd/tmux alongside the gateway. Compare manifest `vault_snapshot.max_mtime_ms` vs note mtimes to skip no-op runs (future optimization).

## On-demand hook (session-close)

After high-signal vault writes in `session-close`, operator may trigger `brain:index` to refresh recall before the next Hermes turn. Wiring into session-close Step 6.x is deferred to Story 79-5 / operator cron setup.

## Revert to stub (NFR5)

```bash
unset CNS_BRAIN_EMBEDDER   # or export CNS_BRAIN_EMBEDDER=stub
npm run brain:index -- --output-dir <same-output-dir>
```

No vault mutation; only index artifacts outside the vault change. Recall stays in `shadow_mode: true` until re-calibrated after any index rebuild.

## Post-rebuild calibration (Story 79-4)

After v2 re-index with Portal embedder:

```bash
export CNS_BRAIN_INDEX_PATH=/abs/outside/vault/brain-index/brain-index.json
npm run brain:calibrate -- --index-path "$CNS_BRAIN_INDEX_PATH" --write-artifact
```

Do not flip `config/brain-recall-policy.json` → `shadow_mode: false` until calibration passes and operator reviews the artifact.
