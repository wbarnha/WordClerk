# Phase 2: Escaping Hardening - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 8 (2 new in openclerk-word, 1 new project-root config, 1 new test, 2 modified in openclerk-word, 1 modified + 1 test-extended in openclerk-core)
**Analogs found:** 6 / 8 (2 have no direct in-repo analog — a genuinely new pattern per RESEARCH.md; RESEARCH.md's own Code Examples are the primary source for those instead)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `src/taskpane/safeInsertion.ts` (word repo, NEW) | utility/wrapper (Office.js insertion boundary) | request-response (sync dispatch, no persistence) | `src/taskpane/word.ts`'s `applyHyperlinkToItem` function (217-233) — this *is* the code being extracted, not an external analog | exact (extraction, not net-new pattern) |
| `eslint.config.mjs` (word repo, NEW, project root) | config | transform (static-analysis config, not runtime) | none in-repo (`.eslintrc.json` exists but is legacy format/dead per RESEARCH.md Pitfall 1) — use RESEARCH.md's own verified Code Example | no analog — use RESEARCH.md Code Example |
| `tests/safeInsertion.test.ts` (word repo, NEW) | test | request-response / unit | `openclerk-core/tests/utils.test.ts` (Jest conventions: `describe`/`test`, plain-value assertions) for structural style; RESEARCH.md's own skeleton for the mock-dispatch pattern (no existing Word.js mock in this repo) | role-match (style) + no analog (content) |
| `src/taskpane/word.ts` (word repo, MODIFY) | controller (task-pane orchestrator) | request-response | itself — pattern is "replace 3 raw call sites + 4 pre-filter sites with imports from `safeInsertion.ts`/`openclerk-core`" | exact (self-modification) |
| `C:\Users\willi\openclerk-core\src\utils.ts` (MODIFY) | utility (leaf module, dependency-free) | transform | itself — `isSafeHyperlinkUrl`/`escapeHtml` (136-163) are the functions being wrapped by new smart constructors | exact (extension of existing file) |
| `C:\Users\willi\openclerk-core\tests\utils.test.ts` (MODIFY) | test | request-response / unit | itself — existing `describe('isSafeHyperlinkUrl', ...)` block (29-50) is the direct template for new `toSafeHyperlinkUrl`/`toSafeHtml` test blocks | exact (extension of existing file) |
| `.github/workflows/ci.yml` (word repo, MODIFY) | config (CI pipeline) | batch | itself — existing `test:` job (53-71) is the template for the new `lint:` job | exact (peer job, same structure) |
| `package.json` (word repo, MODIFY) | config | — | itself — `dependencies.openclerk-core` field (line 41) | exact (single-line version bump) |

## Pattern Assignments

### `src/taskpane/safeInsertion.ts` (utility/wrapper, request-response)

**Analog:** `src/taskpane/word.ts` lines 217-233 (`applyHyperlinkToItem`) and 1220-1234 (`insertComment` call site) — this is a direct extraction/refactor, not a "look elsewhere for style" analog. Also structurally comparable to `src/taskpane/providers/base.ts`'s export style (small, focused module exporting a few typed async functions) for *module organization conventions*, though `base.ts` itself was not found in this checkout under that exact path during this pass — RESEARCH.md's own verified Code Example is authoritative for the wrapper's shape.

**Current code being extracted** (`word.ts:217-233`):
```typescript
async function applyHyperlinkToItem(
  context: Word.RequestContext,
  item: Word.Range,
  url: string,
  displayText: string
): Promise<void> {
  if (typeof (item as any).insertHyperlink === "function") {
    (item as any).insertHyperlink(url, displayText, Word.InsertLocation.replace);
  } else if (typeof (item as any).insertHtml === "function") {
    const html = `<a href="${escapeHtml(url)}">${escapeHtml(displayText)}</a>`;
    (item as any).insertHtml(html, Word.InsertLocation.replace);
  } else {
    // Last-resort: replace with plain text (no hyperlink)
    item.insertText(displayText, Word.InsertLocation.replace);
  }
  await context.sync();
}
```

**Current `insertComment` call site** (`word.ts:1229-1233`, inside a `Word.run` block):
```typescript
// A Word comment is collapsed by default (just a margin icon) and expands on click --
// exactly the "embedded, expandable/collapsible" behavior this feature is for, using
// Word's own native UI instead of a custom widget.
searchResults.items[0].insertComment(buildEmbeddedCommentContent(raw, excerpt));
await context.sync();
```

**Target shape** (per RESEARCH.md's verified Code Example — copy this, not a reimplementation):
```typescript
import { SafeHtml, SafeHyperlinkUrl } from "openclerk-core";

export async function insertSafeHyperlink(
  context: Word.RequestContext,
  item: Word.Range,
  url: SafeHyperlinkUrl,
  displayText: SafeHtml
): Promise<void> {
  if (typeof (item as any).insertHyperlink === "function") {
    (item as any).insertHyperlink(url, displayText, Word.InsertLocation.replace);
  } else if (typeof (item as any).insertHtml === "function") {
    const html = `<a href="${url}">${displayText}</a>`; // both already branded/escaped
    (item as any).insertHtml(html, Word.InsertLocation.replace);
  } else {
    item.insertText(displayText, Word.InsertLocation.replace);
  }
  await context.sync();
}

export function insertSafeComment(range: Word.Range, text: SafeHtml): Word.Comment {
  return range.insertComment(text);
}
```

**Imports pattern:** relative import for internal, package-name import for `openclerk-core` — matches `word.ts:11-30`'s existing style (`import JSJip from "jszip"; import { ... } from "openclerk-core";` — confirmed no path-alias usage in this codebase, per project conventions ("Import Organization: None. Use relative paths consistently").

**Error handling pattern:** None needed inside the wrapper itself — the "move on, don't crash" pattern lives at the smart-constructor boundary (returns `null`), not inside `safeInsertion.ts`. Do not add try/catch here; preserve the existing unguarded `await context.sync()` pattern from `applyHyperlinkToItem`.

**`context.sync()` placement discretion (per CONTEXT.md/RESEARCH.md Open Question 2):** Recommend standardizing on "wrapper takes `context`, syncs internally" for both functions (matches `applyHyperlinkToItem`'s existing pattern) — but `insertSafeComment` in RESEARCH.md's example does NOT take `context`/sync internally (matches the *other* existing pattern, where the surrounding `Word.run` block syncs after). This inconsistency is called out in RESEARCH.md as unresolved — flag for the planner to pick one calling convention explicitly rather than copy the example's minor inconsistency verbatim.

---

### `eslint.config.mjs` (config, project root, NEW)

**No in-repo analog** — `.eslintrc.json` exists but is confirmed dead for `npm run lint` purposes (RESEARCH.md Pitfall 1). Use RESEARCH.md's fully-verified Code Example directly:

```javascript
import officeAddins from "eslint-plugin-office-addins";
import tsParser from "@typescript-eslint/parser";

const RAW_INSERTION_SELECTORS = [
  {
    selector: "CallExpression[callee.property.name='insertHtml']",
    message: "Raw insertHtml calls must go through src/taskpane/safeInsertion.ts.",
  },
  {
    selector: "CallExpression[callee.property.name='insertHyperlink']",
    message: "Raw insertHyperlink calls must go through src/taskpane/safeInsertion.ts.",
  },
  {
    selector: "CallExpression[callee.property.name='insertComment']",
    message: "Raw insertComment calls must go through src/taskpane/safeInsertion.ts.",
  },
];

export default [
  ...officeAddins.configs.recommended,
  {
    plugins: { "office-addins": officeAddins },
    languageOptions: { parser: tsParser },
    rules: {
      "no-restricted-syntax": ["error", ...RAW_INSERTION_SELECTORS],
    },
  },
  {
    files: ["**/safeInsertion.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];
```

Note: keep all three selectors in a single rule-array entry (not split across config objects) — flat config's `no-restricted-syntax` does not merge across matching entries (RESEARCH.md Anti-Pattern, citing eslint/eslint#19239).

---

### `tests/safeInsertion.test.ts` (word repo, test, NEW)

**Style analog:** `C:\Users\willi\openclerk-core\tests\utils.test.ts` — `describe`/`test` blocks, direct `expect(...).toBe(...)` assertions, no custom test harness. This repo's own `tests/installer.test.ts` and `tests/manifest.test.ts` confirm the same plain-Jest style (no mocking library, no snapshot testing) but neither touches Word.js, so there's no existing Word.js mock to imitate.

**Jest config** (from `package.json:81-87`):
```json
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "testMatch": ["**/tests/**/*.test.ts"]
}
```

**Mock/dispatch pattern (no in-repo precedent — use RESEARCH.md's verified skeleton, duck-typed plain objects, no framework):**
```typescript
import { toSafeHyperlinkUrl, toSafeHtml } from "openclerk-core";
import { insertSafeHyperlink } from "../src/taskpane/safeInsertion";

describe("toSafeHyperlinkUrl", () => {
  test("returns null for a javascript: URL", () => {
    expect(toSafeHyperlinkUrl("javascript:alert(1)")).toBeNull();
  });
  test("returns a branded value for an https URL", () => {
    expect(toSafeHyperlinkUrl("https://example.com")).toBe("https://example.com");
  });
});

describe("insertSafeHyperlink dispatch", () => {
  test("prefers insertHyperlink when available", async () => {
    const insertHyperlink = jest.fn();
    const item = { insertHyperlink, insertHtml: jest.fn(), insertText: jest.fn() };
    const context = { sync: jest.fn().mockResolvedValue(undefined) };
    const url = toSafeHyperlinkUrl("https://example.com")!;
    const text = toSafeHtml("Smith v. Jones");
    await insertSafeHyperlink(context as any, item as any, url, text);
    expect(insertHyperlink).toHaveBeenCalled();
  });
});
```

---

### `src/taskpane/word.ts` (controller, MODIFY)

**Analog:** itself — every call site is already identified with exact line numbers in RESEARCH.md.

**Imports to change** (`word.ts:11-30`, currently):
```typescript
import {
  normalizeText,
  isLikelyCaseCitation,
  extractParentheticalCitations,
  escapeHtml,
  isSafeHyperlinkUrl,
  citationProviderRegistry,
  ...
} from "openclerk-core";
```
Add `toSafeHtml, toSafeHyperlinkUrl` to this same `openclerk-core` import block (once published); add a new `import { insertSafeHyperlink, insertSafeComment } from "./safeInsertion";`. `escapeHtml`/`isSafeHyperlinkUrl` imports can likely be dropped from `word.ts` entirely once all 4 pre-filter sites move to `toSafeHyperlinkUrl` and the two insertion call sites move into `safeInsertion.ts` — confirm no other remaining use in the file before removing.

**Call sites to migrate (exact locations, all confirmed present in current file read):**
| Location | Current | Becomes |
|----------|---------|---------|
| `word.ts:217-233` (`applyHyperlinkToItem`) | inline 3-tier dispatch, `escapeHtml` calls | delete function body, replace call sites with `safeInsertion.insertSafeHyperlink(...)` |
| `word.ts:250` (filter predicate) | `... && url && isSafeHyperlinkUrl(url)` | `... && url && toSafeHyperlinkUrl(url) !== null` (or restructure to reuse the branded value downstream, per RESEARCH.md's "single validation, reused" note) |
| `word.ts:342` (filter predicate) | `... && isSafeHyperlinkUrl(entry.url)` | same pattern as above |
| `word.ts:552` (guard) | `if (!match \|\| !isSafeHyperlinkUrl(match.url))` | `if (!match \|\| !toSafeHyperlinkUrl(match.url))` |
| `word.ts:1232` (`insertComment` call) | `searchResults.items[0].insertComment(buildEmbeddedCommentContent(raw, excerpt))` | `safeInsertion.insertSafeComment(searchResults.items[0], toSafeHtml(buildEmbeddedCommentContent(raw, excerpt)))` |
| `word.ts:1426` (guard) | `... && isSafeHyperlinkUrl(url)` | `... && toSafeHyperlinkUrl(url)` |

---

### `C:\Users\willi\openclerk-core\src\utils.ts` (utility, MODIFY)

**Analog:** itself. Existing `isSafeHyperlinkUrl` (136-154) and `escapeHtml` (156-163):
```typescript
const ALLOWED_HYPERLINK_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/**
 * Only http(s)/mailto URLs are safe to write into a Word hyperlink here -- source .docx files
 * come from whoever the user chooses to import, and parenthetical URLs are free-form user input,
 * so schemes like javascript:/vbscript:/file: must be rejected before insertHyperlink/insertHtml.
 */
export function isSafeHyperlinkUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }
  try {
    const parsed = new URL(trimmed, "https://placeholder.invalid/");
    return ALLOWED_HYPERLINK_SCHEMES.has(parsed.protocol);
  } catch {
    return false;
  }
}

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

**Doc-comment style to match** (per project conventions — explains *why*, not *what*, especially security rationale): the existing `isSafeHyperlinkUrl` comment above is the exact template to follow for the new smart constructors' doc comments.

**New code to add** (per RESEARCH.md Pattern 1, verified against this repo's actual `tsconfig.json` non-strict mode):
```typescript
export type SafeHyperlinkUrl = string & { readonly __brand: "SafeHyperlinkUrl" };
export type SafeHtml = string & { readonly __brand: "SafeHtml" };

// Smart constructor: only way to produce a SafeHyperlinkUrl. Returns null on invalid input
// (never throws) so callers can "move on" the same way isSafeHyperlinkUrl callers do today.
export function toSafeHyperlinkUrl(url: string): SafeHyperlinkUrl | null {
  return isSafeHyperlinkUrl(url) ? (url as SafeHyperlinkUrl) : null;
}

// Smart constructor for pre-escaped HTML content (escapeHtml is total -- cannot fail -- so this
// always returns a SafeHtml, never null).
export function toSafeHtml(raw: string): SafeHtml {
  return escapeHtml(raw) as SafeHtml;
}
```

Also update `src/index.ts` (lines 1-8) to export the two new types + two new functions alongside the existing `escapeHtml, isSafeHyperlinkUrl` re-export block.

---

### `C:\Users\willi\openclerk-core\tests\utils.test.ts` (test, MODIFY)

**Analog:** itself — the existing `describe('isSafeHyperlinkUrl', ...)` block (lines 29-50) is the direct template:
```typescript
import {
  normalizeText,
  isLikelyCaseCitation,
  extractParentheticalCitations,
  isSafeHyperlinkUrl,
} from '../src/utils';

describe('isSafeHyperlinkUrl', () => {
  test('allows http and https URLs', () => {
    expect(isSafeHyperlinkUrl('http://example.com')).toBe(true);
    expect(isSafeHyperlinkUrl('https://example.com/case?id=1')).toBe(true);
  });
  test('rejects javascript/vbscript/data/file schemes', () => {
    expect(isSafeHyperlinkUrl('javascript:alert(1)')).toBe(false);
    ...
  });
});
```
New blocks (`describe('toSafeHyperlinkUrl', ...)`, `describe('toSafeHtml', ...)`) should follow this exact same style — single-quoted strings (test-file convention per project conventions), `.toBe`/`.toBeNull()` assertions, one behavior per `test()`. Add `toSafeHyperlinkUrl, toSafeHtml` to the top import block.

---

### `.github/workflows/ci.yml` (config, MODIFY)

**Analog:** itself — existing `test:` job (lines 53-71) is the structural template; RESEARCH.md's Code Example already adapts it:
```yaml
test:
  name: Test
  needs: build
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    - name: Install dependencies
      run: npm ci
    - name: Run tests
      run: npm test
```
New `lint:` job (insert as a peer job, e.g. immediately after `test:`):
```yaml
lint:
  name: Lint
  needs: build
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    - name: Install dependencies
      run: npm ci
    - name: Run lint
      run: npm run lint
```
Note: `publish:` job's `needs:` array (line 282: `[build, test, installer-smoke, installer-smoke-macos, offline-smoke]`) does not currently include `test` blocking release on lint — confirm with planner whether `lint` should also gate `publish` (recommend adding `lint` to that `needs:` array for consistency with D-05's enforcement intent, though not explicitly required by CONTEXT.md).

---

### `package.json` (config, MODIFY)

**Analog:** itself, line 41 — single dependency-version-range edit:
```json
"openclerk-core": "^0.2.6",
```
becomes (once the new `openclerk-core` version publishes, per the D-03 human checkpoint):
```json
"openclerk-core": "^0.3.0",
```
(exact target version left to executor per CONTEXT.md's discretion note — must be run through `npm install` afterward to update `package-lock.json`, not hand-edited alone).

## Shared Patterns

### "Move on, don't crash" validation-failure semantics
**Source:** existing convention, documented in project CLAUDE.md ("Error Handling" section) and `CitationProvider` lookups (network/lookup failures return `null`, not throw)
**Apply to:** `toSafeHyperlinkUrl`/`toSafeHtml` smart constructors (D-04 explicitly extends this pattern) and every `word.ts` call site consuming them — skip/continue on `null`, never throw.

### No path-alias imports; relative paths only
**Source:** project conventions ("Import Organization: None. Use relative paths consistently with existing files.") and confirmed in `word.ts:10-30`
**Apply to:** `safeInsertion.ts`'s import of `word.ts`-adjacent types, `tests/safeInsertion.test.ts`'s import of `../src/taskpane/safeInsertion`.

### JSDoc-style security-rationale comments on exported boundary functions
**Source:** `openclerk-core/src/utils.ts:138-142` (`isSafeHyperlinkUrl`'s comment), `src/taskpane/providers/base.ts`'s pattern per project conventions doc
**Apply to:** the new `toSafeHyperlinkUrl`/`toSafeHtml` smart constructors and `safeInsertion.ts`'s exported wrapper functions — explain *why* branding/wrapping exists (compile-time enforcement of an existing security guard), not just *what* the code does.

### Plain-Jest, no mocking library, `describe`/`test` structure
**Source:** `openclerk-core/tests/utils.test.ts`, `openclerk-word/tests/installer.test.ts`
**Apply to:** `tests/safeInsertion.test.ts` and the extended `openclerk-core/tests/utils.test.ts` blocks — use `jest.fn()` inline for the minimal Word.js duck-typed mocks (no new mocking framework, per RESEARCH.md's Wave 0 Gaps guidance).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `eslint.config.mjs` | config | transform (static analysis) | No flat ESLint config exists anywhere in this repo today (`.eslintrc.json` is legacy format and confirmed dead for `npm run lint`'s purposes). RESEARCH.md's fully-verified Code Example is authoritative — copy it directly rather than deriving from `.eslintrc.json`. |
| Word.js/Office.js Jest mock helpers | test fixture | request-response | No shared mock helper exists anywhere in `openclerk-word`'s `tests/` directory (confirmed: only `installer.test.ts`/`manifest.test.ts` remain, neither touches Word.js). Use RESEARCH.md's inline duck-typed `jest.fn()` objects rather than introducing a mocking library. |

## Metadata

**Analog search scope:** `C:\Users\willi\WordClerk\src\taskpane\`, `C:\Users\willi\WordClerk\tests\`, `C:\Users\willi\WordClerk\.github\workflows\`, `C:\Users\willi\WordClerk\package.json`, `C:\Users\willi\openclerk-core\src\utils.ts`, `C:\Users\willi\openclerk-core\src\index.ts`, `C:\Users\willi\openclerk-core\tests\utils.test.ts`
**Files scanned:** 8 target files + 5 analog source files read directly
**Pattern extraction date:** 2026-07-15
