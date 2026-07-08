import { ParsedCitation } from "../providers/types";
import { BluebookIssue } from "./types";
import { REPORTER_ABBREVIATIONS } from "./generated/reporterAbbreviations.generated";

type ReporterLookup = {
  validForms: Record<string, string>;
  corrections: Record<string, { correctForm: string; name: string }>;
};

const { validForms, corrections } = REPORTER_ABBREVIATIONS as ReporterLookup;

/**
 * Checks a citation's reporter abbreviation against Free Law Project's reporters-db (Table T1
 * data, see generated/reporterAbbreviations.generated.ts) -- vendored at dev time from
 * https://github.com/freelawproject/reporters-db, not fetched at runtime.
 *
 * Edition-independent: reporter abbreviations themselves don't change between Bluebook
 * editions the way case-name/statutory abbreviations do, so this applies to every edition.
 */
export function checkReporterAbbreviation(citation: ParsedCitation): BluebookIssue[] {
  const reporter = citation.reporter;
  if (!reporter) {
    return [];
  }

  if (reporter in validForms) {
    return [];
  }

  // reporters-db's "variations" only lists the specific malformed forms someone bothered to
  // record (it's built from real-world parsing hits, not an exhaustive enumeration), so it only
  // catches the ordinal typo ("2nd" instead of "2d") for a handful of reporters. Normalize and
  // re-check generically so this common mistake is caught for every reporter, not just those.
  const ordinalNormalized = reporter.replace(/\b(\d)(?:nd|rd)\b/g, "$1d");
  if (ordinalNormalized !== reporter && ordinalNormalized in validForms) {
    return [
      {
        ruleId: "reporter-ordinal",
        message: `Reporter series should use "${ordinalNormalized}" (ordinal abbreviations like "2nd"/"3rd" should be "2d"/"3d") -- found "${reporter}".`,
        severity: "error",
      },
    ];
  }

  const correction = corrections[reporter];
  if (correction) {
    return [
      {
        ruleId: "reporter-nonstandard-form",
        message: `"${reporter}" is a known non-standard form of "${correction.correctForm}" (${correction.name}); use "${correction.correctForm}" (Table T1).`,
        severity: "error",
      },
    ];
  }

  return [
    {
      ruleId: "reporter-unrecognized",
      message: `"${reporter}" was not found in the Table T1 reporter database -- verify this reporter abbreviation manually.`,
      severity: "warning",
    },
  ];
}
