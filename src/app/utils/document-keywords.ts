import { DocumentType } from './drec.enum';

/**
 * Weighted keyword dictionaries for zero-shot document classification.
 * Keywords are matched case-insensitively against OCR text.
 * Weight 3 = strong indicator, 2 = moderate, 1 = weak.
 */

interface KeywordEntry {
  pattern: string;
  weight: number;
}

export const DOCUMENT_KEYWORDS: Partial<
  Record<DocumentType, KeywordEntry[]>
> = {
  [DocumentType.FORM_SF_02]: [
    { pattern: 'sf-02', weight: 3 },
    { pattern: 'sf02', weight: 3 },
    { pattern: 'production facility registration', weight: 3 },
    { pattern: 'registration form', weight: 2 },
    { pattern: 'facility name', weight: 1 },
    { pattern: 'installed capacity', weight: 1 },
    { pattern: 'commissioning date', weight: 1 },
  ],
  // SF_02C is the I-REC Owner's Declaration letter — the formal
  // attribute-rights declaration on the owner's letterhead. The
  // "Proof of Ownership" artifact (deed / lease / PPA) lives in
  // PROOF_OF_OWNERSHIP, below.
  [DocumentType.SF_02C]: [
    { pattern: 'sf-02c', weight: 3 },
    { pattern: 'sf02c', weight: 3 },
    { pattern: "owner's declaration", weight: 3 },
    { pattern: 'owners declaration', weight: 3 },
    { pattern: 'declaration of attribute', weight: 3 },
    { pattern: 'declaration of ownership', weight: 3 },
    { pattern: 'attribute generation', weight: 2 },
    { pattern: 'hereby declare', weight: 2 },
    { pattern: 'i-rec', weight: 2 },
    { pattern: 'irec', weight: 2 },
    { pattern: 'irec declaration', weight: 3 },
    { pattern: 'environmental attribute', weight: 2 },
    { pattern: 'legal right', weight: 2 },
    { pattern: 'ownership', weight: 1 },
    { pattern: 'letterhead', weight: 1 },
    { pattern: 'signatory', weight: 1 },
    { pattern: 'participant', weight: 1 },
    { pattern: 'declaration', weight: 1 },
  ],
  [DocumentType.PROOF_OF_OWNERSHIP]: [
    { pattern: 'proof of ownership', weight: 3 },
    { pattern: 'title deed', weight: 3 },
    { pattern: 'lease agreement', weight: 3 },
    { pattern: 'purchase agreement', weight: 3 },
    { pattern: 'sale agreement', weight: 3 },
    { pattern: 'bill of sale', weight: 3 },
    { pattern: 'land registry', weight: 3 },
    { pattern: 'power purchase agreement', weight: 3 },
    { pattern: ' ppa ', weight: 2 },
    { pattern: 'ground lease', weight: 3 },
    { pattern: 'rooftop lease', weight: 3 },
    { pattern: 'lessee', weight: 2 },
    { pattern: 'lessor', weight: 2 },
    { pattern: 'grantor', weight: 1 },
    { pattern: 'grantee', weight: 1 },
    { pattern: 'tenant', weight: 1 },
    { pattern: 'leasehold', weight: 2 },
  ],
  [DocumentType.METERING_EVIDENCE]: [
    { pattern: 'kwh', weight: 3 },
    { pattern: 'mwh', weight: 3 },
    { pattern: 'meter reading', weight: 3 },
    { pattern: 'energy production', weight: 2 },
    { pattern: 'generation data', weight: 2 },
    { pattern: 'total generation', weight: 2 },
    { pattern: 'pv generation', weight: 3 },
    { pattern: 'monthly report', weight: 2 },
    { pattern: 'generation & income', weight: 3 },
    { pattern: 'energy statistics', weight: 2 },
    { pattern: 'capacity(kw', weight: 2 },
    { pattern: 'pv(kwh', weight: 3 },
    { pattern: 'meter', weight: 1 },
    { pattern: 'reading', weight: 1 },
    { pattern: 'energy yield', weight: 2 },
    { pattern: 'cumulative', weight: 1 },
    { pattern: 'generation', weight: 1 },
    { pattern: 'goodwe', weight: 1 },
    { pattern: 'semsportal', weight: 2 },
    { pattern: 'sems', weight: 1 },
  ],
  [DocumentType.SINGLE_LINE_DIAGRAM]: [
    { pattern: 'single line diagram', weight: 3 },
    { pattern: 'single-line diagram', weight: 3 },
    { pattern: 'sld', weight: 2 },
    { pattern: 'one-line diagram', weight: 3 },
    { pattern: 'transformer', weight: 1 },
    { pattern: 'inverter', weight: 1 },
    { pattern: 'circuit breaker', weight: 1 },
    { pattern: 'ac disconnect', weight: 1 },
    { pattern: 'dc disconnect', weight: 1 },
    // Electrical schematic terms found on real SLDs (often in foreign languages)
    { pattern: 'busbar', weight: 2 },
    { pattern: 'mccb', weight: 2 },
    { pattern: 'mcb', weight: 1 },
    { pattern: 'ac cable', weight: 2 },
    { pattern: 'earthing', weight: 1 },
    { pattern: 'zero export', weight: 2 },
    { pattern: 'epc contractor', weight: 1 },
    { pattern: 'msb', weight: 1 },
    { pattern: 'mdb', weight: 1 },
    { pattern: 'vac', weight: 1 },
    { pattern: 'load', weight: 1 },
    { pattern: 'grid', weight: 1 },
  ],
  [DocumentType.COD_PROOF]: [
    { pattern: 'certificate of completion', weight: 3 },
    { pattern: 'commercial operation date', weight: 3 },
    { pattern: 'commercial operation', weight: 2 },
    { pattern: 'commissioning certificate', weight: 3 },
    { pattern: 'commissioning', weight: 1 },
    { pattern: 'completion date', weight: 2 },
    { pattern: 'energized', weight: 1 },
    { pattern: 'cod', weight: 1 },
  ],
  [DocumentType.FACILITY_BOUNDARY]: [
    { pattern: 'boundary', weight: 2 },
    { pattern: 'satellite', weight: 2 },
    { pattern: 'aerial', weight: 2 },
    { pattern: 'perimeter', weight: 1 },
    { pattern: 'outline', weight: 1 },
  ],
  [DocumentType.PROJECT_PHOTOS]: [
    // Photos rarely have extractable text — relies on CLIP (Tier 2)
    { pattern: 'photo', weight: 1 },
    { pattern: 'site', weight: 1 },
  ],
};

