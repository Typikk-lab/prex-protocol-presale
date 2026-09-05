"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";

// Constants & Addresses
const PRESALE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PRESALE_CONTRACT || "0xYOUR_PRESALE_CONTRACT";
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || "0x6437c80e560b215e416084E09909C96a483A7777";
const RPC_URL = process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const RATE_ETH = Number(process.env.NEXT_PUBLIC_RATE_PER_ETH || 1000000);
const RATE_USDC = Number(process.env.NEXT_PUBLIC_RATE_PER_USDC || 300);

// Minimal ABI for the Gamified Presale
const PRESALE_ABI = [
  "function deposit(address referrer) public payable",
  "function totalRaised() public view returns (uint256)",
  "function jackpotPool() public view returns (uint256)",
  "function haltTimestamp() public view returns (uint256)",
  "function topDepositor() public view returns (address)"
];

export default function Home() {
  const [account, setAccount] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<"ETH" | "USDC">("ETH");
  const [amount, setAmount] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([
    "PREX_OS v3.0.1 [GAMIFIED_ENGINE_ACTIVE]",
    "SYSTEM_STATUS: Vault active (85% Pre-IPO Basket)",
    "TYPE 'help' OR CONNECT WALLET TO INITIALIZE DEPOSIT..."
  ]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Gamification States
  const [jackpotAmt, setJackpotAmt] = useState("0.000");
  const [totalRaised, setTotalRaised] = useState("0.00");
  const [topWhale, setTopWhale] = useState("0x000...0000");
  const [haltTimer, setHaltTimer] = useState<number>(0);
  const [showScratcher, setShowScratcher] = useState(false);
  const [scratcherRevealed, setScratcherRevealed] = useState(false);
  const [referrer, setReferrer] = useState<string>("0x0000000000000000000000000000000000000000");

  const appendLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Sync Contract Data
  const syncContractData = async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const contract = new ethers.Contract(PRESALE_CONTRACT_ADDRESS, PRESALE_ABI, provider);
      
      const raised = await contract.totalRaised();
      setTotalRaised(parseFloat(ethers.utils.formatEther(raised)).toFixed(2));

      const pool = await contract.jackpotPool();
      setJackpotAmt(parseFloat(ethers.utils.formatEther(pool)).toFixed(3));

      const whale = await contract.topDepositor();
      if (whale !== "0x0000000000000000000000000000000000000000") {
        setTopWhale(whale.slice(0, 6) + "..." + whale.slice(-4));
      }

      const haltTime = await contract.haltTimestamp();
      const now = Math.floor(Date.now() / 1000);
      if (haltTime.toNumber() > now) {
        setHaltTimer(haltTime.toNumber() - now);
      } else {
        setHaltTimer(0);
      }
    } catch (e) {
      console.log("Awaiting contract deployment or network switch...");
    }
  };

  useEffect(() => {
    // Check URL for referral
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('ref')) {
      setReferrer(urlParams.get('ref') as string);
    }

    const interval = setInterval(() => {
      syncContractData();
      setHaltTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      appendLog("ERROR: EVM Web3 Wallet not detected in browser.");
      return;
    }
    try {
      appendLog("CONNECTING_WALLET...");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts && accounts[0]) {
        setAccount(accounts[0]);
        appendLog(`CONNECTED: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);
        await switchToRobinhoodChain();
        syncContractData();
      }
    } catch (err: any) {
      appendLog(`ERROR_CONNECTING: ${err.message || "User rejected request"}`);
    }
  };

  const switchToRobinhoodChain = async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1237" }], // Chain ID 4663
      });
      appendLog("NETWORK_SET: Robinhood Chain L2");
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x1237",
              chainName: "Robinhood Chain",
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
            }],
          });
          appendLog("NETWORK_ADDED_AND_SWITCHED: Robinhood Chain L2");
        } catch (addError: any) {
          appendLog(`ERROR_ADDING_CHAIN: ${addError.message}`);
        }
      }
    }
  };

  const executeDeposit = async () => {
    if (!account) return appendLog("ERROR: Connect wallet first.");
    if (haltTimer > 0) return appendLog("ERROR: Market currently halted.");
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return appendLog("ERROR: Invalid quantity.");

    setIsProcessing(true);
    let txHash = "";

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();

      if (selectedAsset === "ETH") {
        appendLog(`EXECUTING_SMART_CONTRACT_DEPOSIT: ${amount} ETH...`);
        const contract = new ethers.Contract(PRESALE_CONTRACT_ADDRESS, PRESALE_ABI, signer);
        
        // Execute via Contract to trigger Jackpot & Leaderboard
        const tx = await contract.deposit(referrer, { value: ethers.utils.parseEther(amount) });
        txHash = tx.hash;
        appendLog(`TX_SUBMITTED: ${txHash}`);
        
        await tx.wait();
        
      } else {
        appendLog(`PROMPTING_USDC_TRANSFER: ${amount} USDC -> ${PRESALE_CONTRACT_ADDRESS.slice(0, 6)}...`);
        // Note: USDC remains direct transfer unless contract is upgraded to accept ERC20
        const parsedAmount = ethers.utils.parseUnits(amount, 6);
        const data = `0xa9059cbb${PRESALE_CONTRACT_ADDRESS.replace("0x", "").padStart(64, "0")}${parsedAmount.toHexString().replace("0x", "").padStart(64, "0")}`;

        txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [{ from: account, to: USDC_ADDRESS, data: data }],
        });
      }

      appendLog("VERIFYING_DEPOSIT_ON_CHAIN...");
      
      const res = await fetch("/api/verify-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, expectedType: selectedAsset, userAddress: account }),
      });

      const result = await res.json();
      if (result.success) {
        appendLog(`DEPOSIT_VERIFIED: Allocated ${calculatedAllocation()} $PREX.`);
        // Trigger Scratch Card / Bonus Decrypt UI
        setScratcherRevealed(false);
        setShowScratcher(true);
        syncContractData();
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
    return (num * (selectedAsset === "ETH" ? RATE_ETH : RATE_USDC)).toLocaleString();
  };

  const copyRefLink = () => {
    if(!account) return alert("Connect wallet first to generate ref link.");
    const link = `${window.location.origin}${window.location.pathname}?ref=${account}`;
    navigator.clipboard.writeText(link);
    appendLog("REFERRAL_LINK_COPIED_TO_CLIPBOARD");
  };

  return (
    <main className={`min-h-screen font-mono p-4 md:p-8 flex flex-col justify-between transition-colors duration-300 ${haltTimer > 0 ? 'halt-active' : 'bg-black text-green-500'}`}>
      
      {/* Decrypt Bonus Modal (Terminal Styled Scratcher) */}
      {showScratcher && (
        <div className="terminal-modal-overlay">
          <div className="border-2 border-green-500 bg-black p-8 max-w-md w-full text-center space-y-6">
            <h2 className="text-xl font-bold text-green-400 animate-pulse">// DEPOSIT_CONFIRMED</h2>
            <div 
              onClick={() => setScratcherRevealed(true)}
              className={`border border-dashed p-6 cursor-pointer transition-all ${
                scratcherRevealed 
                  ? "border-green-500 text-green-400 bg-green-900/20" 
                  : "border-zinc-500 text-zinc-500 hover:border-green-400 hover:text-green-400"
              }`}
            >
              {scratcherRevealed ? (
                <div>
                  <div className="text-lg font-bold mb-2">🎟️ JACKPOT_TICKET_SECURED</div>
                  <div className="text-xs">ENTRY LOGGED FOR CLOSING BELL POOL</div>
                </div>
              ) : (
                <div className="text-sm">CLICK TO DECRYPT BONUS PAYLOAD</div>
              )}
            </div>
            {scratcherRevealed && (
              <button 
                onClick={() => setShowScratcher(false)} 
                className="text-xs border border-green-500 px-4 py-2 hover:bg-green-900"
              >
                RETURN_TO_TERMINAL
              </button>
            )}
          </div>
        </div>
      )}

      {/* Circuit Breaker Alert Overlay */}
      {haltTimer > 0 && (
        <div className="w-full bg-red-900 text-red-100 text-center py-2 font-bold text-sm tracking-widest uppercase border-b-2 border-red-500 mb-4 animate-pulse">
          ⚠️ TRADING_HALTED: VOLATILITY_SPIKE_DETECTED // RESUMING IN 00:{haltTimer.toString().padStart(2, '0')} ⚠️
        </div>
      )}

      <div className="max-w-5xl mx-auto w-full space-y-6">
        <header className={`border-b pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${haltTimer > 0 ? 'border-red-800' : 'border-green-800'}`}>
          <div>
            <h1 className="text-2xl font-bold tracking-wider">PREX_PROTOCOL // PRESALE_TERMINAL</h1>
            <p className="text-xs opacity-75">CHAIN: ROBINHOOD_L2 (4663)</p>
          </div>
          <button
            onClick={connectWallet}
            className={`border px-4 py-2 text-xs font-bold transition-all ${
              haltTimer > 0 ? 'border-red-500 hover:bg-red-950 text-red-300' : 'border-green-500 hover:bg-green-950 text-green-300'
            }`}
          >
            {account ? `CONNECTED: ${account.slice(0, 6)}...${account.slice(-4)}` : "EXECUTE: CONNECT_WALLETS"}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Deposit Interface */}
          <div className="lg:col-span-8 space-y-4">
            
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 bg-zinc-950/50 ${haltTimer > 0 ? 'border-red-900' : 'border-green-900'}`}>
              <div>
                <span className="text-xs text-zinc-500 block">NATIVE_ETH_RATE:</span>
                <span className="text-amber-400 font-bold">1 ETH = {RATE_ETH.toLocaleString()} $PREX</span>
              </div>
              <div>
                <span className="text-xs text-zinc-500 block">RAISE_PROGRESS:</span>
                <span className="text-green-400 font-bold">{totalRaised} / 2.00 ETH</span>
              </div>
            </div>

            <div className={`border p-6 bg-black space-y-4 ${haltTimer > 0 ? 'border-red-800' : 'border-green-800'}`}>
              <h2 className="text-sm font-bold">// INITIALIZE_DEPOSIT_MODULE</h2>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setSelectedAsset("ETH")}
                  className={`flex-1 py-2 border text-xs font-bold ${
                    selectedAsset === "ETH"
                      ? "border-green-400 bg-green-950/50 text-green-300"
                      : "border-zinc-800 text-zinc-600 hover:border-zinc-700"
                  }`}
                >
                  NATIVE_ETH
                </button>
                <button
                  onClick={() => setSelectedAsset("USDC")}
                  className={`flex-1 py-2 border text-xs font-bold ${
                    selectedAsset === "USDC"
                      ? "border-cyan-400 bg-cyan-950/50 text-cyan-300"
                      : "border-zinc-800 text-zinc-600 hover:border-zinc-700"
                  }`}
                >
                  USDC_STABLE
                </button>
              </div>

              <div>
                <label className="text-xs opacity-75 block mb-1">DEPOSIT_QUANTITY ({selectedAsset}):</label>
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={haltTimer > 0}
                  placeholder="0.0"
                  className="w-full bg-zinc-950/50 border border-green-900 p-3 text-sm focus:outline-none focus:border-green-500 font-mono disabled:opacity-50"
                />
              </div>

              <div className="text-xs text-zinc-400 flex justify-between">
                <span>ESTIMATED_ALLOCATION:</span>
                <span className="font-bold">{calculatedAllocation()} $PREX</span>
              </div>

              <button
                onClick={executeDeposit}
                disabled={isProcessing || haltTimer > 0}
                className={`w-full font-bold py-3 text-sm transition-colors disabled:opacity-50 ${
                  haltTimer > 0 
                    ? 'bg-red-900 text-black hover:bg-red-900 cursor-not-allowed' 
                    : 'bg-green-900 text-black hover:bg-green-800'
                }`}
              >
                {haltTimer > 0 
                  ? "SYSTEM_HALTED" 
                  : isProcessing 
                    ? "PROCESSING_ON_CHAIN..." 
                    : `[EXECUTE DEPOSIT: ${amount || "0"} ${selectedAsset}]`}
              </button>
            </div>
            
            {/* Terminal Console */}
            <div className={`border p-4 bg-zinc-950/50 h-40 overflow-y-auto space-y-1 text-xs ${haltTimer > 0 ? 'border-red-900' : 'border-green-900'}`}>
              <div className="text-zinc-600 mb-2">// TERMINAL_CONSOLE_OUTPUT</div>
              {logs.map((log, i) => (
                <div key={i} className={log.includes("ERROR") || log.includes("HALTED") ? "text-red-400" : ""}>
                  {log}
                </div>
              ))}
            </div>
          </div>

          <!-- Right Sidebar: Gamification Panels -->
          <div className="lg:col-span-4 space-y-4">
            
            {/* Jackpot Panel */}
            <div className={`border p-5 bg-black ${haltTimer > 0 ? 'border-red-800 shadow-[0_0_15px_rgba(255,0,0,0.2)]' : 'border-green-500 shadow-[0_0_15px_rgba(0,255,102,0.1)]'}`}>
              <h3 className="text-xs text-zinc-500 block mb-2">// CLOSING_BELL_JACKPOT</h3>
              <div className="text-3xl font-bold mb-1">{jackpotAmt} ETH</div>
              <p className="text-xs opacity-75">Awarded to 1 random depositor upon terminal fulfillment.</p>
            </div>

            {/* Boardroom Panel */}
            <div className={`border p-5 bg-black ${haltTimer > 0 ? 'border-red-900' : 'border-zinc-800'}`}>
              <h3 className="text-xs text-zinc-500 block mb-4">// BOARDROOM_ALPHA_NODE</h3>
              <div className="border-b border-dashed border-zinc-700 pb-3 mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span>MANAGING_DIRECTOR:</span>
                  <span className="text-green-300 font-bold border border-green-800 px-1">0% TAX</span>
                </div>
                <div className="text-sm font-bold text-amber-400">{topWhale}</div>
              </div>
              <p className="text-[10px] text-zinc-500">Current top depositor secures permanent 0% trading tax protocol status.</p>
            </div>

            {/* Affiliate Link Panel */}
            {account && (
              <div className="border border-zinc-800 p-4 bg-black">
                <h3 className="text-[10px] text-zinc-500 block mb-2">// AFFILIATE_ROUTING (5% ETH KICKBACK)</h3>
                <button 
                  onClick={copyRefLink}
                  className="w-full text-xs border border-zinc-700 py-2 hover:bg-zinc-900 transition-colors"
                >
                  COPY_REFERRAL_LINK
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}
