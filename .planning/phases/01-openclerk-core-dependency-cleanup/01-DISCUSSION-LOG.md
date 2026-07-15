# Phase 1: openclerk-core Dependency Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 1-openclerk-core-dependency-cleanup
**Areas discussed:** PR #33 merge method, Duplication audit depth

---

## PR #33 Merge Method

| Option | Description | Selected |
|--------|-------------|----------|
| Squash merge | One clean commit on main — simplest history, but loses the 4-commit trail unless preserved in the squash message | |
| Merge commit | Preserves the 4 individual commits and their detailed messages — useful given the security-relevant reasoning in commit 3 | ✓ |

**User's choice:** Merge commit.
**Notes:** Commit 3's message documents a real hallucination-verification bug fix (migrating `checkForHallucinations` onto `openclerk-core`'s shared function), worth preserving in history rather than flattening into a squash.

| Option | Description | Selected |
|--------|-------------|----------|
| Plan merges it directly | The phase's plan includes merging PR #33 as its first task via `gh` | |
| I'll merge it myself | The plan stops short of merging — documents the requirement but the user clicks merge on GitHub | ✓ |

**User's choice:** I'll merge it myself.
**Notes:** `git.branching_strategy` is `"none"` for this project (merges land straight on `main`), so this is a shared-state action the user wants to trigger personally rather than delegate to the plan.

---

## Duplication Audit Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Formally confirm spot-check | Plan verifies systematically that src/commands/ has no overlap and scripts/generate-bluebook-data.js (deleted by PR #33) was the only real duplicate — low effort | ✓ |
| Deep line-by-line diff | Compare every function/export in src/commands/ and scripts/ against openclerk-core's full export surface | |

**User's choice:** Formally confirm the spot-check.
**Notes:** Orchestrator's live scout during discussion (reading `src/commands/commands.word.ts` and listing `scripts/`) found `src/commands/` is unmodified Yeoman boilerplate with zero citation-logic overlap, and `scripts/generate-bluebook-data.js` is the only file with real logic overlap — already deleted by PR #33. No further gray area to resolve; audit scope confirmed as a verification pass, not open-ended.

---

## Claude's Discretion

- Exact grep/search strategy for the post-merge duplication confirmation pass.
- Whether to also spot-check `tests/` for any remaining test file importing from a now-deleted internal path.

## Deferred Ideas

None — discussion stayed within phase scope.
