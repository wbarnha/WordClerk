---
phase: 02-escaping-hardening
reviewed: 2026-07-15T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - .github/workflows/ci.yml
  - eslint.config.mjs
  - src/taskpane/safeInsertion.ts
  - src/taskpane/word.ts
  - tests/safeInsertion.test.ts
findings:
  critical: 2
  warning: 5
  info: 2
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This phase's stated goal was to migrate every raw Office.js DOM-insertion call site in
`word.ts` onto a single wrapper (`safeInsertion.ts`), gate future bypasses with an ESLint
`no-restricted-syntax` rule, and back the whole thing with compiler-enforced branded types
(`SafeHyperlinkUrl`/`SafeHtml` from `openclerk-core`). The migration of `insertHtml`/
`insertHyperlink`/`insertComment` call sites is real — `word.ts` no longer calls any of the
three directly, and the ESLint rule correctly flags any future direct call outside
`safeInsertion.ts`.

However, the wrapper itself has two content-escaping defects that directly contradict its
own safety claims, and the "compiler-enforced, not just convention" guarantee is not actually
backed by any type-checking step in this repo's build or CI pipeline. Both defects sit exactly
on the paths the phase was designed to protect (hyperlink insertion from an untrusted source
`.docx` and from external provider API responses; cited-opinion-text embedding), so they are
classified Critical rather than Warning:

1. `insertSafeHyperlink`'s `insertHtml` fallback branch (the branch actually exercised in
   production, since `insertHyperlink` doesn't exist in the installed `@types/office-js` and is
   absent from all released WordApi requirement sets) builds `<a href="${url}">...</a>` by
   naive string interpolation. `SafeHyperlinkUrl` only guarantees an allowlisted scheme
   (http/https/mailto) — it does **not** escape `"`/`<`/`>` for the HTML-attribute context it's
   spliced into, so a URL containing a `"` can break out of `href="..."` and inject arbitrary
   markup into the Word document. Verified against the actual `isSafeHyperlinkUrl`/
   `toSafeHyperlinkUrl` implementation shipped in `node_modules/openclerk-core`.
2. `insertSafeComment` forwards `SafeHtml` (HTML-escaped text) straight into
   `Word.Range.insertComment(commentText: string)`, which is a plain-text-only API (confirmed
   against the `@types/office-js` declaration — no HTML rendering). This corrupts any embedded
   opinion excerpt or citation text containing `&`, `<`, `>`, `"`, or `'` into literal HTML-entity
   text (`&amp;`, `&#39;`, ...) visible to the user — a direct hit on this project's stated core
   value that citation-related output must be trustworthy and accurate.

## Critical Issues

### CR-01: Unescaped URL enables HTML-attribute injection in the `insertHtml` fallback path

**File:** `src/taskpane/safeInsertion.ts:31-35`
**Issue:**
```ts
} else if (typeof (item as any).insertHtml === "function") {
  // url/displayText are already branded (validated/escaped) by construction -- no further
  // escaping step belongs here.
  const html = `<a href="${url}">${displayText}</a>`;
  (item as any).insertHtml(html, Word.InsertLocation.replace);
}
```
`url: SafeHyperlinkUrl` is validated only for scheme (via `openclerk-core`'s
`isSafeHyperlinkUrl`, which uses `new URL(...)` purely to read `.protocol` and then returns the
**original, unmodified input string** on success — not the normalized `.href`). Nothing escapes
`"`/`<`/`>` in the URL before it's spliced into an HTML attribute. Confirmed empirically:

