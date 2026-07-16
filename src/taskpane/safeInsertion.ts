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
 * (insertHtml/insertHyperlink/insertComment) -- enforced by this repo's ESLint no-restricted-syntax
 * guard (a later plan in this phase). Every exported function below takes only the branded
 * SafeHyperlinkUrl/SafeHtml types, never a plain string, so the guarantee that only already-
 * validated/escaped content reaches Office.js is compiler-enforced here, not just convention: a
 * caller cannot pass an unvalidated string in even if the ESLint rule were somehow bypassed.
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
