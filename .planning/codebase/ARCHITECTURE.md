<!-- refreshed: 2026-07-15 -->
# Architecture

**Analysis Date:** 2026-07-15

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                Word Task Pane (browser context)               │
│  `src/taskpane/taskpane.html` + `src/taskpane/taskpane.ts`    │
│  Loaded into the Office ShowTaskpane action (manifest.xml)    │
└──────────────────┬─────────────────────┬──────────────────────┘
                    │                     │
                    ▼                     ▼
┌───────────────────────────┐  ┌───────────────────────────────┐
│  UI Controller / Orchestrator│  │  Ribbon Commands (function-file)│
│  `src/taskpane/word.ts`      │  │  `src/commands/commands.ts`     │
│  (1538 lines, all DOM wiring,│  │  `src/commands/commands.word.ts`│
│   OOXML parsing, workflows)  │  └───────────────────────────────┘
└──────────┬─────────┬────────┘
           │         │
           ▼         ▼
┌────────────────┐ ┌────────────────────────────┐
│  Citation       │ │  Bluebook Rule Engine       │
│  Providers      │ │ `src/taskpane/bluebook/`    │
│ `src/taskpane/  │ │ (registry + per-edition     │
│  providers/`    │ │  rule sets + generated data)│
└───────┬─────────┘ └──────────────┬──────────────┘
        │                          │
        ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│           Office.js Word API (Word.run / OOXML)               │
│  Reads/writes document content, hyperlinks, comments          │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Task pane entry | Bootstraps the UI bundle by importing the controller | `src/taskpane/taskpane.ts` |
| UI controller / workflow orchestrator | Office.onReady wiring, all DOM event handlers, hyperlinking workflows, source-document (.docx) parsing, Bluebook check orchestration, hallucination check orchestration, cited-text embedding | `src/taskpane/word.ts` |
| Citation provider plugin system | Defines `CitationProvider` interface and registry for pluggable case-law lookup sources | `src/taskpane/providers/types.ts`, `src/taskpane/providers/registry.ts`, `src/taskpane/providers/index.ts` |
| Built-in providers | Concrete lookup implementations (free CourtListener API; enterprise-gated Westlaw/Lexis/Bloomberg/USPTO stubs requiring user-supplied credentials) | `src/taskpane/providers/courtListenerProvider.ts`, `westlawProvider.ts`, `lexisNexisProvider.ts`, `bloombergLawProvider.ts`, `usptoPatentCenterProvider.ts` |
| Enterprise provider base class | Shared OAuth2 client-credentials auth flow for paid/contract-gated APIs | `src/taskpane/providers/base.ts` |
| Citation parsing/formatting | Parses raw citation text into structured `ParsedCitation`; extracts pincite page ranges; extracts opinion text from API responses | `src/taskpane/providers/citationParser.ts`, `pincitePages.ts`, `opinionTextExtractor.ts` |
| Bluebook rule engine | Registry of per-edition rule sets (20th/21st/22nd) that validate/format case-name and reporter citations | `src/taskpane/bluebook/registry.ts`, `edition20th.ts`, `edition21st.ts`, `edition22nd.ts`, `commonRules.ts`, `courtRules.ts`, `reporterRules.ts`, `pageRangeRules.ts`, `checkCaseNameAbbreviations.ts`, `manualCorrections.ts` |
| Generated reference data | Large static lookup tables (case-name/reporter/state abbreviations) generated from external sources by a build script, not hand-edited | `src/taskpane/bluebook/generated/*.generated.ts` (produced by `scripts/generate-bluebook-data.js`) |
| Ribbon/function commands | Minimal Office "commands" entry point for ribbon-triggered actions (function-file bundle, separate from the task pane bundle) | `src/commands/commands.ts`, `src/commands/commands.word.ts`, `src/commands/commands.html` |
| Shared utilities | Small cross-cutting helpers (string/DOM helpers used by the task pane) | `src/taskpane/utils.ts` |
| Installer/build tooling | Node scripts for packaging, release, and local install of the add-in (not part of the runtime add-in) | `scripts/*.js`, `scripts/install-openclerk.*` |
| Standalone PDF extraction tool | Separate self-contained utility (own `node_modules`, own `dist`) for extracting text from PDFs, decoupled from the Office add-in build | `tools/pdf-extract/` |

## Pattern Overview

**Overall:** Single-page Office.js task-pane add-in with a plugin-registry architecture for external integrations (citation providers, Bluebook rule sets). There is no server-side backend — all logic runs client-side in the browser context Office embeds; the only network calls are direct, user-initiated calls from the browser to external case-law APIs.

