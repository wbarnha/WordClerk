# Documentation to complete before AppSource submission

This is the single place that tracks every documentation item still needing a human to fill it in.
Each row says **where** to edit, **what** to enter, and **anywhere else the same value must change**.
Run **`npm run docs:pending`** at any time to list the placeholders that are still open — when it
reports zero, everything in the "Placeholder" section below is done.

> These are content/decision gaps only. The code and manifest changes for submission already landed
> (see `SUBMISSION.md` for the full submission checklist and hosted-URL table).

## Placeholders (`npm run docs:pending` tracks these)

- [x] **Governing-law jurisdiction** — **resolved:** `TERMS.md` § 8 (Governing law) was dropped
  rather than filled in, following standard practice for MIT-licensed open-source projects (the MIT
  License carries no choice-of-law clause and Microsoft Partner Center doesn't require one). Contact
  is now § 8.

- [x] **Publisher / `ProviderName` confirmation** — **confirmed as `William Barnhart`**, matching the
  Partner Center account's Publisher display name. Consistent across `manifest.xml`, `PRIVACY.md`,
  `TERMS.md`, and `SUBMISSION.md`.

- [ ] **Reviewer CourtListener API token.**
  - **Where:** `SUBMISSION.md` § 3 (`<FILL IN: provide a working token …>`).
  - **What:** paste a working read-only CourtListener token, or a free account reviewers can use,
    so the online Find Hallucinations / Online Lookup / Embed Cited Text features can be tested.
    Get one at <https://www.courtlistener.com/help/api/rest/>.

- [ ] **Sample test `.docx` for reviewers.**
  - **Where:** `SUBMISSION.md` § 3 (`<FILL IN: attach a sample .docx …>`).
  - **What:** attach (in Partner Center) and name a small Word document containing a few real case
    citations, so a reviewer can exercise the local features immediately.

- [x] **Support contact email (Partner Center account-level)** — **confirmed:**
  `williambbarnhart@gmail.com`. Set at Partner Center → Account settings → Contact info / Program
  agreements → Support contact (not a per-listing field, so it isn't in `manifest.xml` or the
  hosted-URL table).

## Reminders (not auto-tracked — no placeholder marker)

- [x] **"Last updated" dates** — confirmed: **July 2026** is the intended publication date, so the
  dates in `PRIVACY.md` and `TERMS.md` are final as written.

## How the tracking works

- `npm run docs:pending` scans `SUBMISSION.md`, `TERMS.md`, `PRIVACY.md`, and `manifest.xml` for the
  deliberate markers (`<FILL IN: …>`, `to be specified`, `TODO: fill in`) and prints each remaining
  one as `file:line`. To add a new tracked gap, just drop one of those markers in the doc.
- The "Reminders" items above have no marker (they're valid text today, just dated), so complete
  them by hand — `docs:pending` won't flag them.
