# Testing Patterns

**Analysis Date:** 2026-07-15

## Test Framework

**Runner:**
- Jest 29 (`jest` in `devDependencies`), configured via the `jest` key in `package.json`
- Preset: `ts-jest`, `testEnvironment: "node"`
- `testMatch`: `["**/tests/**/*.test.ts"]` — tests live only under top-level `tests/`, not co-located with source

**Assertion Library:**
- Jest's built-in `expect` (no Chai/Sinon in use; `@sinonjs/commons` present only as a transitive dependency of another package, not used directly)

**Run Commands:**
```bash
npm test                                    # Run all tests (jest)
npm run test:live                           # Run only tests/courtListener.live.test.ts (hits real network)
```
No separate watch or coverage script is defined in `package.json` — use `npx jest --watch` or `npx jest --coverage` directly if needed.

## Test File Organization

**Location:**
- All tests live in the flat top-level `tests/` directory, not alongside source files. Files: `tests/bluebook.test.ts`, `tests/courtListener.live.test.ts`, `tests/hyperlinks.test.ts`, `tests/installer.test.ts`, `tests/manifest.test.ts`, `tests/opinionText.test.ts`, `tests/providers.test.ts`, `tests/utils.test.ts`

**Naming:**
- `<feature-or-module>.test.ts`, matched by Jest's `testMatch` glob. One file typically covers multiple related source modules by topic (e.g. `providers.test.ts` covers `citationParser.ts`, `registry.ts`, `courtListenerProvider.ts`, and `lexisNexisProvider.ts` together) rather than a strict 1:1 file mapping.
- `*.live.test.ts` suffix marks tests that hit real external services and are excluded from the default `npm test` run — only invoked explicitly via `npm run test:live`.

**Structure:**
```
tests/
├── bluebook.test.ts          # Bluebook rule-set/edition logic
├── courtListener.live.test.ts # Live network test against real CourtListener API (opt-in)
├── hyperlinks.test.ts        # HTML utility functions (src/taskpane/utils.ts)
├── installer.test.ts         # Installer scripts
├── manifest.test.ts          # manifest.xml validation
├── opinionText.test.ts       # Opinion excerpt extraction
├── providers.test.ts         # Citation parsing + provider registry + CourtListener/LexisNexis providers
└── utils.test.ts             # General utils
```

## Test Structure

**Suite Organization:**
```typescript
describe('CourtListenerProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('returns a hyperlink match when the API resolves exactly one case', async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
    // ... arrange mock responses, act, assert
  });

  describe('rate-limit awareness (supportsRateLimitAwareness)', () => {
    test('reports rateLimited (not a plain miss) when the API returns 429', async () => { /* ... */ });
  });
});
```
- Nested `describe` blocks group related behaviors within a class/module (see `providers.test.ts`: top-level `describe('CourtListenerProvider', ...)` containing a nested `describe('fetchOpinionExcerpt (Embed Cited Text)', ...)`)
- Test names are full sentences describing observable behavior, often including the *why* ("known limitation: ...", "Regression test: found via manual validation ...")
- `afterEach` restores global mutable state (`global.fetch`, `jest.restoreAllMocks()`) after tests that stub globals — required since `fetch` is monkey-patched per test rather than injected

**Patterns:**
- Setup: helper functions factor out repeated multi-step arrangement, e.g. `authenticatedProvider(mockFetch)` in `tests/providers.test.ts` which mocks the initial auth-validation fetch call and returns an authenticated provider instance
- Teardown: restore `global.fetch` to `originalFetch` and call `jest.restoreAllMocks()` in `afterEach`
- Assertion: prefer `toEqual`/`toMatchObject` for structured results, `resolves.toBeNull()` / `rejects.toThrow(/regex/)` for async outcomes

## Mocking

**Framework:** Jest's built-in `jest.fn()` / `jest.mock` — no separate mocking library.

**Patterns:**
```typescript
// Global fetch is replaced directly, call-by-call, using mockResolvedValueOnce chains
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });   // call 0: auth
mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [...] }); // call 1: lookup

const result = await provider.lookupCitation({ raw: EXAMPLE_CITATION });

expect(mockFetch).toHaveBeenLastCalledWith(
  'https://www.courtlistener.com/api/rest/v4/citation-lookup/',
  expect.objectContaining({ method: 'POST' })
);
```
- Each sequential `fetch` call within a provider method is mocked in call order using `mockResolvedValueOnce` chains; tests comment which call number ("Call 0: authenticate()'s validation request", "Call 1: resolveClusterId's citation-lookup request") each mock corresponds to — follow this convention for multi-request flows so mock ordering stays legible.
- Network errors are simulated with `mockRejectedValueOnce(new Error('network down'))`.
- Call arguments are inspected via `mockFetch.mock.calls[<index>][<argIndex>]` when assertions need to check headers/auth tokens on a specific call, e.g. `mockFetch.mock.calls[1][1].headers.Authorization`.

**What to Mock:**
- Global `fetch` for all provider network calls — no HTTP library wrapper exists to mock instead.

**What NOT to Mock:**
- Pure parsing/formatting logic (`parseCaseCitation`, `extractCaseCitations`, `stripHtmlHyperlinks`, Bluebook rule checks) is tested directly against real inputs/outputs with no mocking — these are deterministic pure functions.

## Fixtures and Factories

**Test Data:**
```typescript
const EXAMPLE_CITATION = 'Norfolk & W. Ry. Co. v. Liepelt, 444 U.S. 490 (U.S.Ill., 1980)';
```
- Shared example citations are declared as module-level `const` at the top of each test file rather than imported from a separate fixtures module.
- Helper functions like `parseOrThrow(raw: string): ParsedCitation` (in `tests/bluebook.test.ts`) wrap a nullable parser call and throw if parsing unexpectedly fails, keeping downstream test bodies free of null-checks.

**Location:**
- No dedicated fixtures directory. Fixture data is inline, per test file.

## Coverage

**Requirements:** No coverage threshold enforced in `package.json` or CI config found.

**View Coverage:**
```bash
npx jest --coverage
```

## Test Types

**Unit Tests:**
- The large majority of the suite: pure-function parsing/rule-checking tests (`bluebook.test.ts`, `hyperlinks.test.ts`, `utils.test.ts`, `opinionText.test.ts`) and provider logic tests with `fetch` mocked (`providers.test.ts`).

**Integration Tests:**
- `tests/manifest.test.ts` and `tests/installer.test.ts` validate build/deployment artifacts (Office manifest, installer scripts) rather than runtime application logic.

**E2E Tests:**
- Not used. `tests/courtListener.live.test.ts` is a live-network smoke test against the real CourtListener API, run only via `npm run test:live`, separate from the default `npm test` run — treat it as an opt-in integration check, not part of CI-gating unit coverage.

## Common Patterns

**Async Testing:**
```typescript
await expect(provider.lookupCitation({ raw: EXAMPLE_CITATION })).resolves.toBeNull();
await expect(provider.authenticate({ apiToken: '' })).rejects.toThrow(/requires an API token/);
```

**Error Testing:**
```typescript
await expect(
  provider.authenticate({ apiBaseUrl: 'http://insecure.example.com', clientId: 'id', clientSecret: 'secret' })
).rejects.toThrow(/https/i);
expect(provider.isAuthenticated()).toBe(false);
```
- Error-path tests consistently assert both the thrown error message pattern (via regex) *and* the resulting state (e.g. `isAuthenticated()` remains `false` after a rejected `authenticate()` call) — verify side effects, not just the exception.

---

*Testing analysis: 2026-07-15*
