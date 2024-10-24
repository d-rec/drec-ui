export interface Devicelist {
  devices: Device[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export interface Device {
  id: number;
  externalId: string;
  developerExternalId?: string;
  //status: DeviceStatus;
  organizationId: number;
  projectName: string;
  address?: string;
  latitude: string;
  longitude: string;
  countryCode: string;
  fuelCode: string;
  deviceTypeCode: string;
  capacity: number;
  commissioningDate: string;
  gridInterconnection: boolean;
  offTaker: string;
  yieldValue: number;
  impactStory?: string;
  images?: string[];
  groupId?: number | null;
  deviceDescription?: string;
  energyStorage?: boolean;
  energyStorageCapacity?: number;
  SDGBenefits?: string[];
  qualityLabels?: string;
  meterReadtype?: string;
  createdAt?: Date;
  version?: string;
  timezone?: string;
}
