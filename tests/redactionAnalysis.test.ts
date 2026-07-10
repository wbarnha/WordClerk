// tools/redaction-checker/redactionAnalysis.js is a plain ES module with zero pdf.js/browser
// dependency of its own (it takes a pdf.js-shaped operator list and OPS enum as plain data), so
// it's exercised here with small hand-built fixtures rather than a real PDF -- the CLI's real-PDF
// coverage lives in tools/pdf-extract instead.
type RedactionAnalysisModule = typeof import("../tools/redaction-checker/redactionAnalysis.js");

let findDarkFillRects: RedactionAnalysisModule["findDarkFillRects"];
let textItemsToBBoxes: RedactionAnalysisModule["textItemsToBBoxes"];
let findBadRedactions: RedactionAnalysisModule["findBadRedactions"];

beforeAll(async () => {
  const mod = await import("../tools/redaction-checker/redactionAnalysis.js");
  ({ findDarkFillRects, textItemsToBBoxes, findBadRedactions } = mod);
});

// A minimal stand-in for pdf.js's OPS enum -- just needs distinct values for the ops
// findDarkFillRects actually switches on.
const OPS = {
  save: 1,
  restore: 2,
  transform: 3,
  setFillRGBColor: 4,
  setFillGray: 5,
  setFillCMYKColor: 6,
  setFillColorN: 7,
  constructPath: 8,
  fill: 9,
  eoFill: 10,
  fillStroke: 11,
  eoFillStroke: 12,
  // A handful of ops findDarkFillRects ignores, included to make sure they're safely skipped.
  beginText: 100,
  showText: 101,
};

function buildOperatorList(entries: Array<[number, unknown]>) {
  return {
    fnArray: entries.map(([fn]) => fn),
    argsArray: entries.map(([, args]) => args),
  };
}

describe("findDarkFillRects", () => {
  test("returns the bounding box of a black filled rectangle", () => {
    const opList = buildOperatorList([
      [OPS.setFillRGBColor, [0, 0, 0]],
      [OPS.constructPath, [null, null, [10, 20, 110, 40]]],
      [OPS.fill, []],
    ]);

    expect(findDarkFillRects(opList, OPS)).toEqual([[10, 20, 110, 40]]);
  });

  test("ignores a light-colored (non-redaction) filled rectangle", () => {
    const opList = buildOperatorList([
      [OPS.setFillRGBColor, [255, 255, 200]],
      [OPS.constructPath, [null, null, [10, 20, 110, 40]]],
      [OPS.fill, []],
    ]);

    expect(findDarkFillRects(opList, OPS)).toEqual([]);
  });

  test("ignores a thin dark rule/underline (too small to be a redaction bar)", () => {
    const opList = buildOperatorList([
      [OPS.setFillGray, [0]],
      [OPS.constructPath, [null, null, [10, 20, 110, 20.5]]],
      [OPS.fill, []],
    ]);

    expect(findDarkFillRects(opList, OPS)).toEqual([]);
  });

  test("applies an active transform to the path's bounding box", () => {
    const opList = buildOperatorList([
      [OPS.setFillGray, [0]],
      [OPS.save, null],
      [OPS.transform, [1, 0, 0, 1, 100, 200]], // translate by (100, 200)
      [OPS.constructPath, [null, null, [0, 0, 50, 10]]],
      [OPS.fill, []],
      [OPS.restore, null],
    ]);

    expect(findDarkFillRects(opList, OPS)).toEqual([[100, 200, 150, 210]]);
  });

  test("defaults to black (PDF's default fill color) when no color op was seen", () => {
    const opList = buildOperatorList([
      [OPS.constructPath, [null, null, [0, 0, 50, 10]]],
      [OPS.fill, []],
    ]);

    expect(findDarkFillRects(opList, OPS)).toEqual([[0, 0, 50, 10]]);
  });
});

describe("findBadRedactions", () => {
  test("flags a dark rectangle that covers real extractable text", () => {
    const darkRects = [[0, 0, 100, 20]];
    const textBBoxes = textItemsToBBoxes([
      { str: "SECRET", transform: [12, 0, 0, 12, 10, 5], width: 60, height: 12 },
    ]);

    const findings = findBadRedactions(darkRects, textBBoxes);
    expect(findings).toHaveLength(1);
    expect(findings[0].text).toBe("SECRET");
  });

  test("does not flag a dark rectangle with no text underneath it (a real redaction)", () => {
    const darkRects = [[0, 0, 100, 20]];
    const textBBoxes = textItemsToBBoxes([
      { str: "visible elsewhere", transform: [12, 0, 0, 12, 500, 500], width: 80, height: 12 },
    ]);

    expect(findBadRedactions(darkRects, textBBoxes)).toEqual([]);
  });

  test("does not flag a rectangle that only barely clips a neighboring word", () => {
    const darkRects = [[0, 0, 10, 20]]; // a narrow dark rect
    const textBBoxes = textItemsToBBoxes([
      // A wide text run that only slightly overlaps the rect on its left edge.
      { str: "mostly outside the box", transform: [12, 0, 0, 12, 5, 5], width: 200, height: 12 },
    ]);

    expect(findBadRedactions(darkRects, textBBoxes)).toEqual([]);
  });
});

describe("textItemsToBBoxes", () => {
  test("drops whitespace-only items", () => {
    const items = [
      { str: "  ", transform: [12, 0, 0, 12, 0, 0], width: 10, height: 12 },
      { str: "real text", transform: [12, 0, 0, 12, 0, 0], width: 40, height: 12 },
    ];
    expect(textItemsToBBoxes(items)).toHaveLength(1);
  });
});
