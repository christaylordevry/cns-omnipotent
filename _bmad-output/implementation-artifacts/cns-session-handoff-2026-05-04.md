# CNS session handoff — 2026-05-04

**Audience:** Fresh Cursor chat / next operator session.  
**Epic 26 — Hermes CNS Integration:** **Closed.** Stories **HI-1 through HI-8** are **done** in `_bmad-output/implementation-artifacts/sprint-status.yaml` (`epic-26: done`).

---

## Git state (this repo, end of session)

- **Branch:** `master`, tracking `origin/master` (last pushed commit before this close-out: `c60f91b` — partial Epic 26 retro / HI-1 reconcile).
- **Pending working tree (intended to land in one commit with this handoff):**  
  - **Modified:** `.gitignore` (ignore `Knowledge-Vault-ACTIVE/00-Inbox/hermes-morning-digest-*.md`), `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml`.  
  - **New:** Epic **26.2–26.8** story artifacts under `_bmad-output/implementation-artifacts/`, Hermes morning-digest **scripts** (`scripts/hermes-morning-digest*.sh|md|py`, `scripts/install-hermes-morning-digest-job.sh`, `scripts/hermes-skill-examples/`), and **this handoff** file.

---

## Completed this session (Epic 26 closure arc)

- **HI-2–HI-8** implementation artifacts and sprint lines brought to **`done`**; **epic-26 → `done`** (no remaining `26-*` stories in sprint).
- **HI-6:** URL ingest skill `hermes-url-ingest-vault`, Discord channel bindings, E2E to governed `03-Resources/` note + `vault_append_daily` (evidence in story `26-6` Dev Agent Record).
- **HI-7:** Mode B morning digest (Sydney civil date → `00-Inbox/hermes-morning-digest-YYYY-MM-DD.md`), WSL cron with `CRON_TZ=Australia/Sydney`, Hermes cron job install script, launcher + inject script for Hermes `--script` filename constraint; Operator Guide **§15.2** + Version History **1.15.0**.
- **HI-8:** Skill capture workflow documented; example skill `hermes-cns-verify-gate-summary` (operator FS + optional repo mirror under `scripts/hermes-skill-examples/`).
- **Operator guide** updates for Hermes Discord recap, digest, cron line, gateway failure posture.

---

## Key environment facts (Christopher / WSL2 host)

| Topic | Fact |
|--------|------|
| **Hermes home / config** | **`~/.hermes/`** — `config.yaml`, `.env`, `memories/`, `skills/`, `scripts/` (see HI-1 Dev Agent Record). Epic-aligned dir **`/home/christ/ai-factory/hermes/`** exists but is effectively unused for runtime; Hermes uses `~/.hermes/`. |
| **Hermes CLI / version** | **`hermes version`** observed in stories: **Hermes Agent v0.12.0 (2026.4.30)** (re-verify after upgrades). |
| **Model (OpenRouter)** | **`anthropic/claude-sonnet-4.6`** (HI-1 operator verification). |
| **Vault root in Hermes** | **`/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`** (same logical tree as `CNS_VAULT_ROOT` for MCP). |
| **MEMORY / USER symlinks** | Hermes **`~/.hermes/memories/MEMORY.md`** and **`USER.md`** → vault **`AI-Context/`** copies (operator FS only; not Vault IO mutators). Canonical vault path example: **`…/Knowledge-Vault-ACTIVE/AI-Context/MEMORY.md`**. |
| **`#hermes` channel ID** | **`1500733488897462382`** (text channel). Guild ID (from HI-7 evidence, redacted URL only): **`1484880486122913802`**. |
| **`~/.hermes/config.yaml` listen scope** | **`discord.allowed_channels`** and **`discord.free_response_channels`** set to the `#hermes` channel ID (HI-5 recap in Operator Guide §15.1). |
| **Hermes morning digest cron job ID** | **`0ace9892ef3d`** (from HI-7 Dev Agent Record); persisted on host at **`~/.hermes/morning-digest-cron-job-id`**. |
| **WSL crontab** | **`0 7 * * *`** with **`CRON_TZ=Australia/Sydney`**, calling **`/home/christ/ai-factory/projects/Omnipotent.md/scripts/hermes-morning-digest.sh`** (adjust if clone path moves). Log: **`~/.hermes/logs/morning-digest-cron.log`**. |
| **Skills tree (CNS)** | Under **`~/.hermes/skills/cns/`**: **`hermes-url-ingest-vault/`** (HI-6 reference layout: `SKILL.md`, `references/ingest-prompt-block.md`), **`hermes-cns-verify-gate-summary/`** (HI-8 worked example). Repo mirrors for copy-install: **`scripts/hermes-skill-examples/`**. |

---

## Stale context — correct next session

**Symptom:** The **2026-05-04** Hermes morning digest inbox file **`Knowledge-Vault-ACTIVE/00-Inbox/hermes-morning-digest-2026-05-04.md`** still reads like **HI-5 is open** (“bind `discord.allowed_channels`… live reply proof”) and pitches **Epic 16 Tier 1 MCP** as the immediate front. That contradicts **`sprint-status.yaml`**, where **HI-5 is `done`** and **Epic 26 is `done`**.

**Why it matters:** That digest is a **Mode B** artifact Hermes/agents may skim for “what’s true today.” Treat it as **stale narrative**, not source of truth.

**Fix (operator FS):**

1. Edit or replace the digest file’s **[!abstract] / Today focus / Open loops** so Epic **26** is recorded **closed (HI-1–HI-8 done)** and HI-5 is **not** listed as a gate.  
2. If any **summary was copied into `AI-Context/MEMORY.md`** on a machine that diverged from the short canonical file, reconcile **MEMORY.md** the same way (Epic 26 closed; no “close HI-5” bullet).  
3. Optional: run the next digest after prompt tightening so **new** inbox files do not resurrect old templates.

**Source of truth for story state:** `_bmad-output/implementation-artifacts/sprint-status.yaml` and the per-story files **`26-*-hermes-*.md`**.

---

## Next session — suggested order

1. **Install Cursor CLI** (operator goal for automation / headless workflows — not tracked as an Epic 26 story).  
2. **Fix stale operator-facing state:** **`MEMORY.md`** (if needed) + **morning digest markdown** under `00-Inbox/` as above.  
3. **Epic 27 planning** (BMAD / sprint — scope TBD in fresh session).

---

## Quick links

- Operator runbook: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (Hermes §15).  
- Constitution mirror: `specs/cns-vault-contract/AGENTS.md` (+ vault dual-copy rule if editing).  
- Verify gate (Omnipotent implementation): `bash scripts/verify.sh`.