```
isSafe('https://example.com/"><img src=x onerror=alert(1)>') === true
html === `<a href="https://example.com/"><img src=x onerror=alert(1)>">text</a>`
```

Because `insertHyperlink` has no declaration in the installed `@types/office-js` and is not
part of any released WordApi requirement set typed in this repo, `typeof item.insertHyperlink
=== "function"` will be `false` for essentially every real `Word.Range` in production, meaning
the vulnerable `insertHtml` branch is the de-facto default path, not a rare fallback. This path
is reachable with attacker-influenced input from:
- `parseSourceDocument` (`word.ts:1533`, `url` read from an untrusted source `.docx`'s
  relationship targets, `applyCaseLawHyperlinksFromSource` at `word.ts:270`/`310`)
- Parenthetical URLs typed by the user (`word.ts:374`/`407`) — lower risk since same-user, but
  still crosses a trust boundary if the doc is later shared/reviewed by someone else
- `match.url` returned by any `CitationProvider.lookupCitation` (`word.ts:606`/`617`) — a
  compromised or malicious enterprise API base URL, or a compromised CourtListener response,
  can supply this value directly

The comment "url/displayText are already branded (validated/escaped) by construction -- no
further escaping step belongs here" is incorrect for `url`: the brand only certifies scheme
safety, not HTML-attribute safety.

**Fix:** Escape the URL for the HTML-attribute context before interpolating (at minimum
double-quotes; ideally reuse `escapeHtml`/`toSafeHtml` on the URL for this specific sink), e.g.:
```ts
const html = `<a href="${escapeHtml(url)}">${displayText}</a>`;
```
or avoid string-built HTML entirely for this branch by setting the range's hyperlink via a
property/field API if one exists in the installed WordApi version, rather than `insertHtml`.

### CR-02: `SafeHtml` (HTML-escaped) content is written into a plain-text-only Word API, corrupting visible citation/opinion text

**File:** `src/taskpane/safeInsertion.ts:48-55`, call site `src/taskpane/word.ts:1327-1331`
**Issue:**
```ts
// safeInsertion.ts
export async function insertSafeComment(
  context: Word.RequestContext,
  range: Word.Range,
  text: SafeHtml
): Promise<void> {
  range.insertComment(text);
  await context.sync();
}
```
```ts
// word.ts
await insertSafeComment(
  context,
  searchResults.items[0],
  toSafeHtml(buildEmbeddedCommentContent(raw, excerpt))
);
```
`Word.Range.insertComment(commentText: string)` (per `@types/office-js`: "The comment text to
be inserted") is a plain-text API — it does not interpret or render HTML. `toSafeHtml` applies
`escapeHtml` (`&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;`, `"`→`&quot;`, `'`→`&#39;`). Feeding that
escaped string into a plain-text sink means any cited opinion excerpt or citation string
containing an ampersand, quote mark, or apostrophe — extremely common in real case names and
opinion text ("Smith & Wesson", "the Court's holding", quoted material) — is inserted into the
user's document as literal HTML-entity text (e.g. `Smith &amp; Wesson`, `Court&#39;s`) instead
of the original characters. This directly corrupts the legal text OpenClerk is supposed to be
embedding faithfully.

This also has a downstream functional consequence: `citationHasEmbeddedComment` (`word.ts:59-64`,
used at `word.ts:1287` to detect and skip citations that already have an embedded comment)
compares the *actual stored comment content* against `${MARKER} ${raw}` built from the
**unescaped** `raw` citation string. Since the stored content is HTML-escaped (per this bug),
any citation whose raw text contains `&`/`<`/`>`/`"`/`'` will never match on re-run, causing
OpenClerk to re-fetch (burning rate-limited API quota) and insert a duplicate comment instead of
recognizing the existing one.

**Fix:** Do not HTML-escape content destined for `insertComment` — it is a different sink than
`insertHtml`/`insertHyperlink` and needs plain text, not `SafeHtml`. Either introduce a
distinct branded type (e.g. `SafePlainText`, effectively a pass-through/normalize-only brand
with no HTML-escaping) for `insertSafeComment`'s parameter, or change `insertSafeComment` to
accept the raw string and skip escaping entirely, e.g.:
```ts
export async function insertSafeComment(
  context: Word.RequestContext,
  range: Word.Range,
  text: string // plain text -- insertComment does not render HTML, escaping would corrupt it
): Promise<void> {
  range.insertComment(text);
  await context.sync();
}
```
and update `word.ts:1330` to pass `buildEmbeddedCommentContent(raw, excerpt)` unescaped.

## Warnings

### WR-01: ESLint exemption glob for `safeInsertion.ts` is unanchored to its directory

**File:** `eslint.config.mjs:60-68`
**Issue:**
```ts
{
  // Exact scoped glob -- matches only src/taskpane/safeInsertion.ts, the sole file allowed to
  // call the raw Office.js insertion APIs. A broader directory glob here would silently defeat
  // the guard for every other file under src/taskpane/.
  files: ["**/safeInsertion.ts"],
  rules: {
    "no-restricted-syntax": "off",
  },
},
```
The comment claims this glob "matches only `src/taskpane/safeInsertion.ts`", but `**/safeInsertion.ts`
actually matches *any path ending in `/safeInsertion.ts` at any depth* — it is a basename match,
not a path-anchored match. It happens to resolve to exactly one file today only because
`office-addin-lint`'s default lint target (`src/**/*.{ts,tsx,js,jsx}`, from
`node_modules/office-addin-lint/lib/defaults.js`) and the fact that no other file in the repo
shares that basename. If a future contributor adds a same-named file anywhere else under `src/`
(e.g. a test double, a per-feature helper in `src/commands/`, or a second wrapper introduced
during a later refactor), the guard is silently disabled there too — exactly the "looks correct
but is too broad" failure mode the surrounding comment says it's trying to avoid.

