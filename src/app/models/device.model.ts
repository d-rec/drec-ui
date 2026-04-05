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
  siteName: string;
  address?: string;
  latitude: string;
  longitude: string;
  countryCode: string;
  fuelCode: string;
  deviceTypeCode: string;
  capacity: number;
  commissioningDate: string;
  gridInterconnection: boolean;
  operatingConfiguration?: string;
  sourceAccessMode?: string;
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
  serialNumber: string;
  // Ownership & off-taker (Evident checklist rows 76, 77, 81)
  pvSystemOwner?: string;
  offTakerName?: string;
  offTakerSameCompanyAsOwner?: 'Yes' | 'No';
  // Subsidies & incentives (rows 78, 79, 80)
  hasSubsidy?: 'Yes' | 'No';
  subsidyTypes?: string[];
  subsidyOtherDetails?: string;
  subsidyClaimsEacs?: 'Yes' | 'No';
  // Public funding (rows 50, 51)
  hasPublicFunding?: 'Yes' | 'No';
  publicFundingEndDate?: string;
}
