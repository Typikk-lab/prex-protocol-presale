"use client";

import { useState } from "react";
import { parseEther, parseUnits } from "viem";

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_WALLET || "0x0000000000000000000000000000000000000000";
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || "0x6437c80e560b215e416084E09909C96a483A7777";
const RPC_URL = process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const RATE_ETH = Number(process.env.NEXT_PUBLIC_RATE_PER_ETH || 1000000);
const RATE_USDC = Number(process.env.NEXT_PUBLIC_RATE_PER_USDC || 300);

export default function Home() {
  const [account, setAccount] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<"ETH" | "USDC">("ETH");
  const [amount, setAmount] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([
    "PREX_OS v2.6.4 [ROBINHOOD_CHAIN_L2]",
    "SYSTEM_STATUS: Vault active (85% Pre-IPO Basket)",
    "TYPE 'help' OR CONNECT WALLET TO INITIALIZE DEPOSIT..."
  ]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const appendLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      appendLog("ERROR: EVM Web3 Wallet not detected in browser.");
      return;
    }

    try {
      appendLog("CONNECTING_WALLET...");
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts && accounts[0]) {
        setAccount(accounts[0]);
        appendLog(`CONNECTED: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
        await switchToRobinhoodChain();
      }
    } catch (err: any) {
      appendLog(`ERROR_CONNECTING: ${err.message || "User rejected request"}`);
    }
  };

  const switchToRobinhoodChain = async () => {
    if (typeof window === "undefined" || !window.ethereum) return;

    try {
      appendLog("VERIFYING_CHAIN_ID_4663...");
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1237" }], // Chain ID 4663 in Hex
      });
      appendLog("NETWORK_SET: Robinhood Chain L2 Mainnet");
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          appendLog("ADDING_ROBINHOOD_CHAIN_L2...");
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x1237",
                chainName: "Robinhood Chain",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: [RPC_URL],
                blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
              },
            ],
          });
          appendLog("NETWORK_ADDED_AND_SWITCHED: Robinhood Chain L2");
        } catch (addError: any) {
          appendLog(`ERROR_ADDING_CHAIN: ${addError.message}`);
        }
      } else {
        appendLog(`ERROR_SWITCHING_CHAIN: ${switchError.message}`);
      }
    }
  };

  const executeDeposit = async () => {
    if (!account) {
      appendLog("ERROR: Connect wallet first.");
      return;
    }

    if (typeof window === "undefined" || !window.ethereum) {
      appendLog("ERROR: EVM Wallet missing.");
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      appendLog("ERROR: Invalid deposit quantity.");
      return;
    }

    setIsProcessing(true);
    let txHash = "";

    try {
      const ethereum = window.ethereum;

      if (selectedAsset === "ETH") {
        appendLog(`PROMPTING_ETH_TRANSFER: ${amount} ETH -> ${TREASURY_ADDRESS.slice(0, 6)}...`);
        const valueHex = "0x" + parseEther(amount).toString(16);

        txHash = await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: account,
              to: TREASURY_ADDRESS,
              value: valueHex,
            },
          ],
        });
      } else {
        appendLog(`PROMPTING_USDC_TRANSFER: ${amount} USDC -> ${TREASURY_ADDRESS.slice(0, 6)}...`);
        const parsedAmount = parseUnits(amount, 6);
        
        const recipientHex = TREASURY_ADDRESS.replace("0x", "").padStart(64, "0");
        const amountHex = parsedAmount.toString(16).padStart(64, "0");
        const data = `0xa9059cbb${recipientHex}${amountHex}`;

        txHash = await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: account,
              to: USDC_ADDRESS,
              data: data,
            },
          ],
        });
      }

      appendLog(`TX_SUBMITTED: ${txHash}`);
      appendLog("VERIFYING_DEPOSIT_ON_CHAIN...");

      const res = await fetch("/api/verify-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash,
          expectedType: selectedAsset,
          userAddress: account,
        }),
      });

      const result = await res.json();
      if (result.success) {
        const estimatedTokens = (
          numericAmount * (selectedAsset === "ETH" ? RATE_ETH : RATE_USDC)
        ).toLocaleString();
        appendLog(`DEPOSIT_VERIFIED: Allocated ${estimatedTokens} $PREX to ${account.slice(0, 6)}...`);
      } else {
        appendLog(`VERIFICATION_WARNING: ${result.error || "Pending confirmation"}`);
      }
    } catch (err: any) {
      appendLog(`TRANSACTION_FAILED: ${err.message || "User cancelled"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const calculatedAllocation = () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return "0";
    const rate = selectedAsset === "ETH" ? RATE_ETH : RATE_USDC;
    return (num * rate).toLocaleString();
  };

  return (
    <main className="min-h-screen bg-black text-green-500 font-mono p-4 md:p-8 flex flex-col justify-between selection:bg-green-900 selection:text-green-100">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <header className="border-b border-green-800 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wider text-green-400">
              PREX_PROTOCOL // PRESALE_TERMINAL
            </h1>
            <p className="text-xs text-green-700">CHAIN: ROBINHOOD_L2 (4663)</p>
          </div>
          <button
            onClick={connectWallet}
            className="border border-green-500 px-4 py-2 hover:bg-green-950 text-xs font-bold transition-all text-green-300"
          >
            {account ? `CONNECTED: ${account.slice(0, 6)}...${account.slice(-4)}` : "EXECUTE: CONNECT_WALLETS"}
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-green-900 p-4 bg-zinc-950">
          <div>
            <span className="text-xs text-zinc-500 block">NATIVE_ETH_RATE:</span>
            <span className="text-amber-400 font-bold">1 ETH = {RATE_ETH.toLocaleString()} $PREX</span>
          </div>
          <div>
            <span className="text-xs text-zinc-500 block">USDC_STABLE_RATE:</span>
            <span className="text-cyan-400 font-bold">1 USDC = {RATE_USDC.toLocaleString()} $PREX</span>
          </div>
        </div>

        <div className="border border-green-800 p-6 bg-black space-y-4">
          <h2 className="text-sm font-bold text-green-400">// INITIALIZE_DEPOSIT_MODULE</h2>
          
          <div className="flex gap-4">
            <button
              onClick={() => setSelectedAsset("ETH")}
              className={`flex-1 py-2 border text-xs font-bold ${
                selectedAsset === "ETH"
                  ? "border-green-400 bg-green-950 text-green-300"
                  : "border-zinc-800 text-zinc-600 hover:border-zinc-700"
              }`}
            >
              NATIVE_ETH
            </button>
            <button
              onClick={() => setSelectedAsset("USDC")}
              className={`flex-1 py-2 border text-xs font-bold ${
                selectedAsset === "USDC"
                  ? "border-cyan-400 bg-cyan-950 text-cyan-300"
                  : "border-zinc-800 text-zinc-600 hover:border-zinc-700"
              }`}
            >
              USDC_STABLE
            </button>
          </div>

          <div>
            <label className="text-xs text-green-600 block mb-1">
              DEPOSIT_QUANTITY ({selectedAsset}):
            </label>
            <input
              type="number"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full bg-zinc-950 border border-green-900 p-3 text-green-400 text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          <div className="text-xs text-zinc-400 flex justify-between">
            <span>ESTIMATED_ALLOCATION:</span>
            <span className="text-green-300 font-bold">{calculatedAllocation()} $PREX</span>
          </div>

          <button
            onClick={executeDeposit}
            disabled={isProcessing}
            className="w-full bg-green-900 hover:bg-green-800 text-black font-bold py-3 text-sm transition-colors disabled:opacity-50"
          >
            {isProcessing ? "PROCESSING_ON_CHAIN..." : `[EXECUTE DEPOSIT: ${amount || "0"} ${selectedAsset}]`}
          </button>
        </div>

        <div className="border border-green-900 p-4 bg-zinc-950 h-48 overflow-y-auto space-y-1 text-xs">
          <div className="text-zinc-600 mb-2">// TERMINAL_CONSOLE_OUTPUT</div>
          {logs.map((log, i) => (
            <div key={i} className="text-green-400">
              {log}
            </div>
          ))}
        </div>
      </div>

      <footer className="text-center text-xs text-zinc-600 mt-8">
        PREX_PROTOCOL // ROBINHOOD_L2 // ENCRYPTED_EDGE_RUNTIME
      </footer>
    </main>
  );
}
