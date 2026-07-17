#!/usr/bin/env node
/*
 * Lists the documentation items that still need a human to fill them in before OpenClerk can be
 * submitted to Microsoft AppSource. Run it any time with `npm run docs:pending`.
 *
 * It scans the submission-relevant docs for the deliberate placeholder markers used throughout them
 * (`<FILL IN ...>`, `to be specified`, `TODO: fill in`) and prints each remaining one as
 * `file:line  excerpt`, followed by a count. When the count reaches 0, every gap listed in
 * DOCS-TODO.md has been closed. Exits 0 either way -- this is an informational helper, not a gate.
 *
 * To track a new fill-in, just use one of the MARKERS below in the doc; it will show up here
 * automatically, no change to this script required.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

// Files that carry human-fill-in placeholders. Missing files are skipped (e.g. when run from a
// branch that doesn't have them yet), so this never errors just because a doc isn't present.
const FILES = ['SUBMISSION.md', 'TERMS.md', 'PRIVACY.md', 'manifest.xml'];

// Deliberate placeholder markers. Kept deliberately narrow so ordinary prose ("todo" in a sentence,
// the word "placeholder" describing the USPTO stub) doesn't produce false hits. The colon after
// FILL IN is required so the header text that DESCRIBES the "<FILL IN>" convention isn't itself
// flagged -- only real "<FILL IN: what to enter>" sites are.
const MARKERS = [/<FILL IN:/i, /to be specified/i, /TODO:\s*fill in/i];

function scanFile(relPath) {
  const abs = path.join(repoRoot, relPath);
  if (!fs.existsSync(abs)) {
    return [];
  }
  const lines = fs.readFileSync(abs, 'utf8').split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    if (MARKERS.some((re) => re.test(line))) {
      hits.push({ file: relPath, line: i + 1, text: line.trim() });
    }
  });
  return hits;
}

function main() {
  const hits = FILES.flatMap(scanFile);

  if (hits.length === 0) {
    console.log('No pending documentation fill-ins. Every DOCS-TODO.md item is complete. ✓');
    return;
  }

  console.log(`Pending documentation fill-ins (${hits.length}) -- see DOCS-TODO.md for what to enter:\n`);
  for (const hit of hits) {
    const excerpt = hit.text.length > 100 ? `${hit.text.slice(0, 97)}...` : hit.text;
    console.log(`  ${hit.file}:${hit.line}  ${excerpt}`);
  }
  console.log('');
}

main();
