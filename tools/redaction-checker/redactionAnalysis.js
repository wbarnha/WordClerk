// Core "bad redaction" detector -- no DOM/browser dependency, so this file is unit-testable with
// plain synthetic operator lists/text content (see tests/redactionAnalysis.test.js) and reusable
// from redactionChecker.js (the page's UI wiring) without change.
//
// Modeled on Free Law Project's x-ray (https://github.com/freelawproject/x-ray), which flags a
// redaction as "bad" when a dark rectangle drawn over part of a page still has real, extractable
// text underneath it -- meaning the underlying content was never actually removed, just visually
// covered. x-ray does this with pdfplumber's `rects`/`chars`; this does the pdf.js equivalent by
// walking a page's operator list for filled paths and comparing their bounding boxes (in PDF user
// space, i.e. before any viewport/canvas scaling) against pdf.js's extracted text item positions.

// Below this luminance (0 = black, 1 = white), a fill color is treated as "dark enough to be a
// plausible redaction bar". Real redaction tools mostly use pure black, but near-black/dark navy
// bars exist too, so this is deliberately permissive rather than requiring exact black -- the
// same trade-off x-ray itself makes.
const DARK_LUMINANCE_THRESHOLD = 0.35;
// A filled rectangle narrower or shorter than this (in PDF points) is treated as a stray line/
// underline/table-border rule rather than a redaction bar.
const MIN_RECT_DIMENSION = 2;
// A text item counts as "under" a dark rectangle when at least this fraction of its bounding-box
// area is covered by that rectangle.
const MIN_OVERLAP_RATIO = 0.5;

function luminance([r, g, b]) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isDark(color) {
  return luminance(color) < DARK_LUMINANCE_THRESHOLD;
}

function multiplyMatrix(m1, m2) {
  // Applies m1 first, then m2 -- matches PDF content-stream matrix concatenation order.
  return [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
  ];
}

function applyMatrixToPoint(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function transformBBox(matrix, [minX, minY, maxX, maxY]) {
  const corners = [
    applyMatrixToPoint(matrix, minX, minY),
    applyMatrixToPoint(matrix, maxX, minY),
    applyMatrixToPoint(matrix, maxX, maxY),
    applyMatrixToPoint(matrix, minX, maxY),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function bboxArea([x0, y0, x1, y1]) {
  return Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
}

function bboxIntersectionArea(a, b) {
  const x0 = Math.max(a[0], b[0]);
  const y0 = Math.max(a[1], b[1]);
  const x1 = Math.min(a[2], b[2]);
  const y1 = Math.min(a[3], b[3]);
  return Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
}

/**
 * Walks a pdf.js page operator list (from `page.getOperatorList()`) and returns the page-space
 * bounding box of every filled path whose fill color was dark and whose dimensions are large
 * enough to plausibly be a redaction bar rather than a stray rule/underline.
 *
 * `ops` is pdf.js's `OPS` enum (imported by the caller, not this module, so this file has zero
 * dependency on pdf.js itself and can be tested with a hand-built fake enum).
 */
export function findDarkFillRects(operatorList, ops) {
  const { fnArray, argsArray } = operatorList;
  const rects = [];
  const ctmStack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  let fillColor = [0, 0, 0]; // PDF's default fill color is black.
  let pendingPathBBox = null;

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];

    if (fn === ops.save) {
      ctmStack.push(ctm);
    } else if (fn === ops.restore) {
      ctm = ctmStack.pop() || ctm;
    } else if (fn === ops.transform) {
      ctm = multiplyMatrix(args, ctm);
    } else if (fn === ops.setFillRGBColor) {
      fillColor = [args[0] / 255, args[1] / 255, args[2] / 255];
    } else if (fn === ops.setFillGray) {
      fillColor = [args[0], args[0], args[0]];
    } else if (fn === ops.setFillCMYKColor) {
      const [c, m, y, k] = args;
      fillColor = [1 - Math.min(1, c + k), 1 - Math.min(1, m + k), 1 - Math.min(1, y + k)];
    } else if (fn === ops.setFillColorN) {
      // Pattern/Separation colorspaces (e.g. a "registration black" spot color) -- assume the
      // worst case (dark) rather than silently skipping a redaction drawn this way.
      fillColor = [0, 0, 0];
    } else if (fn === ops.constructPath) {
      // pdf.js's normalized constructPath args are [subOps, coordArgs, minMax, transform].
      const minMax = args[2];
      if (minMax) {
        pendingPathBBox = minMax;
      }
    } else if (fn === ops.fill || fn === ops.eoFill || fn === ops.fillStroke || fn === ops.eoFillStroke) {
      if (pendingPathBBox && isDark(fillColor)) {
        const width = pendingPathBBox[2] - pendingPathBBox[0];
        const height = pendingPathBBox[3] - pendingPathBBox[1];
        if (width >= MIN_RECT_DIMENSION && height >= MIN_RECT_DIMENSION) {
          rects.push(transformBBox(ctm, pendingPathBBox));
        }
      }
    }
  }

  return rects;
}

/**
 * Converts pdf.js's raw text-content items into simple { str, bbox } records, where bbox is in
 * the same page-space coordinates findDarkFillRects's rectangles are in (pdf.js's TextItem
 * `transform` is already in that same "default user space", unscaled by any viewport/canvas
 * transform, so no extra conversion is needed here).
 */
export function textItemsToBBoxes(items) {
  return items
    .filter((item) => item.str && item.str.trim().length > 0)
    .map((item) => {
      const [, , , , x, y] = item.transform;
      const width = item.width || 0;
      const height = item.height || Math.abs(item.transform[3]) || 1;
      return { str: item.str, bbox: [x, y, x + width, y + height] };
    });
}

/**
 * Given a page's dark-fill rectangles and its text items (already converted via
 * textItemsToBBoxes), returns one entry per rectangle that covers real text -- a bad redaction.
 */
export function findBadRedactions(darkRects, textBBoxItems) {
  const findings = [];

  for (const rect of darkRects) {
    const coveredText = textBBoxItems.filter((item) => {
      const area = bboxArea(item.bbox);
      if (area <= 0) return false;
      return bboxIntersectionArea(item.bbox, rect) / area >= MIN_OVERLAP_RATIO;
    });

    if (coveredText.length > 0) {
      findings.push({
        rect,
        text: coveredText.map((item) => item.str).join(" "),
      });
    }
  }

  return findings;
}