**Key Characteristics:**
- No framework (no React/Vue/Angular) — direct DOM manipulation via `document.getElementById` and manual event listeners, all concentrated in `src/taskpane/word.ts`.
- Two independent webpack entry bundles: `taskpane` (the full UI) and `commands` (a lightweight function-file for ribbon buttons) — see `webpack.config.js` entry block.
- Extensibility via two parallel registry/plugin patterns: `CitationProviderRegistry` (`src/taskpane/providers/registry.ts`) and `bluebookRuleSetRegistry` (`src/taskpane/bluebook/registry.ts`). New providers/rule sets self-register by import side-effect in their respective `index.ts`.
- Office Open XML (OOXML) is read/written directly in places (via JSZip) for operations Office.js does not expose cleanly, e.g. hyperlink relationship parsing (`parseRelationships` in `src/taskpane/word.ts:1508`) and source `.docx` parsing (`parseSourceDocument`, `word.ts:1401`).
- Credentials for enterprise providers are held only in memory for the session (never persisted to disk/localStorage) — enforced by convention in `EnterpriseCitationProvider` (`src/taskpane/providers/base.ts`).

## Layers

**Task pane UI/controller layer:**
- Purpose: DOM wiring, user workflows (hyperlinking case-law citations, Bluebook checks, hallucination checks, embedding cited opinion text), talks to Office.js Word API
- Location: `src/taskpane/taskpane.ts`, `src/taskpane/taskpane.html`, `src/taskpane/word.ts`, `src/taskpane/taskpane.css`
- Contains: Office.onReady bootstrap, event handlers, rendering functions, OOXML parsing helpers
- Depends on: providers layer, bluebook layer, `src/taskpane/utils.ts`, Office.js/Word.js globals
- Used by: Office task pane runtime (loaded via manifest `SourceLocation`)

**Providers layer (external integrations):**
- Purpose: Abstracts "look up a citation" / "get opinion text" across multiple case-law data sources behind one interface
- Location: `src/taskpane/providers/`
- Contains: `CitationProvider` interface (`types.ts`), registry, base class for auth, concrete provider implementations
- Depends on: `fetch` (browser), nothing else internal
- Used by: `src/taskpane/word.ts`

**Bluebook rule engine layer:**
- Purpose: Encodes citation-formatting rules per Bluebook edition, validates document citations against them
- Location: `src/taskpane/bluebook/`
- Contains: `BluebookRuleSet` interface (`types.ts`), registry, per-edition classes, shared rule modules, generated data tables
- Depends on: generated data (`generated/*.generated.ts`)
- Used by: `src/taskpane/word.ts` (Bluebook-check workflow)

**Commands (ribbon) layer:**
- Purpose: Separate, minimal bundle Office loads for ribbon-button function commands (kept small/fast per Office add-in convention)
- Location: `src/commands/`
- Depends on: Office.js
- Used by: manifest ribbon action bindings

**Build/tooling layer (not shipped in the add-in bundle):**
- Purpose: Generate static data, package releases, install the add-in locally
- Location: `scripts/`
- Depends on: Node.js, npm packages (archiver, etc.)

## Data Flow

### Primary Request Path (apply case-law hyperlinks from a source document)

1. User selects a source `.docx` file in the task pane; `onSourceFileSelected` reads it (`src/taskpane/word.ts:197`)
2. `parseSourceDocument` unzips the `.docx` via JSZip and extracts citation-to-URL mappings from its OOXML hyperlink relationships (`word.ts:1401`, using `parseRelationships` at `word.ts:1508`)
3. `applyCaseLawHyperlinksFromSource` matches citations in the active Word document against the parsed map and calls `applyHyperlinkToItem` to write hyperlinks via `Word.run` (`word.ts:239`, `221`)

### Bluebook Check Flow

1. User selects an edition (`populateBluebookEditionSelect`, `word.ts:641`) which resolves a `BluebookRuleSet` from `bluebookRuleSetRegistry` (`word.ts:658`)
2. `checkBluebookCitations` (`word.ts:673`) scans document text via Word.js, runs each citation through the rule set's checks (case name abbreviation, reporter rules, page-range rules, court rules)
3. `renderBluebookResults` (`word.ts:778`) displays flagged issues; clicking a result calls `goToCitationInDocument` (`word.ts:752`) to select/scroll to that citation in Word

### Online Citation Lookup Flow (hallucination check / embed opinion text)

1. User selects a `CitationProvider` from `citationProviderRegistry.list()` (`renderProviderPanel`, `word.ts:416`)
2. If `requiresAuth`, user supplies credentials, held in memory via `provider.authenticate()` (`connectSelectedProvider`, `word.ts:468`; auth flow implemented in `EnterpriseCitationProvider.authenticate`, `providers/base.ts:26`)
3. `checkForHallucinations` / `embedCitedOpinionText` (`word.ts:980`, `1174`) call `provider.lookupCitation()` per citation found in the document, then write results/comments/embedded text back into the document via Word.js

**State Management:**
- All state is in-memory, module-level variables inside `src/taskpane/word.ts` (selected provider, parsed citation map, last scan results) — reset on task-pane reload. No global store, no persistence layer, no server-side session.

## Key Abstractions

