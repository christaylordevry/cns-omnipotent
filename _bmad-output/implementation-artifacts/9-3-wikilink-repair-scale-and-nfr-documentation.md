# Story 9.3: Wikilink repair scale and NFR documentation (Epic B — Phase 2.0)

Status: done

<!-- Sprint tracker: epic-9 / 9-3-wikilink-repair-scale-and-nfr-documentation -->

## Summary

`docs/architecture.md` adds **Scale: `vault_move` wikilink repair** — O(n) full-vault `.md` scan on CLI fallback, low-thousands operational assumption, preference for `CNS_OBSIDIAN_CLI`. Updates the **Convergence escape hatch** paragraph to reference the shared `src/pake/schemas.ts` module instead of “Epic B territory” as future-only work.

## Verification

- `bash scripts/verify.sh` passed (2026-04-04).
