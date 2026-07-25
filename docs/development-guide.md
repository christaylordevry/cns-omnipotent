# Development Guide — CNS Multi-Part

**Updated:** 2026-07-25

## Prerequisites

- Node 20+ (dashboard prefers 24 per `.nvmrc`)
- WSL2 with vault mount at `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`
- Hermes installed; crontab for digests/trends
- Convex access to prod `amiable-ox-862` (or local split per dashboard docs)

## Omnipotent.md

```bash
cd /home/christ/ai-factory/projects/Omnipotent.md
npm install
bash scripts/verify.sh    # must pass before done
npm run dev               # MCP stdio — set CNS_VAULT_ROOT
```

Safe edit policy: ask before MCP signature changes, audit path, `security.md`, bulk refactors.  
Constitution edits: sync `specs/cns-vault-contract/AGENTS.md` **and** vault `AI-Context/AGENTS.md` together; never via WriteGate-blocked vault_io for AGENTS.

## cns-dashboard

```bash
cd /home/christ/ai-factory/projects/cns-dashboard
npm install
npm test
# PUBLIC_CONVEX_URL=https://amiable-ox-862.convex.cloud for live Nexus data
```

Design: INSTRUMENT tokens only for new Nexus work. Honesty primitives — no fabricated confidence/sparklines.

## Hermes ops

- Gateway watchdog every 3 min
- Morning digest 07:00 Sydney via Omnipotent `run-morning-digest-cron.sh`
- Logs under `~/.hermes/logs/`
- Skills install from `scripts/install-hermes-skill-*.sh`

## Architecture next step

Point `/bmad-create-architecture` at:

`_bmad-output/planning-artifacts/brownfield/00-index.md`
