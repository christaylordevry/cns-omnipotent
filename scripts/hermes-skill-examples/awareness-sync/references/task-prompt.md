# Task: `awareness-sync` (Story 77-4 / FR12)

## Hard constraints (must follow)

1. **CLI pull only**: invoke **`scripts/hermes-awareness-pull.ts`** via **`terminal()`** — never call Convex HTTP, Convex SDK, or Convex MCP directly.
2. **Same-shell env**: `source ~/.hermes/awareness-pull.env` must run in the **same** shell as `npx tsx` (inline command string).
3. **No vault mutations** — terminal pull + local cache read + bounded markdown reply only.
4. **Bounded Discord/Desktop output** — no full envelope JSON unless operator passed `--json` debug flag.
5. **Secrets policy**: cite env var **names** only; never echo `HERMES_CONVEX_READ_KEY` or bearer values.
6. **Stale honesty**: when pull fails but cache exists, use STALE header with `pulledAt` age — do not claim freshness.

## 0) REFERENCE ONLY — invocation already confirmed

> **You have already been invoked.** The `config.yaml` trigger matched the incoming Discord message or Desktop session request. Do not re-check or re-evaluate the Hermes skill binding.
> Proceed directly to **§1 Preconditions**.

For documentation purposes only (do not re-evaluate at runtime):

- Explicit triggers start with `awareness-sync` (see `references/trigger-pattern.md`).
- Natural-language cockpit questions route here when the skill is bound — refresh then answer unless `--cache-only` semantics apply.

## 1) Preconditions

### Resolve repo root

```
resolved_repo_root = OMNIPOTENT_REPO when set to a non-empty absolute path
else stop — do not guess cwd
```

If `OMNIPOTENT_REPO` is unset or empty, reply exactly:

```markdown
## Awareness sync skipped

Set the repo root, then re-run:

`export OMNIPOTENT_REPO=/absolute/path/to/Omnipotent.md`

Do not guess cwd.
```

Stop. Do not run `terminal()`.

### Parse operator intent

Let **`raw`** be the incoming message text.

| Mode | Detection | Pull? |
|------|-----------|-------|
| Default | `awareness-sync` (optional question text after first line) | Yes — refresh unless only whitespace after token |
| Cache-only | `awareness-sync --cache-only` (or documented alias `--no-pull`) | No — read cache only |
| JSON debug | `awareness-sync --json` | Yes — then post envelope JSON (warn about size) |

For natural-language questions when bound (e.g. "What's the run-chain status?"), default to **refresh then answer** unless operator explicitly requests cache-only.

### Env file gate (pull modes only)

When pull is required, verify operator has `~/.hermes/awareness-pull.env` (or document expected path). If missing:

```markdown
## Awareness sync skipped (env)

Copy the template and set credentials (names only):

`cp scripts/awareness-pull.env.example ~/.hermes/awareness-pull.env && chmod 600 ~/.hermes/awareness-pull.env`

Required variables: `CONVEX_URL`, `HERMES_CONVEX_READ_KEY`
```

Stop. Do not run pull without both vars.

## 2) Terminal invocation — pull (when not cache-only)

Invoke **one** `terminal()` call with `workdir=resolved_repo_root` and a **single** chained command:

```bash
cd "${OMNIPOTENT_REPO}" && \
  set -a && source "${HOME}/.hermes/awareness-pull.env" && set +a && \
  npx tsx scripts/hermes-awareness-pull.ts
```

Rules:

- Use a **30s+** timeout (pull client default is 30s).
- Capture **exit code**, **stdout**, **stderr**.
- On exit **0**, proceed to §3 cache read (fresh).
- On non-zero exit, proceed to §3 stale path if cache file exists.

**Do not** construct Convex URLs in skill output — the pull script owns URL derivation (`.convex.site` route).

## 3) Cache read

Resolve cache path:

