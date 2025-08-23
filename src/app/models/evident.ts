export interface EvidentIssuerResponse {
  id: string;
  issuerId: string;
  name: string;
  email: string;
  country: string;
  address: string;
  regions: string[];
}

export interface EvidentIssuer {
  issuerId: string;
  name: string;
  email: string;
  country: string;
  address: string;
  regions: string[];
}
