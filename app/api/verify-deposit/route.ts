import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, decodeFunctionData } from "viem";

// Enable Edge Runtime for Cloudflare Workers
export const runtime = "edge";

// Initialize Viem Public Client pointing to Robinhood Chain RPC
const rpcUrl = process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";

const publicClient = createPublicClient({
  transport: http(rpcUrl),
});

// Minimum ERC-20 ABI for transfer decoding
const erc20Abi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { txHash, expectedType, userAddress } = body;

    if (!txHash || !txHash.startsWith("0x")) {
      return NextResponse.json(
        { success: false, error: "INVALID_TRANSACTION_HASH" },
        { status: 400 }
      );
    }

    const treasuryAddress = (
      process.env.NEXT_PUBLIC_TREASURY_WALLET || ""
    ).toLowerCase();

    const usdcContractAddress = (
      process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || ""
    ).toLowerCase();

    // Fetch transaction receipt from Robinhood Chain L2
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt) {
      return NextResponse.json(
        { success: false, error: "TRANSACTION_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (receipt.status !== "success") {
      return NextResponse.json(
        { success: false, error: "TRANSACTION_FAILED_ON_CHAIN" },
        { status: 400 }
      );
    }

    // Verify transaction details based on deposit asset type
    if (expectedType === "ETH") {
      const tx = await publicClient.getTransaction({
        hash: txHash as `0x${string}`,
      });

      if (tx.to?.toLowerCase() !== treasuryAddress) {
        return NextResponse.json(
          { success: false, error: "TREASURY_MISMATCH" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        asset: "ETH",
        amountWei: tx.value.toString(),
        from: tx.from,
        blockNumber: receipt.blockNumber.toString(),
      });
    } else if (expectedType === "USDC") {
      const tx = await publicClient.getTransaction({
        hash: txHash as `0x${string}`,
      });

      if (tx.to?.toLowerCase() !== usdcContractAddress) {
        return NextResponse.json(
          { success: false, error: "TOKEN_CONTRACT_MISMATCH" },
          { status: 400 }
        );
      }

      // Decode ERC-20 transfer parameters
      const { args } = decodeFunctionData({
        abi: erc20Abi,
        data: tx.input,
      });

      const recipient = args[0]?.toLowerCase();
      const amount = args[1];

      if (recipient !== treasuryAddress) {
        return NextResponse.json(
          { success: false, error: "USDC_TREASURY_MISMATCH" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        asset: "USDC",
        amountUnits: amount.toString(),
        from: tx.from,
        blockNumber: receipt.blockNumber.toString(),
      });
    }

    return NextResponse.json(
      { success: false, error: "UNSUPPORTED_ASSET_TYPE" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "VERIFICATION_ERROR" },
      { status: 500 }
    );
  }
}