**CitationProvider:**
- Purpose: Uniform interface for "authenticate, then look up a citation" across free and paid case-law APIs
- Examples: `src/taskpane/providers/courtListenerProvider.ts` (free, no auth), `src/taskpane/providers/westlawProvider.ts`, `lexisNexisProvider.ts`, `bloombergLawProvider.ts` (enterprise, auth required)
- Pattern: Interface (`providers/types.ts`) + registry (`providers/registry.ts`) + self-registering built-ins (`providers/index.ts`)

**BluebookRuleSet:**
- Purpose: Encapsulates one edition's citation-formatting rules as a pluggable, swappable object
- Examples: `src/taskpane/bluebook/edition20th.ts`, `edition21st.ts`, `edition22nd.ts`
- Pattern: Interface (`bluebook/types.ts`) + registry (`bluebook/registry.ts`) + self-registering editions (`bluebook/index.ts`)

**EnterpriseCitationProvider (abstract base):**
- Purpose: Shared OAuth2 client-credentials handshake and in-memory-only credential storage for paid providers
- Examples: subclassed by `westlawProvider.ts`, `lexisNexisProvider.ts`, `bloombergLawProvider.ts`
- Pattern: Template method (`authenticate()` calls abstract `verifyCredentials()`)

## Entry Points

**Task pane bundle:**
- Location: `src/taskpane/taskpane.html` + `src/taskpane/taskpane.ts` (imports `./word`)
- Triggers: Office `ShowTaskpane` ribbon action defined in `manifest.xml`
- Responsibilities: Full UI — all hyperlinking, Bluebook checking, hallucination checking, opinion-text embedding workflows

**Commands bundle (function file):**
- Location: `src/commands/commands.html` + `src/commands/commands.ts` (imports `./commands.word`)
- Triggers: Ribbon `ExecuteFunction` actions defined in `manifest.xml`
- Responsibilities: Lightweight commands not requiring the full task pane UI

## Architectural Constraints

- **Threading:** Single-threaded browser/webview context (standard for Office.js task panes); all document mutations are batched through `Word.run(async (context) => { ... context.sync() })` calls.
- **Global state:** Module-level mutable state lives entirely in `src/taskpane/word.ts` (selected citation map, active provider, last check results) — no external state library.
- **Circular imports:** None detected; dependency direction is strictly `word.ts` → `providers/` and `word.ts` → `bluebook/`, with no reverse imports.
- **No backend:** All network calls are made directly from the browser to third-party APIs (CourtListener, or firm-supplied enterprise API base URLs); OpenClerk operates no server component.

## Anti-Patterns

### Monolithic controller file

**What happens:** `src/taskpane/word.ts` is 1538 lines and owns DOM wiring, business logic (hyperlink matching, OOXML parsing), and rendering for every workflow in the add-in.
**Why it's wrong:** Any change to one workflow (e.g., Bluebook checking) risks touching shared helpers used by unrelated workflows (e.g., hyperlink removal), and the file is difficult to navigate/test in isolation.
**Do this instead:** When adding a new workflow, prefer extracting workflow-specific logic into a new module under `src/taskpane/` (following the `providers/`/`bluebook/` pattern) and keep `word.ts` focused on DOM wiring/dispatch.

### Direct OOXML manipulation alongside Office.js calls

**What happens:** `src/taskpane/word.ts` mixes high-level `Word.run` calls with low-level manual OOXML parsing via JSZip (`parseSourceDocument`, `parseRelationships`, `getElementText` at `word.ts:1401-1538`).
**Why it's wrong:** Two different document-access paradigms in one file increase the risk of inconsistency (e.g., stale relationship IDs) and make the code harder to reason about.
**Do this instead:** Keep OOXML-parsing helpers isolated (they largely already are, at the bottom of `word.ts`) and treat them as a self-contained "source document reader" — consider extracting to their own module if this logic grows further.

## Error Handling

**Strategy:** Try/catch around async Word.js/network operations with user-facing status messages; no centralized error boundary or logger.

**Patterns:**
- `setStatus(message)` (`src/taskpane/word.ts:1394`) writes user-visible status/progress text into the task pane
- Provider `authenticate()`/`verifyCredentials()` throw `Error` with human-readable messages that are surfaced directly in the UI (`providers/base.ts:26-41`)
- Bounded reads guard against unbounded memory use, e.g. `readZipEntryWithLimit` (`word.ts:1452`)

## Cross-Cutting Concerns

**Logging:** No structured logging framework; status/progress is communicated via `setStatus()` in the UI rather than console logs.
**Validation:** Enterprise provider credentials are validated for required fields and HTTPS-only API base URLs before use (`providers/base.ts:26-41`); Bluebook rule checks validate citation formatting against per-edition rule sets.
**Authentication:** Only enterprise citation providers require auth; auth is per-session, in-memory, never persisted (`providers/base.ts`).

---

*Architecture analysis: 2026-07-15*
