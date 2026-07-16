# Phase 2: Escaping Hardening - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Hyperlink/HTML/comment insertion into the Word document cannot bypass the existing escaping
guards, at any current or future Office.js insertion call site — enforced at compile time, not
just by convention. This phase touches two repositories: `openclerk-core` (home of the new
branded validation types) and `openclerk-word` (home of the `safeInsertion.ts` wrapper and the
ESLint bypass guard).

</domain>

<decisions>
## Implementation Decisions

### Branded-type home (cross-repo)
- **D-01:** The branded `SafeHtml`/`SafeHyperlinkUrl` types are added to **`openclerk-core`**, not
  a local `utils.ts` in `openclerk-word`. `utils.ts` no longer exists in this repo — Phase 1
  moved `escapeHtml`/`isSafeHyperlinkUrl` into `openclerk-core`'s `src/utils.ts`
  (`C:\Users\willi\openclerk-core`, sibling checkout, currently at package version `0.2.7`).
  `escapeHtml`/`isSafeHyperlinkUrl` become (or are wrapped by) smart constructors that return the
  branded types, so the type system — not convention — enforces that only validated/escaped
  values reach an Office.js insertion call. Rationale: `openclerk-core` is the shared logic home
  across Word/GDocs/LibreOffice per its own README; the branded types belong at the source of
  truth, not duplicated per consumer.
- **D-02 (sequencing):** This is **one phase spanning both repos**, not a separate prerequisite
  effort in `openclerk-core`'s own planning. The plan should include an early wave that: (1) adds
  the branded types + smart constructors to `openclerk-core`, (2) bumps its version, (3) stops at
  a **human checkpoint** before the actual `npm publish` / release-tag push (same pattern as PR
  #33's merge checkpoint in Phase 1 — publishing is an externally-visible, hard-to-reverse
  action), then (4) once published, bumps the `openclerk-core` dependency in `openclerk-word`'s
  `package.json` and proceeds to build `safeInsertion.ts` against the new branded exports.
