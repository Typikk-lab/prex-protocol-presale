import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, decodeFunctionData } from "viem";

const publicClient = createPublicClient({
  transport: http(process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com"),
});

const TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_TREASURY_WALLET || "").toLowerCase();
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || "").toLowerCase();

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export async function POST(req: NextRequest) {
  try {
    const { txHash, userAddress, amount, paymentType } = await req.json();

    if (!txHash || !userAddress || !amount || !paymentType) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });

    if (!receipt || receipt.status !== "success") {
      return NextResponse.json({ error: "Transaction unconfirmed on-chain" }, { status: 400 });
    }

    const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
    let tokensAllocated = 0;

    if (paymentType === "ETH") {
      if (tx.to?.toLowerCase() !== TREASURY_ADDRESS) {
        return NextResponse.json({ error: "Recipient does not match Treasury" }, { status: 400 });
      }
      const ratePerEth = Number(process.env.NEXT_PUBLIC_RATE_PER_ETH || 1000000);
      tokensAllocated = parseFloat(amount) * ratePerEth;
    } else if (paymentType === "USDC") {
      if (tx.to?.toLowerCase() !== USDC_ADDRESS) {
        return NextResponse.json({ error: "Not sent to USDC contract" }, { status: 400 });
      }
      const decoded = decodeFunctionData({ abi: ERC20_TRANSFER_ABI, data: tx.input });
      const recipient = (decoded.args[0] as string).toLowerCase();
      if (recipient !== TREASURY_ADDRESS) {
        return NextResponse.json({ error: "USDC target is not Treasury" }, { status: 400 });
      }
      const ratePerUsdc = Number(process.env.NEXT_PUBLIC_RATE_PER_USDC || 300);
      tokensAllocated = parseFloat(amount) * ratePerUsdc;
    }

    return NextResponse.json({
      success: true,
      txHash,
      userAddress,
      amount,
      paymentType,
      tokensAllocated,
      blockNumber: receipt.blockNumber.toString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
