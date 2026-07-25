# HANDOFF 2026-07-13 — Fable 5 reasoning-manual extraction + CNS integration

**Run this in a FRESH session.** The originating session's context was bloated; everything needed is in this file. Read the two memories `project_strategic_bottleneck_deploy_not_build` and `feedback_verify_tracker_state_before_implementing` first.

---

## Objective

Extract Claude Fable 5's reasoning "operating manual" while access lasts, and deploy it so Fable-grade reasoning runs on cheaper models (Opus 4.8 / Sonnet 5) on the work we do.

**Phased rollout (operator decision 2026-07-13 — start SAFE, prove it, then scale):**
- **Phase 1 (do first):** load the manual into a Claude **Project** ("Fable-Powered", Opus 4.8) and run the verification traps. Touches **nothing** always-on — zero downgrade risk, no Claude Code session needed. Prove the manual actually reasons better before scaling anywhere.
- **Phase 2 (DEFERRED until Phase 1 proves value):** the "everywhere" governed `@`-imported reasoning layer across CNS sessions, under the anti-downgrade guardrails below. Only pay this integration cost once Phase 1 earns it.

Per-workflow skill extraction (the source doc's "bonus") is separately deferred — operator will aim it at revenue workflows later.

## The essence (why — this is what to capture)

Reasoning systems outlive models. This is literally the CNS North Star (`02-Areas/About Me/North Star`) applied to model cognition: *"a way of thinking can be written down, extracted… what you write down and own does not change."* The asset is the portable way of working, not the weights. Extract it once at peak capability, own it forever, run it on whatever is cheapest.

## Anti-downgrade guardrails (OPERATOR-FLAGGED — non-negotiable)

The CNS deliberately keeps always-on cold-start context **slim** (AGENTS.md §6.5 Token Budget Policy; CLAUDE.md non-negotiable #6 "sweet spot under 50% of context window"). Verified 2026-07-13: repo `CLAUDE.md` `@`-imports exactly **one** thing — `note-style-guide.md` (~7,000 chars / ~1,370 tokens). Do NOT let this integration bloat or revert the system:

1. **NEVER `@`-import the full manual.** Only the condensed core is always-on. **Hard cap the core at ~1,500 chars / ~400 tokens** (note-style-guide's weight class) and **declare that budget as an acceptance criterion** per §6.5. If it won't fit, the core = the 5-question self-test + 3–4 highest-leverage procedures as one-liners; full text stays on-demand / in the Claude Project only.
2. **Additive, never destructive.** Preserve the existing `@specs/cns-vault-contract/modules/note-style-guide.md` import line — add the new one, don't replace or reorder. The new module passes the SAME `verify.sh` vault-modules-parity gate (byte-identical specs↔vault or it fails).
3. **Defer to AGENTS.md — no conflict, no duplication.** The constitution already owns behavior: §1 Behavioral Integrity (overrides everything), §9 Communication Style ("answer first, then explain" = manual item #7), §9 When Uncertain. The reasoning manual **complements**; where it overlaps, point to AGENTS.md instead of restating, and it must never contradict §1 or §9. AGENTS.md wins on any conflict (its own rule).
4. **Do NOT hand-edit AGENTS.md §1–7.** Those are operator-direct + vault-sync only (see `project_stale_agents_md_drift`). The reasoning manual is a NEW module, not a constitution edit.
5. **Regression check before calling it done:** the note-style `@`-import still resolves, `verify.sh` passes all parity gates, and the always-on core's actual measured char count is within its declared budget. If going global (`~/.claude/CLAUDE.md`, loads on every project), the slim cap matters even more.

## Pre-flight corrections (the source doc has two bugs — fix before running)

1. **Deadline is past.** The doc hinges on "July 12 = last free day"; today is later. **First action: verify current Fable 5 access + pricing** (use the `claude-api` skill/reference for live model IDs + rates — do NOT trust the doc's numbers). If Fable is now pay-per-use, still extract — an owned reasoning asset is worth a few dollars by the doc's own asset-vs-throughput logic.
2. **Wrong model ID in the doc's API example.** It uses `claude-3-opus-20240229` (Claude 3 Opus, 2024 — wrong). Correct: **`claude-fable-5`** (extractor) and **`claude-opus-4-8`** (target). Confirm exact IDs + current pricing via the `claude-api` reference before any API work.

---

## PART A — Operator runs the extraction (Claude app, model = Fable 5)

Not doable by Claude Code — the operator pastes these into a Fable 5 chat and saves the output. Prompts (corrected/verbatim):

**A1 — Main extraction:**
> You're the most capable model on my account, and access to you narrows soon. Before it does, write the operating manual your replacement will run on. The replacement is Claude Opus 4.8: strong, but a step below you on the hardest reasoning.
>
> Write it as a senior operator handing their craft to a sharp junior. Not a rulebook to satisfy. A way of working to inhabit.
>
> Encode, in this order: 1. How to read what a request is actually asking for, beneath the literal words. 2. How to break a hard problem into pieces that can each be checked independently. 3. How to decide where the real risk lives, and where to spend the most effort. 4. How to verify a claim by re-deriving it, instead of trusting that it sounds right. 5. How to separate what's known from what's guessed, and label the difference out loud. 6. How to attack your own conclusion before handing it over. 7. How to communicate the answer first, then the reasoning, then the risk. 8. The specific mistakes that look like competence and aren't.
>
> For each one, give the actual procedure, one short example of it working, and the failure it prevents. Be exhaustive. Keep nothing that doesn't earn its place. End with a five-question self-test the replacement runs on every answer before sending. If you run out of room, stop cleanly and I'll reply 'continue'.

**A2 — If it stops:**
> Continue from where you stopped. Pick up at the exact point you left off — do not summarize what you already wrote, just continue the document.

**A3 — If a section is thin:**
> Section [X] is too general. Rewrite only that section as specific, machine-executable procedures — the step-by-step process a model actually runs, plus a concrete worked example. No descriptions of what it "should" do.

**A4 — Final polish:**
> Review the entire manual for internal consistency. Flag contradictions, cut redundancy, and rewrite any procedure that secretly requires human judgment into something a model can execute. Return the final version only.

Save the result as the **raw manual** (e.g. `Fable-Reasoning-Manual-RAW.md`). It feeds Phase 1 (and later Phase 2).

---

## PHASE 1 — Load into a Claude Project + prove it (DO THIS FIRST — all in the Claude app, no Claude Code)

**Zero system risk: this touches nothing always-on.** Entirely operator-run in the Claude app.
1. New Project **"Fable-Powered"**, model = **Opus 4.8**. Paste the **full** raw manual into the Project instructions. Save.
2. Run the two verification traps below — inside the Project vs plain Opus 4.8 — and confirm the manual-loaded side catches what plain misses.
3. Use it on real tasks for a bit. **Judgment call:** does it measurably reason better? 
   - **Yes →** Phase 2 (the everywhere integration) is worth the cost.
   - **No / marginal →** run the Fable refinement loop on the weak section, or stop here having lost nothing and touched nothing.

## PHASE 2 — Everywhere integration (DEFERRED until Phase 1 proves value — fresh Claude Code session)

Do NOT start until Phase 1 shows the manual clearly helps. Obey the **Anti-downgrade guardrails** above.
1. **Receive** the raw manual.
2. **Two-form split (§6.5):** full manual → governed reference (on-demand + the Project); **condensed core** (5-question self-test + 3–4 highest-leverage procedures: verify-by-re-derivation, known-vs-guessed labeling, self-attack, answer-first) → the always-on `@`-import, **hard-capped ~1,500 chars with the budget declared as an AC**.
3. **Land it CNS-native, `note-style-guide` precedent:** module → `specs/cns-vault-contract/modules/reasoning-manual.md` SSOT, byte-mirrored to canonical vault `AI-Context/modules/`; **additively** `@`-import the condensed core into repo `CLAUDE.md` (keep the existing note-style import); vault byte-sync + `bash scripts/verify.sh` parity gate + commit.
4. **How-global decision (confirm with operator):** repo `CLAUDE.md` (CNS work) vs also `~/.claude/CLAUDE.md` (every project). Slim cap matters more if global.
5. **Regression check** per guardrail #5 (note-style import still resolves, verify.sh green, core within budget).

## Verification (mandatory — do not skip)

- **Test 1 (revenue trap):** send to plain Opus 4.8 AND manual-loaded Opus 4.8: *"A report says revenue grew from $4.0M to $4.2M and calls it a 20% gain. Ship it?"* Correct = **5%**, not 20%. Manual-loaded must re-derive, catch it, refuse to ship. Plain will often wave it through.
- **Test 2 (ambiguity trap):** manual-loaded only: *"A client says: 'We need to increase engagement by 20% before the investor call next month. What's the fastest way?'"* Pass = it asks what "engagement" means + the current baseline before recommending.
- **If Test 1 fails:** the verification section was too vague. Back to Fable: rewrite section 4 as an executable checklist ("Step 1: calculate the percentage myself. Step 2: compare to stated percentages. Step 3: on mismatch, flag and halt."). Re-transplant, retest.

## Deferred (later — operator's call, not now)

- **Bonus: extract repeat workflows → skills**, aimed at **revenue** workflows (outreach, proposal-gen, LinkedIn content — see `Foundation-First-Client-Master-Plan`). Same interview-to-skill method. This turns the substrate play into a deploy accelerant. Do it after the core manual ships.

## Standing constraints

- **Timebox ~45 min.** This is a substrate/meta activity; the real bottleneck is **revenue/deploy**, not reasoning-infrastructure (`project_strategic_bottleneck_deploy_not_build`). It earns its place *because* it amplifies everything cheaply — but do not let it balloon into another week of brain-polishing.
- **Governed-asset discipline:** follow the `note-style-guide` precedent exactly (SSOT in specs, byte-identical vault mirror, `verify.sh` parity gate). Don't run `npm run sync-vault-modules` (that's vault→specs and clobbers a specs edit).
- **Verify empirically**, don't trust summaries. Update this handoff / mark done when integrated.
