export interface fulecodeType{
    code:string;
    name:string;
}
export interface devicecodeType{
    code:string;
    name:string;
}

export interface CountryInfo {
    country: string;
    alpha2: string;
    alpha3: string;
    numeric: string;
    countryCode: string;
    timezones: TimezoneInfo[];
  }
  
  interface TimezoneInfo {
    name: string;
    offset: number;
  }
  

