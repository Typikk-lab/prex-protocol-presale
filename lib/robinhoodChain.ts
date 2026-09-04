import { createPublicClient, http } from "viem";

export const ROBINHOOD_CHAIN_ID = 4663;
export const ROBINHOOD_HEX_CHAIN_ID = "0x1237";

export const publicClient = createPublicClient({
  transport: http(process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com"),
});

export const TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_TREASURY_WALLET ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export async function switchToRobinhoodChain(): Promise<boolean> {
  if (!window.ethereum) return false;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ROBINHOOD_HEX_CHAIN_ID }],
    });
    return true;
  } catch (switchError: any) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: ROBINHOOD_HEX_CHAIN_ID,
              chainName: "Robinhood Chain",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
              blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
            },
          ],
        });
        return true;
      } catch (addError) {
        return false;
      }
    }
    return false;
  }
}
