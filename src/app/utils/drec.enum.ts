export const UserStatus = [
  'Pending',
  'Active',
  // 'Suspended',
  //'Deleted',
];
export enum UserEnumStatus {
  Pending = 'Pending',
  Active = 'Active',
  // 'Suspended',
  //'Deleted',
}

export enum OrganizationType {
  Buyer = 'Buyer',
  Developer = 'Developer',
  ApiUser = 'ApiUser',
  Admin = 'Admin',
}

export enum Role {
  User = 'User',
  DeviceOwner = 'DeviceOwner',
  OrganizationAdmin = 'OrganizationAdmin',
  Buyer = 'Buyer',
  Admin = 'Admin',
  Intermediary = 'Intermediary',
  Reviewer = 'Reviewer',
  SeniorReviewer = 'SeniorReviewer',
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
  SF_02C = 'SF_02C', //SF-02C Owner's Declaration or Proof of Ownership
  METERING_EVIDENCE = 'METERING_EVIDENCE', //Metering Evidence
  SINGLE_LINE_DIAGRAM = 'SINGLE_LINE_DIAGRAM', //Single Line Diagram
  PROJECT_PHOTOS = 'PROJECT_PHOTOS', //Project Photos
  SCREENSHOTS = 'SCREENSHOTS', //Screenshots
  COD_PROOF = 'COD_PROOF', //Certificate of Completion / COD Proof
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
