import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, decodeFunctionData, parseAbi } from "viem";

export const runtime = "edge";

const rpcUrl = process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";

const publicClient = createPublicClient({
  transport: http(rpcUrl),
});

// ABI for verifying USDC transfers
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

// ABI for verifying the Smart Contract deposit call
const presaleAbi = parseAbi([
  "function deposit(address referrer) public payable"
]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { txHash, expectedType } = body;

    if (!txHash || !txHash.startsWith("0x")) {
      return NextResponse.json(
        { success: false, error: "INVALID_TRANSACTION_HASH" },
        { status: 400 }
      );
    }

    // Now pointing to the Presale Contract instead of Treasury
    const presaleAddress = (
      process.env.NEXT_PUBLIC_PRESALE_CONTRACT || ""
    ).toLowerCase();

    const usdcContractAddress = (
      process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || ""
    ).toLowerCase();

    if (!presaleAddress) {
      return NextResponse.json(
        { success: false, error: "SERVER_CONFIG_MISSING_PRESALE_ADDRESS" },
        { status: 500 }
      );
    }

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

    const tx = await publicClient.getTransaction({
      hash: txHash as `0x${string}`,
    });

    if (expectedType === "ETH") {
      // Verify tx is directed at the Presale Smart Contract
      if (tx.to?.toLowerCase() !== presaleAddress) {
        return NextResponse.json(
          { success: false, error: "PRESALE_CONTRACT_MISMATCH" },
          { status: 400 }
        );
      }

      // Optional: Decode the function to log the referrer
      let referrer = "0x0000000000000000000000000000000000000000";
      try {
        const { args, functionName } = decodeFunctionData({
          abi: presaleAbi,
          data: tx.input,
        });
        if (functionName === "deposit" && args) {
          referrer = args[0] as string;
        }
      } catch (e) {
        console.warn("Could not decode deposit params, likely raw ETH transfer.");
      }

      return NextResponse.json({
        success: true,
        asset: "ETH",
        amountWei: tx.value.toString(),
        from: tx.from,
        referrer: referrer,
        blockNumber: receipt.blockNumber.toString(),
      });
      
    } else if (expectedType === "USDC") {
      // Verify tx is interacting with the USDC token contract
      if (tx.to?.toLowerCase() !== usdcContractAddress) {
        return NextResponse.json(
          { success: false, error: "TOKEN_CONTRACT_MISMATCH" },
          { status: 400 }
        );
      }

      const { args } = decodeFunctionData({
        abi: erc20Abi,
        data: tx.input,
      });

      const recipient = args[0]?.toLowerCase();
      const amount = args[1];

      // Verify the USDC recipient is the Presale Contract
      if (recipient !== presaleAddress) {
        return NextResponse.json(
          { success: false, error: "USDC_PRESALE_MISMATCH" },
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

