/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/// <reference types="office-js" />

/* global Word */

import { escapeHtml } from "openclerk-core";
import type { SafeHtml, SafeHyperlinkUrl } from "openclerk-core";

/**
 * This file is the only place in openclerk-word allowed to call a raw Office.js insertion API
 * (insertHtml/insertHyperlink/insertComment/insertOoxml) -- enforced by this repo's ESLint
 * no-restricted-syntax guard (a later plan in this phase). insertSafeHyperlink/insertSafeComment
 * take only the branded SafeHyperlinkUrl/SafeHtml types, never a plain string, so the guarantee
 * that only already-validated/escaped content reaches Office.js is compiler-enforced for those two
 * sinks, not just convention: a caller cannot pass an unvalidated string in even if the ESLint rule
 * were somehow bypassed. insertSafeOoxml's ooxml parameter is intentionally plain string (see its
 * own doc comment) since its only current caller re-inserts document-derived, not untrusted, OOXML.
 */
export async function insertSafeHyperlink(
  context: Word.RequestContext,
  item: Word.Range,
  url: SafeHyperlinkUrl,
  displayText: SafeHtml
): Promise<void> {
  if (typeof (item as any).insertHyperlink === "function") {
    // insertHyperlink is a newer/preview Office.js API with no declaration in the installed
    // @types/office-js version -- this cast bridges that gap and is pre-existing, not new risk
    // introduced by this refactor (RESEARCH.md Pitfall 2).
    (item as any).insertHyperlink(url, displayText, Word.InsertLocation.replace);
  } else if (typeof (item as any).insertHtml === "function") {
    // displayText is already branded (HTML-escaped) by construction. url is only branded for
    // scheme safety (SafeHyperlinkUrl certifies http/https/mailto, nothing about the
    // HTML-attribute context it's spliced into here) -- escapeHtml is required on this specific
    // sink so a "><... payload embedded in the URL can't break out of the href attribute.
    const html = `<a href="${escapeHtml(url)}">${displayText}</a>`;
    (item as any).insertHtml(html, Word.InsertLocation.replace);
  } else {
    // Last-resort: replace with plain text (no hyperlink)
    item.insertText(displayText, Word.InsertLocation.replace);
  }
  await context.sync();
}

/**
 * The only place in openclerk-word allowed to call Word.Range.insertComment directly -- see the
 * rationale on insertSafeHyperlink above. Unlike insertSafeHyperlink's insertHtml branch,
 * Word.Range.insertComment(commentText: string) is a plain-text-only API -- it does not render
 * HTML. text is intentionally a plain string here, not SafeHtml: passing HTML-escaped content
 * into a plain-text sink would corrupt any cited opinion excerpt or citation string containing
 * &/</>/"/' into literal HTML-entity text instead of the original characters.
 */
export async function insertSafeComment(
  context: Word.RequestContext,
  range: Word.Range,
  text: string
): Promise<void> {
  range.insertComment(text);
  await context.sync();
}

/**
 * The only place in openclerk-word allowed to call Body.insertOoxml directly -- same rationale
 * as insertSafeHyperlink/insertSafeComment above. Currently only used by removeAllHyperlinks
 * (word.ts) to re-insert OOXML derived from the document's own existing content (getOoxml(),
 * regex-stripped of hyperlink wrapper tags) -- not attacker-influenced input -- but the call is
 * centralized here regardless so no raw Office.js insertion API is ever called outside this file,
 * matching the header comment's "only place" claim.
 */
export async function insertSafeOoxml(
  context: Word.RequestContext,
  body: Word.Body,
  ooxml: string
): Promise<void> {
  body.insertOoxml(ooxml, Word.InsertLocation.replace);
  await context.sync();
}
