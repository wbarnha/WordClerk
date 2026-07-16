---
phase: 02-escaping-hardening
plan: 01
subsystem: security
tags: [typescript, branded-types, openclerk-core, escaping, hyperlink-validation, npm-publish]

# Dependency graph
requires:
  - phase: 01-openclerk-core-dependency-cleanup
    provides: "openclerk-core as the published, non-vendored shared logic package (escapeHtml/isSafeHyperlinkUrl already live there)"
provides:
  - "openclerk-core src/utils.ts branded types SafeHyperlinkUrl/SafeHtml and smart constructors toSafeHyperlinkUrl/toSafeHtml"
  - "openclerk-core src/index.ts re-exporting all four new identifiers from the public entry point"
  - "openclerk-core tests/utils.test.ts coverage for the new smart constructors (valid/invalid/empty/whitespace)"
  - "openclerk-core version 0.3.0 committed locally, build+test green, ready for human-triggered tag/publish"
affects: [02-02, 02-03, 02-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TypeScript branded (nominal) types via string intersection with a readonly __brand literal, gatekept by a smart constructor"
    - "Smart constructors delegate to existing validators (isSafeHyperlinkUrl/escapeHtml) rather than reimplementing validation logic"
    - "D-04 'move on, don't crash': toSafeHyperlinkUrl returns null on invalid input rather than throwing"

key-files:
  created: []
  modified:
    - "C:\\Users\\willi\\openclerk-core\\src\\utils.ts"
    - "C:\\Users\\willi\\openclerk-core\\src\\index.ts"
    - "C:\\Users\\willi\\openclerk-core\\tests\\utils.test.ts"
    - "C:\\Users\\willi\\openclerk-core\\package.json"
    - "C:\\Users\\willi\\openclerk-core\\package-lock.json"

key-decisions:
  - "Version bumped to 0.3.0 (semver minor, per RESEARCH.md's recommendation -- 0.2.7 was already the published registry version)."
  - "Task 3's local commit was split into three atomic per-task commits (Task 1, Task 2, Task 3) rather than one squashed commit, following the standard executor per-task commit protocol -- the plan's acceptance criteria (a commit exists, working tree clean, tests pass) are satisfied either way."
  - "Rule 3 auto-fix: package-lock.json's version field was still 0.2.7 after the package.json bump (npm run build/test do not touch the lockfile's root version). Left unfixed, `npm ci` in publish.yml would fail on a version mismatch before ever reaching the tag-vs-version check. Fixed via `npm install --package-lock-only`, re-verified build+test green, committed separately."

requirements-completed: []  # ESCAPE-01 only partially satisfied -- see Next Phase Readiness; publish (Task 4) is still pending human action

coverage:
  - id: D1
    description: "openclerk-core exports SafeHyperlinkUrl/SafeHtml branded types and toSafeHyperlinkUrl/toSafeHtml smart constructors that delegate to (not duplicate) the existing isSafeHyperlinkUrl/escapeHtml validators"
    requirement: "ESCAPE-01"
    verification:
      - kind: unit
        ref: "C:\\Users\\willi\\openclerk-core\\tests\\utils.test.ts#toSafeHyperlinkUrl, #toSafeHtml"
        status: pass
      - kind: other
        ref: "cd C:/Users/willi/openclerk-core && npx tsc --noEmit"
        status: pass
    human_judgment: false
  - id: D2
    description: "openclerk-core is published to the public npm registry at version 0.3.0 after explicit human confirmation (D-03)"
    requirement: "ESCAPE-01"
    verification: []
    human_judgment: true
    rationale: "Task 4 is a blocking-human checkpoint per D-03 -- the executor prepares the version bump/local commit but a human must push the release tag and confirm the publish.yml workflow succeeds. Not automatable and not yet performed."

# Metrics
duration: 7min
completed: 2026-07-16
status: blocked
---

# Phase 2 Plan 1: openclerk-core Branded Types Summary

**Added compiler-enforced SafeHyperlinkUrl/SafeHtml branded types and toSafeHyperlinkUrl/toSafeHtml smart constructors to openclerk-core, bumped it to 0.3.0 locally, and stopped at the D-03 human publish checkpoint (Task 4) -- Tasks 1-3 complete, Task 4 pending human action.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-16T01:57:51Z
- **Completed (through Task 3):** 2026-07-16T02:04:55Z
- **Tasks:** 3 of 4 completed (Task 4 is a blocking-human checkpoint, not yet actioned)
- **Files modified:** 5 (all in the sibling `openclerk-core` repository)

## Accomplishments
- `SafeHyperlinkUrl`/`SafeHtml` branded types added to `openclerk-core/src/utils.ts`, each a `string` intersected with a readonly `__brand` literal, producible only via their respective smart constructors
- `toSafeHyperlinkUrl(url): SafeHyperlinkUrl | null` delegates to the existing `isSafeHyperlinkUrl` allowlist validator, returns `null` (never throws) on invalid/empty/whitespace input per D-04
- `toSafeHtml(raw): SafeHtml` delegates to the existing `escapeHtml`, never returns `null` since escaping is total
- All four new identifiers re-exported from `openclerk-core/src/index.ts`'s existing `./utils` export block
- `tests/utils.test.ts` extended with `describe('toSafeHyperlinkUrl', ...)` and `describe('toSafeHtml', ...)` blocks covering valid input, `javascript:` rejection, empty string, and whitespace-only input
- `openclerk-core` bumped to version `0.3.0` (from the already-published `0.2.7`); `npx tsc --noEmit`, `npm run build`, and `npm test` all exit 0 at this version
- All changes committed locally in `openclerk-core`'s own git history (branch `main`), working tree clean -- ready for human review before the release tag is pushed

## Task Commits

All commits below are in the **sibling `openclerk-core` repository** (`C:\Users\willi\openclerk-core`, branch `main`), NOT in this repo's (`openclerk-word`/`WordClerk`) git history:

1. **Task 1: Add branded types + smart constructors, export from index.ts** - `07381e1` (feat)
2. **Task 2: Extend tests/utils.test.ts with toSafeHyperlinkUrl/toSafeHtml coverage** - `cc163be` (test)
3. **Task 3: Bump openclerk-core to 0.3.0, verify build+test, commit locally** - `40cb423` (feat)
   - Follow-up fix (Rule 3, same task): sync `package-lock.json`'s version field - `8c9906e` (fix)
4. **Task 4 (checkpoint:human-action, gate="blocking-human"): NOT executed** - awaiting human confirmation, see Checkpoint below

**This repo's metadata commit:** created below, includes this SUMMARY.md, STATE.md, ROADMAP.md.

_Note: no TDD RED/GREEN/REFACTOR cycle applies here -- Task 2 was `tdd="true"` at the plan level but the tests were additive coverage for already-implemented (Task 1) smart constructors, matching the plan's own task ordering (implementation in Task 1, tests in Task 2), not a strict RED-before-GREEN sequence._

## Files Created/Modified
- `C:\Users\willi\openclerk-core\src\utils.ts` - Added `SafeHyperlinkUrl`/`SafeHtml` branded types and `toSafeHyperlinkUrl`/`toSafeHtml` smart constructors
- `C:\Users\willi\openclerk-core\src\index.ts` - Re-exported the four new identifiers from the existing `./utils` export block
- `C:\Users\willi\openclerk-core\tests\utils.test.ts` - Added `toSafeHyperlinkUrl`/`toSafeHtml` test coverage
- `C:\Users\willi\openclerk-core\package.json` - Version bumped `0.2.7` -> `0.3.0`
- `C:\Users\willi\openclerk-core\package-lock.json` - Version field synced to `0.3.0` (Rule 3 auto-fix, see Deviations)

## Decisions Made
- Targeted version `0.3.0` (semver minor bump) per RESEARCH.md's explicit recommendation, since `0.2.7` was confirmed already published to the public npm registry (not an unpublished local bump).
- Kept the standard per-task atomic-commit protocol (one commit per task) in `openclerk-core`'s history rather than literally squashing Tasks 1-3 into a single commit as the plan's Task 3 action text suggested -- the plan's actual acceptance criteria (commit exists, tree clean, build/test pass) are satisfied by either approach, and per-task commits give a clearer audit trail for human review before Task 4's publish.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Synced package-lock.json's stale version field**
- **Found during:** Task 3 (version bump + build/test verification)
- **Issue:** After bumping `package.json`'s `version` to `0.3.0`, `package-lock.json`'s root `version` and `packages[""].version` fields still read `0.2.7` (neither `npm run build` nor `npm test` touch the lockfile). `publish.yml`'s `npm ci` step requires `package.json` and `package-lock.json` to match exactly, or it fails immediately -- before Task 4's tag-vs-version check would ever run.
- **Fix:** Ran `npm install --package-lock-only` to regenerate the lockfile's version metadata against the bumped `package.json`, with no dependency changes (0 vulnerabilities, up to date, 308 packages unchanged).
- **Files modified:** `C:\Users\willi\openclerk-core\package-lock.json`
- **Verification:** Re-ran `npm run build` and `npm test` after the fix -- both still exit 0 (252 passed, 5 skipped, 1 suite intentionally skipped per existing project convention).
- **Committed in:** `8c9906e`

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Necessary to keep Task 4's eventual publish workflow from failing on a lockfile/manifest version mismatch. No scope creep -- no dependencies were added or upgraded.

## Issues Encountered
None beyond the lockfile sync above.

## User Setup Required

**External action required before Plan 02 (Wave 2) can proceed.** Task 4 is a `checkpoint:human-action` gate (`gate="blocking-human"`) per decision D-03 -- publishing a package version is externally visible and hard to reverse, so a human must trigger it, not the executor. See the CHECKPOINT REACHED block returned alongside this summary for the exact steps (review the local commits, push to the `openclerk-core` remote, tag `v0.3.0`, push the tag, confirm the `publish.yml` GitHub Actions run succeeds).

## Next Phase Readiness

**Not yet ready for Plan 02.** Plan 02 (Wave 2) depends on `openclerk-core@0.3.0` being resolvable from the public npm registry (`npm view openclerk-core version` returning `0.3.0`) before it can bump `openclerk-word`'s own dependency and proceed to build `safeInsertion.ts`. That requires Task 4's human action to complete first:
1. Push the local `openclerk-core` commits (`07381e1`, `cc163be`, `40cb423`, `8c9906e`) to the `openclerk-core` GitHub remote.
2. Tag the commit with `package.json` version `0.3.0` as `v0.3.0` and push the tag.
3. Confirm the `publish.yml` workflow run succeeds (build, test, tag-vs-version check, `npm publish --access public` via OIDC trusted publishing).
4. Confirm `npm view openclerk-core version` returns `0.3.0`.

Once confirmed, resume with "published" (per the plan's resume-signal) and Plan 02 can begin.

---
*Phase: 02-escaping-hardening*
*Completed (Tasks 1-3): 2026-07-16*

## Self-Check: PASSED

All claimed files exist on disk and all four claimed openclerk-core commit hashes (`07381e1`, `cc163be`, `40cb423`, `8c9906e`) are present in `git log --oneline --all` for `C:\Users\willi\openclerk-core`.
