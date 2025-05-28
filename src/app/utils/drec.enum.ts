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
  PRODUCTION_FACILITY_REGISTRATION = 'productionFacilityRegistration',
  OWNERSHIP_PROOF = 'ownershipProof',
  METERING_EVIDENCE = 'meteringEvidence',
  SINGLE_LINE_DIAGRAM = 'singleLineDiagram',
  PROJECT_PHOTOS = 'projectPhotos',
  INCORPORATION_CERTIFICATE = 'incorporationCertificate',
  LEGAL_REPRESENTATIVE_PASSPORT = 'legalRepresentativePassport',
  ADDRESS_PROOF = 'addressProof',
  OWNERS_DECLARATION = 'ownersDeclaration',
}
