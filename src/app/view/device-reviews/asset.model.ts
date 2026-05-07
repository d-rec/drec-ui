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
  sf02cOwnersDeclarationUrl: string | null;
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
  // Set when the registrant ran panel detection at these coords and the
  // model found ≥1 panels; auto-screen's ≥6-decimal precision check
  // passes when this exists and matches the device's current lat/lng.
  coordsConfirmedAt: string | null;
  coordsConfirmedLat: number | null;
  coordsConfirmedLng: number | null;
  coordsConfirmedPanelCount: number | null;
}
