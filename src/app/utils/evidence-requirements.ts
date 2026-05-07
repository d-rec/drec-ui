import { OperatingConfiguration } from './drec.enum';

/**
 * Document requirement level per operating configuration.
 * Derived from the D-REC Methodology Overview for I-REC(E), Tables 1 and 5.
 */
export type RequirementLevel = 'required' | 'recommended' | 'optional';

export interface EvidenceRequirements {
  FORM_SF_02: RequirementLevel;
  SF_02C: RequirementLevel;
  PROOF_OF_OWNERSHIP: RequirementLevel;
  METERING_EVIDENCE: RequirementLevel;
  SINGLE_LINE_DIAGRAM: RequirementLevel;
  PROJECT_PHOTOS: RequirementLevel;
  COD_PROOF: RequirementLevel;
}

const DEFAULT_REQUIREMENTS: EvidenceRequirements = {
  FORM_SF_02: 'required',
  SF_02C: 'required',
  PROOF_OF_OWNERSHIP: 'required',
  METERING_EVIDENCE: 'required',
  SINGLE_LINE_DIAGRAM: 'required',
  PROJECT_PHOTOS: 'required',
  COD_PROOF: 'required',
};

/**
 * Per-configuration evidence requirements.
 *
 * Grid-connected, no export:
 *   SLD must show no-export config. Screenshots recommended (inverter/EMS
 *   zero-export settings).
 *
 * Grid-connected, permitted export:
 *   Screenshots recommended (inverter/EMS/RMS export data).
 *
 * Grid-connected, full export:
 *   Screenshots recommended (monitoring and commercial records).
 *
 * Off-grid / islanded:
 *   Metering evidence recommended (not always available).
 *   Screenshots recommended (operator/project records).
 *
 * Dual-mode / hybrid:
 *   All documents required — both grid and off-grid evidence needed.
 */
export const EVIDENCE_REQUIREMENTS: Record<string, EvidenceRequirements> = {
  [OperatingConfiguration.GridNoExport]: {
    FORM_SF_02: 'required',
    SF_02C: 'required',
    PROOF_OF_OWNERSHIP: 'required',
    METERING_EVIDENCE: 'required',
    SINGLE_LINE_DIAGRAM: 'required',
    PROJECT_PHOTOS: 'required',
    COD_PROOF: 'required',
  },
  [OperatingConfiguration.GridPermittedExport]: {
    FORM_SF_02: 'required',
    SF_02C: 'required',
    PROOF_OF_OWNERSHIP: 'required',
    METERING_EVIDENCE: 'required',
    SINGLE_LINE_DIAGRAM: 'required',
    PROJECT_PHOTOS: 'required',
    COD_PROOF: 'required',
  },
  [OperatingConfiguration.GridFullExport]: {
    FORM_SF_02: 'required',
    SF_02C: 'required',
    PROOF_OF_OWNERSHIP: 'required',
    METERING_EVIDENCE: 'required',
    SINGLE_LINE_DIAGRAM: 'required',
    PROJECT_PHOTOS: 'required',
    COD_PROOF: 'required',
  },
  [OperatingConfiguration.OffGrid]: {
    FORM_SF_02: 'required',
    SF_02C: 'required',
    PROOF_OF_OWNERSHIP: 'required',
    METERING_EVIDENCE: 'recommended',
    SINGLE_LINE_DIAGRAM: 'required',
    PROJECT_PHOTOS: 'required',
    COD_PROOF: 'required',
  },
  [OperatingConfiguration.DualModeHybrid]: {
    FORM_SF_02: 'required',
    SF_02C: 'required',
    PROOF_OF_OWNERSHIP: 'required',
    METERING_EVIDENCE: 'required',
    SINGLE_LINE_DIAGRAM: 'required',
    PROJECT_PHOTOS: 'required',
    COD_PROOF: 'required',
  },
};

export function getEvidenceRequirements(
  config?: string | null,
): EvidenceRequirements {
  if (!config) return DEFAULT_REQUIREMENTS;
  return EVIDENCE_REQUIREMENTS[config] ?? DEFAULT_REQUIREMENTS;
}

/** Human-readable hint per operating config + doc type. */
export const EVIDENCE_HINTS: Record<string, Record<string, string>> = {
  [OperatingConfiguration.GridNoExport]: {
    SINGLE_LINE_DIAGRAM: 'Must show no-export configuration',
    METERING_EVIDENCE: 'Must confirm no export channel exists',
  },
  [OperatingConfiguration.GridPermittedExport]: {
    METERING_EVIDENCE: 'Import/export meter channels required',
    SF_02C: 'Include contractual/regulatory records permitting export',
  },
  [OperatingConfiguration.GridFullExport]: {
    METERING_EVIDENCE: 'Export meter data required',
    SF_02C: 'Utility/offtaker records and open-access docs required',
  },
  [OperatingConfiguration.OffGrid]: {
    SINGLE_LINE_DIAGRAM: 'Must show standalone/islanded operation',
    METERING_EVIDENCE: 'Monitoring setup recommended if available',
  },
  [OperatingConfiguration.DualModeHybrid]: {
    METERING_EVIDENCE: 'Evidence for both operating modes required',
  },
};

export function getHint(
  config: string | null | undefined,
  docType: string,
): string | null {
  if (!config) return null;
  return EVIDENCE_HINTS[config]?.[docType] ?? null;
}