/** Document types eligible for classification (device-level only). */
export const CLASSIFIABLE_TYPES: DocumentType[] = [
  DocumentType.FORM_SF_02,
  DocumentType.SF_02C,
  DocumentType.PROOF_OF_OWNERSHIP,
  DocumentType.METERING_EVIDENCE,
  DocumentType.SINGLE_LINE_DIAGRAM,
  DocumentType.PROJECT_PHOTOS,
  DocumentType.COD_PROOF,
  DocumentType.FACILITY_BOUNDARY,
  DocumentType.OTHER_DOCUMENTS,
];

/** Human-readable labels for suggestion display. */
export const DOCUMENT_TYPE_LABELS: Partial<Record<DocumentType, string>> = {
  [DocumentType.FORM_SF_02]: 'SF-02 Registration Form',
  [DocumentType.SF_02C]: 'SF-02C Declaration',
  [DocumentType.PROOF_OF_OWNERSHIP]: 'Proof of Ownership',
  [DocumentType.METERING_EVIDENCE]: 'Metering Evidence',
  [DocumentType.SINGLE_LINE_DIAGRAM]: 'Single Line Diagram',
  [DocumentType.PROJECT_PHOTOS]: 'Site Photos',
  [DocumentType.COD_PROOF]: 'COD Proof',
  [DocumentType.FACILITY_BOUNDARY]: 'Facility Boundary',
  [DocumentType.OTHER_DOCUMENTS]: 'Other Document',
};

export interface ClassificationResult {
  suggestedType: DocumentType;
  confidence: number;
  method: 'keywords' | 'clip' | 'none';
  alternatives: Array<{ type: DocumentType; confidence: number }>;
}

/**
 * Score OCR text against all keyword dictionaries.
 * Returns sorted scores per document type.
 */
export function scoreByKeywords(
  text: string,
): Array<{ type: DocumentType; score: number }> {
  const lowerText = text.toLowerCase();
  const results: Array<{ type: DocumentType; score: number }> = [];

  for (const [docType, keywords] of Object.entries(DOCUMENT_KEYWORDS)) {
    if (!keywords) continue;
    let score = 0;
    for (const kw of keywords) {
      if (lowerText.includes(kw.pattern.toLowerCase())) {
        score += kw.weight;
      }
    }
    if (score > 0) {
      results.push({ type: docType as DocumentType, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Classify text using keyword scoring.
 * Returns a result if the top score is confident enough, otherwise null.
 */
export function classifyByKeywords(
  text: string,
): ClassificationResult | null {
  const scores = scoreByKeywords(text);

  // No keyword matches at all — OCR succeeded but nothing matched.
  // Suggest OTHER_DOCUMENTS as a low-confidence fallback.
  if (scores.length === 0) {
    return {
      suggestedType: DocumentType.OTHER_DOCUMENTS,
      confidence: 0.25,
      method: 'keywords',
      alternatives: [],
    };
  }

  const topScore = scores[0].score;
  const secondScore = scores.length > 1 ? scores[1].score : 0;

  // Confidence based on absolute score thresholds and separation from runner-up.
  // A score of 4+ from keyword hits is a reasonable match; 8+ is strong.
  const absConfidence = Math.min(topScore / 8, 1);
  const separation = secondScore > 0 ? topScore / secondScore : 3;
  const confidence = Math.min(absConfidence * Math.min(separation, 2), 1);

  if (confidence < 0.25) return null;

  return {
    suggestedType: scores[0].type,
    confidence: Math.round(confidence * 100) / 100,
    method: 'keywords',
    alternatives: scores.slice(1, 4).map((s) => ({
      type: s.type,
      confidence:
        Math.round(Math.min(s.score / 8, 1) * 100) / 100,
    })),
  };
}
