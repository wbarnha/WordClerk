# Coding Conventions

**Analysis Date:** 2026-07-15

## Naming Patterns

**Files:**
- Source files: `camelCase.ts` (e.g. `src/taskpane/providers/citationParser.ts`, `src/taskpane/bluebook/checkCaseNameAbbreviations.ts`)
- Generated data files: `<name>.generated.ts` under `src/taskpane/bluebook/generated/` — never hand-edit, produced by `scripts/generate-bluebook-data.js` (npm script `bluebook:update-data`)
- Test files: `<subject>.test.ts` in top-level `tests/` directory, mirroring the module under test (not co-located with source)

**Functions:**
- `camelCase`, verb-first: `parseCaseCitation`, `extractCaseCitations`, `checkCommonCaseCitationRules`, `applyManualReporterOverrides`, `stripHtmlHyperlinks`
- Boolean-returning functions read as predicates: `isAuthenticated()`, `isReadyForOpinionText()`, `wasLastRequestRateLimited()`

**Variables:**
- `camelCase` for locals/params; `UPPER_SNAKE_CASE` for module-level constants (`API_BASE`, `SITE_ORIGIN`, `EXAMPLE_CITATION` in tests)

**Types/Interfaces:**
- `PascalCase` for interfaces and classes: `CitationProvider`, `ParsedCitation`, `CourtListenerCluster`, `CourtListenerProvider`
- Provider-vendor-specific response shapes are declared as local `interface`s at the top of the provider file (e.g. `CourtListenerCitationResult`, `CourtListenerOpinionsResponse` in `src/taskpane/providers/courtListenerProvider.ts`), not shared globally

## Code Style

**Formatting:**
- Prettier via `office-addin-prettier-config` (`prettier` field in `package.json`); run with `npm run prettier`
- No local `.prettierrc` overrides — the shared office-addin config is authoritative

**Linting:**
- ESLint via `eslint-plugin-office-addins`, `plugin:office-addins/recommended` (`.eslintrc.json`)
- Run with `npm run lint`; `npm run lint:fix` for auto-fixable issues
- Office-addin-specific rules are enforced (e.g. `call-sync-after-load`, `no-office-initialize`, `test-for-null-using-isNullObject`) — relevant when touching any Word/Office.js API calls in `src/taskpane/word.ts` or `src/commands/`

**TypeScript:**
- `tsconfig.json` targets `es5` with `lib: ["es2015", "dom"]`, `jsx: "react"`, `experimentalDecorators: true`
- `allowJs: true`, `esModuleInterop: true`; no `strict` mode enabled — do not assume strict-null-checks safety when writing new code
- Double-quoted string literals are common in provider/type files (`base.ts`, `courtListenerProvider.ts`); single-quoted strings appear in test files. Prettier governs actual enforcement — do not hand-wrangle quote style.

## Import Organization

**Order:**
1. Relative imports from sibling modules within the same feature folder (e.g. `./types`, `./opinionTextExtractor`)
2. Cross-folder relative imports (e.g. `../providers/citationParser` from `bluebook/`)
3. No path aliases are configured — all imports are relative (`../../`, `./`), matching `tsconfig.json`'s lack of a `paths` map

**Path Aliases:**
- None. Use relative paths consistently with existing files.

## Error Handling

**Patterns:**
- Providers throw `Error` with a user-facing message on invalid/missing credentials, rather than returning error codes: see `EnterpriseCitationProvider.authenticate()` in `src/taskpane/providers/base.ts` (`throw new Error(\`Missing required field(s): ...\`)`)
- Network/lookup failures are swallowed and converted to `null` return values rather than propagated exceptions — "move on" semantics are explicit in test names (`tests/providers.test.ts`: "moves on (returns null) instead of throwing on a network failure"). This is a deliberate pattern: citation lookups are best-effort and must never crash the taskpane UI.
- Rate-limiting (HTTP 429) is tracked via a dedicated boolean flag (`lastRequestWasRateLimited` in `CourtListenerProvider`) rather than a thrown/typed error, so callers can distinguish "rate limited" from "not found" without try/catch.
- Validation errors (e.g. non-HTTPS API base URL in `EnterpriseCitationProvider.authenticate`) are thrown synchronously/early, before any network call is attempted — fail fast on bad input.

## Comments

**When to Comment:**
- JSDoc-style block comments precede exported classes/functions to explain *why*, not *what* — see `src/taskpane/providers/base.ts` (explains why credentials are never persisted) and `src/taskpane/providers/courtListenerProvider.ts` (explains CourtListener's auth requirement and links to API docs)
- Inline comments justify non-obvious behavior or document known limitations, especially near regex/parsing logic (`src/taskpane/providers/citationParser.ts` and its test file `tests/bluebook.test.ts` document "known limitation" cases directly in test names/comments)
- Regression-motivated tests include a comment explaining the bug that was fixed and why the assertion matters (see `tests/bluebook.test.ts` lines ~98-117)

**JSDoc/TSDoc:**
- Used selectively on exported abstractions (base classes, provider entry points), not on every function. Favor documenting *design rationale* (security/legal/compliance reasoning) over restating parameter types.

## Function Design

**Size:** Small, single-purpose functions; parsing logic is decomposed into named helpers (`parseCaseCitation`, `extractCaseCitations`) rather than one large regex-and-branch function.

**Parameters:** Provider methods take a single structured object (`ParsedCitation`, `Record<string, string>` for credentials) rather than long positional parameter lists.

**Return Values:** Async lookup/fetch methods return `Promise<T | null>` — `null` signals "not found / not applicable / not ready", never an exception, for expected-miss cases. Reserve thrown errors for programmer/config errors (bad credentials, missing required fields).

## Module Design

**Exports:** Named exports throughout (no default exports observed in `src/taskpane/providers/` or `src/taskpane/bluebook/`). Classes and standalone helper functions are exported side-by-side from the same file when related (e.g. `base.ts` exports both `EnterpriseCitationProvider` and `fetchClientCredentialsToken`/`trimTrailingSlash`).

**Registries:** Extensible provider/rule-set families use a small `Registry` class (`CitationProviderRegistry` in `src/taskpane/providers/registry.ts`, `BluebookRuleSetRegistry` in `src/taskpane/bluebook/registry.ts`) with `register()`, `unregister()`, `get(id)`, `list()`. Follow this pattern when adding new pluggable providers or rule sets rather than hardcoding branches.

**Barrel Files:** `src/taskpane/providers/index.ts` and `src/taskpane/bluebook/index.ts` re-export the public surface of each feature folder — import from the folder root when consuming from outside, not deep individual files, unless already inside that folder.

---

*Convention analysis: 2026-07-15*
