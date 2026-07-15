# External Integrations

**Analysis Date:** 2026-07-15

## APIs & External Services

**Case-law lookup (built-in, default provider):**
- CourtListener REST API v4 (Free Law Project) - `src/taskpane/providers/courtListenerProvider.ts`
  - Base URL: `https://www.courtlistener.com/api/rest/v4` (`API_BASE`), site origin `https://www.courtlistener.com` (`SITE_ORIGIN`)
  - Used for: citation lookup (`/citation-lookup/`) and opinion text retrieval (`/opinions/?cluster=...`)
  - Auth: user-supplied API token (`apiToken` credential field), sent as a bearer/token header — required for all requests; there is no anonymous tier for citation-lookup (confirmed live per code comment)
  - Rate limits: documented 5 requests/minute, 50/hour, 125/day; provider tracks `lastRequestWasRateLimited` to distinguish 429s from genuine not-found results
  - This is the only domain declared in `manifest.xml`'s `<AppDomains>` and the only integration that ships without user configuration

**Enterprise legal research providers (opt-in, user-configured, not bundled with credentials):**
- LexisNexis - `src/taskpane/providers/lexisNexisProvider.ts`
  - Base URL: user-supplied tenant URL (must start with `https://`), e.g. `https://your-tenant.api.lexisnexis.com`
  - Auth: OAuth2 client-credentials handshake via `fetchClientCredentialsToken()` in `src/taskpane/providers/base.ts`
- Westlaw (Thomson Reuters) - `src/taskpane/providers/westlawProvider.ts`
  - Same pattern: tenant base URL + OAuth2 client-credentials
- Bloomberg Law - `src/taskpane/providers/bloombergLawProvider.ts`
  - Same pattern: tenant base URL + OAuth2 client-credentials
- USPTO Patent Center - `src/taskpane/providers/usptoPatentCenterProvider.ts`
  - Patent-citation-focused provider, same enterprise-provider architecture

All enterprise providers extend `EnterpriseCitationProvider` (`src/taskpane/providers/base.ts`), which:
  - Rejects non-HTTPS base URLs
  - Performs an OAuth2 client-credentials POST to the vendor's token endpoint, expecting an `access_token` field in the JSON response
  - Holds credentials/tokens in memory only for the session (`this.credentials`); never persists to disk or `localStorage`

**Provider registry:**
- `src/taskpane/providers/registry.ts` and `src/taskpane/providers/index.ts` wire up the available providers for the taskpane UI to select from

## Data Storage

**Databases:**
- None. No SQL/NoSQL database client or ORM found in dependencies or source.

**File Storage:**
- Local filesystem only, via the host Word document itself. `jszip` is used to read/write the `.docx` OOXML archive directly (citation/hyperlink edits) — see references throughout `src/taskpane/word.ts` and `src/taskpane/providers/`.
- No cloud storage integration (S3, Azure Blob, Google Drive/Docs API) detected.

**Caching:**
- None detected beyond in-memory provider state held for the current taskpane session.

## Authentication & Identity

**Auth Provider:**
- No end-user/app authentication system (no login, no SSO, no session cookies) — the add-in itself is unauthenticated; only outbound calls to citation-research vendors require credentials, and those are entered by the user per-session (see APIs & External Services above).
- Office Add-in sideloading/identity is governed by Microsoft Office's own trust model (`manifest.xml`), not custom code.

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry/Bugsnag/Application Insights or similar SDK found in dependencies.

**Logs:**
- No centralized logging; errors are surfaced directly to the taskpane UI (thrown `Error` objects caught and displayed) rather than sent to a remote log/telemetry service.
- `appsscript.json` (Google Apps Script project config) sets `"exceptionLogging": "STACKDRIVER"`, but no active Apps Script source exists in `src/` — this appears to be an inactive/unused scaffold, not a live integration.

## CI/CD & Deployment

**Hosting:**
- GitHub Pages, hosting the built `dist/` output (docs site + add-in assets), deployed by the `deploy-pages` job in `.github/workflows/ci.yml` on GitHub release events
- GitHub Releases distribute `openclerk-addin.zip` and `openclerk-addin-offline.zip` as downloadable installer packages

**CI Pipeline:**
- GitHub Actions - `.github/workflows/ci.yml`, jobs: `build`, `test`, `installer-smoke` (Windows PowerShell installer, via ubuntu + pwsh), `installer-smoke-macos` (macOS installer smoke test, `runs-on: macos-latest`), `offline-smoke` (offline package/local-server validation), `deploy-pages`, `publish`
- `publish` job optionally pushes to Microsoft Partner Center via Azure AD OAuth2 client-credentials (`login.microsoftonline.com`) — entirely gated behind presence of `PARTNER_CENTER_API_URL`, `PARTNER_CENTER_CLIENT_ID`, `PARTNER_CENTER_CLIENT_SECRET`, `PARTNER_CENTER_TENANT_ID` secrets; skipped if unset
- Build provenance attestation via `actions/attest-build-provenance@v2`; SHA256SUMS generated and attached to releases

## Environment Configuration

**Required env vars:**
- None required for local development or normal operation of the add-in itself (all provider credentials are entered interactively at runtime, not via env vars)
- CI-only secrets (optional, for Partner Center publishing): `PARTNER_CENTER_API_URL`, `PARTNER_CENTER_CLIENT_ID`, `PARTNER_CENTER_CLIENT_SECRET`, `PARTNER_CENTER_TENANT_ID`
- Standard `GITHUB_TOKEN` used for release-asset upload steps

**Secrets location:**
- No `.env` files present in the repo
- CI secrets are stored in GitHub Actions repository/environment secrets (not present in source)
- End-user provider credentials (CourtListener token, enterprise API keys) live only in browser memory for the taskpane session — never written to disk, `localStorage`, or an OpenClerk-controlled server (per explicit code comments in `src/taskpane/providers/base.ts`)

## Webhooks & Callbacks

**Incoming:**
- None. This is a client-side Office Add-in with no server component to receive webhooks.

**Outgoing:**
- None beyond the direct REST calls to citation-research providers listed above (these are synchronous request/response API calls, not webhook/callback patterns).

---

*Integration audit: 2026-07-15*
