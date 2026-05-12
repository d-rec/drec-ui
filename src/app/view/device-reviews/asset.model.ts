export type AssetStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'legacy';

export interface DocMeta {
  docId: number;
  reviewed: boolean;
  label?: string | null;
  originalFilename?: string | null;
}

export interface Asset {
  id: string;
  serial: string;
  sldUrl: string | null;
  codProofUrl: string | null;
  sf02Url: string | null;
  sf02cUrl: string | null;
  proofOfOwnershipUrl: string | null;
  meteringEvidenceUrls: string[];
  pictureUrls: string[];
  screenshotUrls: string[];
  otherDocumentUrls: string[];
  lat: number | null;
  long: number | null;
  siteName: string;
  capacity: number | null;
  countryCode: string;
  submitterEmail: string;
  submitterName: string;
  reviewer: string;
  dateAdded: Date | null;
  dateSubmitted: Date | null;
  modifiedDate: Date | null;
  status: AssetStatus;
  notes: string;
  operatingConfiguration: string | null;
  sourceAccessMode: string | null;
  evidencePathway: string | null;
  ownershipStatus: string | null;
  evidentDeviceId: string | null;
  evidentStatus: string | null;
  lastScreenStatus: string | null;
  lastScreenedAt: string | null;
  sf02Ready: boolean;
  docMeta: Record<string, DocMeta>;
  /** Per-field source/confidence/at map produced by the registrant's
   *  auto-fill pipeline. Drives OC# row tinting on the reviewer side
   *  (green = a platform source set it, grey = manually entered). */
  fieldProvenance: Record<
    string,
    { source: string; confidence: number; at: string }
  > | null;
}
