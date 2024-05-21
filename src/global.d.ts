interface Ethereum {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (eventName: string, callback: (...args: any[]) => void) => void;
  // Add other properties and methods as needed
}

interface Window {
  ethereum?: Ethereum;
}
