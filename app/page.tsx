"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Wallet, Trophy, Clock, ArrowRightLeft, ShieldAlert, Copy, Check } from "lucide-react";
import { createWalletClient, custom, parseEther } from "viem";

const TREASURY_WALLET = (process.env.NEXT_PUBLIC_TREASURY_WALLET || "0x9faC30440D0990d5B421900Ab3c6a60F30A992ba") as `0x${string}`;

export default function Dashboard() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [amount, setAmount] = useState("");
  const [referrer, setReferrer] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Leaderboard & Jackpot state
  const [jackpotTimeLeft, setJackpotTimeLeft] = useState("15:00");
  const [jackpotPool, setJackpotPool] = useState({ eth: "0.00" });
  const [boardroom, setBoardroom] = useState<any[]>([]);

  // Detect Referral Parameter from URL (?ref=0x...)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const refParam = searchParams.get("ref");
      if (refParam && refParam.startsWith("0x") && refParam.length === 42) {
        setReferrer(refParam);
        toast.info(`Referral code applied: ${refParam.slice(0, 6)}...${refParam.slice(-4)}`);
      }
    }
  }, []);

  // Fetch Boardroom & Jackpot Data from API
  const fetchDashboardData = async () => {
    try {
      const res = await fetch("/api/boardroom");
      if (res.ok) {
        const data = await res.json();
        setBoardroom(data.boardroom || []);
        setJackpotPool({ eth: data.jackpotEth || "0.00" });
        if (data.timeLeft) setJackpotTimeLeft(data.timeLeft);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard state", err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Connect Wallet
  const connectWallet = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const client = createWalletClient({ transport: custom(window.ethereum) });
        const [address] = await client.requestAddresses();
        setAccount(address);
        toast.success("Wallet connected!");
      } catch (err) {
        toast.error("Failed to connect wallet.");
      }
    } else {
      toast.error("No Web3 wallet found. Please use a Web3 browser or MetaMask.");
    }
  };

  // Handle Purchase with Direct Treasury Transfer & Instant 5% Affiliate Split
  const handlePurchase = async () => {
    if (!account) return toast.error("Please connect your wallet first.");
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return toast.error("Enter a valid ETH amount.");
    }

    setIsLoading(true);

    try {
      const walletClient = createWalletClient({
        account,
        transport: custom(window.ethereum!),
      });

      const totalWei = parseEther(amount);
      const isReferrerValid =
        referrer &&
        referrer.startsWith("0x") &&
        referrer.length === 42 &&
        referrer.toLowerCase() !== account.toLowerCase();

      let primaryTxHash: string;

      if (isReferrerValid) {
        // Split: 95% Treasury, 5% Referrer
        const affiliateShare = (totalWei * 5n) / 100n;
        const treasuryShare = totalWei - affiliateShare;

        toast.loading("Step 1/2: Sending 95% to Presale Treasury...");
        primaryTxHash = await walletClient.sendTransaction({
          to: TREASURY_WALLET,
          value: treasuryShare,
        });

        toast.loading("Step 2/2: Sending 5% Instant Affiliate Kickback...");
        await walletClient.sendTransaction({
          to: referrer as `0x${string}`,
          value: affiliateShare,
        });

        toast.success("Deposit and 5% Affiliate Kickback confirmed!");
      } else {
        toast.loading("Sending deposit to Presale Treasury...");
        primaryTxHash = await walletClient.sendTransaction({
          to: TREASURY_WALLET,
          value: totalWei,
        });

        toast.success("Deposit successfully sent to Treasury!");
      }

      // Log Deposit Off-Chain
      await fetch("/api/log-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: primaryTxHash,
          user: account,
          amountETH: amount,
          referrer: isReferrerValid ? referrer : null,
          timestamp: Date.now(),
        }),
      });

      setAmount("");
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Transaction failed or canceled.");
    } finally {
      setIsLoading(false);
    }
  };

  // Copy Referral Link helper
  const copyReferralLink = () => {
    if (!account) return;
    const link = `${window.location.origin}?ref=${account}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Referral link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-dark-bg text-white font-mono p-4 md:p-8">
      {/* Navbar */}
      <nav className="flex justify-between items-center mb-8">
        <div className="text-2xl font-bold text-rh-green tracking-tighter">
          PREX<span className="text-white">PROTOCOL</span>
        </div>
        <button
          onClick={connectWallet}
          className="bg-dark-surface border border-rh-green text-rh-green px-4 py-2 rounded hover:bg-rh-green hover:text-dark-bg transition-colors flex items-center gap-2 text-sm"
        >
          <Wallet size={16} />
          {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
        </button>
      </nav>

      <div className="grid md:grid-cols-12 gap-8 max-w-6xl mx-auto">
        {/* Left Column: Jackpot & Purchase Form */}
        <div className="md:col-span-7 space-y-6">
          {/* Jackpot Card */}
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
            <div className="text-sm text-gray-400">
              Current Pool: <span className="text-white font-bold text-lg">{jackpotPool.eth} ETH</span>
            </div>
          </motion.div>

          {/* Purchase Card */}
          <div className="bg-dark-surface border border-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 border-b border-gray-800 pb-4">
              <ArrowRightLeft size={20} className="text-rh-green" /> Direct Presale Deposit
            </h3>

            {/* Referral Link Generator Banner */}
            {account && (
              <div className="bg-black/60 border border-rh-green/40 rounded p-3 mb-6 flex items-center justify-between text-xs">
                <div className="truncate mr-2">
                  <span className="text-gray-400 block mb-0.5">Your Referral Link (5% Instant Kickback):</span>
                  <span className="text-rh-green font-mono">{`${typeof window !== "undefined" ? window.location.origin : ""}?ref=${account}`}</span>
                </div>
                <button
                  onClick={copyReferralLink}
                  className="bg-rh-green text-dark-bg font-bold px-3 py-1.5 rounded hover:bg-rh-green-dark transition-colors shrink-0 flex items-center gap-1"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">
                  Amount (ETH)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.05 ETH"
                  className="w-full bg-black border border-gray-800 rounded p-3 text-white focus:outline-none focus:border-rh-green transition-colors font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">
                  Referrer Address (5% Instant Kickback)
                </label>
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
                {isLoading ? "PROCESSING TRANSACTION..." : "DEPOSIT NATIVE ETH"}
              </button>

              <div className="text-center text-xs text-gray-500 flex items-center justify-center gap-1 mt-4">
                <ShieldAlert size={12} /> Direct-to-Treasury Model • Zero Smart Contract Risk
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
                <div className="text-center text-gray-500 py-10">No deposits logged yet. Be the first!</div>
              ) : (
                boardroom.map((entry, idx) => (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    key={idx}
                    className={`flex justify-between items-center p-3 rounded ${
                      idx === 0
                        ? "bg-gradient-to-r from-jackpot-gold/20 to-transparent border border-jackpot-gold/50 text-jackpot-gold"
                        : "bg-black border border-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold opacity-50">#{idx + 1}</span>
                      <span className="text-sm">
                        {entry.user ? `${entry.user.slice(0, 6)}...${entry.user.slice(-4)}` : "0x00...0000"}
                      </span>
                    </div>
                    <div className="font-bold">{entry.totalEth} ETH</div>
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
