# Story 21.1 Final Live Chain Evidence: Green Run

Date captured: 2026-04-30T00:41:40.807Z

Command:

```bash
source .env.live-chain && CNS_VAULT_ROOT="/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE" npx tsx --no-cache scripts/run-chain.ts --topic "creative technologist consulting rates Sydney 2026"
```

## Live Chain Smoke Evidence

- Date: 2026-04-30T00:41:40.807Z
- Duration ms: 256673
- Command shape: `CNS_VAULT_ROOT="<staging-vault-root>" CNS_BRIEF_TOPIC="<brief-topic>" FIRECRAWL_API_KEY=[REDACTED] APIFY_API_TOKEN=[REDACTED] SCRAPLING_COMMAND="scrapling" PERPLEXITY_API_KEY=[REDACTED] ANTHROPIC_API_KEY=[REDACTED] tsx scripts/run-chain.ts [--brief-file path] [--evidence-file path] [--operator-note text]`
- Vault root class: active (Knowledge-Vault-ACTIVE)
- Brief topic: creative technologist consulting rates Sydney 2026
- Depth/query count: deep / 3
- Services: Firecrawl configured, Apify configured, Scrapling configured, Perplexity configured, Anthropic configured

| Stage | Status | Counts |
| --- | --- | --- |
| Research | ok | notes_created=5, notes_skipped=23, perplexity_answers_filed=3 |
| Synthesis | ok | sources_used=5, sources_read_failed=0 |
| Hook | ok | options=4, total_iterations=12 |
| Boss | ok | options=4, total_iterations=4 |

## Generated Notes

- Research: `03-Resources/salary-creative-technologist-in-sydney-australia-2026-glassdoor.md`
- Research: `03-Resources/salary-creative-technologist-in-sydney-2026-glassdoor.md`
- Research: `03-Resources/perplexity-creative-technologist-consulting-rates-sydney-2026-creative-technologist-consulting-rates-sydney-2026-2026-04.md`
- Research: `03-Resources/perplexity-creative-technologist-consulting-rates-sydney-2026-reddit-com-creative-technologist-consulting-rates-sydney-2.md`
- Research: `03-Resources/perplexity-creative-technologist-consulting-rates-sydney-2026-creative-technologist-consulting-rates-sydney-2026-bot-pro.md`
- Synthesis: `03-Resources/synthesis-creative-technologist-consulting-rates-sydney-2026-2026-04-30.md`
- Hooks: `03-Resources/hooks-creative-technologist-consulting-rates-sydney-2026-2026-04-30.md`
- Weapons: `03-Resources/weapons-check-creative-technologist-consulting-rates-sydney-2026-2026-04-30.md`

## Quality Contract

- PAKE++ validation: PASS
- InsightNote path: `03-Resources/synthesis-creative-technologist-consulting-rates-sydney-2026-2026-04-30.md`
- Summary result: PASS

## Read-Back Validation

- synthesis: `03-Resources/synthesis-creative-technologist-consulting-rates-sydney-2026-2026-04-30.md` (ok)
- hooks: `03-Resources/hooks-creative-technologist-consulting-rates-sydney-2026-2026-04-30.md` (ok)
- weapons: `03-Resources/weapons-check-creative-technologist-consulting-rates-sydney-2026-2026-04-30.md` (ok)

## Operator Notes

- Brief routing triggers: social-domain query count=1; Scrapling tier configured for post-Firecrawl/Apify acquisition attempts. Stale generated chain notes cleaned before run: removed=5, skipped=0.
- Scrapling adapter disabled because command was not found on PATH: `scrapling`.
- Retry / rate-limit observations: none observed in compact evidence.

## Service Notes

The Research stage created usable source notes and completed as `ok`. Some Apify snippet candidates were skipped and recorded as compact service/error URNs in the terminal evidence. No credentials or bearer tokens were printed.
