# HANDOFF — Hermes Consolidation / Omniscient Session 7 (2026-06-26)

**For:** a fresh Claude Code session continuing this initiative.
**Role:** strategic verifier alongside the operator (Chris), who runs BMAD workflows in **Cursor**. You verify Cursor's outputs against the locked plan by **reading actual diffs/artifacts/source — never rubber-stamping**. That discipline has repeatedly caught real problems (see §7).

---

## 1. Read first

- This handoff, then the prior chain: `HANDOFF-2026-06-25-session6-hermes-consolidation.md`.
- **Omniscient plan (the active work):**
  - Resurfacing/feasibility: `_bmad-output/planning-artifacts/research-hermes-omniscience-resurfacing.md`
  - Brief: `_bmad-output/planning-artifacts/briefs/brief-hermes-omniscient-2026-06-25/`
  - PRD: `_bmad-output/planning-artifacts/prds/prd-CNS-2026-06-25/prd.md`
  - Architecture: `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md`
  - Epics/stories: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` (Epics 79–85, 22 stories)

---

## 2. What session 7 accomplished

1. **Epic 77-3** (Convex webhook push) — verified, committed (cns-dashboard `be5246e`), pushed; `HERMES_DISCORD_WEBHOOK_URL` confirmed set in Convex prod. **Epic 77 MVP done.**
2. **Epic 78** — 78-1 (voice config; Desktop E2E deferred — no native Electron build) + 78-2 (per-skill routing). Committed `d803190`.
3. **Key source-verified discoveries** (the verification that shaped everything):
   - `smart_model_routing` has **zero consumers** in Hermes v0.17.0 — **INERT** (78-2 retires it). Real FR14 cost lever is the **`auxiliary:`** block (Epic 80).
   - **ElevenLabs TTS is real** → direct key (ADR-HERMES-014); Portal managed TTS = OpenAI-only.
   - **`pre_llm_call`** is the real recall injection seam — a Hermes **user plugin** hook; mutation contract `{"context": "..."}` → appended to API user message (verified in `conversation_loop.py`/`turn_context.py`). No core fork.
4. **PIVOT to omniscience** (operator-directed): finished the full BMAD chain — research → brief → PRD → architecture → epics. All committed (`1285ba8`, `024b480`).
5. **Epic 79 (recall spine) BUILT 5/5**, each via BMAD dev-story → code-review → verifier → commit:
   - 79-1 A4-0 `pre_llm_call` probe — `0bbf873`
   - 79-2 PortalEmbedder + Brain index — `63532de`
   - 79-3 recall policy + `recall-inject.ts` — `0ecda99`
   - 79-4 golden-set calibration harness + shadow mode — `94c6c75`
   - 79-5 production `cns-brain-recall` plugin + prefetch CLI — `dc46cc7`
6. **CALIBRATION SESSION — the pivotal finding.** Built the first real Portal index (`text-embedding-3-large`, **153 notes**, at `/home/christ/.hermes/brain/`). Ran `brain:calibrate` → **FAIL, 2/36 channel runs passed.**
7. **Story 79-6 (chunked Brain index) — IN PROGRESS** (operator running `bmad-create-story` at handoff time).

---

## 3. THE CRITICAL FINDING — recall needs chunking (do not go live)

Calibration verdict: **whole-note embedding does not work.** Root cause, two compounding failures:

1. **Oversized notes excluded** — the index embeds **one vector per whole note**; 8 notes exceed `text-embedding-3-large`'s 8191-token limit and fail with `IO_ERROR`. These include the **richest docs** (e.g. `CNS-Operator-Guide.md` ~21K tok — a golden-query target).
2. **Short queries don't match diluted whole-note vectors** — even notes that *did* index (e.g. `CNS-Daily-Rhythm.md`) score `precision@k=0`, because a whole 5K-token note's averaged vector doesn't match a tight query. **Threshold tuning cannot fix ranking** — if the note isn't in top-k, lowering `min_score` won't add it.

The pipeline itself works (`operator-profile` hit precision 1.0 — embed→search→retrieve→cite is sound). The problem is **granularity, not plumbing.**

**Fix = chunking (Story 79-6):** split notes into ~512–1024-token passages, embed each chunk, recall returns the relevant chunk + parent path. Fixes oversized exclusion *and* ranking, and makes inject-trim natural (inject the passage, not the note's first N chars). This is standard RAG and is the difference between "barely retrieves" and "feels omniscient."

**The calibration gate did exactly its job** — it caught this *before* go-live. If recall had been flipped live un-calibrated, omniscient Hermes would have silently injected mostly-irrelevant content.

---

## 4. Current state

- **Omnipotent.md** branch `hermes-consolidation`, HEAD **`dc46cc7`** (79-5).
- **Recall is in SHADOW mode** (`config/brain-recall-policy.json` `shadow_mode: true`) — **NOT live.** Plugin `cns-brain-recall` installed + enabled but logs-only. **Do not flip `shadow_mode: false`** until 79-6 lands and re-calibration passes.
- **Epic 82 (voice) gate is correctly unmet** (depends on 79-4 calibration pass).
- Brain index (whole-note, 153 notes) at `/home/christ/.hermes/brain/brain-index.json` — **will be rebuilt chunked** after 79-6.
- Corpus allowlist **created** at `<vault>/_meta/schemas/brain-corpus-allowlist.json` — subtrees `03-Resources, 01-Projects, 02-Areas, AI-Context` + `protected_corpora_opt_in` enabled.
- Hermes subscription **proxy** may still be running (port `8645`, `hermes proxy start` in a tmux pane) for re-indexing.

---

## 5. Next steps (in order)

1. **Verify the 79-6 story** (chunked index + chunk-aware recall design) when the operator pastes it — check chunk schema, query returns chunks, recall-inject cites parent path, re-index documented, protect-list clean.
2. **Build 79-6** (dev-story → code-review → commit).
3. **Re-run the calibration session:** rebuild the chunked index, `brain:calibrate` against the 12 golden queries, **target a real pass.**
4. **Validate golden `expected_paths` against the real ranked results** — fix any wrong ones; set `operator_signoff: confirmed` in `config/brain-golden-queries.json` (currently `dev-agent (pending operator validation)`).
5. **Go live:** flip `shadow_mode: false`; set gateway env (`CNS_BRAIN_INDEX_PATH`, `CNS_NODE_BIN`, `CNS_OMNIPOTENT_ROOT`, `CNS_VAULT_ROOT`, embedder env) in `~/.hermes/.env`; restart gateway → recall LIVE. **This also clears the Epic 82 voice gate.**
6. Then: **Epic 80** (auxiliary→Haiku cost, parallel/independent), **Epic 81** (digest + discovery), **Epic 82** (voice). Epics 83–85 are v1.5.

---

## 6. Calibration / env gotchas (you WILL need these)

- **Run env for index + calibrate:**
  ```bash
  export CNS_BRAIN_EMBEDDER=portal
  export CNS_BRAIN_EMBED_MODEL='openai/text-embedding-3-large'
  export CNS_BRAIN_EMBED_API_KEY='local'   # any token; proxy attaches real credential
  export CNS_VAULT_ROOT="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE"
  export CNS_BRAIN_TOKEN_COUNT_BASE_URL=http://127.0.0.1:8645/v1
  export CNS_BRAIN_TOKEN_COUNT_MODEL=anthropic/claude-sonnet-4-6
  ```
- **`brain:index` requires the corpus allowlist** at `<vault>/_meta/schemas/brain-corpus-allowlist.json` (setup prerequisite — already created).
- **Proxy does NOT forward `/v1/messages/count_tokens`** (only chat/completions/embeddings/models) → token measure degrades to `chars/4` estimate (harness marks it `estimate` + warns — graceful). Real-token validation needs a different path (local tokenizer or proxy config). Logged; revisit at go-live.
- **`wsl bash -c` (non-login) lacks nvm node on PATH** → `npm` resolves to Windows `npm.cmd` (CMD.EXE/UNC error). Fix: `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` and call `node_modules/.bin/tsx <script>` directly instead of `npm run`.
- **Vault path has a space** — `[ -d "$VAULT" ]` with a var assignment can break in nested quoting; use the glob `/mnt/c/Users/*/Knowledge-Vault-ACTIVE` or `find`.
- Embeddings model used: `openai/text-embedding-3-large` (3072-dim). Switching models requires a full reindex.

---

## 7. Verification wins this session (why the role matters)

The verifier-reads-source discipline caught, in order: `smart_model_routing` is inert (would've been built-on); ElevenLabs managed-path is OpenAI-only (would've shipped wrong vendor path); the `pre_llm_call` mutation contract (de-risked the P0 seam); a **vacuous** secret-gate test that passed for the wrong reason; the production plugin's **45s-per-turn timeout + missing fail-open + node-not-on-PATH**; and finally the **whole-note recall failure** at calibration. Several of these were on the P0 critical path. Keep reading the actual artifacts.

---

## 8. Locked decisions / constraints (do not re-litigate)

- **Protect-list, zero edits:** `src/agents/{synthesis,hook,boss}-adapter-llm.ts`, `src/agents/run-chain.ts`, `scripts/run-chain.ts`. **No fork of `~/.hermes/hermes-agent` core** — plugin/config seams only.
- Recall plugin is **in-repo-with-install**: source `scripts/hermes-plugin-examples/cns-brain-recall/` → `scripts/install-hermes-plugin-cns-brain-recall.sh` → `~/.hermes/plugins/` (runtime copy, not git). Re-prove `diff -rq` parity after edits.
- `~/.hermes` changes (config/plugin) are **not git-tracked** → stories use the **evidence-file** pattern (78-x style) for done-proof.
- Voice (Epic 82): **Nexus-local primary** (ADR-001 amended), ElevenLabs direct key (ADR-014), SvelteKit `$lib/server` → `:9119` (ADR-013); SPIKE-OMNI-001/002 gate FR10 only.
- Context7 before implementing against any lib/API (NFR7). Reversibility (NFR5). `bash scripts/verify.sh` before every commit. No npm/pip package < 14 days old.
- **v1 success does NOT promise operator-intention inference** (that needs the v1.5 learning loop, Epic 83).

---

## 9. Working style

- Operator runs BMAD in Cursor; verifier reads diffs/evidence/source and gives clear go/no-go.
- **Always write out the full paste-ready Cursor prompt** for the next story (constraints baked in); lead commit/terminal instructions with **repo + branch**.
- One logical change per commit; co-author trailer.
- Be concise and decisive; recommend, don't survey.