**Fix:** Anchor the glob to the real path so it cannot accidentally match a same-named file
elsewhere:
```ts
files: ["src/taskpane/safeInsertion.ts"],
```

### WR-02: A raw Office.js DOM-insertion call (`insertOoxml`) still exists in `word.ts`, outside both the wrapper and the ESLint guard

**File:** `src/taskpane/word.ts:1602`
**Issue:** `safeInsertion.ts`'s header comment states it is "the only place in openclerk-word
allowed to call a raw Office.js insertion API (insertHtml/insertHyperlink/insertComment)." That
claim is only true for those three specific APIs. `removeAllHyperlinks` still calls
`body.insertOoxml(strippedOoxml, Word.InsertLocation.replace)` directly, and the ESLint
`no-restricted-syntax` selector list in `eslint.config.mjs:36-49` only restricts
`insertHtml`/`insertHyperlink`/`insertComment` — `insertOoxml` is not covered at all, by design
or oversight. In this specific call site the OOXML being re-inserted originates from the
document's own existing content (`body.getOoxml()`, regex-stripped of hyperlink wrapper tags),
so the immediate exploitability is low, but it is still an unguarded raw-insertion pathway that
contradicts the phase's documented completeness claim, and any future code that reuses this
pattern with less-trusted OOXML would get no protection from the guard added in this phase.

**Fix:** Either extend the ESLint selector list to also flag `insertOoxml` outside
`safeInsertion.ts` (moving `removeAllHyperlinks`'s OOXML round-trip into the wrapper module, or
carving out a narrowly-scoped second exemption with its own rationale comment), or correct the
header comment in `safeInsertion.ts` so it doesn't overstate the guard's coverage.

### WR-03: `safeInsertion.test.ts` never asserts on the actual payload passed to `insertHtml`, missing exactly the bug class found in CR-01/CR-02

**File:** `tests/safeInsertion.test.ts:39-50`, `:64-76`
**Issue:** The `insertHtml` dispatch test only checks call counts:
```ts
test("calls only insertHtml when insertHyperlink is unavailable", async () => {
  ...
  await insertSafeHyperlink(context as any, item as any, url, text);
  expect(insertHtml).toHaveBeenCalledTimes(1);
  expect(insertText).not.toHaveBeenCalled();
  expect(context.sync).toHaveBeenCalledTimes(1);
});
```
It never inspects the actual HTML string built (`<a href="${url}">${displayText}</a>`), so a
test asserting the exact string produced from a URL containing a `"` would have caught CR-01
directly. The `insertComment` test does assert `toHaveBeenCalledWith(text)`, but only checks
that the wrapper forwards the same `SafeHtml` value unchanged — it never asserts that the value
is semantically correct for a plain-text sink, so it does not (and structurally cannot) catch
CR-02.

**Fix:** Add assertions on the literal string/argument values, e.g.
`expect(insertHtml).toHaveBeenCalledWith('<a href="...">...</a>', ...)` with a URL fixture
containing `"`/`<`/`>` to lock in correct attribute-escaping, and an `insertComment` test that
feeds text containing `&`/`'`/`"` and asserts the stored value has no HTML entities.

### WR-04: The "compiler-enforced, not just convention" branded-type guarantee is not actually checked anywhere for `word.ts`

**File:** `package.json` (`scripts.build`, `scripts.test`), `webpack.config.js:36-41`, `.github/workflows/ci.yml` (build/test/lint jobs)
**Issue:** `safeInsertion.ts`'s header comment states: "the guarantee that only already-
validated/escaped content reaches Office.js is compiler-enforced here, not just convention." In
practice, no step in this repo's build or CI pipeline runs `tsc` against `word.ts`:
- `npm run build` runs webpack with `babel-loader` (`webpack.config.js:36-41`), which strips
  TypeScript types via `@babel/preset-typescript` without performing any type-checking.
- `npm test` runs Jest with the `ts-jest` preset, which does perform type-checking — but only
  for files that are actually `require`d during a test run. No file under `tests/` imports
  `src/taskpane/word.ts` (confirmed by search), so `word.ts` is never parsed or type-checked by
  `ts-jest` either.
