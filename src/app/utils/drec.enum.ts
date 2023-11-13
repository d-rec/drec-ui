export  const UserStatus = [
    'Pending',
    'Active',
   // 'Suspended',
     //'Deleted',
]
export  enum UserEnumStatus {
    Pending= 'Pending',
    Active= 'Active',
   // 'Suspended',
     //'Deleted',
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
    Education="Education",
    HealthFacility = 'Health Facility',
    Residential = 'Residential',
    Commercial = 'Commercial',
    Industrial = 'Industrial',
    PublicSector = 'Public Sector',
    Agriculture = 'Agriculture',
    Utility='Utility',
    OffGridCommunity='Off-Grid Community'
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
  