# Brain index — incremental rebuild (Story 79-2)

Operator-facing notes for production Portal vectors. Full incremental engine is a follow-on; this documents the intended cadence per NFR-RECALL-2.

## Full rebuild (today)

```bash
export CNS_VAULT_ROOT=/path/to/Knowledge-Vault-ACTIVE
export CNS_BRAIN_EMBEDDER=portal
export CNS_BRAIN_EMBED_MODEL='<embedding-model-from-portal>'
# optional: CNS_BRAIN_EMBED_BASE_URL=http://127.0.0.1:8645/v1
hermes proxy start   # separate terminal — Portal JWT proxy

npm run brain:index -- --output-dir /abs/path/outside/vault/brain-index
```

Manifest `freshness.last_build_utc` and `embedder` (`providerId: portal`, `modelId`) record build metadata.

## Rebuild triggers

| Event | Action |
|-------|--------|
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

No vault mutation; only index artifacts outside the vault change.
