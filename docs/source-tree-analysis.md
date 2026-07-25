# Source Tree Analysis — Multi-Part CNS

**Updated:** 2026-07-25

## Omnipotent.md (control)

```
Omnipotent.md/
├── src/                         # Vault IO MCP (entry: index.ts)
│   ├── register-vault-io-tools.ts
│   ├── write-gate.ts
│   ├── tools/                   # vault_* implementations
│   ├── pake/                    # schemas + validation
│   ├── brain/                   # recall / embedder
│   ├── agents/                  # run-chain
│   └── routing/ adapters/
├── scripts/                     # DATA SPINE writers
│   ├── run-digest-convex-completion.mjs
│   ├── push-digest-watchdog.mjs
│   ├── trend-ingest.py
│   ├── dashboard-sync.ts
│   ├── hermes-awareness-pull.ts
│   ├── install-*-cron.sh / run-*-cron.sh
│   ├── session-close/
│   ├── hermes-skill-examples/
│   └── verify.sh
├── specs/cns-vault-contract/    # Constitution + Phase specs
├── _bmad-output/
│   ├── planning-artifacts/
│   │   ├── brownfield/          # Phase 0 docs (THIS SCAN)
│   │   └── nexus-unified-app-master-plan.md
│   └── implementation-artifacts/
├── docs/                        # AI retrieval index
└── Knowledge-Vault-ACTIVE/      # CI fixture ONLY
```

## cns-dashboard (app)

```
cns-dashboard/
├── src/
│   ├── routes/
│   │   ├── nexus/               # LIVE: /, investigate, entities
│   │   ├── trends/              # ORPHAN from Nexus nav
│   │   └── api/                 # hermes proxy + trends AI
│   ├── lib/
│   │   ├── components/nexus/    # cockpit, board, sidebar, orphans
│   │   └── styles/cns-tokens.css  # INSTRUMENT SSOT
│   └── …
├── convex/
│   ├── schema.ts                # 25 tables
│   ├── digest.ts                # 11 fns
│   ├── trendIntelligence.ts     # largest module
│   ├── hermesAwareness.ts
│   ├── http.ts                  # GET /hermes/awareness
│   └── crons.ts                 # hourly analytics
└── …
```

## Hermes runtime

```
~/.hermes/
├── config.yaml
├── skills/cns/                  # 14 skills
│   └── morning-digest/scripts/score-digest-signals.mjs
├── hooks/morning-digest-convex-completion/
├── logs/
├── digest-push-*.json
├── digest-outcomes/
└── memories/awareness-snapshot.json
```

## Integration points

| From | To | Mechanism |
|------|-----|-----------|
| Omnipotent scripts | Convex | deploy key mutations |
| Hermes | Vault | MCP `cns_vault_io` |
| Hermes | Convex awareness | HTTP GET + pull cron |
| Dashboard | Convex | PUBLIC_CONVEX_URL reactive queries |
| Dashboard | Hermes | local API proxy (voice/ws) |

Critical folders for architecture: `scripts/` (writers), `convex/` (schema+fns), `src/routes` + `NexusSidebar.svelte` (surfaces), `~/.hermes/skills/cns` (operator skills).
