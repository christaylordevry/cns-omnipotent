## Live Chain Smoke Evidence

- Date: 2026-04-22T13:57:54.937Z
- Duration ms: 1910
- Command shape: `CNS_VAULT_ROOT="<staging-vault-root>" FIRECRAWL_API_KEY=[REDACTED] PERPLEXITY_API_KEY=[REDACTED] ANTHROPIC_API_KEY=[REDACTED] tsx scripts/run-chain.ts`
- Vault root class: staging (cns-live-smoke-vault-A1XaoS)
- Brief topic: Creative Technologist remote roles and how to position for them in 2026
- Depth/query count: deep / 3
- Services: Firecrawl configured, Perplexity configured, Anthropic configured

| Stage | Status | Counts |
| --- | --- | --- |
| Research | failed | notes_created=0, notes_skipped=3, perplexity_answers_filed=0 |
  - service/error: urn:cns:research-sweep:firecrawl:query:what%20do%20companies%20actually%20want%20when%20they%20hire%20a%20creative%20technologist
  - service/error: urn:cns:research-sweep:firecrawl:query:creative%20technologist%20remote%20job%20market%202026%20salary%20expectations
  - service/error: urn:cns:research-sweep:firecrawl:query:how%20to%20position%20AI%20skills%20for%20creative%20director%20or%20creative%20technologist%20roles%20reddit
  - service/error: Firecrawl search HTTP 401: {"success":false,"error":"Unauthorized: Invalid token"}
  - service/error: Perplexity search HTTP 401: {"error":{"message":"Invalid API key provided. Ensure your API key is correct and active.","type":"invalid_api_key","code":401}}
  - observation: Perplexity was skipped or unavailable during probe.
| Synthesis | skipped | sources_read_failed=0 |
  - observation: Skipped: no-source-notes
| Hook | skipped | none |
  - observation: Skipped: synthesis-skipped
| Boss | skipped | none |
  - observation: Skipped: hook-skipped

### Retry / Rate-Limit Observations
- None observed in compact evidence.

### Operator Notes
- Baseline Epic 19.1 live smoke against fixture-backed staging vault.
