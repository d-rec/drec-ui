import { OrganizationStatus } from '../utils/drec.enum';
export interface OrganizationInformation {
  id: number;
  name: string;
  secretKey: string;
  address: string;
  zipCode: string;
  city: string;
  country: string;
  organizationType: string;
  status: string;
  documentIds: string[];
  signatoryDocumentIds: string[];
  blockchainAccountAddress: string;
  blockchainAccountSignedMessage: string;
}
export class IPublicOrganization {
  id: number;
  name: string;
  address: string;
  zipCode: string;
  city: string;
  country: string;
  organizationType: string;

  status: OrganizationStatus;

  blockchainAccountAddress?: string;
  blockchainAccountSignedMessage?: string;
}

export interface IFullOrganization extends IPublicOrganization {
  signatoryDocumentIds?: string[];
  documentIds?: string[];
}
