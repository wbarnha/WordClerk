---
phase: 01-openclerk-core-dependency-cleanup
reviewed: 2026-07-15T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - CONTRIBUTING.md
  - README.md
  - package.json
  - src/taskpane/word.ts
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-07-15
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This phase moves `openclerk-word`'s citation-parsing/provider/Bluebook logic out to the new
`openclerk-core` npm dependency, deletes the vendored `src/taskpane/providers/`,
`src/taskpane/bluebook/`, and `src/taskpane/utils.ts` source trees, and repoints `word.ts`'s
imports at `openclerk-core` (verified against the `76d3a5d..HEAD` diff and the installed
`node_modules/openclerk-core@0.2.6` package).

The safety-critical piece — the "Find Hallucinations" hallucination-check migration in
`src/taskpane/word.ts` (`checkForHallucinations` / `renderHallucinationResults`) — was reviewed
line-by-line against `openclerk-core`'s `checkCitationsForHallucinations`/`HallucinationCheckResult`
implementation. The per-citation rendering correctly preserves the project's Core Value guard:
`verifiedVia` is checked first (only path that renders "Verified"), `nameMismatch` is rendered as
a flagged "Possible hallucination" (never silently accepted), and a rate-limited provider is never
conflated with a verified/flagged result. No weakening of that guard was found. However, the
*aggregate* status-line count (`flaggedCount`/`rateLimitedCount` in `checkForHallucinations`) was
not updated to account for the newly-added `nameMismatch` field and can under-count genuinely
flagged citations in a narrow but real combination of conditions (see WR-01) — this does not affect
the per-citation "Possible hallucination" line the user actually clicks into, only the one-line
summary text.

Separately, this phase's deletion of `tests/courtListener.live.test.ts` (moved into `openclerk-core`
along with the provider it tested) was not accompanied by removing/updating the `test:live` npm
script or the README section that documents it — both now point at a file that no longer exists in
this repo, and running the documented command fails outright (verified by executing it). See CR-01.

`npm audit --omit=dev` and full `npm audit` were re-run against the current lockfile/`node_modules`
and both report 0 vulnerabilities, matching README's claims in the "Dependency security fixes" and
"Security & IT review" sections — no discrepancy found there. `npx tsc --noEmit` and `npm test` both
pass cleanly for the reviewed files.

## Critical Issues

### CR-01: `npm run test:live` is broken — references a test file deleted by this phase

**File:** `package.json:35`, `README.md:266-278`
**Issue:** This phase deleted `tests/courtListener.live.test.ts` along with the vendored
`src/taskpane/providers/` tree (that live-integration test now lives in `openclerk-core`), but did
not update `package.json`'s `test:live` script or the corresponding "Testing against the real
CourtListener API locally" section in `README.md`, both of which still reference the deleted file.
Verified directly:

```
$ npm run test:live
> jest tests/courtListener.live.test.ts
No tests found, exiting with code 1
Run with `--passWithNoTests` to exit with code 0
...
Pattern: tests\courtListener.live.test.ts - 0 matches
```

This fails unconditionally now, regardless of whether `COURTLISTENER_API_TOKEN` is set —
contradicting README.md:278's claim that "Without `COURTLISTENER_API_TOKEN` set, `npm test` and
`npm run test:live` both skip this file entirely." `README.md:278` also links directly to
`tests/courtListener.live.test.ts`, which is now a dead relative link. A contributor following
README's documented workflow to sanity-check the real CourtListener integration hits an
unconditional failure with no indication why.
**Fix:** Either remove the `test:live` script and its README section entirely (documenting that
live-integration testing now happens in `openclerk-core`, and linking there), or, if a live-test
entry point should still exist in this repo, point it at whatever this repo's own README/CI now use
to validate the `openclerk-core` integration end-to-end. Minimal fix:
```diff
- "test:live": "jest tests/courtListener.live.test.ts"
```
and update/remove `README.md:266-278` accordingly (e.g. point to
`https://github.com/OpenClerkProject/openclerk-core` for the live test suite, matching the pattern
already used for every other provider link updated in this diff).

## Warnings

### WR-01: Hallucination-check status summary undercounts flagged citations that also hit a rate limit

**File:** `src/taskpane/word.ts:1017-1022`
**Issue:** `openclerk-core`'s `checkCitationsForHallucinations` (added by this phase's migration)
can set both `nameMismatch` *and* a non-empty `rateLimitedProviders` on the same result — e.g. the
first selected provider resolves the citation's locator to a different case name (setting
`nameMismatch`) and the loop `continue`s to try the next selected provider, which then gets
rate-limited (see `node_modules/openclerk-core/lib/providers/hallucinationCheck.js:35-54`, no
`break` after a `nameMismatch`). `checkForHallucinations`'s summary counters were not updated for
this new field:

```ts
const rateLimitedCount = results.filter(
  (result) => !result.verifiedVia && result.rateLimitedProviders.length > 0
).length;
const flaggedCount = results.filter(
  (result) => !result.verifiedVia && result.rateLimitedProviders.length === 0
).length;
```

For a result with `nameMismatch` set and `rateLimitedProviders.length > 0`, this is bucketed into
`rateLimitedCount`, not `flaggedCount` — even though `renderHallucinationResults` (line 1067)
checks `result.nameMismatch` *before* `result.rateLimitedProviders.length`, so the per-citation row
still correctly renders "Possible hallucination -- ...". The one-line status summary text
(`setStatus` at line 1027) will therefore under-report how many citations were actually flagged as
possible hallucinations in this edge case, creating a mismatch between what the summary says and
what the results list actually shows — a user who trusts only the summary line could walk away
thinking fewer citations were flagged than the list actually contains.
**Fix:** Treat `nameMismatch` as taking priority over `rateLimitedProviders` in the count, mirroring
the render logic:
```ts
const flaggedCount = results.filter(
  (result) => !result.verifiedVia && (result.nameMismatch || result.rateLimitedProviders.length === 0)
).length;
const rateLimitedCount = results.filter(
  (result) => !result.verifiedVia && !result.nameMismatch && result.rateLimitedProviders.length > 0
).length;
```

## Info

### IN-01: CONTRIBUTING.md's `bluebook:update-data` reference is stale for this repo

**File:** `CONTRIBUTING.md:77-78`
**Issue:** This phase's `package.json` diff removed the `bluebook:update-data` script from this
repo (`git diff 76d3a5d..HEAD -- package.json` shows it deleted; it now only exists in
`openclerk-core`). `CONTRIBUTING.md:74-80` ("Why corrections live in a separate file") still reads
`(see [npm run bluebook:update-data](README.md#vendored-reference-data))` with no indication the
command is no longer runnable in this repo. Verified: `npm run bluebook:update-data` in this repo
now fails with `npm error Missing script: "bluebook:update-data"`. The linked README anchor *does*
correctly explain "run `npm run bluebook:update-data` in openclerk-core" (this text was updated
correctly by this same diff), so a reader who clicks through eventually gets the right answer, but
the CONTRIBUTING.md phrasing itself reads as if the command is runnable here.
**Fix:** Match the phrasing already used in `README.md`'s "Vendored reference data" section, e.g.:
```diff
- periodically straight from reporters-db (see [`npm run
- bluebook:update-data`](README.md#vendored-reference-data)) -- any hand-edits there would be lost
+ periodically straight from reporters-db (see [`npm run
+ bluebook:update-data`](README.md#vendored-reference-data), run in `openclerk-core`, not this repo)
+ -- any hand-edits there would be lost
```

---

_Reviewed: 2026-07-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
