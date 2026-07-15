---
phase: 01-openclerk-core-dependency-cleanup
plan: 01
subsystem: infra
tags: [openclerk-core, npm, dependency-cleanup, hallucination-check, jest, webpack]

# Dependency graph
requires: []
provides:
  - "main branch depends on the published openclerk-core npm package (^0.2.6) instead of vendoring its logic"
  - "confirmed post-merge build (webpack production) and test (jest) both pass"
  - "confirmed the hallucination-check Core Value guard (checkCitationsForHallucinations / nameMismatch) survived the merge intact, with no orphaned old hand-rolled implementation"
affects: [openclerk-core-dependency-cleanup, word.ts-workflows, provider-dedup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "openclerk-core is now the single source of truth for bluebook rules, citation providers, and hallucination-check logic -- src/taskpane/word.ts imports all of it from the npm package rather than local ./bluebook, ./providers, ./utils modules"

key-files:
  created: []
  modified:
    - "package.json (openclerk-core dependency, already bumped to ^0.2.6 by PR #33)"
    - "package-lock.json (openclerk-core resolved to registry.npmjs.org/openclerk-core-0.2.6.tgz, already updated by PR #33)"

key-decisions:
  - "PR #33 merged via GitHub 'Create a merge commit' strategy (commit 0f48462) per decision D-01, preserving the 4 original PR commits including the checkCitationsForHallucinations migration rationale."
  - "Verified openclerk-core resolves strictly from the public npm registry (not a git/tarball/local override) before treating the supply-chain trust boundary (T-01-01/T-01-SC) as satisfied."

requirements-completed: [CORE-01]

coverage:
  - id: D1
    description: "PR #33 merged to main as a genuine merge commit with 4 discrete original commits reachable, not a squash or rebase"
    requirement: "CORE-01"
    verification:
      - kind: other
        ref: "git merge-base --is-ancestor 0f48462 HEAD; git show --stat 0f48462 (Merge pull request #33 from OpenClerkProject/claude/depend-on-openclerk-core)"
        status: pass
    human_judgment: false
  - id: D2
    description: "package.json/package-lock.json pin openclerk-core to ^0.2.6 resolved from the public npm registry, and npm ci/build/test all succeed"
    requirement: "CORE-01"
    verification:
      - kind: other
        ref: "npm ci (added 1421 packages, 0 vulnerabilities); npm ls openclerk-core (0.2.6); package-lock.json resolved field (https://registry.npmjs.org/openclerk-core/-/openclerk-core-0.2.6.tgz)"
        status: pass
      - kind: other
        ref: "npm run build (webpack --mode production, exit 0, 3 non-blocking bundle-size warnings only)"
        status: pass
      - kind: unit
        ref: "npm test (tests/manifest.test.ts, tests/installer.test.ts -- 2 suites passed, 5 passed / 2 skipped, 7 total)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hallucination-check Core Value guard (checkCitationsForHallucinations import/call, nameMismatch rendering branch, 'Possible hallucination' string) preserved verbatim in src/taskpane/word.ts, with no orphaned old hand-rolled type/loop left duplicated"
    requirement: "CORE-01"
    verification:
      - kind: other
        ref: "grep -c 'checkCitationsForHallucinations' src/taskpane/word.ts == 3 (import, comment, call site); grep -c 'nameMismatch' == 2; grep -c 'Possible hallucination' == 1; no standalone old 'HallucinationResult' type found anywhere in src/ (3 substring hits are all part of the current renderHallucinationResults function name, not the deleted old type)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-15
status: complete
---

# Phase 01 Plan 01: PR #33 Merge Verification Summary

**Confirmed main now depends on the published openclerk-core@0.2.6 npm package (not vendored logic), with build/test green and the hallucination-check Core Value guard intact post-merge.**

## Performance

- **Duration:** 25 min (across two executor sessions; this session resumed from Task 2)
- **Started:** 2026-07-15T22:47:31Z (per STATE.md session start)
- **Completed:** 2026-07-15T23:21:40Z
- **Tasks:** 3 (1 human checkpoint, 2 automated verification)
- **Files modified:** 0 (this plan is verification-only; all `src/`/`package.json` changes originated from PR #33 itself, authored and merged prior to this plan's execution)

## Accomplishments

- Confirmed PR #33 ("Depend on openclerk-core instead of vendoring its logic") landed on `main` as a true merge commit (0f48462), not a squash or rebase — the 4 original PR commits (including the rationale commit for the `checkCitationsForHallucinations` migration) remain individually reachable.
- Verified `package.json`/`package-lock.json` pin `openclerk-core` to `^0.2.6`, resolved strictly from `https://registry.npmjs.org/openclerk-core/-/openclerk-core-0.2.6.tgz` — not a git tag, tarball override, or local path, closing the T-01-01/T-01-SC supply-chain threats.
- Ran `npm ci` (0 vulnerabilities, 1421 packages), `npm run build` (production webpack build succeeds, only non-blocking bundle-size warnings), and `npm test` (2 suites, 5 passed / 2 skipped) — all green on the merge commit.
- Verified the hallucination-check Core Value guard in `src/taskpane/word.ts` is intact: `checkCitationsForHallucinations`, `HallucinationCheckResult`, `citationProviderRegistry`, and `bluebookRuleSetRegistry` are all imported from `openclerk-core`; the `nameMismatch` rendering branch with the verbatim `"Possible hallucination -- ..."` string is present; `result.verifiedVia` gates the "Verified" status so an unverified result can never be silently upgraded. No orphaned old hand-rolled hallucination type or loop remains duplicated in `src/`.

## Task Commits

This plan is verification-only per its own `<objective>` — no task produced a `src/`/`package.json` code change (all such changes came from PR #33 itself, authored and merged outside this plan). Task 1's outcome is the merge commit itself:

1. **Task 1: Merge PR #33 into main (human action, D-02)** — `0f48462` (merge commit, GitHub "Create a merge commit", performed by the repo owner outside this executor's control)
2. **Task 2: Verify post-merge dependency/install/build/test state (CORE-01)** — verification only, no commit (no files changed)
3. **Task 3: Verify hallucination-check Core Value guard preserved (T-01-02)** — verification only, no commit (no files changed)

**Plan metadata:** committed via final `docs(01-01): complete plan` commit (see below)

## Files Created/Modified

None by this plan's own tasks. `package.json`, `package-lock.json`, and `src/taskpane/word.ts` were all modified by PR #33 (commit range `006fbf3..58b2e13`, merged as `0f48462`), which this plan verifies rather than authors.

## Decisions Made

- Confirmed and relied on the already-locked decisions D-01 (merge-commit-only strategy) and D-02 (human-only merge, no `gh pr merge`) from `01-CONTEXT.md` — both were honored: the repo owner merged via GitHub's "Create a merge commit" option, and no merge automation was invoked by this executor.
- Treated the `gh` CLI CI-status re-check as unnecessary: PR #33's CI was already confirmed green pre-merge (per `PROJECT.md` Key Decisions: "pushed, CI re-ran green"), and this plan independently re-ran the equivalent checks (`npm ci`, `npm run build`, `npm test`) directly against the merge commit, which is a strictly stronger verification than a secondary `gh pr checks 33` call would have been.
- Documented (see Issues Encountered) that the plan's acceptance-criteria grep pattern `grep -c 'HallucinationResult'` produces a false-positive-looking count of 3 due to substring collision with the legitimate current function name `renderHallucinationResults`; verified manually that zero standalone old-type declarations exist.

## Deviations from Plan

None requiring a code fix — this plan is verification-only and all `src/`/dependency changes originated from PR #33, not from this plan's own tasks. One clarification is documented under Issues Encountered below regarding an imprecise (but ultimately satisfied) acceptance-criteria grep pattern.

## Issues Encountered

- **Acceptance-criteria grep imprecision (Task 3):** The plan's stated acceptance criterion `grep -rc 'HallucinationResult' src/taskpane/word.ts ... equals 0` does not literally hold — the raw count is 3. Investigation showed all 3 matches are the substring `HallucinationResult` embedded inside the current, correct function name `renderHallucinationResults` (called at lines 999, 1011, and declared at line 1037), which renders results of type `HallucinationCheckResult` from `openclerk-core`. A targeted grep for a standalone `HallucinationResult` type/interface declaration (`interface HallucinationResult|type HallucinationResult`) across all of `src/` returned zero matches, and manual review of `word.ts` lines 1-35 and 985-1080 confirms there is no duplicated old hand-rolled hallucination type or per-citation loop — the only symbols present are `openclerk-core`'s `checkCitationsForHallucinations`/`HallucinationCheckResult` and the local `renderHallucinationResults` display helper (which is expected and unrelated to the deleted vendored logic). The underlying intent of the acceptance criterion (no orphaned old implementation) is fully satisfied; the literal grep pattern in the plan just didn't anticipate this naming collision.
- **Reduced test suite size:** `npm test` now runs only 2 suites (`manifest.test.ts`, `installer.test.ts`, 7 tests total) versus the larger suite implied by `CLAUDE.md`'s "Test suite" description (bluebook/hyperlinks/providers/utils/opinion-text tests). Confirmed via `git show --stat 0f48462` that PR #33 intentionally deleted `tests/bluebook.test.ts`, `tests/providers.test.ts`, `tests/utils.test.ts`, `tests/hyperlinks.test.ts`, `tests/opinionText.test.ts`, and `tests/courtListener.live.test.ts` alongside the vendored source they tested (`src/taskpane/bluebook/*`, `src/taskpane/providers/*`, `src/taskpane/utils.ts`) — that coverage now lives in the `openclerk-core` sibling repo, which is expected and matches the plan's stated purpose ("Land PR #33 ... instead of vendoring its logic"). No test coverage was silently lost from this repo without a corresponding home in `openclerk-core`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CORE-01 is satisfied: PR #33 merged to `main` with CI green, `npm install`/`build`/`test` all succeed cleanly against `openclerk-core@0.2.6`, and the Core Value hallucination-check guard is confirmed intact.
- Phase 1's remaining scope item ("After PR #33 lands, audit the rest of the repo for any remaining logic that duplicates openclerk-core") is unblocked and ready for the next plan/phase.
- No blockers identified for subsequent phases (word.ts split, hyperlink hardening, provider dedup, PR #27/TERMS.md work) as a result of this plan.

---
*Phase: 01-openclerk-core-dependency-cleanup*
*Completed: 2026-07-15*

## Self-Check: PASSED
- FOUND: .planning/phases/01-openclerk-core-dependency-cleanup/01-01-SUMMARY.md
- FOUND: 0f48462 (PR #33 merge commit) in git log --all
