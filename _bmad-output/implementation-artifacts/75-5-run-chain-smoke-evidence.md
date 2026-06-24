## Live Chain Smoke Evidence

- Date: 2026-06-24T17:21:09.593Z
- Duration ms: 245282
- Command shape: `CNS_VAULT_ROOT="<staging-vault-root>" CNS_BRIEF_TOPIC="<brief-topic>" FIRECRAWL_API_KEY=[REDACTED] APIFY_API_TOKEN=[REDACTED] SCRAPLING_COMMAND="scrapling" PERPLEXITY_API_KEY=[REDACTED] ANTHROPIC_API_KEY=[REDACTED] tsx scripts/run-chain.ts [--brief-file path] [--evidence-file path] [--operator-note text]`
- Vault root class: active (Knowledge-Vault-ACTIVE)
- Brief topic: CNS run-chain revival smoke 2026-06
- Depth/query count: shallow / 1
- Services: Firecrawl configured, Apify configured, Scrapling configured, Perplexity configured, Anthropic configured

| Stage | Status | Counts |
| --- | --- | --- |
| Research | ok | notes_created=2, notes_skipped=3, perplexity_answers_filed=0 |
  - generated: urn:cns:chain:ephemeral:apify:ff122f4a-2088-475f-be1e-8fe4a52bf7a8
  - generated: urn:cns:chain:ephemeral:apify:4bd946a4-163e-4175-b89a-d1eefa7a8df7
  - observation: Perplexity was skipped or unavailable during probe.
| Synthesis | ok | sources_used=2, sources_read_failed=0 |
  - generated: 03-Resources/synthesis-cns-run-chain-revival-smoke-2026-06-2026-06-24.md
| Hook | ok | options=4, total_iterations=20 |
  - generated: 03-Resources/hooks-cns-run-chain-revival-smoke-2026-06-2026-06-24.md
| Boss | ok | options=4, total_iterations=9 |
  - generated: 03-Resources/weapons-check-cns-run-chain-revival-smoke-2026-06-2026-06-24.md

### Synthesis Quality Contract (PAKE++)
- PAKE++ validation: PASS
- InsightNote path: 03-Resources/synthesis-cns-run-chain-revival-smoke-2026-06-2026-06-24.md

### Retry / Rate-Limit Observations
- None observed in compact evidence.

### Operator Notes
- Brief routing triggers: social-domain query count=0; Scrapling tier configured for post-Firecrawl/Apify acquisition attempts. Stale generated chain notes cleaned before run: removed=0, skipped=0.
