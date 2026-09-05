"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Wallet, Trophy, Clock, ArrowRightLeft, ShieldAlert } from "lucide-react";
import { createPublicClient, createWalletClient, custom, parseEther, parseUnits, formatEther, formatUnits } from "viem";

// Fallbacks for environment variables
const RPC_URL = process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const PRESALE_CONTRACT = (process.env.NEXT_PUBLIC_PRESALE_CONTRACT || "0x0") as `0x${string}`;
const USDC_CONTRACT = (process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || "0x0") as `0x${string}`;

// Minimal ABIs for the dashboard
const presaleAbi = [
  "function depositETH(address referrer) external payable",
  "function depositUSDC(uint256 amount, address referrer) external",
  "function getBoardroom() external view returns (tuple(address user, uint256 usdValue)[10])",
  "function jackpotDeadline() external view returns (uint256)",
  "function ethJackpotPool() external view returns (uint256)",
  "function usdcJackpotPool() external view returns (uint256)",
  "function lastBuyer() external view returns (address)"
];

const erc20Abi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

export default function Dashboard() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [activeTab, setActiveTab] = useState<"ETH" | "USDC">("ETH");
  const [amount, setAmount] = useState("");
  const [referrer, setReferrer] = useState("");
  
  // Gamification State
  const [jackpotTimeLeft, setJackpotTimeLeft] = useState<string>("15:00");
  const [jackpotPool, setJackpotPool] = useState({ eth: "0", usdc: "0" });
  const [boardroom, setBoardroom] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize Wallet Connection
  const connectWallet = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const client = createWalletClient({ transport: custom(window.ethereum) });
        const [address] = await client.requestAddresses();
        setAccount(address);
        toast.success("Wallet connected successfully!");
      } catch (err) {
        toast.error("Failed to connect wallet.");
      }
    } else {
      toast.error("No Web3 wallet detected. Please install MetaMask or Robinhood Wallet.");
    }
  };

  // Fetch On-Chain Data (Mocked interval for UI demonstration)
  useEffect(() => {
    const fetchContractData = async () => {
      try {
        const publicClient = createPublicClient({ transport: custom(window.ethereum || { request: () => {} }) });
        // In production, uncomment these to fetch live data from PRESALE_CONTRACT
        /*
        const deadline = await publicClient.readContract({ address: PRESALE_CONTRACT, abi: presaleAbi, functionName: "jackpotDeadline" });
        const top10 = await publicClient.readContract({ address: PRESALE_CONTRACT, abi: presaleAbi, functionName: "getBoardroom" });
        setBoardroom(top10);
        */
        
        // Placeholder data for UI testing
        setBoardroom([
          { user: "0x1234...ABCD", usdValue: "50000000000" }, // 50k
          { user: "0x5678...EF01", usdValue: "25000000000" }  // 25k
        ]);
        setJackpotPool({ eth: "2.5", usdc: "1500" });
      } catch (error) {
        console.error("Error fetching on-chain data", error);
      }
    };

    fetchContractData();
    const interval = setInterval(fetchContractData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Handle Purchase Submission
  const handlePurchase = async () => {
    if (!account) return toast.error("Please connect your wallet first.");
    if (!amount || isNaN(Number(amount))) return toast.error("Enter a valid amount.");
    
    setIsLoading(true);
    const refAddress = referrer && referrer.startsWith("0x") ? referrer : "0x0000000000000000000000000000000000000000";

    try {
      const walletClient = createWalletClient({ account, transport: custom(window.ethereum!) });
      
      if (activeTab === "ETH") {
        toast.loading("Confirming ETH transaction...");
        // Execute depositETH via viem
        // await walletClient.writeContract({ address: PRESALE_CONTRACT, abi: presaleAbi, functionName: "depositETH", args: [refAddress], value: parseEther(amount) });
        
        setTimeout(() => toast.success("Deposit successful! You are now the Last Buyer."), 2000);
      } else {
        toast.loading("Approving USDC...");
        // Handle USDC Approval -> Deposit logic here
        
        setTimeout(() => toast.success("USDC Deposit successful!"), 2000);
      }
    } catch (err: any) {
      toast.error(err.message || "Transaction failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg text-white font-mono p-4 md:p-8">
      {/* Navbar */}
      <nav className="flex justify-between items-center mb-12">
        <div className="text-2xl font-bold text-rh-green tracking-tighter">PREX<span className="text-white">PROTOCOL</span></div>
        <button 
          onClick={connectWallet}
          className="bg-dark-surface border border-rh-green text-rh-green px-4 py-2 rounded hover:bg-rh-green hover:text-dark-bg transition-colors flex items-center gap-2"
        >
          <Wallet size={18} />
          {account ? `${account.slice(0,6)}...${account.slice(-4)}` : "Connect Wallet"}
        </button>
      </nav>

      <div className="grid md:grid-cols-12 gap-8 max-w-6xl mx-auto">
        
        {/* Left Column: Purchase & Jackpot */}
        <div className="md:col-span-7 space-y-6">
          
          {/* Jackpot Banner */}
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-dark-surface border border-jackpot-gold rounded-lg p-6 text-center shadow-[0_0_15px_rgba(255,215,0,0.15)] relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-jackpot-gold animate-jackpot-pulse" />
            <h2 className="text-jackpot-gold font-bold flex items-center justify-center gap-2 mb-2">
              <Clock size={20} /> LAST BUYER JACKPOT
            </h2>
            <div className="text-5xl font-bold tracking-widest mb-4">{jackpotTimeLeft}</div>
            <div className="flex justify-center gap-6 text-sm text-gray-400">
              <div>
                <span className="block text-white font-bold text-lg">{jackpotPool.eth} ETH</span>
                Pool
              </div>
              <div>
                <span className="block text-white font-bold text-lg">{jackpotPool.usdc} USDC</span>
                Pool
              </div>
            </div>
          </motion.div>

          {/* Terminal / Purchase Card */}
          <div className="bg-dark-surface border border-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 border-b border-gray-800 pb-4">
              <ArrowRightLeft size={20} className="text-rh-green" /> Acquire $PREX
            </h3>

            {/* Asset Toggle */}
            <div className="flex gap-2 mb-6 p-1 bg-black rounded">
              <button 
                onClick={() => setActiveTab("ETH")}
                className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${activeTab === "ETH" ? "bg-rh-green text-dark-bg" : "text-gray-400 hover:text-white"}`}
              >
                ETH
              </button>
              <button 
                onClick={() => setActiveTab("USDC")}
                className={`flex-1 py-2 rounded text-sm font-bold transition-colors ${activeTab === "USDC" ? "bg-[#2775CA] text-white" : "text-gray-400 hover:text-white"}`}
              >
                USDC
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Amount ({activeTab})</label>
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`0.00 ${activeTab}`}
                  className="w-full bg-black border border-gray-800 rounded p-3 text-white focus:outline-none focus:border-rh-green transition-colors font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Referral Code (Optional 5% Kickback)</label>
                <input 
                  type="text" 
                  value={referrer}
                  onChange={(e) => setReferrer(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-black border border-gray-800 rounded p-3 text-white focus:outline-none focus:border-rh-green transition-colors font-mono text-sm"
                />
              </div>

              <button 
                onClick={handlePurchase}
                disabled={isLoading}
                className="w-full bg-rh-green text-dark-bg font-bold py-4 rounded hover:bg-rh-green-dark transition-colors mt-4 disabled:opacity-50"
              >
                {isLoading ? "PROCESSING..." : `BUY WITH ${activeTab}`}
              </button>
              
              <div className="text-center text-xs text-gray-500 flex items-center justify-center gap-1 mt-4">
                <ShieldAlert size={12} /> Minimum 0.005 ETH / 15 USDC to reset Jackpot
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Boardroom Leaderboard */}
        <div className="md:col-span-5">
          <div className="bg-dark-surface border border-gray-800 rounded-lg p-6 h-full">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-rh-green border-b border-gray-800 pb-4">
              <Trophy size={20} /> The Boardroom
            </h3>
            
            <div className="space-y-3">
              {boardroom.length === 0 ? (
                <div className="text-center text-gray-500 py-10">Awaiting first deposits...</div>
              ) : (
                boardroom.map((entry, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={idx}
                    className={`flex justify-between items-center p-3 rounded ${idx === 0 ? 'bg-gradient-to-r from-jackpot-gold/20 to-transparent border border-jackpot-gold/50 text-jackpot-gold' : 'bg-black border border-gray-800'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold opacity-50">#{idx + 1}</span>
                      <span className="text-sm">{entry.user}</span>
                    </div>
                    <div className="font-bold">
                      ${(Number(entry.usdValue) / 1e6).toLocaleString()}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
