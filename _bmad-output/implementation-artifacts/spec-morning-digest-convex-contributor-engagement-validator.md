---
title: 'morning-digest-convex-contributor-engagement-validator'
type: 'bugfix'
created: '2026-06-20T12:31:00+10:00'
status: 'done'
context:
  - '{project-root}/project-context.md'
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent -- do not modify unless human renegotiates">

## Intent

**Problem:** The 2026-06-20 morning digest collection succeeds, but every Convex push fails after several signal writes with `ArgumentValidationError: Object contains extra field viewCount`. The root cause is not a missing top-level `sourceMetadata.viewCount` validator: production accepts that field. The failing field is `sourceMetadata.contributingSources[].viewCount`, emitted by the dedupe provenance stage for merged YouTube/TikTok/Instagram clusters.

**Approach:** Preserve contributor engagement metadata because it is useful provenance and already intentionally emitted by `dedupe-digest-signals.mjs`. Update the actual Convex mutation validator for nested contributing-source entries, add a regression test with the failed artifact shape, deploy the dashboard Convex functions, then prove a live push for today's digest reaches a non-failed status.

## Boundaries & Constraints

**Always:** Keep the fix scoped to the digest signal validator/test path; confirm the real mutation is `digest:addDigestSignal`; verify against production Convex after deploying.

**Ask First:** Any change that strips adapter payload data, rewrites dedupe/scoring, changes public mutation signatures, or consumes extra ScrapeCreators credits beyond the final live proof.

**Never:** Do not refactor Sources 1-15, do not modify unrelated dashboard UI, do not touch pre-existing dirty files except this related spec, and do not report done until production `digest:getRecentDigestRuns` shows today's latest run is not failed.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Merged short-form/youtube cluster | `digest:addDigestSignal` receives `sourceMetadata.contributingSources[]` rows containing `viewCount`, `comments`, `commentCount`, `likes`, `publishedAt` | Mutation accepts and stores the signal | Invalid unrelated fields still reject through Convex validators |
| Today's live retry | Full morning digest cron rebuild/push for `2026-06-20` | Convex latest run for today is `published` or otherwise not `failed` | If live push fails, inspect exact new validator path before any second live attempt |

</frozen-after-approval>

## Code Map

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-youtube-signals.mjs` -- Source 13 adapter; emits `videos[].viewCount`, `likeCount`, and `commentCount`.
- `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs` -- Maps adapter output into `signal.sourceMetadata.viewCount`, not a top-level signal field.
- `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs` -- Merges duplicate clusters and writes `sourceMetadata.contributingSources[]` entries from `ENGAGEMENT_FIELDS`, including `viewCount` and `comments`.
- `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` -- Posts each signal to Convex path `digest:addDigestSignal`.
- `../cns-dashboard/convex/digest.ts` -- Actual public mutation; imports `digestSignalInputValidator`.
- `../cns-dashboard/convex/validators.ts` -- Actual mutation arg validator and nested contributor schema to patch.
- `../cns-dashboard/tests/convex/digest.test.ts` -- Regression coverage for accepted digest signal shapes.

## Tasks & Acceptance

**Execution:**
- [x] `../cns-dashboard/convex/validators.ts` -- add `viewCount` and `comments` to `sourceMetadataValidator.contributingSources[]` -- match the real dedupe `ENGAGEMENT_FIELDS` output.
- [x] `../cns-dashboard/tests/convex/digest.test.ts` -- add regression for merged contributor provenance with `viewCount` -- catch the exact production failure before deploy.
- [x] Verification commands -- run targeted dashboard tests, full verify, deploy Convex production functions, and run one live digest retry -- prove the fix in production.

**Acceptance Criteria:**
- Given a merged digest signal includes `sourceMetadata.contributingSources[].viewCount`, when `digest:addDigestSignal` validates it, then the mutation accepts and stores it.
- Given TikTok/Instagram contributor rows include the same engagement keys, when the mutation validates them, then no analogous extra-field failure is waiting behind YouTube.
- Given today's digest is retried once after deploy, when `digest:getRecentDigestRuns {"limit":1} --prod` is queried, then the latest 2026-06-20 run status is not `failed`.

## Spec Change Log

## Design Notes

The correct fix is server-side validator alignment, not payload stripping: `contributingSources[]` is merge provenance consumed by the inspector/feed layer, and the dedupe stage intentionally copies all engagement metrics listed in `ENGAGEMENT_FIELDS`.

## Verification

**Commands:**
- `npm test -- tests/convex/digest.test.ts` in `../cns-dashboard` -- expected: pass.
- `bash scripts/verify.sh` in `Omnipotent.md` -- expected: pass.
- `npx convex deploy` in `../cns-dashboard` -- expected: production function spec includes nested contributor `viewCount`.
- Live cron command from the operator brief -- expected: one successful push.
- `npx convex run digest:getRecentDigestRuns '{"limit":1}' --prod` in `../cns-dashboard` -- expected: latest run for `2026-06-20` is not `failed`.
