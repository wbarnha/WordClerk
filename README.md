# WordClerk

[![CI](https://github.com/wbarnha/WordClerk/actions/workflows/ci.yml/badge.svg)](https://github.com/wbarnha/WordClerk/actions/workflows/ci.yml)

WordClerk is a Word add-in (task pane) for applying and removing hyperlinks to case-law and parenthetical citations.

## Development

Prerequisites
- Node.js (16+ recommended)
- npm

Install dependencies:

```bash
cd "c:\Users\willi\WordClerk"
npm install
```

Generate PNG icons from the SVG (optional but recommended for manifest icons):

```bash
npm run convert-logos
```

Start the dev server and sideload the add-in into Word (desktop):

```bash
npm run start
```

This runs the webpack dev server and uses `office-addin-debugging` to sideload the manifest into Word for debugging.

## Scripts
- `npm run build:dev` — build development bundle
- `npm run build` — production build
- `npm run convert-logos` — convert `dist/assets/logo-filled.svg` into PNG variants (16/32/80px)
- `npm run start` — start dev server and sideload into Word
- `npm run recover:start` — clear stale Office dev settings, then stop and restart sideload debugging
- `npm run install:addin` — install the manifest into the default Office WEF manifest folder
- `npm run install:addin:dry-run` — validate installer behavior without writing files

## Notes
- If icons in the manifest are SVG and Word rejects the manifest, convert or reference PNGs instead.
- If `insertHyperlink` is unavailable in your Word environment, the add-in falls back to using `insertHtml` or plain text.

## Dependency security fixes

All of the following are **devDependency-only** issues — they live in the local build/debug toolchain (webpack, its dev server, and Microsoft's own Office Add-in CLI tooling) and were never part of `dist/`, the bundle Word actually loads. Still, `npm audit`/GitHub Dependabot flagged 10 findings (9 moderate, 1 high) before this branch; all 10 are fixed here (`npm audit` now reports **0 vulnerabilities**), with no breaking changes to the packages we depend on directly and no change to the project's minimum supported Node version.

| Package (path) | Advisory | Severity | Before | After | How it's reached / fixed |
| --- | --- | --- | --- | --- | --- |
| `serialize-javascript` (via `copy-webpack-plugin`) | [GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq) — RCE via `RegExp.flags`/`Date.prototype.toISOString()` | High | `<=7.0.4` | `^7.0.7` (forced via `overrides`) | `copy-webpack-plugin@12.0.2` (our pinned version) depends on a vulnerable `serialize-javascript` range. Bumping `copy-webpack-plugin` itself to the only fixed release (`14.0.0`) would've required Node ≥20.9.0 in CI/local dev, so instead we added a package.json [`overrides`](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides) entry that forces every consumer in the tree onto a patched `serialize-javascript`, regardless of what `copy-webpack-plugin` itself asks for. |
| `serialize-javascript` (same package) | [GHSA-qj8w-gfj5-8c6v](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v) — CPU-exhaustion DoS via crafted array-like objects | High | `<=7.0.4` | `^7.0.7` | Same root cause and fix as above (one vulnerable package, two CVEs). |
| `uuid` (via `webpack-dev-server` → `sockjs`) | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — missing buffer bounds check in `uuid` v3/v5/v6 when a buffer is supplied | Moderate | `<11.1.1` (`sockjs`'s own dependency is pinned to `^8.3.2`, unpatched upstream as of this writing) | `^14.0.1` (forced via `overrides`) | `sockjs` (used by `webpack-dev-server` for its WebSocket fallback transport) hasn't updated its own `uuid` dependency, so no version of `webpack-dev-server` fixes this by itself. The `overrides` entry forces `uuid` to a patched version tree-wide instead. |
| `uuid` (via `office-addin-manifest` → `office-addin-usage-data`) | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Moderate | `office-addin-manifest@2.1.5` → `office-addin-usage-data 1.6.2–2.0.8` → vulnerable `uuid` | `office-addin-manifest@2.1.6` → `office-addin-usage-data@2.1.1` (no longer depends on `uuid` at all) | Plain devDependency update — `office-addin-manifest` and `office-addin-cli` were bumped within their existing `^2.1.x`/`^2.0.x` package.json ranges; no version-range change needed. |
| `uuid` (via `office-addin-debugging` → `office-addin-dev-settings` → (optional) `@microsoft/m365agentstoolkit-cli` → `@microsoft/teamsfx-core` → `@azure/msal-node`, and a second nested copy of `office-addin-manifest@1.13.6` inside the same `teamsfx-core` tree) | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Moderate (×5 distinct dependency paths in the original audit output) | `@azure/msal-node@<=5.1.4` and a pinned `office-addin-manifest@1.13.6` nested under `@microsoft/teamsfx-core`, both depending on vulnerable `uuid` | Same `^14.0.1` `overrides` entry | `office-addin-debugging@6.1.2` (updated from `6.1.1`, within our existing `^6.0.6` range) now pulls `office-addin-dev-settings@3.1.2`, but that package still lists `@microsoft/m365agentstoolkit-cli` as an *optional* dependency, and Microsoft hasn't yet updated the `teamsfx-core`/`msal-node` chain it drags in. This entire chain is dev-time-only tooling for an M365 Agents Toolkit CLI feature this project doesn't use; the `overrides` entry closes it without needing that upstream fix. |
| `webpack-dev-server` | [GHSA-mx8g-39q3-5c79](https://github.com/advisories/GHSA-mx8g-39q3-5c79) — HMR WebSocket interception via permissive user-configured proxies | Moderate | `5.2.4` (exact pin) | `5.2.6` (exact pin) | Plain patch-level version bump, same `5.x` line, same `node >= 18.12.0` engine requirement — no compatibility risk expected. |

**Why `overrides` instead of upgrading `copy-webpack-plugin`/`webpack-dev-server` to their latest majors?** `npm audit fix --force` offered `copy-webpack-plugin@14.0.0` and (for a full sockjs fix) `webpack-dev-server@6.0.0`, but those require Node ≥20.9.0 and ≥22.15.0 respectively — bumping this project's minimum Node version is a separate decision with its own blast radius (CI config, contributor tooling), not something to bundle silently into a vulnerability fix. The `overrides` field lets us force the two actually-vulnerable leaf packages (`uuid`, `serialize-javascript`) to patched versions everywhere in the tree, which is what actually eliminates the advisories, without forcing major-version churn on `copy-webpack-plugin`/`webpack-dev-server` or raising the Node floor. If a future contributor *does* want to move to `webpack-dev-server@6`/Node 22+, these overrides can simply be deleted at that point since they'd be redundant.

## Download and install from GitHub
You can install the add-in into desktop Word from this repository by using the GitHub release package, workflow artifacts, or cloning the repo locally.

### Option 1: Install from GitHub Release asset
1. Go to the GitHub Releases page for this repo.
2. Download the latest `wordclerk-addin.zip` release asset.
3. Extract the ZIP. It contains `manifest.xml`, `dist`, and `assets`.
4. In a terminal, open the extracted folder and run:

```bash
npm install
npm run start
```

5. `npm run start` launches the local dev server and sideloads the add-in into Word Desktop.

### Option 2: Install from GitHub Actions workflow artifact
1. Open the Actions tab in this repo.
2. Select the latest successful workflow run for `CI`.
3. Scroll to the `Artifacts` section and download `wordclerk-addin`.
4. Extract the downloaded artifact.
5. Open the extracted folder and run:

```bash
npm install
npm run start
```

This gives you a packaged `wordclerk-addin.zip` plus the source contents.

### Option 3: Create a local install package
If you want a package that can be uploaded to Word manually, use the package script:

```bash
npm install
npm run package
```

This creates `wordclerk-addin.zip` at the repo root, which contains:
- `manifest.xml`
- `dist`
- `assets`
- `installer/install-wordclerk.js`
- `installer/install-wordclerk.ps1`

You can then upload the `manifest.xml` file to Word from `Insert` → `My Add-ins` → `Upload My Add-in` → `Add from file`.

### Option 4: Create a local test environment
For local QA, you can use the PowerShell helper script:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-local-test.ps1
```

That script installs dependencies, builds the add-in, and packages `wordclerk-addin.zip`.
The generated package also includes installer scripts that can copy the manifest into Word's local WEF folder.

After the script completes, run:

```bash
npm run start
```

Then open Word and use the add-in from the sideloaded manifest.

### Option 5: Clone the repository and install locally
1. Clone the repo:

```bash
git clone https://github.com/wbarnha/WordClerk.git
cd WordClerk
```

2. Install dependencies:

```bash
npm install
```

3. Start the add-in locally and sideload into Word:

```bash
npm run start
```

This will launch the dev server on `https://localhost:3000` and load the add-in into Word Desktop using the manifest.

### Manual sideload via manifest
If you want to sideload the add-in manually in Word Desktop:
1. Run `npm install` and `npm run build:dev`.
2. Host the `dist` and `assets` folders on a local HTTPS server matching the URLs in `manifest.xml`.
3. In Word, go to `Insert` → `My Add-ins` → `Upload My Add-in` → `Add from file`.
4. Select the extracted or cloned `manifest.xml` file.

> Note: The manifest currently points to `https://localhost:3000/` for the add-in content, so the easiest install path is using `npm run start`.

