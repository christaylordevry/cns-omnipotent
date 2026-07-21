# HANDOFF 2026-07-21 — ops-observability closed; next = NotebookLM 981466f0 source fix

**Read this first, then `_bmad-output/implementation-artifacts/deferred-work.md` (top entries).**
Supersedes `HANDOFF-2026-07-20-redesign-scenarios-and-bd4.md`.

---

## TL;DR

- **Epic `ops-observability` CLOSED.** OPS-1, OPS-2, OPS-4, OPS-5 done; OPS-3 cancelled on evidence.
- Three incidents diagnosed and fixed. All were the same defect: **a component that answered
  "I don't know" with "fine."**
- Both repos pushed clean.
- **Next task is NOT code** — it's an operator action in the NotebookLM UI. Diagnosis is done
  (below); don't re-derive it.

## Current state

| Repo | Branch | State |
|---|---|---|
| `Omnipotent.md` | `hermes-consolidation` | pushed, clean |
| `cns-dashboard` | `cns-redesign` | pushed, clean (`c8d673a`) |

---

## ~~⏭️ NEXT TASK~~ — ✅ RESOLVED 2026-07-21 — NotebookLM notebook `981466f0` cannot drive-sync

> **CLOSED.** Fixed exactly as predicted below: operator attached the Drive PDF, no code change.
> 3/3 targets now sync green. The diagnosis below held up; kept for the record.
> **Two corrections it did not have:**
> 1. `NOTEBOOKLM_DRIVE_DOC_ID` comes from **`~/.hermes/session-close.env:14`** (a third env file),
>    and it is **not stale** — it resolves to a live 2.99 MB PDF modified 2026-07-20.
> 2. Real root cause: the 58-3 PDF migration only ever covered **2 of 3** notebooks, though its
>    record claimed all 3. This was an incomplete migration, not a new fault.

### The diagnosis is already done. Do not re-investigate.

Session-close reports this notebook as `error_class: unknown`:

```
no Drive source matched NOTEBOOKLM_DRIVE_DOC_ID 1olnjZJMP7xa9adwt_DlQRHTcDEk1GxKM
and no google_docs / vault-export word_doc fallback source was available
```

**Verified live 2026-07-21 via `nlm source list 981466f0-de1c-4551-93a9-f3bc2a24b184 --drive --json`:**

The notebook **already has** a source titled `vault-export-for-notebooklm.md`
(id `e7846754-eea9-480f-8741-bdac5db890ba`) — but its type is **`generated_text`**, not a Drive
source. Every source in that notebook is `generated_text` or `unknown`; none is Drive-linked.

The matcher chain in `scripts/session-close/sync-vault-export-drive.mjs` tries, in order:
1. `matchDriveSourceByDocId` — needs a Drive doc ID → no match
2. `matchGoogleDocsSourceFallback` — needs type `google_docs` → no match
3. `matchWordDocVaultExportFallback` — needs type `word_doc` → no match

### ⚠️ The obvious fix is the WRONG fix

Widening the fallback to accept `generated_text` would make the *match* succeed and the *sync*
meaningless: a `generated_text` source has **no Drive linkage**, so `nlm source sync` has nothing to
refresh. It would convert a loud failure into a silent no-op — the exact anti-pattern this whole
epic removed. **Do not widen the matcher.**

### The actual fix (operator, NotebookLM UI)

Attach the vault-export **PDF as a Drive source** to notebook `981466f0`, matching how the other two
notebooks are configured (they resolve to real source IDs and attempt sync). Then re-check.

The two working notebooks for comparison:
- `f037c741-f7e1-4a90-880f-d2d38986767b` → source `19fdae14-7dac-4399-a403-00cde9ac6275`
- `dc6abf1a-99d2-428d-af63-107591ff2c2e` → source `45616e49-4e01-43cb-b88f-5dedfa398cfc`

### Open thread while you're in there

`NOTEBOOKLM_DRIVE_DOC_ID` is **not set** in `.env.live-chain` or `~/.hermes/.env` (grepped, empty),
yet the error quotes `1olnjZJMP7xa9adwt_DlQRHTcDEk1GxKM`. Find where that value actually comes from
(fanout targets config? a default in code?) and confirm it points at the current export PDF. A stale
hardcoded doc ID would explain the mismatch on all three notebooks, not just this one.

---

## What shipped 2026-07-20/21 — do NOT re-derive

### OPS-1 — digest push fails loudly (`cc781a3`)
2026-07-20 Convex free-plan outage blocked every push; watchdog logged
`completion-convex-push-failed … signalsWritten:0` with **`exit=0`**. Fix reuses the already-computed
`computeOverall()` verdict instead of discarding it: `overall !== 'success'` → exit 1 + Discord alert
via the existing `postOutcomeCheckAlert` path, same-day dedup cleared on success.
**AC2 proven live** — a `skipped-already-pushed` run exits 0 and posts nothing.

