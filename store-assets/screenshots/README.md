# Partner Center listing screenshots

Five 1366×768 PNGs for the AppSource listing, one per workflow tab:

1. `1-manage-hyperlinks-file-source.png` — Manage Hyperlinks, file-based source
2. `2-manage-hyperlinks-online-lookup.png` — Manage Hyperlinks, online lookup source
3. `3-bluebook-check.png` — Bluebook Check
4. `4-find-hallucinations.png` — Find Hallucinations
5. `5-embed-cited-text.png` — Embed Cited Text

**How these were made:** the task pane's real production build (`dist/taskpane.html` after `npm run
build`) was loaded in headless Chromium with `Office.js` replaced by a minimal async stub (`Office.onReady`
resolves as if hosted in Word) — enough to un-hide the UI and drive the `#workflow-select` dropdown
through each tab, without ever touching a real Word document. That capture was then composited onto a
plain mock Word window (ribbon bar + blank document) at 1366×768 so the pane reads in context. The task
pane content itself is pixel-accurate to the shipped build; the surrounding "Word window" is a
simplified stand-in, not a real Word screenshot.

**To regenerate after a UI change:** rebuild (`npm run build`), then re-run the harness/mockup/Playwright
script used to produce these — see the conversation history or recreate per the approach above (stub
`Office.onReady` asynchronously; a *synchronous* stub fires before module-level `const`s like
`TAB_PANEL_IDS` in `word.ts` finish initializing under the ES5 build and throws spuriously).
