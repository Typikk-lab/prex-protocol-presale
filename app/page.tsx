"use client";

import { useState } from "react";
import { parseEther, parseUnits, encodeFunctionData } from "viem";
import { switchToRobinhoodChain, TREASURY_ADDRESS } from "@/lib/robinhoodChain";

type PaymentCurrency = "ETH" | "USDC";

const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

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

export default function TerminalPresalePage() {
  const [account, setAccount] = useState<string | null>(null);
  const [currency, setCurrency] = useState<PaymentCurrency>("ETH");
  const [amount, setAmount] = useState<string>("0.05");
  const [loading, setLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([
    "PREX_OS v2.6.4 [ROBINHOOD_CHAIN_L2]",
    "SYSTEM_STATUS: Vault active (85% Pre-IPO Basket)",
    "TYPE 'help' OR CONNECT WALLET TO INITIALIZE DEPOSIT...",
  ]);

  const rateEth = Number(process.env.NEXT_PUBLIC_RATE_PER_ETH || 1000000);
  const rateUsdc = Number(process.env.NEXT_PUBLIC_RATE_PER_USDC || 300);

  const activeRate = currency === "ETH" ? rateEth : rateUsdc;
  const estimatedTokens = (parseFloat(amount) || 0) * activeRate;

  const appendLog = (msg: string) => {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, 8);
    setLogs((prev) => [...prev.slice(-6), `[${timestamp}] ${msg}`]);
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      appendLog("ERROR: EVM Web3 Provider not found. Install Robinhood / MetaMask.");
      return;
    }

    try {
      appendLog("INITIALIZING_WALLET_HANDSHAKE...");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      appendLog(`CONNECTED: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
      await switchToRobinhoodChain();
      appendLog("NETWORK_SYNC: Robinhood Chain (Chain ID: 4663)");
    } catch (err: any) {
      appendLog(`ERR_CONNECT_FAILED: ${err.message}`);
    }
  };

  const handleCurrencyChange = (newCurrency: PaymentCurrency) => {
    setCurrency(newCurrency);
    setAmount(newCurrency === "ETH" ? "0.05" : "100");
    appendLog(`CURRENCY_SWITCH -> ${newCurrency}`);
  };

  const handleDeposit = async () => {
    if (!account) {
      await connectWallet();
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      appendLog(`ERR_INVALID_INPUT: Enter a valid ${currency} value.`);
      return;
    }

    try {
      setLoading(true);
      appendLog("VERIFYING_CHAIN_ID_4663...");

      const isCorrectChain = await switchToRobinhoodChain();
      if (!isCorrectChain) {
        appendLog("ERR_WRONG_CHAIN: Switch wallet to Robinhood Chain.");
        setLoading(false);
        return;
      }

      let txHash = "";

      if (currency === "ETH") {
        appendLog(`PROMPTING_ETH_TRANSFER (${numericAmount} ETH) -> TREASURY`);
        const valueHex = "0x" + parseEther(numericAmount.toString()).toString(16);

        txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [{ from: account, to: TREASURY_ADDRESS, value: valueHex }],
        });
      } else {
        appendLog(`PROMPTING_USDC_TRANSFER (${numericAmount} USDC) -> TREASURY`);
        const data = encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [TREASURY_ADDRESS, parseUnits(numericAmount.toString(), 6)],
        });

        txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [{ from: account, to: USDC_ADDRESS, data: data }],
        });
      }

      appendLog(`TX_BROADCAST: ${txHash.slice(0, 14)}... Waiting L2 block confirm...`);

      const res = await fetch("/api/verify-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash,
          userAddress: account,
          amount: numericAmount,
          paymentType: currency,
        }),
      });

      const data = await res.json();
      if (data.success) {
        appendLog(`[SUCCESS] ALLOCATED ${data.tokensAllocated.toLocaleString()} $PREX`);
      } else {
        appendLog(`[WARN] Tx confirmed on-chain, backend log warning: ${data.error}`);
      }
    } catch (err: any) {
      appendLog(`ERR_TX_REJECTED: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-emerald-400 font-mono flex flex-col justify-between p-4 md:p-8 select-none">
      <header className="border-b border-emerald-900/60 pb-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-500/70 mb-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>ROBINHOOD_CHAIN // CHAIN_ID: 4663</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span className="text-emerald-400">&gt;_</span> PREX_PROTOCOL
            <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded">
              PRESALE_V1
            </span>
          </h1>
        </div>

        <button
          onClick={connectWallet}
          className="border border-emerald-500/40 hover:border-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-xs px-4 py-2 rounded transition font-bold"
        >
          {account ? `USER: ${account.slice(0, 6)}...${account.slice(-4)}` : "EXECUTE: CONNECT_WALLETS"}
        </button>
      </header>

      <div className="max-w-3xl w-full mx-auto bg-neutral-950 border border-emerald-900/80 rounded-lg p-6 shadow-[0_0_30px_rgba(16,185,129,0.08)] space-y-6">
        <div className="bg-black/80 border border-emerald-950 p-4 rounded text-xs space-y-2">
          <div className="text-amber-400 font-semibold">[VAULT_SPECS]</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-neutral-400">
            <div>ASSETS: <span className="text-white">Pre-IPO Basket</span></div>
            <div>DECAY TAX: <span className="text-cyan-400">25% → 0% (90d)</span></div>
            <div>EST. GAS: <span className="text-emerald-400">&lt; $0.01</span></div>
            <div>NAV FLOOR: <span className="text-amber-300">$1.00 BASE</span></div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-neutral-400 mb-2 font-semibold">SELECT_PAYMENT_METHOD //</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleCurrencyChange("ETH")}
              className={`p-3 text-xs border rounded transition flex items-center justify-between font-bold ${
                currency === "ETH"
                  ? "border-emerald-400 bg-emerald-950/80 text-emerald-300"
                  : "border-neutral-800 bg-black text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <span>NATIVE_ETH</span>
              <span className="text-amber-400">1 ETH = 1M $PREX</span>
            </button>
            <button
              onClick={() => handleCurrencyChange("USDC")}
              className={`p-3 text-xs border rounded transition flex items-center justify-between font-bold ${
                currency === "USDC"
                  ? "border-cyan-400 bg-cyan-950/80 text-cyan-300"
                  : "border-neutral-800 bg-black text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <span>USDC_STABLE</span>
              <span className="text-amber-400">1 USDC = 300 $PREX</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-neutral-400 font-semibold">INPUT_DEPOSIT_QUANTITY ({currency}) //</label>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-emerald-500 text-sm font-bold">&gt;</span>
            <input
              type="number"
              min={currency === "ETH" ? "0.001" : "1"}
              step={currency === "ETH" ? "0.01" : "10"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-black border border-emerald-900 rounded px-8 py-3 text-white focus:outline-none focus:border-emerald-400 font-mono text-sm"
              placeholder={currency === "ETH" ? "0.05" : "100"}
            />
            <span className="absolute right-4 top-3 text-xs text-neutral-500 font-semibold">{currency}</span>
          </div>

          <div className="flex justify-between text-xs text-neutral-400 px-1 pt-1">
            <span>CONVERSION_OUTPUT:</span>
            <span className="text-white">
              ESTIMATED: <strong className="text-amber-400">{estimatedTokens.toLocaleString()} $PREX</strong>
            </span>
          </div>
        </div>

        <button
          onClick={handleDeposit}
          disabled={loading}
          className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 text-black font-extrabold py-3.5 rounded transition text-sm tracking-wide shadow-[0_0_15px_rgba(16,185,129,0.3)]"
        >
          {loading ? "[EXECUTING_TRANSACTION...]" : account ? `[EXECUTE DEPOSIT: ${amount} ${currency}]` : "[CONNECT WALLET TO DEPOSIT]"}
        </button>

        <div className="bg-black border border-emerald-950 p-4 rounded text-[11px] font-mono space-y-1 overflow-hidden">
          <div className="text-neutral-500 text-[10px] border-b border-emerald-950 pb-1 mb-2">TERMINAL_CONSOLE_OUTPUT //</div>
          {logs.map((log, idx) => (
            <div key={idx} className={log.includes("ERR") ? "text-red-400" : log.includes("SUCCESS") ? "text-amber-300 font-bold" : "text-emerald-500/90"}>
              {log}
            </div>
          ))}
        </div>
      </div>

      <footer className="mt-8 text-center text-xs text-neutral-600 border-t border-emerald-950 pt-4">
        PREX_PROTOCOL © 2026 // DECENTRALIZED PRE-IPO VAULTS ON ROBINHOOD CHAIN
      </footer>
    </main>
  );
}