### OPS-2 — cross-repo digest-signal schema contract (`b230a1a`, `6a7de0a`, `58ca8ed` + dashboard `ced8406`, `c8d673a`)
Closes the **2026-06-20** incident: `ArgumentValidationError: viewCount`, **`signalsWritten: 11`** —
a *partial write* that silently truncated a day, 5× at `exit=0`, unnoticed for a month. Structural
cause: 15 untyped producer sites + a dedupe spread (`dedupe-digest-signals.mjs:446`) against 1 strict
Convex validator, no link. Fix = generated manifest at `contracts/digest-signal-contract.json`
(derived mechanically from the validators), guarded **both** sides: fixture sweep at `verify.sh` time
+ pre-flight assertion before **any** Convex call (zero partial writes, including the run row).

### OPS-3 — in-run retry: **CANCELLED UNBUILT**
Full watchdog log history = 8 failures in 2 clusters, **all permanent** (schema drift, quota),
**zero transient**. Day-level retry already exists (`push-digest-watchdog.mjs:435`). Story retained —
the analysis records why not to build it next time it looks obvious. **Reopen only if** a
`completion-convex-push-failed` ever self-heals on the next run.

### OPS-4 — constitution propagation guard (`b57ff2d`, `ac987ca`)
The session's own `/session-close` propagated a **corrupt vault AGENTS.md** over the clean git mirror
while reporting `agents_sync: synced`. **Root cause was corrected mid-investigation** — the §8
transform is provably clean; the defect was `apply-section8.mjs` reading the vault and writing both
targets unvalidated. Guard now validates before the transform and before any write.
**Verified against the real artifact:** the preserved corrupt copy is rejected by name; clean mirror
and live vault both pass.

### OPS-5 — drive-sync timeout, canary, rollup honesty (`da20448`, `8e77639`)
**Measured live: `nlm source sync` takes 41.2s; the bound was 25s** → every sync failed every time.
Deterministic, not "intermittent". Split into `NLM_LIST_TIMEOUT_MS` (25s) / `NLM_SYNC_TIMEOUT_MS`
(120s), capped at `NLM_TIMEOUT_MS_CAP` 240s (**not** 300s — parity with the Hermes terminal budget
would make the inner bound unreachable and lose the clean `nlm_sync_timeout` class). Canary warns at
50% of bound. Rollup: total → `notebooklm`, partial → `notebooklm_partial`, zero targets →
`notebooklm_no_targets`. Killed `{ ok: true, synced: 0 }`.

### verify.sh tracker gate
`sprint-status.yaml` broke unnoticed (mangled `last_updated` → unparseable). Nothing caught it.
`verify.sh` now asserts it parses and has a non-empty `development_status`, early (~1s), before the
expensive suites. Both red paths exercised.

---

## Still open

1. ~~**`981466f0` source fix**~~ — ✅ **DONE 2026-07-21.** Drive PDF attached in the NotebookLM UI;
   new source `43663c0f-b944-429c-a258-6f0bea4b010c`, type `word_doc`. **All 3/3 targets verified
   green** by hand-running the exact session-close argv (`nlm source sync <nb> --source-ids <id> -y`)
   — no `/session-close` spend needed. No code change; matcher untouched, as called.
   Full write-up in `deferred-work.md` → "Epic 58 residual", piece (b).
2. **Vault-corruption origin** — some write between 07-14 and 07-20 dirtied `AI-Context/AGENTS.md`.
   OPS-4 contains the blast radius but does not explain the cause. Corrupt copy preserved at
   `AI-Context/AGENTS.md.corrupt-2026-07-20.bak`.
3. **Unguarded Convex siblings** — `entityMentions`, `keywordCandidates`, `hermesAwareness` cross the
   same producer→Convex boundary with no contract. The OPS-2 manifest pattern generalises.

## `/session-close` status

**Safe to run again for the constitution** (OPS-4 refuses to propagate corruption) and drive-sync
should now complete (OPS-5). **That first run is the live confirmation for both** — check the
drive-sync targets and `failure_class` rather than assuming. Still ~$3–5/run.

## Operating notes that cost time this session

- **`git status --short` before every commit.** Three times work was finished and green off files git
  did not have (an untracked fixture that a committed test imported; uncommitted review patches).
- **Verify by exit code, never by reading piped output.** A piped `verify.sh` masked a failure claim
  during OPS-4 review; the finding turned out wrong, but only because someone actually re-ran it.
- **Two confident diagnoses were wrong** and were caught only by running an experiment: the
  session-close root cause (it *propagates*, doesn't *create*) and "verify is red" (it was green).
  Both reversed before code was written. **Probe, don't infer.**
