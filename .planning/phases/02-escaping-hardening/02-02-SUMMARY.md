---
phase: 02-escaping-hardening
plan: 02
subsystem: security
tags: [typescript, branded-types, office-js, safeInsertion, escaping, hyperlink-validation, jest]

# Dependency graph
requires:
  - phase: 02-escaping-hardening (Plan 01)
    provides: "openclerk-core@0.3.0 published to the public npm registry, exporting SafeHyperlinkUrl/SafeHtml branded types and toSafeHyperlinkUrl/toSafeHtml smart constructors"
provides:
  - "openclerk-word dependency on openclerk-core bumped to ^0.3.0, resolved from the public npm registry"
  - "tsconfig.json excludes tools/ so a project-wide tsc --noEmit is a usable phase-wide verification command"
  - "src/taskpane/safeInsertion.ts -- the sole wrapper module for raw Office.js insertHtml/insertHyperlink/insertComment calls, with branded-type-only exported parameters"
  - "tests/safeInsertion.test.ts -- dedicated unit tests covering the 3-tier dispatch fallback order and insertSafeComment (D-06)"
affects: [02-03, 02-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single wrapper module (safeInsertion.ts) as the only file allowed to call raw Office.js insertion APIs -- a later plan's ESLint no-restricted-syntax rule will enforce this structurally"
    - "Wrapper functions take a Word.RequestContext and own their own context.sync() call internally, standardizing the two previously-inconsistent calling conventions in word.ts"
    - "Branded-type-only exported function parameters (SafeHyperlinkUrl/SafeHtml, never string) as the compile-time enforcement point"

key-files:
  created:
    - "src/taskpane/safeInsertion.ts"
    - "tests/safeInsertion.test.ts"
  modified:
    - "package.json"
    - "package-lock.json"
    - "tsconfig.json"

key-decisions:
  - "Added a minimal inline Word.InsertLocation global stub in tests/safeInsertion.test.ts (Rule 3 auto-fix) -- Office.js's Word global is normally supplied by the WebView host at runtime and has no presence under Jest's node testEnvironment, so the ported dispatch logic could not execute under test without it."

requirements-completed: [ESCAPE-01, ESCAPE-02]

coverage:
  - id: D1
    description: "openclerk-word depends on openclerk-core ^0.3.0, resolved from the public npm registry, exposing the four new branded-type exports; tsconfig.json excludes tools/ so a project-wide tsc --noEmit is a usable verification command for the rest of the phase"
    requirement: "ESCAPE-01"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (exits 0); node -p \"require('./node_modules/openclerk-core/package.json').version\" (prints 0.3.0); package-lock.json resolved field starts with https://registry.npmjs.org/openclerk-core/"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/taskpane/safeInsertion.ts exports insertSafeHyperlink/insertSafeComment with branded-type-only parameters (SafeHyperlinkUrl/SafeHtml, never string) that genuinely reject a bare string at compile time, verified via a transient negative compile-time check"
    requirement: "ESCAPE-01"
    verification:
      - kind: other
        ref: "npx tsc --noEmit && printf assign-bare-string-to-SafeHyperlinkUrl > __brand-check.ts && (! npx tsc --noEmit) && rm __brand-check.ts && npx tsc --noEmit -- transient check confirmed TS2322 error, then confirmed clean again after removal"
        status: pass
    human_judgment: false
  - id: D3
    description: "safeInsertion.ts is the sole wrapper owning the 3-tier hyperlink dispatch (insertHyperlink -> insertHtml -> insertText) ported from word.ts's applyHyperlinkToItem, and insertSafeComment for the insertComment call site -- both functions take context.sync() internally exactly once"
    requirement: "ESCAPE-02"
    verification:
      - kind: unit
        ref: "tests/safeInsertion.test.ts#insertSafeHyperlink dispatch > calls only insertHyperlink when all three duck-typed methods are present"
        status: pass
      - kind: unit
        ref: "tests/safeInsertion.test.ts#insertSafeHyperlink dispatch > calls only insertHtml when insertHyperlink is unavailable"
        status: pass
      - kind: unit
        ref: "tests/safeInsertion.test.ts#insertSafeHyperlink dispatch > calls only insertText when neither insertHyperlink nor insertHtml is available"
        status: pass
      - kind: unit
        ref: "tests/safeInsertion.test.ts#insertSafeComment > calls insertComment with the branded text and syncs exactly once"
        status: pass
    human_judgment: false
  - id: D4
    description: "toSafeHyperlinkUrl/toSafeHtml re-exported through openclerk-core resolve correctly when imported from openclerk-word's own node_modules (D-06 dedicated test coverage)"
    requirement: "ESCAPE-01"
    verification:
      - kind: unit
        ref: "tests/safeInsertion.test.ts#toSafeHyperlinkUrl > rejects an unsafe scheme"
        status: pass
      - kind: unit
        ref: "tests/safeInsertion.test.ts#toSafeHyperlinkUrl > accepts an https URL"
        status: pass
    human_judgment: false

# Metrics
duration: 18min
completed: 2026-07-16
status: complete
---

# Phase 2 Plan 2: safeInsertion.ts Wrapper Module Summary

**Created src/taskpane/safeInsertion.ts -- the sole wrapper for raw Office.js insertHtml/insertHyperlink/insertComment calls with branded-type-only parameters, after bumping openclerk-word's openclerk-core dependency to the newly-published 0.3.0.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-16T03:04:10Z (STATE.md handoff from Plan 01)
- **Completed:** 2026-07-16T03:14:45Z
- **Tasks:** 3 of 3 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- Bumped `openclerk-word`'s `dependencies.openclerk-core` from `^0.2.6` to `^0.3.0`, confirmed resolved from the public npm registry (not a git/tarball/local override), exposing `SafeHyperlinkUrl`/`SafeHtml`/`toSafeHyperlinkUrl`/`toSafeHtml`
- Added `"tools"` to `tsconfig.json`'s `exclude` array so `npx tsc --noEmit` is a clean, whole-project verification command for the rest of this phase (previously would have choked on the unrelated standalone `tools/pdf-extract` subproject)
- Created `src/taskpane/safeInsertion.ts`, porting the existing 3-tier hyperlink dispatch (`insertHyperlink` -> `insertHtml` -> `insertText`) and the `insertComment` call site out of `word.ts`, with both exported functions (`insertSafeHyperlink`, `insertSafeComment`) taking only branded `SafeHyperlinkUrl`/`SafeHtml` parameters and owning their own single `context.sync()` call
- Verified the branding guarantee is a genuine compile-time gate (not a cosmetic alias) via a transient negative check: a scratch file assigning a bare string literal to a `SafeHyperlinkUrl`-typed variable produced a real `TS2322` error, then was deleted and the project re-verified clean
- Preserved the pre-existing `(item as any).insertHyperlink(...)` type-widening cast unchanged, since `@types/office-js` has no declaration for this Office.js preview API (RESEARCH.md Pitfall 2) -- not new risk introduced by this refactor
- Added `tests/safeInsertion.test.ts` (6 tests) covering: `toSafeHyperlinkUrl` re-export sanity (rejects unsafe scheme, accepts https), the full 3-tier dispatch fallback order (each case asserting only the expected method fired and `context.sync()` was called exactly once), and `insertSafeComment`
- Full project test suite (`npm test`) and `npx tsc --noEmit` both green after all three tasks

## Task Commits

Each task was committed atomically:

1. **Task 1: Bump openclerk-core to ^0.3.0, verify branded exports resolve, scope tsc to exclude tools/** - `28863d2` (feat)
2. **Task 2: Create src/taskpane/safeInsertion.ts -- the sole wrapper for raw Office.js insertion calls** - `0891ec7` (feat)
3. **Task 3: Create tests/safeInsertion.test.ts** - `6d513f5` (test)

**Plan metadata:** created below (docs: complete plan)

_Note: Task 2 and Task 3 were marked `tdd="true"` at the plan level, but per the plan's own task ordering (implementation in Task 2, dedicated tests in Task 3) this followed an implement-then-test sequence, not a strict RED-before-GREEN cycle -- matching Plan 01's precedent for this phase._

## Files Created/Modified
- `package.json` - `dependencies.openclerk-core` bumped from `^0.2.6` to `^0.3.0`
- `package-lock.json` - regenerated resolved/integrity entry for `openclerk-core@0.3.0`
- `tsconfig.json` - added `"tools"` to `exclude` array
- `src/taskpane/safeInsertion.ts` (new) - exports `insertSafeHyperlink`/`insertSafeComment`, the sole wrapper functions allowed to call raw Office.js insertion APIs, both branded-type-parameter-only
- `tests/safeInsertion.test.ts` (new) - dedicated unit tests for the wrapper module (D-06)

## Decisions Made
- Standardized both `insertSafeHyperlink` and `insertSafeComment` on the "wrapper takes `context`, syncs internally" calling convention (matching `applyHyperlinkToItem`'s existing pattern), resolving RESEARCH.md's Open Question 2 / the two-pattern inconsistency PATTERNS.md flagged between `word.ts`'s current hyperlink-insertion function and its `insertComment` call site.
- Left `word.ts`'s own call sites untouched in this plan -- they still call the raw Office.js APIs directly and have not yet migrated to `safeInsertion.ts`. This is intentional and matches the plan's stated scope (`safeInsertion.ts` created here; call-site migration is Plan 03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stubbed the Word.InsertLocation global in tests/safeInsertion.test.ts**
- **Found during:** Task 3 (writing dedicated dispatch tests)
- **Issue:** `insertSafeHyperlink`'s ported dispatch logic references `Word.InsertLocation.replace` directly, exactly as the pre-existing `word.ts` code it was extracted from does. `Word` is a real Office.js global normally supplied by the WebView host at runtime; it does not exist under Jest's `testEnvironment: node`, so all three dispatch tests failed with `ReferenceError: Word is not defined` on first run.
- **Fix:** Added a minimal inline stub, `(global as any).Word = { InsertLocation: { replace: "Replace" } };`, at the top of the test file -- a plain object assignment consistent with this project's "no mocking library" testing convention, not a new framework or dependency.
- **Files modified:** `tests/safeInsertion.test.ts`
- **Verification:** Re-ran `npx jest tests/safeInsertion.test.ts` -- all 6 tests pass (previously 3 of 6 failed with the ReferenceError).
- **Committed in:** `6d513f5` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Necessary for the dedicated test suite (D-06) to actually exercise the dispatch logic under test; does not touch `safeInsertion.ts`'s own implementation or weaken any guard. No scope creep.

## Issues Encountered
None beyond the Jest global stub above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 03.** `src/taskpane/safeInsertion.ts` exists, exports `insertSafeHyperlink`/`insertSafeComment` with branded-type-only parameters, and is fully covered by dedicated passing tests. `word.ts`'s own three raw-insertion call sites (`applyHyperlinkToItem` at lines 217-233, the `insertComment` call at line 1232) and its four `isSafeHyperlinkUrl` pre-filter call sites (lines 250, 342, 552, 1426) have not yet been migrated to import from `safeInsertion.ts`/consume `toSafeHyperlinkUrl`/`toSafeHtml` -- that migration is Plan 03's scope, at which point Roadmap Phase 2 Success Criterion 1 (branded types type-constrain the insertion helper's parameters) is satisfied end-to-end and the raw calls in `word.ts` can be deleted. Plan 03 can also proceed with the ESLint `no-restricted-syntax` bypass guard (ESCAPE-03) once `word.ts`'s call sites route through this wrapper, since the guard would otherwise immediately flag `word.ts`'s still-raw calls as violations.

---
*Phase: 02-escaping-hardening*
*Completed: 2026-07-16*

## Self-Check: PASSED

All claimed files exist on disk (`src/taskpane/safeInsertion.ts`, `tests/safeInsertion.test.ts`, this SUMMARY.md) and all four claimed commit hashes (`28863d2`, `0891ec7`, `6d513f5`, `fc80270`) are present in `git log --oneline --all`.
