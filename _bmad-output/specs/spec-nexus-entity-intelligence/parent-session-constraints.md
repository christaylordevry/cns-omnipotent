# Constraints Carried Over from Parent Session

Do not relitigate without cause. Verbatim from source (`docs/brainstorming.md`).

- **No new ScrapeCreators/external adapter** — this is explicitly an analysis stage on existing collected signals, not a new digest source. Do not wedge this into the Epic 72 source-registry/three-list-class pattern used for TikTok/Instagram/Pinterest/Polymarket/Threads/LinkedIn — that pattern is for adapters with new external API dependencies.

- **No dependency on the parked LLM provider question** — the research-chain's `ANTHROPIC_API_KEY` is currently dead and that decision (fix vs. migrate to OpenRouter/subscription routing) is intentionally unresolved. This feature must not require any LLM call to ship v1.

- **Validator/registry-drift discipline** — if this feature does add new Convex tables/mutations, apply the same lesson learned today from three separate incidents (viewCount validator desync, Pinterest/Polymarket health-registry omission, Threads/LinkedIn missing-env-var gap): confirm every field actually round-trips through the real mutation validator via a canonical fixture, and confirm any new health/status surface is actually wired and live-verified against prod, not just passing local tests.
