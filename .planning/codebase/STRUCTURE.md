# Codebase Structure

**Analysis Date:** 2026-07-15

## Directory Layout

```
WordClerk/
├── src/                          # Office add-in source (webpack-built)
│   ├── taskpane/                 # Full task-pane UI bundle
│   │   ├── bluebook/             # Bluebook citation rule engine
│   │   │   └── generated/        # Auto-generated reference data (do not hand-edit)
│   │   ├── providers/            # Citation-lookup provider plugin system
│   │   ├── taskpane.html         # Task pane markup
│   │   ├── taskpane.ts           # Task pane entry point (imports word.ts)
│   │   ├── taskpane.css          # Task pane styling
│   │   ├── word.ts               # Main UI controller / all workflow logic
│   │   └── utils.ts              # Shared small helpers
│   └── commands/                 # Ribbon "function file" bundle
│       ├── commands.html
│       ├── commands.ts           # Entry point (imports commands.word.ts)
│       └── commands.word.ts
├── tests/                        # Jest test suite (flat, one file per concern)
├── scripts/                      # Node build/release/install tooling (not shipped)
│   └── local-server/             # PowerShell scripts for local HTTPS hosting
├── tools/
│   └── pdf-extract/               # Standalone PDF text-extraction utility, own package
├── assets/                       # Static icons/images used by the add-in and manifest
├── dist/                         # Webpack build output (generated, gitignored)
├── .github/
│   ├── workflows/                # CI pipelines
│   └── ISSUE_TEMPLATE/
├── .claude/                      # Claude Code / GSD project configuration
├── .planning/                    # GSD planning artifacts (this document lives here)
├── manifest.xml                  # Office add-in manifest (entry points, permissions, icons)
├── appsscript.json / .clasp.json # Google Apps Script config (secondary integration, root-level)
├── webpack.config.js             # Build config — defines the two entry bundles
├── tsconfig.json                 # TypeScript compiler config
├── babel.config.json             # Babel config (used for Jest transform)
├── .eslintrc.json                # Lint config
├── package.json                  # npm scripts and dependencies
└── SECURITY_AUDIT.md             # Security review notes
```

## Directory Purposes

**`src/taskpane/`:**
- Purpose: Everything rendered/executed inside the Word task pane
- Contains: HTML/CSS for the pane, the single large controller (`word.ts`), and two sub-plugin-systems (`bluebook/`, `providers/`)
- Key files: `src/taskpane/word.ts` (orchestrator), `src/taskpane/taskpane.ts` (entry point)

**`src/taskpane/providers/`:**
- Purpose: Pluggable case-law citation lookup sources (free API and enterprise/paid APIs)
- Contains: interface/type definitions, registry, base class for auth, one file per provider
- Key files: `types.ts` (contract), `registry.ts` (plugin registry), `index.ts` (registers built-ins), `base.ts` (enterprise auth base class)

**`src/taskpane/bluebook/`:**
- Purpose: Bluebook citation-format rule checking, per edition
- Contains: interface/type definitions, registry, one file per edition, shared rule modules, `generated/` reference data
- Key files: `types.ts`, `registry.ts`, `index.ts` (registers editions), `edition20th.ts`/`edition21st.ts`/`edition22nd.ts`