- **D-03:** Publish authority is a **human checkpoint** — the executor prepares the version bump
  and any changelog/PR in `openclerk-core`, but a person triggers the actual publish
  (`npm publish` or the release tag that fires `openclerk-core`'s existing `publish.yml`).

### Failure behavior at the validation boundary
- **D-04:** When a URL or string fails validation (e.g. `isSafeHyperlinkUrl`-equivalent check
  returns false), the smart constructor **returns `null`** rather than throwing. The caller skips
  that citation, matching the codebase's existing "move on, don't crash" pattern for
  best-effort/network-adjacent operations (documented in project conventions and already how
  `word.ts:250`/`346`/`556`/`1442` filter unsafe URLs today). This phase makes that filtering
  compiler-enforced (you cannot call the insertion wrapper without a branded value) rather than
  changing the runtime behavior users see.

### CI enforcement
- **D-05:** Add an `npm run lint` (ESLint) step to `.github/workflows/ci.yml`. Confirmed by
  reading the workflow directly: CI currently runs build, `npm test` (jest), and manifest
  `xmllint` validation, but **never runs ESLint**. Without this, the `no-restricted-syntax`
  bypass-guard (ESCAPE-03) only protects a developer who happens to lint locally — a bad PR would
  still go green. This is now in scope for Phase 2, not deferred.

### Test coverage
- **D-06:** `safeInsertion.ts` gets **dedicated unit tests** in `openclerk-word`'s `tests/`
  directory. Confirmed `word.ts` has zero automated test coverage today (only
  `installer.test.ts` and `manifest.test.ts` remain in `tests/` — citation/provider/utils tests
  moved to `openclerk-core` in Phase 1). Scope is limited to the new `safeInsertion.ts` module
  (branded-type constructors + the insertion dispatch/fallback logic) — it does **not** extend to
  testing the rest of the untested `word.ts` monolith, which stays deferred to v2 (WORDTS-01/02).

### Claude's Discretion
- Exact branding mechanism in TypeScript (e.g., `string & { readonly __brand: unique symbol }`)
  and smart-constructor function naming/signatures in `openclerk-core`.
- Whether `safeInsertion.ts`'s wrapper functions take a `Word.RequestContext` and perform
  `context.sync()` internally (as today's `applyHyperlinkToItem` does) or leave sync to the
  caller (as today's `insertComment` call site does) — reconcile the two existing patterns into
  one consistent wrapper API.
- Whether the existing 3-tier fallback in `applyHyperlinkToItem` (`insertHyperlink` →
  `insertHtml` with escaped anchor → plain `insertText`) is preserved as-is inside
  `safeInsertion.ts` — default to preserving existing behavior unless research surfaces a reason
  not to.
- `src/commands/commands.word.ts:15`'s `insertParagraph(atext, ...)` call (Yeoman-boilerplate
  "Hello World" paragraph, hardcoded string, no dynamic/user-derived content) is **out of scope**
  for the ESLint bypass-guard — ESCAPE-02/03 name only `insertHtml`/`insertHyperlink`/
  `insertComment`, and this call carries no injection risk (fixed literal, no interpolation).
- Exact ESLint `no-restricted-syntax` selector/override mechanism (e.g. `overrides` glob
  excluding `safeInsertion.ts` from the restricted-syntax rule) is an implementation detail for
  the planner/researcher.
- Version-number choice for the new `openclerk-core` release (patch vs. minor) given it adds new
  exported types/functions — likely minor per semver, but left to the executor at bump time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase-defining docs
- `.planning/ROADMAP.md` §"Phase 2: Escaping Hardening" — goal and 4 success criteria (note:
  criterion 1's literal "types exist in utils.ts" wording is superseded by D-01 above — utils.ts
  no longer exists in this repo, and the types now live in `openclerk-core` instead)
- `.planning/REQUIREMENTS.md` — ESCAPE-01, ESCAPE-02, ESCAPE-03 (same "utils.ts" superseding note
  applies to ESCAPE-01's wording)
- `.planning/PROJECT.md` — Core Value statement and Active requirements list

### Codebase maps
- `.planning/codebase/CONCERNS.md` — "openclerk-core logic duplicated, not shared" finding
  (resolved in Phase 1) and the `word.ts` monolith-size finding that motivates this phase's
  compile-time guard
- `.planning/codebase/ARCHITECTURE.md` — current `providers/`/`bluebook/` registry pattern and
  the `word.ts` monolithic-controller anti-pattern this phase partially mitigates
- `.planning/codebase/STRUCTURE.md` — directory layout reference

### Security findings (this phase directly addresses these)
- `SECURITY_AUDIT.md` — Finding A (`escapeHtml`/`isSafeHyperlinkUrl` drift risk between
  `openclerk-word` and `openclerk-core`, now resolved by D-01's upstreaming) and the DOM/HTML-
  injection review section documenting all current insertion call sites
  (`src\taskpane\word.ts:221-237` `insertHtml`/`insertHyperlink`; `src\taskpane\word.ts:1232`
  `insertComment`, confirmed plain-text-API, not HTML-coerced)

### Cross-repo
- `C:\Users\willi\openclerk-core` — sibling repo checkout, currently `package.json` version
  `0.2.7` (one ahead of the `^0.2.6` `openclerk-word` currently depends on). Has its own
  `.github/workflows/publish.yml` for the npm release. `src/utils.ts` currently exports
  `escapeHtml(str: string): string` and `isSafeHyperlinkUrl(url: string): boolean` (plain types,
  not yet branded) — see `node_modules/openclerk-core/lib/utils.d.ts` in `openclerk-word` for the
  currently-consumed signatures.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `openclerk-core`'s existing `escapeHtml`/`isSafeHyperlinkUrl` implementations (already
  well-tested per `SECURITY_AUDIT.md` — allowlist-based URL scheme check, complete HTML entity
  escaping) — the smart constructors wrap these rather than reimplementing validation logic.

### Established Patterns
- "Move on, don't crash" error handling — network/lookup failures already return `null` instead
  of throwing (`CitationProvider` lookups); D-04 extends this pattern to the new validation
  boundary for consistency.
- Self-registering plugin registries (`providers/index.ts`, `bluebook/index.ts`) — unaffected by
  this phase, no changes needed here.

### Integration Points
- `src/taskpane/word.ts` — three call sites to migrate into `safeInsertion.ts`:
  - `applyHyperlinkToItem` (`word.ts:217-233`): feature-detects `insertHyperlink` vs. `insertHtml`
    vs. plain-text `insertText` fallback; currently calls `escapeHtml`/uses pre-filtered URLs.
  - `embedCitedText`'s `insertComment` call (`word.ts:1232`, inside the pincite-embedding
    `Word.run` block) — plain-text Office.js API, no HTML escaping needed today, but folded into
    the same wrapper module per ESCAPE-02's "all raw calls live in `safeInsertion.ts`" requirement.
  - URL pre-filtering already happens at `word.ts:250`, `342`, `552`, `1426` via
    `isSafeHyperlinkUrl` — these become call sites for the new smart constructor instead.
- `package.json` (`openclerk-word`) — `dependencies.openclerk-core` version bump once the new
  `openclerk-core` release publishes.
- `.eslintrc.json` — needs a `no-restricted-syntax` rule (or `overrides` block) added; currently
  only `plugin:office-addins/recommended`.
- `.github/workflows/ci.yml` — needs a new `npm run lint` step (D-05); currently has `build`,
  `test`, `installer-smoke`, `installer-smoke-macos`, `offline-smoke`, `deploy-pages`, and
  `publish` jobs, no lint job.

</code_context>

<specifics>
## Specific Ideas

No UI/visual specifics — this phase is entirely internal hardening (types, a wrapper module, an
ESLint rule, a CI step, and a cross-repo release). The user's specific asks were about
architecture location (D-01/D-02), failure semantics (D-04), and process rigor (D-03, D-05, D-06)
rather than user-facing behavior.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. `word.ts`'s broader monolith split (WORDTS-01/02)
was already deferred to v2 before this discussion began (per `REQUIREMENTS.md`) and was not
reopened here.

</deferred>

---

*Phase: 2-escaping-hardening*
*Context gathered: 2026-07-15*
