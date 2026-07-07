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
- If `insertHyperlink` is unavailable in your Word environment, the add-in falls back to using `insertHtml` or plain text. This fallback also makes the add-in behave the same way on Windows (WebView2) and Mac (WKWebView) Word builds that support different Office.js requirement sets.

## Citation hyperlink providers (plugin architecture)

The **Online Lookup** tab is an alternative to the file-parsing workflow on the **Case Law** tab: instead of copying hyperlinks out of a source `.docx`, it queries a case-law lookup provider live and hyperlinks only the citations that resolve to exactly one case. For a citation like:

> Norfolk & W. Ry. Co. v. Liepelt, 444 U.S. 490 (U.S.Ill., 1980)

the selected provider is asked about that citation; if it immediately resolves to a single case, WordClerk hyperlinks it, otherwise that citation is left untouched and the scan moves on to the next one — no error, no interruption.

Providers are plugins implementing `CitationProvider` in [src/taskpane/providers/types.ts](src/taskpane/providers/types.ts) and self-registering with `citationProviderRegistry` in [src/taskpane/providers/index.ts](src/taskpane/providers/index.ts). To add a new one (a firm's internal search API, another public case-law database, etc.), implement the interface and register an instance — nothing else in the add-in needs to change.

Built-in providers:
- **CourtListener** ([courtListenerProvider.ts](src/taskpane/providers/courtListenerProvider.ts)) — Free Law Project's free, public case-law search. Works with no credentials; get an optional API token at [courtlistener.com/profile/api-token](https://www.courtlistener.com/profile/api-token/) to raise the (fairly low) anonymous rate limit.
- **LexisNexis, Westlaw, Bloomberg Law** ([lexisNexisProvider.ts](src/taskpane/providers/lexisNexisProvider.ts), [westlawProvider.ts](src/taskpane/providers/westlawProvider.ts), [bloombergLawProvider.ts](src/taskpane/providers/bloombergLawProvider.ts)) — these are contract-gated enterprise APIs. Each vendor provisions its own base URL and OAuth2 client credentials per customer, so WordClerk doesn't (and can't) ship a fixed endpoint or key; you supply your API base URL, client ID, and client secret from your firm's contract in the Online Lookup tab. The bundled implementations use the standard OAuth2 client-credentials flow and a `POST <base>/search/cases`-shaped request as a starting point — confirm the exact token and search paths in your vendor's API documentation and adjust the `TOKEN_PATH`/`SEARCH_PATH` constants at the top of each file if they differ.
- **USPTO Patent Center** ([usptoPatentCenterProvider.ts](src/taskpane/providers/usptoPatentCenterProvider.ts)) — **TODO, not implemented.** Registered as a placeholder (shows up in the provider list, always reports "not found" so citations are skipped) so the plugin wiring can be exercised end-to-end before a real Patent Center / PEDS integration is built for the Non-patent Literature workflow.

### Getting credentials for each provider