- There is no `tsc`/`typecheck` npm script, and none of `ci.yml`'s jobs (`build`, `test`,
  `lint`, `installer-smoke*`, `offline-smoke`, `publish`) invoke `tsc` directly.
- `eslint.config.mjs`'s `@typescript-eslint/parser` is configured without a `parserOptions.project`,
  so ESLint here does purely syntactic parsing, not type-aware linting either.

The net effect: if a future edit to `word.ts` passed a plain `string` where `SafeHyperlinkUrl`
or `SafeHtml` is required (defeating the entire point of this phase), it would compile silently
under Babel, produce no ts-jest diagnostic (word.ts is never transformed by Jest), pass ESLint
(no type info available), and ship. Only `safeInsertion.ts` itself currently gets real
type-checking, incidentally, because `tests/safeInsertion.test.ts` imports it.

**Fix:** Add a `"typecheck": "tsc --noEmit"` script and run it as its own CI job (or as a step
in the existing `build`/`lint` job) so the branded-type guarantee this phase is built around
actually holds for every file in `src/`, not just the ones a test file happens to import.

### WR-05: Stale comment claims batched `context.sync()`, but every insertion now syncs per item

**File:** `src/taskpane/word.ts:266-268` vs. `src/taskpane/safeInsertion.ts:40`, `:54`
**Issue:**
```ts
// Batch all searches/loads/inserts into a handful of context.sync() calls instead of a
// few per citation -- a document with 50-100+ citations previously meant 200-400+
// sequential round-trips, which is enough to make the taskpane visibly freeze.
```
This comment precedes `applyCaseLawHyperlinksFromSource`, whose insertion loop
(`word.ts:305-312`) calls `await insertSafeHyperlink(context, item, url, ...)` once per matched
item, and `insertSafeHyperlink` unconditionally calls `await context.sync()` at the end of every
invocation (`safeInsertion.ts:40`). The same pattern recurs at `word.ts:403-409` and
`word.ts:616-618`, and `insertSafeComment` does the same (`safeInsertion.ts:54`). So the actual
behavior post-refactor is exactly the "few [syncs] per citation" round-trip pattern the comment
says was eliminated — for a 50-100+ citation document, this reintroduces the original freeze
this code was written to avoid. (Flagged as a documentation-accuracy/maintainability issue per
this review's scope, not as a standalone performance finding.)

**Fix:** Either update the comment to reflect the current one-sync-per-insertion behavior, or
restore true batching by giving `insertSafeHyperlink`/`insertSafeComment` (or new
non-syncing variants) an option to skip the internal `context.sync()` so callers can still batch
multiple insertions into one sync.

## Info

### IN-01: `toSafeHyperlinkUrl` can return a branded value containing un-trimmed whitespace

**File:** `src/taskpane/word.ts:270` (call site; root cause is in `openclerk-core`'s `toSafeHyperlinkUrl`)
**Issue:** `toSafeHyperlinkUrl(url)` validates using a trimmed copy internally but returns the
original, un-trimmed `url` argument on success. Most call sites in `word.ts` trim before calling
it (`word.ts:374`: `entry.url.trim()`), but `applyCaseLawHyperlinksFromSource`
(`word.ts:270`: `toSafeHyperlinkUrl(rawUrl)`) does not — `rawUrl` comes straight from a parsed
source `.docx`'s relationship target. A URL with leading/trailing whitespace would pass
validation and carry that whitespace into the "safe" branded value used for the actual
hyperlink insertion.
**Fix:** Trim at the `word.ts:270` call site (`toSafeHyperlinkUrl(rawUrl.trim())`) for
consistency with the other call sites, independent of whether `openclerk-core` is also fixed to
return the trimmed/validated form.

### IN-02: `insertHyperlink`'s content-type contract for `displayText` is unverified

**File:** `src/taskpane/safeInsertion.ts:26-30`
**Issue:** The `insertHyperlink` branch passes the same `displayText: SafeHtml` (HTML-escaped)
value used by the `insertHtml` branch. Since `insertHyperlink` has no type declaration in this
repo (`@types/office-js` doesn't include it) and its real behavior can't be confirmed from
source, it's unverified whether its display-text parameter renders as HTML (in which case
escaping is correct) or as plain text (in which case it would suffer the same corruption as
CR-02 if this branch is ever exercised on a host that does implement the preview API).
**Fix:** Confirm against real Office.js host documentation/behavior once available, and add a
regression test once the actual contract is known.

---

_Reviewed: 2026-07-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
