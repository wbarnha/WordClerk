---
phase: 02-escaping-hardening
verified: 2026-07-16T00:00:00Z
status: human_needed
score: 3/4 must-haves verified (1 requires human smoke test)
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Manual Word smoke test (Roadmap Phase 2 Success Criterion 4). Open a real Word document (desktop or online) with OpenClerk sideloaded. Run through all four workflows end-to-end: (1) Manage Hyperlinks -- load a source .docx and apply case-law hyperlinks, confirm links are inserted correctly; (2) Bluebook Check -- run a check against document text, confirm issues render; (3) Hallucination Check -- connect a provider (e.g. CourtListener) and run a hallucination scan, confirm the \"possible hallucination\" guard still renders correctly for a deliberately-mismatched citation; (4) Embed Cited Text -- embed opinion text for a pincite citation, confirm a Word comment is inserted with the expected excerpt."
    expected: "No workflow regressed after the safeInsertion.ts wrapper refactor. In particular: hyperlinks render correctly (CR-01 fix verified no attribute-injection breakage), embedded opinion-text comments show unescaped legal text with correct ampersands/quotes/apostrophes (CR-02 fix verified no HTML-entity corruption), and the hallucination-check nameMismatch guard still renders for a deliberately-mismatched citation."
    why_human: "Requires a live Word desktop/online session with OpenClerk sideloaded, a real source .docx, and (for the hallucination check) a live CourtListener/provider connection -- cannot be exercised from static analysis or the Jest/node test environment. This project's workflow.human_verify_mode is end-of-phase, so 02-03-SUMMARY.md deliberately deferred this item (coverage id D4, human_judgment: true, status: pending) rather than blocking execution."
---

# Phase 02: Escaping Hardening Verification Report

