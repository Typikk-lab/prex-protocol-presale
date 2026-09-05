export {};

// Standard EIP-1193 Provider RPC Error
export interface ProviderRpcError extends Error {
  message: string;
  code: number;
  data?: unknown;
}

declare global {
  interface Window {
    ethereum?: {
      // Wallet detection flags
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      isBraveWallet?: boolean;
      isTrust?: boolean;
      isRobinhood?: boolean;
      
      // Used when multiple wallets inject into window.ethereum
      providers?: any[]; 
      
      // Current connection state
      chainId?: string;
      networkVersion?: string;
      selectedAddress?: string | null;

      // EIP-1193 request method
      request: (args: { method: string; params?: unknown[] | object }) => Promise<any>;

      // Event listeners for state changes (e.g., changing wallets or networks)
      on: (eventName: string, handler: (...args: any[]) => void) => void;
      removeListener: (eventName: string, handler: (...args: any[]) => void) => void;
      removeAllListeners: (eventName?: string) => void;
    };
  }
}
