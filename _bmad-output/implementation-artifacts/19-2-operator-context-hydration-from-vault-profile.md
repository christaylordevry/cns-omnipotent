# Story 19-2: Hydrate OperatorContext from Vault Profile Note

## Status: done
## Commit: feat(19-2): hydrate OperatorContext from vault profile note

## What was built
- Added `loadOperatorContextFromVault(vaultRoot: string): Promise<OperatorContext>` to `src/agents/vault-context-builder.ts`
- Reads `03-Resources/Operator-Profile.md` via `vaultReadFile`, parses frontmatter with `gray-matter`
- Maps: `operator_name→name`, `operator_location→location`, `operator_positioning→positioning`, `operator_tracks→tracks`, `operator_constraints→constraints`
- Validates with `operatorContextSchema.safeParse()` — returns `DEFAULT_OPERATOR_CONTEXT` on any failure, never throws
- `run-chain.ts` updated to call `loadOperatorContextFromVault(vaultRoot)` instead of hardcoded default
- 4 tests added: valid profile, missing file, invalid frontmatter, bad tracks shape
- Vault note created: `03-Resources/Operator-Profile.md` with all required frontmatter keys

## Acceptance criteria met
- 514 tests passing (PERPLEXITY_API_KEY="" bash scripts/verify.sh)
- Live run no longer fires `> [!warning] No vault context found` when Operator-Profile.md is present
