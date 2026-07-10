import * as pdfjsLib from "./vendor/pdf.min.mjs";
import { findDarkFillRects, textItemsToBBoxes, findBadRedactions } from "./redactionAnalysis.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";

const fileInput = document.getElementById("file-input");
const dropZone = document.getElementById("drop-zone");
const dropZoneLabel = document.getElementById("drop-zone-label");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragover");
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) analyzeFile(file);
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) analyzeFile(file);
});

function setStatus(message) {
  statusEl.textContent = message;
}

async function analyzeFile(file) {
  dropZoneLabel.textContent = file.name;
  resultsEl.innerHTML = "";
  setStatus("Loading PDF...");

  let pdf;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    pdf = await pdfjsLib.getDocument({ data }).promise;
  } catch (error) {
    setStatus(`Could not open this file as a PDF. ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const pageResults = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    setStatus(`Scanning page ${pageNumber} of ${pdf.numPages}...`);
    const page = await pdf.getPage(pageNumber);

    const [textContent, operatorList] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
    const darkRects = findDarkFillRects(operatorList, pdfjsLib.OPS);
    const textBBoxes = textItemsToBBoxes(textContent.items);
    const findings = findBadRedactions(darkRects, textBBoxes);

    if (findings.length > 0) {
      pageResults.push({ pageNumber, page, findings });
    }
  }

  setStatus(
    pageResults.length === 0
      ? `Scanned ${pdf.numPages} page(s). No bad redactions found -- every dark redaction-shaped box checked had no extractable text underneath it.`
      : `Scanned ${pdf.numPages} page(s). Found possible bad redactions on ${pageResults.length} page(s) -- see below.`
  );

  if (pageResults.length === 0) {
    const allClear = document.createElement("div");
    allClear.className = "all-clear";
    allClear.textContent =
      "No bad redactions detected. This checks for text still present underneath a drawn black box -- it can't detect a redaction that removed the underlying text correctly, and it isn't a substitute for careful manual review before filing or producing a document.";
    resultsEl.appendChild(allClear);
    return;
  }

  for (const result of pageResults) {
    resultsEl.appendChild(await renderPageResult(result));
  }
}

async function renderPageResult({ pageNumber, page, findings }) {
  const container = document.createElement("div");
  container.className = "page-result";

  const heading = document.createElement("h2");
  heading.textContent = `Page ${pageNumber}: ${findings.length} possible bad redaction(s)`;
  container.appendChild(heading);

  const scale = 1.5;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;

  // Outline each flagged rectangle directly on the rendered page so it's obvious which box is
  // being called out, converting from PDF user space to canvas pixels via the same viewport.
  context.strokeStyle = "#ff3b3b";
  context.lineWidth = 2;
  findings.forEach(({ rect }) => {
    const [x0, y0] = viewport.convertToViewportPoint(rect[0], rect[1]);
    const [x1, y1] = viewport.convertToViewportPoint(rect[2], rect[3]);
    const left = Math.min(x0, x1);
    const top = Math.min(y0, y1);
    context.strokeRect(left, top, Math.abs(x1 - x0), Math.abs(y1 - y0));
  });

  container.appendChild(canvas);

  findings.forEach((finding, index) => {
    const findingEl = document.createElement("div");
    findingEl.className = "finding";
    findingEl.innerHTML = `<strong>Redaction ${index + 1}:</strong> text still present underneath -- "${escapeHtml(
      finding.text
    )}"`;
    container.appendChild(findingEl);
  });

  return container;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
