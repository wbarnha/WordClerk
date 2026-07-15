# Phase 1: openclerk-core Dependency Cleanup - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

The codebase depends cleanly on the published `openclerk-core` npm package, with no vendored
duplicate logic remaining anywhere in the repo. This covers: (1) getting PR #33 merged, and
(2) confirming the rest of the repo (`src/commands/`, `scripts/`) has no other logic duplicated
in `openclerk-core`.

</domain>

<decisions>
## Implementation Decisions

### PR #33 Merge Method

- **D-01:** Merge PR #33 with a merge commit, not a squash. Preserves the 4 individual commits
  and their detailed messages — notably commit 3's rationale for migrating
  `checkForHallucinations` onto `openclerk-core`'s shared `checkCitationsForHallucinations` (a
  real bug fix, not just a refactor).
- **D-02:** The plan does NOT merge PR #33 itself. The user (repo owner, `wbarnha`) will click
  merge on GitHub themselves. The plan should document that PR #33 must be merged before/during
  this phase, and can verify post-merge state (`git log main`, `npm install` against
  `openclerk-core ^0.2.6`), but must not attempt `gh pr merge` as a task.

### Duplication Audit Depth (CORE-02)

- **D-03:** Formally confirm the spot-check already done during discussion, rather than a deep
  line-by-line diff against `openclerk-core`'s full export surface:
  - `src/commands/` (`commands.ts`, `commands.word.ts`, `commands.html`) — confirmed zero overlap
    with `openclerk-core`; this is unmodified Yeoman/Office-Add-in-template boilerplate (a
    "Hello World" ribbon command), unrelated to citation/Bluebook logic.
  - `scripts/generate-bluebook-data.js` (6,800 bytes) — the one file in `scripts/` with real
    logic overlap. PR #33 already deletes it (equivalent script now lives in `openclerk-core`).
  - The plan's audit task is: after PR #33 merges, re-run a systematic pass over `src/commands/`
    and `scripts/` (grep for logic patterns that resemble anything exported from
    `openclerk-core`, e.g. citation parsing, Bluebook rule application, HTML escaping) to confirm
    no other overlap exists, and record the result (even if "confirmed: none found") — not an
    open-ended deep-dive.

### Claude's Discretion

- Exact grep/search strategy for the post-merge duplication confirmation pass.
- Whether to also spot-check `tests/` for any remaining test file that imports from a
  now-deleted internal path (PR #33 already removes the 6 test files that deep-imported
  `bluebook`/`providers`/`utils` internals, but a fresh look after merge is worthwhile).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PR #33 (this phase's primary deliverable)
- PR: `OpenClerkProject/openclerk-word#33` — "Depend on openclerk-core instead of vendoring its
  logic". CI green, mergeable, `openclerk-core` dependency already bumped to `^0.2.6` (npm
  registry) during onboarding session verification.

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — current architecture, including the
  `providers/`/`bluebook/` plugin-registry pattern PR #33 removes the vendored copies of
- `.planning/codebase/CONCERNS.md` — "`openclerk-core` logic duplicated, not shared" finding
  that motivated this phase
- `.planning/codebase/STRUCTURE.md` — directory layout reference for the `src/commands/` and
  `scripts/` audit

### Project-level
- `.planning/PROJECT.md` — Key Decisions table already records the `v0.2.1` → `^0.2.6` dependency
  fix rationale (ReDoS fixes + `caseNamesMatch` hallucination-verification bypass fix)
- `.planning/REQUIREMENTS.md` — CORE-01, CORE-02

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None new — this phase is dependency/cleanup work, not net-new feature code.

### Established Patterns
- Self-registering plugin registries (`providers/index.ts`, `bluebook/index.ts`) — PR #33
  preserves this pattern; the audit should confirm it still holds after merge (no orphaned
  registration imports left pointing at deleted local files).

### Integration Points
- `package.json` `dependencies.openclerk-core` — the single integration point this phase
  finalizes (already `^0.2.6` on the PR branch).
- `src/taskpane/word.ts` imports from `openclerk-core` instead of local `./utils`, `./providers`,
  `./bluebook` after merge — verify no other file in the repo still imports from the (deleted)
  local paths.

</code_context>

<specifics>
## Specific Ideas

No specific implementation requests beyond the two decisions above — this is a well-scoped,
mostly mechanical phase (merge + verify).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-openclerk-core-dependency-cleanup*
*Context gathered: 2026-07-15*
