#!/usr/bin/env node
import * as fs from "fs";
import { extractPdfText, PageExtraction } from "./pdfText";
import {
  extractCitationTokens,
  clusterCitationTokens,
  findOrphanedCitations,
  checkCitationsForHallucinations,
  CourtListenerProvider,
} from "./citations";

interface CliOptions {
  pdfPath: string;
  ocr: boolean;
  ocrLanguage: string;
  json: boolean;
  outPath: string | null;
  citations: boolean;
  verify: boolean;
}

function printUsage(): void {
  process.stdout.write(
    [
      "Usage: openclerk-pdf-extract <file.pdf> [options]",
      "",
      "  --no-ocr           Skip OCR for pages with no embedded text layer (text-layer extraction only)",
      "  --lang <code>      tesseract.js language code(s) for OCR, e.g. eng or eng+fra (default: eng)",
      "  --citations        Also report case citations found in the extracted text (full/short-form/id./supra, clustered by case)",
      "  --verify           Check each citation against CourtListener and flag any that don't resolve as a possible hallucination.",
      "                     Requires a COURTLISTENER_API_TOKEN environment variable. Implies --citations.",
      "  --json             Output machine-readable JSON instead of plain text",
      "  --out <file>       Write output to a file instead of stdout",
      "",
    ].join("\n")
  );
}

function parseArgs(argv: string[]): CliOptions | null {
  const args = [...argv];
  const pdfPath = args.find((arg) => !arg.startsWith("--"));
  if (!pdfPath) {
    return null;
  }

  const langIndex = args.indexOf("--lang");
  const outIndex = args.indexOf("--out");

  return {
    pdfPath,
    ocr: !args.includes("--no-ocr"),
    ocrLanguage: langIndex >= 0 ? args[langIndex + 1] : "eng",
    json: args.includes("--json"),
    outPath: outIndex >= 0 ? args[outIndex + 1] : null,
    citations: args.includes("--citations") || args.includes("--verify"),
    verify: args.includes("--verify"),
  };
}

interface CitationReportEntry {
  leadCitation: string;
  caseName?: string;
  shortFormCount: number;
  verifiedVia?: string | null;
}

async function buildCitationReport(fullText: string, verify: boolean): Promise<CitationReportEntry[]> {
  const tokens = extractCitationTokens(fullText);
  const clusters = clusterCitationTokens(tokens);
  const orphaned = findOrphanedCitations(fullText);

  const report: CitationReportEntry[] = clusters.map((cluster) => ({
    leadCitation: cluster.leadCitation,
    caseName: cluster.caseName,
    shortFormCount: cluster.tokens.length - 1,
  }));

  if (verify) {
    const token = process.env.COURTLISTENER_API_TOKEN;
    if (!token) {
      throw new Error("--verify requires a COURTLISTENER_API_TOKEN environment variable (see README).");
    }
    const provider = new CourtListenerProvider();
    await provider.authenticate({ apiToken: token });

    const leadCitations = clusters.map((cluster) => cluster.leadCitation);
    const results = await checkCitationsForHallucinations(leadCitations, [provider]);
    results.forEach((result, index) => {
      report[index].verifiedVia = result.verifiedVia;
    });
  }

  if (orphaned.length > 0) {
    report.push(
      ...orphaned.map((token) => ({
        leadCitation: `[orphaned ${token.type}] ${token.raw}`,
        shortFormCount: 0,
      }))
    );
  }

  return report;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(options.pdfPath)) {
    process.stderr.write(`File not found: ${options.pdfPath}\n`);
    process.exitCode = 1;
    return;
  }

  const pages: PageExtraction[] = await extractPdfText(options.pdfPath, {
    ocr: options.ocr,
    ocrLanguage: options.ocrLanguage,
    onProgress: (message) => process.stderr.write(`${message}\n`),
  });

  const fullText = pages.map((page) => page.text).join("\n\n");
  const citations = options.citations ? await buildCitationReport(fullText, options.verify) : null;

  let output: string;
  if (options.json) {
    output = JSON.stringify({ pages, citations }, null, 2);
  } else {
    const parts = pages.map((page) => `--- Page ${page.pageNumber} (${page.source}) ---\n${page.text}`);
    if (citations) {
      parts.push(
        "--- Citations ---",
        ...citations.map((entry) => {
          const verified =
            entry.verifiedVia === undefined
              ? ""
              : entry.verifiedVia
                ? ` [verified via ${entry.verifiedVia}]`
                : " [!! not found by any checked provider -- possible hallucination]";
          const shortForms = entry.shortFormCount > 0 ? ` (+${entry.shortFormCount} short-form/id. reference(s))` : "";
          return `${entry.leadCitation}${shortForms}${verified}`;
        })
      );
    }
    output = parts.join("\n\n");
  }

  if (options.outPath) {
    fs.writeFileSync(options.outPath, output);
  } else {
    process.stdout.write(output + "\n");
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
