---
phase: 01-openclerk-core-dependency-cleanup
plan: 02
subsystem: infra
tags: [openclerk-core, dependency-cleanup, audit, tech-debt]

# Dependency graph
requires:
  - phase: 01-openclerk-core-dependency-cleanup
    provides: "PR #33 merged to main, main depends on published openclerk-core@0.2.6 instead of vendored logic (Plan 01-01)"
provides:
  - "Fresh post-merge audit confirming src/commands/ contains zero logic duplicating openclerk-core"
  - "Fresh post-merge audit confirming scripts/ contains zero logic duplicating openclerk-core, and scripts/generate-bluebook-data.js (the one file with real overlap) is deleted"
  - "Confirmed zero residual imports of the deleted local ./providers, ./bluebook, or ./utils paths anywhere in src/ or scripts/"
  - "Confirmed all 6 test files PR #33 removed are genuinely absent from tests/ with no dangling deep-import"
  - "Persistent, dated audit record at 01-DUPLICATION-AUDIT.md closing CORE-02"
affects: [openclerk-core-dependency-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Duplication audits for future dependency-extraction cleanups should record literal grep commands + output in a dated .planning artifact, not just a verbal conclusion, per the pattern established in 01-DUPLICATION-AUDIT.md"

key-files:
  created:
    - ".planning/phases/01-openclerk-core-dependency-cleanup/01-DUPLICATION-AUDIT.md"
  modified:
    - ".planning/codebase/CONCERNS.md"

key-decisions:
  - "Ran a fresh post-merge grep pass (not a restatement of the pre-merge 01-CONTEXT.md D-03 spot-check) directly against main's merge commit 0f48462, per the plan's explicit prohibition against rubber-stamping."
  - "Confirmed 0f48462 (PR #33's actual GitHub merge commit) rather than 955ee84 (a later local sync merge) as the canonical baseline SHA for the audit record, via git merge-base --is-ancestor."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "src/commands/ audited and confirmed to contain zero logic duplicating openclerk-core (citation-parsing, Bluebook-rule, or HTML-escaping identifiers)"
    requirement: "CORE-02"
    verification:
      - kind: other
        ref: "grep -rc 'parseCaseCitation|ParsedCitation|BluebookRuleSet|escapeHtml|isSafeHyperlinkUrl|citationProviderRegistry|bluebookRuleSetRegistry' src/commands/commands.ts src/commands/commands.word.ts src/commands/commands.html -- all 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "scripts/ audited: generate-bluebook-data.js (the one file with real overlap) confirmed deleted; remaining 5 scripts/*.js files contain zero duplicating logic; zero residual imports of deleted ./providers, ./bluebook, ./utils paths anywhere in src/ or scripts/; all 6 removed test files confirmed absent from tests/ with no dangling deep-import"
    requirement: "CORE-02"
    verification:
      - kind: other
        ref: "test ! -f scripts/generate-bluebook-data.js; grep -rc identifier-list across 5 remaining scripts/*.js files -- all 0; grep -rn import-pattern src/ scripts/ -- 0 matches; grep -rn deep-import-pattern tests/ -- 0 matches"
        status: pass
    human_judgment: false
  - id: D3
    description: "Persistent, dated audit record written documenting the exact grep commands and results; CONCERNS.md duplication tech-debt entry marked Resolved"
    requirement: "CORE-02"
    verification:
      - kind: other
        ref: "test -f 01-DUPLICATION-AUDIT.md; grep -c 'CORE-02' 01-DUPLICATION-AUDIT.md == 3; grep -c 'Resolved' CONCERNS.md == 1"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-15
status: complete
---

# Phase 01 Plan 02: CORE-02 Duplication Audit Summary

**Fresh post-merge grep audit confirms zero duplicated openclerk-core logic remains in src/commands/ or scripts/, with the result recorded in a persistent, reviewable audit file.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-15 (session start)
- **Completed:** 2026-07-15
- **Tasks:** 3 (2 verification-only, 1 produced planning-doc changes)
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments

- Confirmed `src/commands/commands.ts`, `commands.word.ts`, and `commands.html` are unmodified Office-Add-in template boilerplate (the "Hello World" ribbon command) with zero citation-parsing/Bluebook/escaping identifiers -- PR #33's diff does not touch this directory.
- Confirmed `scripts/generate-bluebook-data.js` (the one file in `scripts/` with real overlap with `openclerk-core`) is deleted on `main`, and the 5 remaining `scripts/*.js` files contain zero duplicated logic.
- Confirmed zero residual imports of the deleted local `./providers`, `./bluebook`, or `./utils` paths anywhere across the entire `src/` and `scripts/` trees.
- Ran the discretionary `tests/` deep-import spot-check called out in `01-CONTEXT.md`: all 6 test files PR #33 removed (`bluebook.test.ts`, `providers.test.ts`, `utils.test.ts`, `opinionText.test.ts`, `hyperlinks.test.ts`, `courtListener.live.test.ts`) are confirmed genuinely absent, none left with a dangling deep-import.
- Wrote `.planning/phases/01-openclerk-core-dependency-cleanup/01-DUPLICATION-AUDIT.md`, a persistent record of every grep command run and its literal output, plus the "CORE-02: confirmed -- no logic in src/commands/ or scripts/ duplicates openclerk-core" conclusion.
- Marked CONCERNS.md's "openclerk-core logic duplicated, not shared" tech-debt entry Resolved, referencing the new audit file and PR #33's merge commit (`0f48462`).

## Task Commits

1. **Task 1: Confirm zero duplication in src/commands/** -- verification only, no commit (no files changed; matches D-03's pre-merge spot-check, formally re-confirmed post-merge)
2. **Task 2: Confirm zero duplication in scripts/ and zero residual imports** -- verification only, no commit (no files changed; `generate-bluebook-data.js` confirmed deleted, no removal action needed)
3. **Task 3: Write the CORE-02 audit record and close the CONCERNS.md duplication entry** -- `edeb094` (docs)

**Plan metadata:** committed via final `docs(01-02): complete CORE-02 duplication audit plan` commit (see below)

## Files Created/Modified

- `.planning/phases/01-openclerk-core-dependency-cleanup/01-DUPLICATION-AUDIT.md` - New audit record: baseline merge-commit verification, Task 1/Task 2 grep commands with literal output, and the CORE-02 confirmed-none-found conclusion.
- `.planning/codebase/CONCERNS.md` - Appended a "Resolved (2026-07-15)" line to the "openclerk-core logic duplicated, not shared" tech-debt entry, referencing the new audit file and merge commit `0f48462`.

## Decisions Made

- Ran the audit as a genuinely fresh post-merge grep pass against `main`'s current state, rather than restating the pre-merge spot-check already captured in `01-CONTEXT.md` D-03 and `01-PATTERNS.md` -- per the plan's explicit prohibition, and per this plan's own `must_haves.truths` requiring fresh evidence.
- Used `git merge-base --is-ancestor 0f48462 HEAD` to confirm PR #33's actual GitHub merge commit (`0f48462`) as the canonical baseline SHA for the audit record, rather than the more recent local sync merge (`955ee84` from `git log --merges -1 main`) which is a different, later merge commit reachable on `main` but not the PR #33 merge itself.

## Deviations from Plan

None - plan executed exactly as written. Both audit tasks (Task 1, Task 2) returned zero matches for every grep pattern specified in the plan's acceptance criteria; no duplicated logic was found requiring removal, and no architectural or scope decision was needed.

## Issues Encountered

None. All acceptance criteria in Task 1, Task 2, and Task 3 were met exactly on the first grep pass -- no false positives, no naming collisions (unlike Plan 01-01's `HallucinationResult` substring collision, which did not recur here since the identifier list used in this plan's grep patterns has no such overlapping substrings in the current codebase).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CORE-02 is satisfied: `src/commands/` and `scripts/` have been formally audited post-merge for logic duplicated in `openclerk-core`, nothing was found beyond what PR #33 already removed, and the result is recorded in a persistent, reviewable artifact (`01-DUPLICATION-AUDIT.md`).
- Phase 01's scope (CORE-01 + CORE-02) is now fully complete: PR #33 merged and verified (Plan 01-01), and the post-merge duplication audit confirmed clean (this plan).
- No blockers identified for subsequent phases (word.ts split, hyperlink hardening, provider dedup, PR #27/TERMS.md work) as a result of this plan.

---
*Phase: 01-openclerk-core-dependency-cleanup*
*Completed: 2026-07-15*

## Self-Check: PASSED
- FOUND: .planning/phases/01-openclerk-core-dependency-cleanup/01-DUPLICATION-AUDIT.md
- FOUND: .planning/phases/01-openclerk-core-dependency-cleanup/01-02-SUMMARY.md
- FOUND: edeb094 (Task 3 commit) in git log --all
