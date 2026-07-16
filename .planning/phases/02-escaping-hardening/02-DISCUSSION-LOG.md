# Phase 2: Escaping Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 2-escaping-hardening
**Areas discussed:** Branded-type home, Cross-repo sequencing, Publish authority, Failure behavior, CI lint gate, Test coverage

---

## Branded-type home

Discovered during codebase scouting: ROADMAP.md/REQUIREMENTS.md say the branded
`SafeHtml`/`SafeHyperlinkUrl` types go in `utils.ts`, but `utils.ts` no longer exists in
`openclerk-word` — Phase 1 moved `escapeHtml`/`isSafeHyperlinkUrl` into the `openclerk-core` npm
package (confirmed via grep: `word.ts` imports both from `"openclerk-core"`, not a local path).

| Option | Description | Selected |
|--------|-------------|----------|
| New local utils.ts | Recreate a small local utils.ts holding only the branded types + smart constructors, wrapping openclerk-core's functions. Keeps this phase entirely local. | |
| Inline in safeInsertion.ts | Define branded types directly in safeInsertion.ts, next to their only consumer. | |
| Upstream into openclerk-core | Add branded types to openclerk-core itself, publish a new version, bump the dependency here. | ✓ |

**User's choice:** Upstream into openclerk-core
**Notes:** Chose the highest-scope option knowing it requires cross-repo coordination — confirmed a sibling `openclerk-core` checkout exists locally at `C:\Users\willi\openclerk-core` (v0.2.7) before locking this in, since the option is only viable if that repo is actually reachable.

---

## Cross-repo sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Same phase, both repos | Phase 2 includes a wave that edits openclerk-core, bumps/publishes it (human-checkpointed), then bumps the openclerk-word dependency and builds safeInsertion.ts. | ✓ |
| Separate prerequisite effort | Treat the openclerk-core change as its own piece of work in that repo's own GSD planning, done and released first; Phase 2 here starts only once published. | |

**User's choice:** Same phase, both repos
**Notes:** One phase, one CONTEXT.md, sequenced waves — avoids splitting the work across two separate discuss/plan/execute cycles.

---

## Publish authority

| Option | Description | Selected |
|--------|-------------|----------|
| Human checkpoint | Executor prepares the version bump/PR in openclerk-core; a person triggers the actual npm publish / release tag. | ✓ |
| Executor can publish autonomously | Executor bumps version and pushes the release tag without a separate confirmation. | |

**User's choice:** Human checkpoint
**Notes:** Matches the PR #33 merge-checkpoint pattern from Phase 1 — publishing a package version is externally visible and hard to reverse.

---

## Failure behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Return null, caller skips | Matches the existing "move on, don't crash" pattern already used for provider lookups; call sites already filter unsafe URLs today, this just makes it compiler-enforced. | ✓ |
| Throw an Error | Fail loudly since this is a security guard; would require wrapping every call site in try/catch, a behavior change from today. | |

**User's choice:** Return null, caller skips
**Notes:** No runtime behavior change intended — the type system enforces what convention already enforces today.

---

## CI lint gate

Discovered during codebase scouting: `.github/workflows/ci.yml` runs `build`, `npm test` (jest),
and manifest `xmllint` validation, but no `npm run lint` / ESLint step exists anywhere in CI today.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add ESLint to CI | Add an `npm run lint` step so the no-restricted-syntax bypass-guard actually blocks a bad PR automatically. | ✓ |
| No, out of scope | Leave CI as-is; the rule only protects developers who lint locally. | |

**User's choice:** Yes, add ESLint to CI
**Notes:** Without this, ESCAPE-03's "ESLint fails the build" claim would not actually be true in CI — only locally/in-editor.

---

## Test coverage

Discovered during codebase scouting: `tests/` currently contains only `installer.test.ts` and
`manifest.test.ts` — citation/provider/utils tests moved to `openclerk-core` in Phase 1, leaving
`word.ts` and its insertion logic with zero automated coverage in this repo.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, unit-test safeInsertion.ts | Test the new safety-critical module in isolation without touching the rest of the untested word.ts monolith. | ✓ |
| No, manual smoke test only | Rely solely on the roadmap's manual smoke-test success criterion, matching word.ts's existing zero-coverage state. | |

**User's choice:** Yes, unit-test safeInsertion.ts
**Notes:** Scope stays limited to the new module — does not reopen WORDTS-01/02 (word.ts monolith split), which stays deferred to v2.

---

## Claude's Discretion

- Exact TypeScript branding mechanism and smart-constructor naming in openclerk-core.
- Whether safeInsertion.ts wrapper functions own `context.sync()` internally or leave it to the caller (reconciling two existing call-site patterns).
- Whether to preserve the existing 3-tier hyperlink fallback (insertHyperlink → insertHtml → insertText) as-is.
- Scoping `commands.word.ts`'s hardcoded `insertParagraph("Hello World", ...)` call out of the ESLint bypass-guard (no dynamic content, not one of the three named APIs).
- Exact ESLint `no-restricted-syntax` selector/override mechanism.
- semver choice (patch vs. minor) for the new openclerk-core release.

## Deferred Ideas

None — discussion stayed within phase scope.
