export type ReadReviewStatus = 'pending' | 'approved' | 'flagged' | 'rejected';

export interface MeterReadEntry {
  id: number;
  value: number;
  unit: string;
  type: string;
  startDate: string;
  endDate: string;
  certified: boolean;
}

export interface MeterReadReviewDevice {
  deviceId: number;
  externalId: string;
  projectName: string;
  serialNumber: string;
  capacity: number | null;
  countryCode: string;
  submitterEmail: string;
  reviewStatus: ReadReviewStatus;
  reviewer: string | null;
  notes: string | null;
  readCount: number;
  latestReadDate: string | null;
  earliestReadDate: string | null;
  totalKwh: number;
  reads: MeterReadEntry[];
}
