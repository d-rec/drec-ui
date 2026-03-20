export type AssetStatus = 'pending' | 'approved' | 'rejected';

export interface Asset {
  id: string;
  serial: string;
  sldUrl: string | null;
  codProofUrl: string | null;
  sf02Url: string | null;
  sf02cUrl: string | null;
  meteringEvidenceUrl: string | null;
  pictureUrls: string[];
  lat: number | null;
  long: number | null;
  projectName: string;
  capacity: number | null;
  acCapacity: number | null;
  countryCode: string;
  submitterEmail: string;
  reviewer: string;
  dateAdded: Date | null;
  dateSubmitted: Date | null;
  modifiedDate: Date | null;
  status: AssetStatus;
  notes: string;
}
