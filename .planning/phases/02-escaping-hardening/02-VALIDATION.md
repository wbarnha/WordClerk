---
phase: 2
slug: escaping-hardening
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 (`ts-jest` preset) — identical framework in both `openclerk-word` and `openclerk-core` |
| **Config file** | `package.json`'s embedded `"jest"` block (`testMatch: **/tests/**/*.test.ts`, `testEnvironment: node`) — no standalone `jest.config.*` |
| **Quick run command** | `npx jest tests/safeInsertion.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds (small existing suite; no new heavy deps introduced) |

---

## Sampling Rate

- **After every task commit:** Run `npx jest tests/safeInsertion.test.ts`
- **After every plan wave:** Run `npm test` (full suite, both repos where applicable) + `npm run lint` (openclerk-word)
- **Before `/gsd-verify-work`:** Full suite green in both repos, `npm run lint` green, plus the manual Word smoke test (Success Criterion 4)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | ESCAPE-01 | T-2-01 | Smart constructors return branded value on valid input, `null` on invalid input (D-04) | unit | `npx jest tests/safeInsertion.test.ts -t "toSafeHyperlinkUrl"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ESCAPE-01 | T-2-01 | Branded-type parameter constraint rejects a plain `string` at compile time | type-check | `npm run build` (or `npx tsc --noEmit`) — deliberately widen a type, confirm build fails, then revert | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ESCAPE-02 | T-2-02 | `insertSafeHyperlink` dispatches `insertHyperlink` → `insertHtml` → `insertText` in existing fallback order | unit | `npx jest tests/safeInsertion.test.ts -t "dispatch"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ESCAPE-02 | T-2-02 | `insertSafeComment` calls `Word.Range.insertComment` with the given text | unit | `npx jest tests/safeInsertion.test.ts -t "insertSafeComment"` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ESCAPE-03 | T-2-03 | `no-restricted-syntax` fails the build when a raw insertion call exists outside `safeInsertion.ts` | integration (lint-as-test) | `npm run lint` against a deliberately-reintroduced violation, confirm non-zero exit, then revert | N/A — enforced by lint, not Jest | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `openclerk-word/tests/safeInsertion.test.ts` — new file, covers ESCAPE-01/02 (no existing test in this repo touches `word.ts`'s insertion logic)
- [ ] `openclerk-word/eslint.config.mjs` — new file, required for ESCAPE-03 to be enforceable at all (`.eslintrc.json` is not read by `npm run lint` — see RESEARCH.md Pitfall 1)
- [ ] `openclerk-core/tests/utils.test.ts` — extend (existing file) with `toSafeHyperlinkUrl`/`toSafeHtml` smart-constructor cases

*No shared Word.js/Office.js mock helper exists in this repo's `tests/` — keep mocks minimal/inline (plain objects matching the duck-typed `insertHyperlink`/`insertHtml`/`insertText` shape), consistent with the project's `es5`/no-framework conventions.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hyperlinking, Bluebook checking, hallucination checking, and opinion-text embedding still work correctly after the wrapper refactor | Roadmap Success Criterion 4 | `word.ts` has zero existing automated coverage (D-06 scope boundary); requires a real Office.js Word host, not reproducible under Jest | Open a real Word document; run through hyperlinking, a Bluebook check, a hallucination check, and opinion-text embedding; confirm behavior is unchanged post-refactor |
| `no-restricted-syntax` actually rejects a bypass (wiring, not logic) | ESCAPE-03 | Confirms the lint rule is actually wired into `npm run lint` (Pitfall 1: `.eslintrc.json` is silently ignored) rather than just present in a config file — not a permanent automated test, ESLint itself is the enforcement mechanism | Temporarily add a raw `insertHtml`/`insertHyperlink`/`insertComment` call outside `safeInsertion.ts`; run `npm run lint`; confirm it exits non-zero; then revert |
| `openclerk-core` publish (D-03 human checkpoint) | ESCAPE-01 (cross-repo sequencing) | Publishing to the public npm registry is an externally-visible, hard-to-reverse action — requires human trigger by design, not automatable | Executor prepares version bump/changelog/PR in `openclerk-core`; a person reviews and triggers `npm publish` / pushes the release tag |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
