# Technology Stack

**Analysis Date:** 2026-07-15

## Languages

**Primary:**
- TypeScript (compiled with `target: es5`, `lib: es2015, dom`) - `src/**/*.ts`, used for all add-in logic (taskpane UI, Word interop, Bluebook citation engine, citation-provider integrations)

**Secondary:**
- HTML - `src/taskpane/taskpane.html`, `src/commands/commands.html` (Office Add-in task pane and function-file entry points)
- CSS - `src/taskpane/taskpane.css`
- PowerShell / Bash / Batch - `scripts/install-openclerk.ps1`, `scripts/install-openclerk.sh`, `scripts/install-openclerk.cmd`, `scripts/local-server/*.ps1` (end-user installer/offline-server tooling, not part of the add-in bundle)
- XML - `manifest.xml` (Office Add-in manifest, uses Microsoft's `OfficeApp`/`VersionOverridesV1_0` schema)

## Runtime

**Environment:**
- Node.js 18 (CI: `.github/workflows/ci.yml` uses `actions/setup-node@v4` with `node-version: '18'`, except the `publish` job which uses Node 22 for an ESM-only manifest-validation dependency)
- Browser runtime: Microsoft Office WebView (Word desktop/online), targeting `es5`/`ie 11` per `browserslist` in `package.json` for maximum Office host compatibility

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- Office JS API (`@types/office-js`, `@types/office-runtime`) - Word document interop via `src/taskpane/word.ts`
- No frontend UI framework (React/Vue/Angular) - taskpane UI is built with vanilla TS/DOM manipulation (`src/taskpane/taskpane.ts`, `src/taskpane/utils.ts`)
- `marked` (^18.0.5) - Markdown rendering, used in `scripts/build-docs.js` to generate `dist/index.html` from `README.md`

**Testing:**
- Jest 29 with `ts-jest` preset - config embedded in `package.json` (`testMatch: **/tests/**/*.test.ts`, `testEnvironment: node`)
- Test suite: `tests/*.test.ts` (bluebook citation formatting, hyperlinks, installer scripts, manifest validation, opinion-text extraction, provider behavior, utils)
- `tests/courtListener.live.test.ts` is excluded from the default `npm test` run; invoked separately via `npm run test:live` (hits the real CourtListener API)

**Build/Dev:**
- Webpack 5 (`webpack.config.js`) - bundles `taskpane` and `commands` entry points, dev-serves via `webpack-dev-server` with `office-addin-dev-certs` for HTTPS
- Babel (`@babel/core`, `@babel/preset-env`, `@babel/preset-typescript`) via `babel-loader` - transpiles TS/JS for the `es5`/`ie 11` browserslist target
- `office-addin-cli` / `office-addin-debugging` / `office-addin-dev-settings` / `office-addin-manifest` / `office-addin-lint` - Microsoft's Office Add-in tooling for sideloading, manifest validation, and linting
- `sharp` - image processing, used in `scripts/convert-logos.js`
- `archiver` - zips release packages in `scripts/package-release.js` / `scripts/package-release-offline.js`
- ESLint with `eslint-plugin-office-addins` (`plugin:office-addins/recommended`) - `.eslintrc.json`
- Prettier via `office-addin-prettier-config` (`"prettier"` field in `package.json`)

## Key Dependencies

**Critical:**
- `jszip` (^3.10.1) + `@types/jszip` - reads/writes `.docx` (OOXML zip) structure directly, used for citation/hyperlink manipulation independent of the Office JS API
- `core-js` / `regenerator-runtime` - polyfills for `es5`/`ie 11` target compatibility

**Infrastructure:**
- `copy-webpack-plugin`, `html-webpack-plugin`, `html-loader`, `file-loader`, `source-map-loader` - webpack asset/HTML pipeline
- `os-browserify`, `process` - Node built-in shims for browser bundling

## Configuration

**Environment:**
- No `.env` file present in the repo; the add-in has no server-side environment variables — it runs entirely client-side inside Word
- Per-provider credentials (CourtListener API token, LexisNexis/Westlaw/Bloomberg Law API base URL + client id/secret) are supplied by the end user at runtime through the taskpane UI and held in memory only for the session — see `src/taskpane/providers/base.ts` and `src/taskpane/providers/courtListenerProvider.ts`
- `package.json` `config` block sets Office debugging defaults (`app_to_debug: word`, `dev_server_port: 3000`)

**Build:**
- `webpack.config.js` - dev server on port 3000 with HTTPS via `office-addin-dev-certs`, separate `taskpane`/`commands` bundles
- `tsconfig.json` - `es5` target, `jsx: react` (unused, artifact of the Office Add-in template), `outDir: lib`
- `babel.config.json` - preset-env + preset-typescript
- `manifest.xml` - Office Add-in manifest; production variant generated at package time replaces `https://localhost:3000` URLs (verified by CI's "Verify production manifest URLs" step)
- `.clasp.json` / `appsscript.json` - Google Apps Script project config; present in the repo root but no corresponding `.gs`/Apps Script source files were found under `src/` — appears to be a leftover/unused scaffold rather than an active integration

## Platform Requirements

**Development:**
- Node.js 18+ and npm
- Windows/macOS with Word desktop (or Word on the web) for sideloading via `manifest.xml`
- HTTPS dev certs (`office-addin-dev-certs`) required for local Office Add-in development

**Production:**
- Distributed as a sideloaded Office Add-in (no app-store/AppSource listing referenced in code) via:
  - GitHub Releases zip (`openclerk-addin.zip`, built by `scripts/package-release.js`) containing `installer/install-openclerk.{ps1,cmd,sh}` and `manifest.xml`
  - GitHub Pages hosting of the built `dist/` bundle (deployed by CI's `deploy-pages` job, triggered on GitHub release)
  - An offline-capable package (`openclerk-addin-offline.zip`, `scripts/package-release-offline.js`) with vendored `office.js`/Fabric CSS and a local PowerShell HTTPS server (`scripts/local-server/*.ps1`) for air-gapped/no-internet use
- Optional Microsoft Partner Center publishing step in CI (`publish` job), gated on `PARTNER_CENTER_*` secrets being configured

---

*Stack analysis: 2026-07-15*
