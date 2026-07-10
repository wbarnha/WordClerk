# openclerk-pdf-extract

Standalone CLI: extracts text from a PDF via [pdf.js](https://mozilla.github.io/pdf.js/)'s embedded text layer, falling back to [tesseract.js](https://github.com/naptha/tesseract.js) OCR for any page with no usable text layer (a scanned/image-only page). Optionally reports the case citations found in the extracted text -- full, short-form, `Id.`, and `supra` -- clustered by which case each one refers to, and can flag citations that don't resolve against CourtListener as possible hallucinations.

This is a separate package from the OpenClerk Word add-in (own `package.json`, own dependencies) -- it's a command-line tool, not something loaded by Word, and isn't part of `dist/`. It does reuse the add-in's citation-parsing/hallucination-check logic directly from `../../src/taskpane/providers/` (see `src/citations.ts`) rather than duplicating it.

## Install and build

```bash
npm install
npm run build
```

## Usage

```bash
node dist/tools/pdf-extract/src/cli.js path/to/file.pdf [options]
```

- `--no-ocr` -- skip OCR; extract the embedded text layer only.
- `--lang <code>` -- tesseract.js language code(s) for OCR, e.g. `eng` or `eng+fra` (default: `eng`).
- `--citations` -- also report case citations found in the extracted text, clustered by case.
- `--verify` -- check each citation against CourtListener and flag any that don't resolve as a possible hallucination. Requires a `COURTLISTENER_API_TOKEN` environment variable (get one free at [courtlistener.com/profile/api-token](https://www.courtlistener.com/profile/api-token/)). Implies `--citations`.
- `--json` -- output machine-readable JSON instead of plain text.
- `--out <file>` -- write output to a file instead of stdout.

## Reproducing the Mata v. Avianca OCR run

The repo ships a real test fixture at [../../tests/fixtures/mata-v-avianca-filing.pdf](../../tests/fixtures/mata-v-avianca-filing.pdf) -- the affirmation in opposition from *Mata v. Avianca, Inc.*, No. 1:22-cv-01461-PKC (S.D.N.Y.), the filing containing the widely reported ChatGPT-fabricated case citations. Its pages have no embedded text layer at all (only the CM/ECF header stamp does), so running it through this tool exercises the real OCR path, not just text-layer extraction:

```bash
node dist/tools/pdf-extract/src/cli.js ../../tests/fixtures/mata-v-avianca-filing.pdf --citations
```

This recovers the full filing text via OCR and reports every citation found, including the two fabricated ones (*Peterson v. Iran Air* and *Martinez v. Delta Airlines, Inc.*) alongside the filing's genuine citations. Add `--verify` with a `COURTLISTENER_API_TOKEN` to see them flagged as unresolved automatically instead of having to eyeball the list.

## Tests

```bash
npm test
```
