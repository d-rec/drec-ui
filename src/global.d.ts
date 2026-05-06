interface Ethereum {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (eventName: string, callback: (...args: any[]) => void) => void;
  // Add other properties and methods as needed
}

interface Window {
  ethereum?: Ethereum;
}

declare module 'piexifjs' {
  export const GPSIFD: {
    GPSLatitudeRef: number;
    GPSLatitude: number;
    GPSLongitudeRef: number;
    GPSLongitude: number;
    GPSDateStamp: number;
    [k: string]: number;
  };
  export const GPSHelper: {
    degToDmsRational(deg: number): number[][];
    dmsRationalToDeg(dms: number[][], ref: string): number;
  };
  export function dump(exif: Record<string, Record<string | number, unknown>>): string;
  export function load(jpegData: string): Record<string, Record<string | number, unknown>>;
  export function insert(exifBytes: string, jpegData: string): string;
  export function remove(jpegData: string): string;
}
