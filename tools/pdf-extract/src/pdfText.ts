import * as fs from "fs";

// pdfjs-dist 4.x's Node ("legacy") build ships ESM only. Node 22.12+ can `require()` a
// synchronous ESM module directly (no top-level await), so this stays a plain CommonJS `require`
// rather than a dynamic `import()` -- see the tool's README for the resulting Node version floor.
// Typed by hand below rather than via pdfjs-dist's own .d.mts, since pulling those in here would
// require switching this whole package to ESM/NodeNext module resolution just for one import.
interface PdfjsTextItem {
  str: string;
}

interface PdfjsTextContent {
  items: PdfjsTextItem[];
}

interface PdfjsViewport {
  width: number;
  height: number;
}

export interface PdfjsCanvasLike {
  getContext(type: "2d"): unknown;
}

interface PdfjsPageProxy {
  getTextContent(): Promise<PdfjsTextContent>;
  getViewport(params: { scale: number }): PdfjsViewport;
  render(params: { canvasContext: unknown; viewport: PdfjsViewport }): { promise: Promise<void> };
}

interface PdfjsDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfjsPageProxy>;
}

interface PdfjsLib {
  getDocument(params: { data: Uint8Array; useSystemFonts?: boolean }): { promise: Promise<PdfjsDocumentProxy> };
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.mjs") as PdfjsLib;

export type PageTextSource = "embedded" | "ocr" | "empty";

export interface PageExtraction {
  pageNumber: number;
  text: string;
  source: PageTextSource;
}

export interface ExtractPdfTextOptions {
  /** Run OCR on pages with no usable embedded text layer. Defaults to true. */
  ocr?: boolean;
  /** tesseract.js language code(s), e.g. "eng" or "eng+fra". Defaults to "eng". */
  ocrLanguage?: string;
  onProgress?: (message: string) => void;
}

// Below this many non-whitespace characters, a page's embedded text layer is treated as absent
// (rather than as a real but short page of text) and, if OCR is enabled, rasterized and OCR'd
// instead. This has to be well above "a few stray characters" -- e-filed documents commonly have
// a CM/ECF header stamp (e.g. "Case 1:22-cv-01461-PKC  Document 21  Filed 03/01/23  Page 1 of 10")
// burned in as real embedded text on every page even when the scanned page body underneath it has
// none, so a low threshold would misread a scanned page as already having usable text.
const MIN_EMBEDDED_TEXT_LENGTH = 200;

function normalizeExtractedText(text: string): string {
  return text.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

async function ocrPage(page: PdfjsPageProxy, language: string): Promise<string> {
  // Imported lazily so a run with --no-ocr never pays for loading @napi-rs/canvas or
  // tesseract.js at all.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createCanvas } = require("@napi-rs/canvas");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createWorker } = require("tesseract.js");

  // Scale 2x for a sharper OCR source image than the PDF's native (72dpi-equivalent) point size.
  const viewport = page.getViewport({ scale: 2 });
  const canvas: PdfjsCanvasLike = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;
  const pngBuffer: Buffer = (canvas as unknown as { toBuffer(format: string): Buffer }).toBuffer("image/png");

  const worker = await createWorker(language);
  try {
    const {
      data: { text },
    } = await worker.recognize(pngBuffer);
    return text as string;
  } finally {
    await worker.terminate();
  }
}

/**
 * Extracts text from every page of a PDF: first via pdf.js's embedded text layer (fast, exact --
 * works for virtually any e-filed document, since those are generated from a text source rather
 * than scanned), falling back to tesseract.js OCR for any page whose text layer is empty or
 * near-empty (a scanned/image-only page).
 */
export async function extractPdfText(filePath: string, options: ExtractPdfTextOptions = {}): Promise<PageExtraction[]> {
  const ocrEnabled = options.ocr !== false;
  const ocrLanguage = options.ocrLanguage ?? "eng";

  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise;
  const pages: PageExtraction[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const embeddedText = normalizeExtractedText(content.items.map((item) => item.str).join(" "));

    if (embeddedText.replace(/\s/g, "").length >= MIN_EMBEDDED_TEXT_LENGTH) {
      pages.push({ pageNumber, text: embeddedText, source: "embedded" });
      continue;
    }

    if (!ocrEnabled) {
      pages.push({ pageNumber, text: embeddedText, source: embeddedText ? "embedded" : "empty" });
      continue;
    }

    options.onProgress?.(`page ${pageNumber}: no embedded text layer, running OCR...`);
    const ocrText = normalizeExtractedText(await ocrPage(page, ocrLanguage));
    pages.push({ pageNumber, text: ocrText, source: "ocr" });
  }

  return pages;
}