```
cache_path = HERMES_AWARENESS_CACHE_PATH from env when set
else ~/.hermes/memories/awareness-snapshot.json
```

Read via `terminal()` (`cat` with quoted path) or Hermes file-read if available. Parse JSON envelope:

```typescript
type AwarenessCacheEnvelope = {
  pulledAt: number;      // Unix ms
  sourceUrl: string;     // GET URL (no bearer)
  snapshot: HermesAwarenessSnapshot;
};
```

Validate `snapshot` has all eight top-level keys: `sync`, `vault`, `chain`, `mcps`, `digest`, `entities`, `investigations`, `trends`.

If cache missing and pull failed:

```markdown
## Cockpit awareness unavailable

Pull failed and no cache file found at `<cache_path>`.
Error: <stderr one-liner — no secrets>
```

Stop.

### Stale fallback (pull failed, cache exists)

```markdown
## Cockpit awareness (STALE — pull failed)

Pull error: {stderr one-liner — no secrets}
Using cache from {pulledAt relative}.
```

Then continue to §4 using cached `snapshot`. Mark freshness as **stale** in all summaries.

### 401 / auth failure

When stderr indicates 401 or auth failure, add:

- Verify `HERMES_CONVEX_READ_KEY` matches Convex deployment env (cite **names** only).
- Verify `CONVEX_URL` uses `.convex.cloud` form in env file.

## 4) Section routing (operator question → snapshot path)

| Question theme | Snapshot path | Minimum fields to cite |
|----------------|---------------|-------------------------|
| Run-chain status | `snapshot.chain` | `state`, `lastRunAt`, `lastSynthesisTitle` |
| Vault health | `snapshot.vault` | inbox depth, lint metrics, PAKE distribution summary |
| MCP / tool health | `snapshot.mcps` | name, status, last check |
| Morning digest | `snapshot.digest` | `brief.status`, `brief.date`, top 3 `topSignals` titles |
| Investigations | `snapshot.investigations` | `totalItems`, `columnCounts` |
| Entity intelligence | `snapshot.entities` | tracked/emerging display names + momentum one-liners |
| Trends / anomalies | `snapshot.trends` | anomaly keywords, score lifecycle stages |
| Sync freshness | `snapshot.sync` + envelope `pulledAt` | last sync time; stale if age > 5 min |

When operator message is bare `awareness-sync` (no specific question), post **§5 cockpit digest**.

## 5) Output templates

### Success digest (bare trigger — ≤25 lines)

```markdown
## Cockpit awareness (fresh | stale — pulled <N> min ago)

**Run-chain:** {chain.state} — last run {relative time} — {lastSynthesisTitle or "—"}
**Digest ({date}):** {brief.status} — top signal: {topSignals[0].title or "—"}
**Vault:** inbox {depth} — lint {critical}/{total}
**Investigations:** {totalItems} ({triage} triage, {investigating} active)
**MCPs:** {ok count}/{total} healthy
**Sync:** last cockpit sync {sync.lastSyncAt relative}
```

Use **fresh** when pull succeeded this turn; **stale** when serving last-good cache after pull failure.

### Targeted answer (natural language or themed question)

Bounded markdown — cite only the relevant section(s). Example for run-chain:

```markdown
## Run-chain status

- **State:** {chain.state}
- **Last run:** {relative lastRunAt}
- **Last synthesis:** {lastSynthesisTitle or "—"}
- **Awareness age:** {pulledAt relative} ({fresh|stale})
```

### JSON debug (`awareness-sync --json`)

Warn operator about Discord size limits, then post formatted envelope JSON (or attach as file if platform supports).

## Explicit non-goals

- Do **not** import or modify `scripts/hermes-awareness-pull.ts`.
- Do **not** call Convex MCP or live GET per chat turn outside the pull CLI.
- Do **not** paste more than **25 lines** for default cockpit digest.
- Do **not** echo secret values from env or stderr.
