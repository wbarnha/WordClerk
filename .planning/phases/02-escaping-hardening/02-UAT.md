---
status: testing
phase: 02-escaping-hardening
source: [02-VERIFICATION.md]
started: 2026-07-16T00:00:00Z
updated: 2026-07-16T00:00:00Z
---

## Current Test

number: 1
name: Manual Word smoke test (Roadmap Phase 2 Success Criterion 4)
expected: |
  No workflow regressed after the safeInsertion.ts wrapper refactor. Specifically worth
  double-checking given the review+fix cycle: hyperlinks render with no broken/injected markup
  (CR-01), and embedded comment text shows correct ampersands/apostrophes/quotes rather than
  HTML entities like &amp;/&#39; (CR-02).
awaiting: user response

## Tests

### 1. Manual Word smoke test (Roadmap Phase 2 Success Criterion 4)
expected: |
  Open a real Word document (desktop or online) with OpenClerk sideloaded. Run through all four
  workflows end-to-end:
  1. Manage Hyperlinks — load a source .docx and apply case-law hyperlinks, confirm links are
     inserted correctly.
  2. Bluebook Check — run a check against document text, confirm issues render.
  3. Hallucination Check — connect a provider (e.g. CourtListener) and run a hallucination scan,
     confirm the "possible hallucination" guard still renders correctly for a deliberately-
     mismatched citation.
  4. Embed Cited Text — embed opinion text for a pincite citation, confirm a Word comment is
     inserted with the expected excerpt.

  No workflow regressed after the safeInsertion.ts wrapper refactor. Specifically worth
  double-checking given the review+fix cycle: hyperlinks render with no broken/injected markup
  (CR-01), and embedded comment text shows correct ampersands/apostrophes/quotes rather than
  HTML entities like &amp;/&#39; (CR-02).
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
