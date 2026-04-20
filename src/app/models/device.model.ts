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
  SDGBenefits?: string[];
  meterReadtype?: string;
  createdAt?: Date;
  version?: string;
  timezone?: string;
  serialNumber: string;
  // General (rows 2, 8)
  defaultAccountCode?: string;
  requestedEffectiveRegDate?: string;
  // Signature & evidence pathway (rows 55-56, 58-59, 61-62)
  signatoryName?: string;
  gridExportType?: string;
  hasNetworkMeter?: 'Yes' | 'No';
  meterReadsShareable?: 'Yes' | 'No';
  // Business details (Evident checklist rows 43, 45-48, 54)
  hasCaptiveConsumer?: 'Yes' | 'No';
  hasAuxiliaryEnergySources?: 'Yes' | 'No';
  auxiliaryEnergySourceDetails?: string;
  nonMeterImportDetails?: string;
  otherEacSchemeRegistration?: string;
  additionalInfo?: string;
  // Facility technical (Evident checklist rows 32, 33, 35, 36)
  generatingUnitCount?: number;
  networkOwner?: string;
  interconnectionVoltage?: string;
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
  // SF-02 gaps
  registrationType?: string;
  volumeEvidenceType?: string;
  publicFundingType?: string;
  labellingSchemeAccreditation?: string;
  verificationAgentName?: string;
  offGridCircumstances?: string;
}
