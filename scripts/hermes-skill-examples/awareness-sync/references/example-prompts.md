# Example prompts: `awareness-sync` (Story 77-4 / AC5)

Operator-facing examples with expected snapshot sections. All assume skill is bound on `#hermes` or Hermes Desktop and `OMNIPOTENT_REPO` + `~/.hermes/awareness-pull.env` are configured.

## Full cockpit digest

**Prompt:**

```text
awareness-sync
```

**Expected behavior:** Run pull (unless `--cache-only`), read cache envelope, post bounded digest (≤25 lines) covering chain, digest, vault, investigations count, MCP health summary, sync age.

**Snapshot sections:** `snapshot.chain`, `snapshot.digest`, `snapshot.vault`, `snapshot.investigations`, `snapshot.mcps`, `snapshot.sync`, envelope `pulledAt`.

---

## Run-chain status

**Prompt:**

```text
What's the run-chain status?
```

**Expected behavior:** Refresh awareness (default), answer from `snapshot.chain`.

**Minimum fields:** `state`, `lastRunAt`, `lastSynthesisTitle`.

---

## Morning digest

**Prompt:**

```text
How did the morning digest go?
```

**Expected behavior:** Answer from `snapshot.digest.brief` + top signals.

**Minimum fields:** `brief.status`, `brief.date`, top 3 `topSignals[].title`.

---

## Trend anomalies

**Prompt:**

```text
Any trend anomalies?
```

**Expected behavior:** Summarize `snapshot.trends.anomalies` — keywords, sigma distance, lifecycle stage when present.

---

## Investigation board

**Prompt:**

```text
Investigation board summary
```

**Expected behavior:** Summarize `snapshot.investigations`.

**Minimum fields:** `totalItems`, `columnCounts` (triage, investigating, waiting, resolved).

---

## MCP health

**Prompt:**

```text
MCP health check
```

**Expected behavior:** List `snapshot.mcps` rows with name, status, last check; healthy vs total count.

---

## Cache-only (cron warm path)

**Prompt:**

```text
awareness-sync --cache-only
```

**Expected behavior:** Skip terminal pull; read existing `~/.hermes/memories/awareness-snapshot.json`; report age from `pulledAt`; note if cache older than 5 min.
