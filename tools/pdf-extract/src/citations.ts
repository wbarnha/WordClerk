// Re-exports OpenClerk's citation engine (full/short-form/id./supra extraction, clustering, and
// the hallucination-check logic shared with the Word add-in's "Find Hallucinations" tab) for use
// here. This tool is deliberately a separate standalone package (own package.json/tsconfig, no
// Office.js or browser dependency) rather than a copy of the parsing logic -- these files are
// plain, dependency-light TypeScript with no Office.js or DOM dependency, so importing them
// directly by relative path keeps the two tools sharing one implementation instead of drifting.
export {
  extractCaseCitations,
  parseCaseCitation,
  extractCitationTokens,
  clusterCitationTokens,
  findOrphanedCitations,
  CitationToken,
  CitationCluster,
} from "../../../src/taskpane/providers/citationParser";
export { checkCitationsForHallucinations, HallucinationCheckResult } from "../../../src/taskpane/providers/hallucinationCheck";
export { CourtListenerProvider } from "../../../src/taskpane/providers/courtListenerProvider";
export { CitationProvider } from "../../../src/taskpane/providers/types";