**Phase Goal:** Hyperlink/HTML insertion into the Word document cannot bypass the existing escaping guards, at any current or future Office.js insertion call site.
**Verified:** 2026-07-16
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (Roadmap Success Criterion) | Status | Evidence |
|---|---|---|---|
| 1 | Branded SafeHtml/SafeHyperlinkUrl types exist and type-constrain the input parameter of every Office.js insertion helper | ✓ VERIFIED (with noted, reviewed nuance) | `openclerk-core/src/utils.ts:172,184,192,201` exports `SafeHyperlinkUrl`, `SafeHtml`, `toSafeHyperlinkUrl`, `toSafeHtml`; published to npm registry at 0.3.0 (`npm view openclerk-core version` → `0.3.0`). `safeInsertion.ts`'s `insertSafeHyperlink(url: SafeHyperlinkUrl, displayText: SafeHtml)` type-constrains both parameters — a bare `string` genuinely fails `tsc` (re-verified via a fresh transient negative-check, see below). **Nuance:** post-review-fix, `insertSafeComment(text: string)` and `insertSafeOoxml(ooxml: string)` (new, added by the WR-02 fix) intentionally take plain `string`, not a branded type. This is a deliberate, security-reviewed correction (CR-02): `Word.Range.insertComment` is a plain-text-only API, and feeding it `SafeHtml` (HTML-escaped) content corrupted real citation/opinion text (`&`, `'`, `"` → HTML entities) — a direct Core Value violation. Branding this parameter would have been the *wrong* fix. The compile-time enforcement for the two sinks that actually need escaping (`insertHtml`/`insertHyperlink`) remains fully branded-type-gated. |
| 2 | Every raw Office.js insertHtml/insertHyperlink/insertComment call in the codebase lives inside safeInsertion.ts and nowhere else | ✓ VERIFIED | `grep -rn "\.insertHtml(\|\.insertHyperlink(\|\.insertComment(\|\.insertOoxml(" src/ --include="*.ts" \| grep -v safeInsertion.ts` returns zero matches. `grep -c "applyHyperlinkToItem\|escapeHtml\|isSafeHyperlinkUrl" src/taskpane/word.ts` = 0. All four raw Office.js insertion/OOXML APIs (`insertHtml`, `insertHyperlink`, `insertComment`, and `insertOoxml` — the last found and fixed as WR-02) are exclusively called from `src/taskpane/safeInsertion.ts`. |
| 3 | ESLint fails the build (no-restricted-syntax) if a raw insertHtml/insertHyperlink/insertComment call is added outside safeInsertion.ts | ✓ VERIFIED (re-proven live, not just trusted from SUMMARY) | Independently reproduced the phase's own machine-proof: baseline `npm run lint` exits 0 → wrote a scratch file outside `safeInsertion.ts` calling raw `insertHtml` → `npm run lint` reported `error  Raw insertHtml calls must go through src/taskpane/safeInsertion.ts  no-restricted-syntax` and exited non-zero → deleted the scratch file → `npm run lint` clean again (exit 0, 3 pre-existing unrelated warnings only). Also independently reproduced the same for `insertOoxml` (WR-02's fix) — correctly flagged too. `eslint.config.mjs`'s exemption glob is path-anchored (`files: ["src/taskpane/safeInsertion.ts"]`, WR-01's fix — not the basename-only `**/safeInsertion.ts` the original review flagged as a scoping risk). CI's `lint:` job (`.github/workflows/ci.yml`) has no `continue-on-error`, and `publish:`'s `needs` array includes `lint` (and `typecheck`, WR-04's fix). |
| 4 | Hyperlinking, Bluebook checking, hallucination checking, and opinion-text embedding still work correctly against a real Word document after the wrapper refactor (manual smoke test) | ? UNCERTAIN — requires human | Cannot be automated (Office.js WebView host, live document, live provider). Deferred per `human_verify_mode: end-of-phase` (recorded in `02-03-SUMMARY.md` coverage id D4, `status: pending`). See Human Verification section below for the exact steps to run. |

**Score:** 3/4 truths automatically verified; 1 requires a human smoke test.

### Review Findings — Fix Verification (CR-01, CR-02, WR-01–WR-05)

This phase went through a code-review + fix cycle (`02-REVIEW.md` → `02-REVIEW-FIX.md`). Each finding was independently re-verified against the current codebase (not just trusted from the fix report):

| Finding | Claim | Re-verified? | Evidence |
|---|---|---|---|
| CR-01 | HTML-attribute injection via unescaped URL in `insertHtml` fallback, fixed by escaping the URL | ✓ Confirmed fixed | `safeInsertion.ts:39`: `` const html = `<a href="${escapeHtml(url)}">${displayText}</a>`; ``. Ran `tests/safeInsertion.test.ts` live (not trusted from report) — the CR-01 regression test (malicious `"><img src=x onerror=alert(1)>` URL fixture) passes, asserting the exact escaped attribute string. |
| CR-02 | HTML-escaped text fed into plain-text `insertComment`, corrupting cited legal text | ✓ Confirmed fixed | `safeInsertion.ts:56-63`: `insertSafeComment`'s `text` param is now plain `string`; doc comment explicitly explains why. Call site `word.ts:1330-1334` passes `buildEmbeddedCommentContent(raw, excerpt)` **unescaped** (no `toSafeHtml(...)` wrapper). `citationHasEmbeddedComment` (`word.ts:59-64`) compares against the same unescaped `raw` string used to build the marker — the downstream re-run-detection bug the review flagged is also resolved. Live test run confirms the CR-02 regression test (`&`, `'`, `"` fixture) asserts the stored value is byte-for-byte unchanged, no HTML entities. |
| WR-01 | ESLint exemption glob unanchored (`**/safeInsertion.ts` — basename match, not path-anchored) | ✓ Confirmed fixed | `eslint.config.mjs:69`: `files: ["src/taskpane/safeInsertion.ts"]` (path-anchored). |
| WR-02 | `insertOoxml` call in `word.ts` outside both the wrapper and the ESLint guard | ✓ Confirmed fixed | New `insertSafeOoxml` wrapper (`safeInsertion.ts:73-80`); `word.ts:1605` calls it; `eslint.config.mjs`'s `RAW_INSERTION_SELECTORS` now includes an `insertOoxml` selector. Independently re-proved the guard rejects a raw `insertOoxml` call outside `safeInsertion.ts` (see Truth 3 evidence). |
| WR-03 | Tests never asserted actual payload strings, missing the CR-01/CR-02 bug class | ✓ Confirmed fixed | `tests/safeInsertion.test.ts` now has dedicated payload-assertion tests for both (`escapes a quote character in the URL...`, `does not HTML-escape ampersands, quotes, or apostrophes`) — both ran and passed live. |
| WR-04 | No compiler type-checking step anywhere in build/CI for `word.ts` | ✓ Confirmed fixed | `package.json` has `"typecheck": "tsc --noEmit"`. `.github/workflows/ci.yml` has a `typecheck:` job (`needs: build`, no `continue-on-error`, runs `npm run typecheck`), and `publish:`'s `needs` array includes `typecheck`. Ran `npx tsc --noEmit` live — exits 0 against the whole `src/` tree including `word.ts`. |
| WR-05 | Stale comment claimed batched `context.sync()`, but every insertion syncs per item | ✓ Confirmed fixed | `word.ts:266-269` comment now accurately describes per-citation sync behavior in the insertion loop. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `openclerk-core/src/utils.ts` (sibling repo) | `SafeHyperlinkUrl`/`SafeHtml` types + smart constructors | ✓ VERIFIED | Present, published at v0.3.0 on the public npm registry. |
| `src/taskpane/safeInsertion.ts` | Sole wrapper for raw Office.js insertion APIs | ✓ VERIFIED | Exports `insertSafeHyperlink`, `insertSafeComment`, `insertSafeOoxml`; all raw API calls live here exclusively. |
| `tests/safeInsertion.test.ts` | Dedicated unit tests incl. CR-01/CR-02 regression coverage | ✓ VERIFIED | 8/8 tests pass, including both regression tests added by the fix cycle. |
| `eslint.config.mjs` | no-restricted-syntax bypass guard | ✓ VERIFIED | Path-anchored exemption; 4-API selector list; machine-proven to reject a bypass. |
| `.github/workflows/ci.yml` | Blocking `lint` + `typecheck` jobs gating `publish` | ✓ VERIFIED | Both jobs present, no `continue-on-error`, both in `publish.needs`. |
| `.eslintrc.json` | Deleted (dead config) | ✓ VERIFIED | `test ! -f .eslintrc.json` confirms removal. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `word.ts`'s 3 hyperlink workflows | `safeInsertion.ts`'s `insertSafeHyperlink` | `toSafeHyperlinkUrl`/`toSafeHtml` branded values | ✓ WIRED | `word.ts:313,410,620` — all three call sites pass branded values. |
| `word.ts`'s comment-embedding workflow | `safeInsertion.ts`'s `insertSafeComment` | unescaped `buildEmbeddedCommentContent(...)` | ✓ WIRED | `word.ts:1330-1334`. |
| `word.ts`'s `removeAllHyperlinks` | `safeInsertion.ts`'s `insertSafeOoxml` | plain-string OOXML | ✓ WIRED | `word.ts:1605`. |
| `office-addin-lint`'s `npm run lint` | `eslint.config.mjs` (project root) | `fs.existsSync` resolution, bypassing ESLint's default discovery | ✓ WIRED | Re-verified live (bypass-guard fires correctly); `.eslintrc.json` confirmed dead/removed. |
| `openclerk-word`'s `package.json` | `openclerk-core@^0.3.0` | npm registry resolution | ✓ WIRED | `package-lock.json`'s `openclerk-core` entry pins `^0.3.0`; installed package version 0.3.0; `npm view openclerk-core version` confirms public registry has 0.3.0. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Bypass-guard rejects raw `insertHtml` outside `safeInsertion.ts` | Wrote scratch file with raw call, ran `npm run lint`, deleted, re-ran | Errored with exact configured message, then clean | ✓ PASS |
| Bypass-guard rejects raw `insertOoxml` outside `safeInsertion.ts` | Same pattern, `insertOoxml` selector | Errored with exact configured message, then clean | ✓ PASS |
| `tsc --noEmit` passes against whole `src/` tree (WR-04) | `npx tsc --noEmit` | Exit 0 | ✓ PASS |
| Full Jest suite passes | `npm test` | 3 suites, 13 passed, 2 skipped (courtListener.live.test.ts, intentionally excluded) | ✓ PASS |
| CR-01/CR-02 regression tests pass | `npx jest tests/safeInsertion.test.ts` | 8/8 passed | ✓ PASS |
| `openclerk-core@0.3.0` published and resolvable | `npm view openclerk-core version` | `0.3.0` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| ESCAPE-01 | 02-01, 02-02, 02-03 | Branded `SafeHtml`/`SafeHyperlinkUrl` types added to (per D-01, superseded to `openclerk-core`) and used to type-constrain Office.js insertion helpers | ✓ SATISFIED (with noted nuance on `insertSafeComment`/`insertSafeOoxml`, see Truth 1) | Types exist, published, and constrain `insertSafeHyperlink`'s two parameters at compile time. |
| ESCAPE-02 | 02-02, 02-03 | Single wrapper module (`safeInsertion.ts`) owns all raw Office.js insertion calls | ✓ SATISFIED | Confirmed via full-codebase grep; zero raw calls outside `safeInsertion.ts`. |
| ESCAPE-03 | 02-04 | ESLint `no-restricted-syntax` rule bans direct calls outside the wrapper, failing the build on a bypass | ✓ SATISFIED | Machine-proven live (both `insertHtml` and `insertOoxml` bypass attempts correctly rejected); CI `lint`/`typecheck` jobs block `publish`. |

No orphaned requirements — REQUIREMENTS.md's traceability table lists exactly ESCAPE-01/02/03 for Phase 2, and all three are declared in plan frontmatter and satisfied above.

### Anti-Patterns Found

None blocking. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in `safeInsertion.ts`, `eslint.config.mjs`, or `word.ts`. No leftover scratch files (`__brand-check.ts`, `__lint-verify-scratch.ts`) in the working tree — `git status --short` shows only pre-existing, phase-unrelated untracked files (`.clasp.json`, `.scratch/`, `appsscript.json`).

### Human Verification Required

### 1. Manual Word smoke test (Roadmap Phase 2 Success Criterion 4)

**Test:** Open a real Word document (desktop or online) with OpenClerk sideloaded. Run through all four workflows end-to-end:
1. **Manage Hyperlinks** — load a source `.docx` and apply case-law hyperlinks, confirm links are inserted correctly.
2. **Bluebook Check** — run a check against document text, confirm issues render.
3. **Hallucination Check** — connect a provider (e.g. CourtListener) and run a hallucination scan, confirm the "possible hallucination" guard still renders correctly for a deliberately-mismatched citation.
4. **Embed Cited Text** — embed opinion text for a pincite citation, confirm a Word comment is inserted with the expected excerpt.

**Expected:** No workflow regressed after the `safeInsertion.ts` wrapper refactor. Specifically worth double-checking given the review+fix cycle: hyperlinks render with no broken/injected markup (CR-01), and embedded comment text shows correct ampersands/apostrophes/quotes rather than HTML entities like `&amp;`/`&#39;` (CR-02).

**Why human:** Requires a live Office.js WebView host (Word desktop/online), a real source document, and (for step 3) a live external provider connection — none of which are exercisable from static analysis or the Jest/node test environment.

## Gaps Summary

No blocking gaps. All three requirement IDs (ESCAPE-01/02/03) and Roadmap Success Criteria 1-3 are verified against the live codebase, not just SUMMARY claims — including independent re-execution of the phase's own machine-proofs (ESLint bypass rejection for both `insertHtml` and `insertOoxml`) and independent confirmation that both critical code-review findings (CR-01 HTML-attribute injection, CR-02 plain-text corruption) are genuinely fixed in the current code, with passing regression tests. One item (Success Criterion 4, the manual Word smoke test) cannot be automated and is correctly deferred to human verification per this project's `end-of-phase` UAT workflow — this is expected process, not a phase deficiency.

One nuance worth flagging for awareness (not a gap): the roadmap's literal Success Criterion 1 wording ("type-constrain the input parameter of every Office.js insertion helper") is no longer uniformly true post-fix — `insertSafeComment`/`insertSafeOoxml` intentionally take plain `string`. This was a deliberate, correctly-reasoned outcome of fixing CR-02 (branding comment text as `SafeHtml` was itself the bug), not scope creep or a missed requirement. The insertion-safety invariant that matters (no unvalidated content reaches a sink that needs escaping, and no raw API is callable from outside the wrapper) holds fully.

---

_Verified: 2026-07-16_
_Verifier: Claude (gsd-verifier)_