**`src/taskpane/bluebook/generated/`:**
- Purpose: Large static lookup tables (case-name/reporter/state abbreviations)
- Generated: Yes — produced by `scripts/generate-bluebook-data.js` (npm run `bluebook:update-data`)
- Committed: Yes (tracked in git despite being generated, so builds don't require regeneration)

**`src/commands/`:**
- Purpose: Minimal Office "function file" bundle for ribbon commands that don't need the full task pane
- Contains: `commands.html`, `commands.ts` (entry), `commands.word.ts` (implementation)

**`tests/`:**
- Purpose: Jest test suite, flat structure (no subdirectories), one file per functional area
- Contains: `bluebook.test.ts`, `providers.test.ts`, `hyperlinks.test.ts`, `opinionText.test.ts`, `utils.test.ts`, `manifest.test.ts`, `installer.test.ts`, `courtListener.live.test.ts` (live network test, run separately via `npm run test:live`)

**`scripts/`:**
- Purpose: Node/PowerShell tooling for build, packaging, release, and install — not part of the add-in runtime bundle
- Contains: `build-docs.js`, `package-release.js`, `package-release-offline.js`, `install-openclerk.{js,ps1,sh,cmd}`, `generate-bluebook-data.js`, `convert-logos.js`
- Key files: `scripts/install-openclerk.js` (cross-platform installer logic, wrapped per-OS by the `.ps1`/`.sh`/`.cmd` scripts)

**`tools/pdf-extract/`:**
- Purpose: Standalone utility for extracting text from PDFs; decoupled from the add-in — has its own `package.json`/`node_modules`/`dist`
- Contains: own `src/` and build output under `dist/`

**`assets/`:**
- Purpose: Icons and images referenced by `manifest.xml` and the task pane UI

**`dist/`:**
- Purpose: Webpack build output (the actual add-in bundle deployed/hosted)
- Generated: Yes
- Committed: No (build artifact; regenerate via `npm run build`/`build:dev`)

## Key File Locations

**Entry Points:**
- `src/taskpane/taskpane.ts`: Task pane bundle entry (imports `word.ts`)
- `src/commands/commands.ts`: Commands bundle entry (imports `commands.word.ts`)
- `manifest.xml`: Declares both entry points to Office (`SourceLocation`, ribbon actions)

**Configuration:**
- `webpack.config.js`: Defines the two build entries and dev-server settings
- `tsconfig.json`: TypeScript config
- `babel.config.json`: Babel transform used by Jest
- `.eslintrc.json`: Lint rules (Office add-in ESLint plugin)
- `package.json`: npm scripts (`build`, `test`, `start`, `package`, `bluebook:update-data`, etc.)

**Core Logic:**
- `src/taskpane/word.ts`: All task-pane workflows (hyperlinking, Bluebook checks, hallucination checks, opinion-text embedding, OOXML parsing)
- `src/taskpane/providers/`: Citation provider plugin system
- `src/taskpane/bluebook/`: Bluebook rule engine

**Testing:**
- `tests/*.test.ts`: Jest tests, one file per concern, run via `npm test`
- `tests/courtListener.live.test.ts`: Live network test against the real CourtListener API, excluded from default `npm test` run, run via `npm run test:live`

## Naming Conventions

**Files:**
- Providers: `<vendorName>Provider.ts`, camelCase (e.g., `westlawProvider.ts`, `courtListenerProvider.ts`)
- Bluebook editions: `edition<Ordinal><suffix>.ts` (e.g., `edition20th.ts`, `edition22nd.ts`)
- Generated data: `<name>.generated.ts` suffix marks files produced by a script, not hand-written
- Tests: `<subject>.test.ts`, mirroring the functional area name rather than the source file path (flat `tests/` directory, no 1:1 mirroring of `src/`)

**Directories:**
- Lowercase, single-word or camelCase (`taskpane`, `providers`, `bluebook`, `generated`)
- Plugin-system directories (`providers/`, `bluebook/`) each contain `types.ts` + `registry.ts` + `index.ts` as the standard trio

## Where to Add New Code

**New citation provider (e.g., a new case-law API):**
- Implementation: `src/taskpane/providers/<vendorName>Provider.ts`, implementing `CitationProvider` from `src/taskpane/providers/types.ts` (extend `EnterpriseCitationProvider` in `base.ts` if it requires paid/contract auth)
- Registration: add `citationProviderRegistry.register(new YourProvider())` to `src/taskpane/providers/index.ts`
- Tests: add cases to `tests/providers.test.ts`

**New Bluebook edition or rule:**
- Implementation: `src/taskpane/bluebook/edition<N>.ts` implementing `BluebookRuleSet` from `types.ts`, or extend a shared rule module (`commonRules.ts`, `reporterRules.ts`, `courtRules.ts`, `pageRangeRules.ts`)
- Registration: add to `src/taskpane/bluebook/index.ts`
- Tests: `tests/bluebook.test.ts`

**New task-pane workflow (UI feature):**
- Wiring: add DOM event listener registration in the `Office.onReady` block of `src/taskpane/word.ts`, plus handler function(s) below it
- Markup: add corresponding elements to `src/taskpane/taskpane.html`
- Consider extracting non-trivial workflow logic into a new file under `src/taskpane/` rather than growing `word.ts` further

**New ribbon command:**
- Implementation: `src/commands/commands.word.ts`
- Manifest: register the action/function in `manifest.xml`

**Build/release tooling:**
- Node scripts: `scripts/*.js`
- Cross-platform installer wrappers: `scripts/install-openclerk.{ps1,sh,cmd}` calling into `scripts/install-openclerk.js`

**Shared utilities:**
- Task-pane-wide helpers: `src/taskpane/utils.ts`

## Special Directories

**`src/taskpane/bluebook/generated/`:**
- Purpose: Large static abbreviation/reference tables
- Generated: Yes, by `scripts/generate-bluebook-data.js`
- Committed: Yes

**`dist/`:**
- Purpose: Webpack build output for the add-in
- Generated: Yes
- Committed: No

**`tools/pdf-extract/dist/` and `tools/pdf-extract/node_modules/`:**
- Purpose: Build output and dependencies for the standalone PDF extraction tool
- Generated: Yes
- Committed: No (should be gitignored; verify `.gitignore` coverage if adding new tool subprojects)

**`.scratch/`:**
- Purpose: Ad hoc/temporary working files outside the tracked source tree (untracked per git status)
- Generated: Yes (developer scratch space)
- Committed: No

---

*Structure analysis: 2026-07-15*
