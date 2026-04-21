export const UserStatus = [
  'Pending',
  'Active',
  'Suspended',
];
export enum UserEnumStatus {
  Pending = 'Pending',
  Active = 'Active',
  // 'Suspended',
  //'Deleted',
}

export enum OrganizationType {
  Buyer = 'Buyer',
  Registrant = 'Registrant',
  Admin = 'Admin',
  SiteOperator = 'SiteOperator',
}

export enum Role {
  User = 'User',
  Registrant = 'Registrant',
  Buyer = 'Buyer',
  Admin = 'Admin',
  Intermediary = 'Intermediary',
  Reviewer = 'Reviewer',
  SeniorReviewer = 'SeniorReviewer',
  SiteOperator = 'SiteOperator',
}
export enum OffTaker {
  School = 'School',
  Education = 'Education',
  HealthFacility = 'Health Facility',
  Residential = 'Residential',
  Commercial = 'Commercial',
  Industrial = 'Industrial',
  PublicSector = 'Public Sector',
  Agriculture = 'Agriculture',
  Utility = 'Utility',
  OffGridCommunity = 'Off-Grid Community',
}
export enum OperatingConfiguration {
  GridNoExport = 'Grid-connected, behind-the-meter, no export',
  GridPermittedExport = 'Grid-connected, behind-the-meter, with permitted export',
  GridFullExport = 'Grid-connected, full export / open access',
  OffGrid = 'Off-grid / islanded',
  DualModeHybrid = 'Dual-mode / hybrid',
}

export enum SourceAccessMode {
  Mode1_DirectAPI = 'Mode 1 — Direct API-based source access',
  Mode2_PortalAccess = 'Mode 2 — Direct portal access',
  Mode3_FileSubmission = 'Mode 3 — Source-linked file submission',
  Mode4_CompensatingControls = 'Mode 4 — Submitted data with compensating controls',
}

export enum EvidencePathway {
  DirectGrid = 'Direct Grid-Connected',
  FileBasedGrid = 'File-Based Grid-Connected',
  CompensatingGrid = 'Compensating Grid-Connected',
  DirectOffGrid = 'Direct Off-Grid',
  CompensatingOffGrid = 'Compensating Off-Grid',
}

export enum OwnershipStatus {
  Unverified = 'unverified',
  Verified = 'verified',
  Flagged = 'flagged',
}

export enum RegistrationType {
  New = 'New',
  ChangeOfDetails = 'Change of details',
  Renewal = 'Renewal',
  Transfer = 'Transfer',
}

export enum VolumeEvidenceType {
  MeteringData = 'Metering data',
  ContractSalesInvoice = 'Contract sales invoice',
  Other = 'Other',
}

export enum PublicFundingType {
  No = 'No',
  Investment = 'Investment',
  Production = 'Production',
}

export enum GroupReviewStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum ReadType {
  History = 'History',
  Delta = 'Delta',
  ReadMeter = 'Aggregate',
}
export enum OrganizationStatus {
  Submitted = 'Submitted',
  Denied = 'Denied',
  Active = 'Active',
}

export enum DocumentType {
  INCORPORATION_CERTIFICATE = 'INCORPORATION_CERTIFICATE',
  LEGAL_REPRESENTATIVE_PASSPORT = 'LEGAL_REPRESENTATIVE_PASSPORT',
  ADDRESS_PROOF = 'ADDRESS_PROOF',
  OWNERS_DECLARATION = 'OWNERS_DECLARATION ',
  FORM_SF_02 = 'FORM_SF_02', //Form SF-02 - Production Facility Registration
  SF_02C = 'SF_02C', //SF-02C form itself (I-REC declaration)
  SF_02C_OWNERS_DECLARATION = 'SF_02C_OWNERS_DECLARATION', //Owner's Declaration / Proof of Ownership (distinct from the SF-02C form)
  METERING_EVIDENCE = 'METERING_EVIDENCE', //Metering Evidence
  SINGLE_LINE_DIAGRAM = 'SINGLE_LINE_DIAGRAM', //Single Line Diagram
  PROJECT_PHOTOS = 'PROJECT_PHOTOS', //Project Photos
  SCREENSHOTS = 'SCREENSHOTS', //Screenshots (legacy; merged into METERING_EVIDENCE in Phase 1c)
  COD_PROOF = 'COD_PROOF', // Commercial Operation Date Proof
  FACILITY_BOUNDARY = 'FACILITY_BOUNDARY', // OC#44 satellite image with panel outline
  OTHER_DOCUMENTS = 'OTHER_DOCUMENTS', // Other supporting documents
}

export enum DataSourceTypes {
  Inverter = 'Inverter',
  DataLogger = 'DataLogger',
  Other = 'Other',
}

export enum GroupType {
  Single = 'single',
  Multiple = 'multiple',
}

export enum SelectionType {
  Checkbox = 'checkbox',
  Radio = 'radio',
}

// OC#37 — Other Labelling Scheme (RR Checklist col J enum)
export const LABELLING_SCHEMES: string[] = [
  'The D-REC Label',
  'C:Pesa Verification Label',
  'EO100tm Responsible Energy Standard',
  'European Guarantee of Origin',
  'Hydropower Sustainability Standard',
  'Use with matched attributes for electricity',
  'Use with matched attributes for NFC and electricity',
  'Use with matched attributes for NFC',
  'Low-Carbon Hydro',
  'New Zealand New Generation',
  'New Zealand New Generation - Contract Backed',
  'Peace REC',
  'REC Brazil',
  'T-RECs Verification Solar Rooftop Scheme',
  'T-RECs C&I Verification Service',
  'T-RECs Resi Verification Service',
  'South African REC',
];