**CourtListener** (free, optional token — self-service):
1. Create a free account at [courtlistener.com/sign-in](https://www.courtlistener.com/sign-in/) (there's a "Register" link if you don't have one).
2. Once signed in, go to [courtlistener.com/profile/api-token](https://www.courtlistener.com/profile/api-token/) and copy the token shown there.
3. Paste it into the "API token" field on the Online Lookup tab and click Connect. You can leave it blank and use CourtListener anonymously, just at a lower rate limit.

**LexisNexis** (requires an existing Lexis subscription):
1. Register for a developer account at the [LexisNexis Developer Portal](https://dev.lexisnexis.com/) (use your firm/business email) — see their [Getting Started guide](https://dev.lexisnexis.com/gettingStarted).
2. Request access to the case-law/citation API product for your organization; a LexisNexis data specialist reviews and provisions access (their published turnaround is about 24 hours for trial requests).
3. Once approved, the portal issues a Client ID and Client Secret and documents your tenant's API base URL — enter those three values into the LexisNexis fields on the Online Lookup tab.

**Westlaw** (requires an existing Westlaw/Thomson Reuters subscription):
1. Visit the [Thomson Reuters Developer Portal](https://developers.thomsonreuters.com/) and contact Thomson Reuters support to request API access under your firm's existing Westlaw agreement — this isn't self-service signup; TR provisions it per customer.
2. TR support provides a Client ID, Client Secret, the authentication (token) endpoint, and your API base URL.
3. Enter those into the Westlaw fields on the Online Lookup tab (adjust `TOKEN_PATH` in [westlawProvider.ts](src/taskpane/providers/westlawProvider.ts) if the endpoint TR gives you doesn't match the default `/oauth/token`).

**Bloomberg Law** (requires an existing Bloomberg Law subscription):
1. Contact your Bloomberg account representative, or Bloomberg Law's help desk (888.560.2529 / help@bloomberglaw.com), to request Web API access for your firm's account.
2. Bloomberg provisions credentials through its Enterprise Console (an admin on your account downloads a Client ID and Secret there — see Bloomberg's [Web API Connectivity Policy](https://www.bloomberg.com/professional/support/api-library/) for what the console shows). Store the downloaded secret securely; per Bloomberg's policy these credentials expire after 18 months and will need to be refreshed then.
3. Enter the Client ID, Secret, and the API base URL Bloomberg gives you into the Bloomberg Law fields on the Online Lookup tab.

Because the three enterprise integrations are contract-gated and provisioned per customer, treat the exact field names/paths above as a starting point, not a guarantee — confirm specifics against the documentation your vendor rep provides.

## Security & IT review

WordClerk has no backend server of its own — it's static HTML/JS/CSS loaded into a Word task pane (see `npm run start`, which just serves `dist/` and sideloads `manifest.xml`). This keeps the data-flow story simple to audit:

- **Outbound network calls are limited to two things**, both easy to grep for: (1) the citation lookup providers under [src/taskpane/providers/](src/taskpane/providers/), each of which only calls the single host in its `API_BASE`/base-URL field, and (2) nothing else — the file-parsing and parenthetical-citation workflows never leave the machine.
- **Credentials are held in memory only**, inside each provider instance (see `EnterpriseCitationProvider` in [base.ts](src/taskpane/providers/base.ts)). They are never written to `localStorage`, `sessionStorage`, cookies, or any WordClerk-controlled server, and are cleared by "Disconnect" or when the task pane is closed/reloaded.
- **No telemetry or analytics** are collected by the add-in itself.
- **`manifest.xml`'s `<AppDomains>`** declares every external domain WordClerk talks to out of the box (`courtlistener.com`); if your policy requires allow-listing every contacted domain, add your firm's specific LexisNexis/Westlaw/Bloomberg Law API host there too before deploying.
- The whole add-in is open source under this repository, so IT/security review doesn't have to take any of the above on faith — it can be verified directly by reading `src/taskpane/`.

## Compliance considerations

WordClerk itself is a thin, client-side Word add-in with no hosted service of its own, so heavyweight vendor attestations like **SOC 2 Type II** or **ISO/IEC 27001** — which certify how an organization *operates and hosts* a service over time — don't map cleanly onto "review this add-in's code." WordClerk does not hold, and does not claim, either certification. What's actually relevant to a law firm's review is more specific to how it's distributed and what it touches:

- If you're evaluating this add-in as a piece of software (rather than as a hosted vendor), Microsoft's [Microsoft 365 App Compliance Program](https://learn.microsoft.com/en-us/microsoft-365-app-certification/overview) is the applicable path for Office Add-ins: **Publisher Attestation** (a self-assessment of security/data-handling practices) or full **Microsoft 365 Certification** (a third-party audit against SOC 2/PCI-DSS/ISO 27001-aligned controls). Neither has been completed for WordClerk; pursue whichever your IT team requires before broad deployment.
- Firms increasingly vet vendors with standardized questionnaires (e.g., the Shared Assessments **SIG** questionnaire) rather than, or in addition to, certifications — the "Security & IT review" section above is meant to answer those questions directly from the source.
- Because the LexisNexis/Westlaw/Bloomberg Law integrations are opt-in and use *your firm's own* contracted API credentials, your firm's existing vendor agreements and compliance posture with those three vendors govern that data flow — WordClerk is just the client dialing out to an endpoint you already have a relationship with.
- Under the ABA Model Rules (notably Rule 1.1 cmt. 8 on technology competence and Rule 1.6 on confidentiality), the relevant question for any tool touching client matters is typically "what leaves the firm's control and where does it go" — the Security & IT review section above is written to answer exactly that.

## Performance notes

- The file-parsing (**Case Law**) and parenthetical (**Non-patent Literature**) workflows are entirely local (no network calls) and are unaffected by the Online Lookup feature.
- Online Lookup makes one network round-trip per detected citation, **sequentially** (never in parallel), specifically to stay under each provider's rate limits — CourtListener's free anonymous tier, for example, allows only a few requests per minute. A document with many citations will take roughly `(number of citations) × (provider round-trip time)` to finish; expect low-to-mid tens of seconds for a document with a few dozen citations, and prefer the file-parsing workflow when you already have a hyperlinked source document, since it's effectively instant.
- No new bundle dependencies were added for this feature — it's built on the browser's native `fetch`, already available in both the Windows (WebView2) and Mac (WKWebView) Word task pane runtimes.

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

