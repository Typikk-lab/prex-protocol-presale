// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PrexProtocolPresale
 * @notice Gamified presale contract with referral kickbacks, last-buyer jackpot,
 *         circuit breakers, and top-10 boardroom leaderboard.
 */
contract PrexProtocolPresale is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- TOKENS & ADDRESSES ---
    IERC20 public immutable usdcToken;
    address payable public treasuryWallet;

    // --- CONVERSION RATES ---
    // 1 ETH = 1,000,000 PREX (1e18 wei = 1e6 * 1e18 PREX)
    // 1 USDC = 300 PREX (1e6 units = 300 * 1e18 PREX)
    uint256 public constant PREX_PER_ETH = 1_000_000;
    uint256 public constant PREX_PER_USDC = 300;

    // --- GAMIFICATION & FEES ---
    uint256 public constant REFERRAL_BIPS = 500;   // 5.0%
    uint256 public constant JACKPOT_BIPS = 300;    // 3.0%
    uint256 public constant BIPS_DIVISOR = 10_000;

    // Minimum deposit to reset jackpot timer (0.005 ETH or 15 USDC)
    uint256 public minEthJackpotEligibility = 0.005 ether;
    uint256 public minUsdcJackpotEligibility = 15 * 1e6;

    // Jackpot State
    uint256 public constant JACKPOT_DURATION = 15 minutes;
    uint256 public jackpotDeadline;
    address public lastBuyer;
    uint256 public ethJackpotPool;
    uint256 public usdcJackpotPool;

    // --- CIRCUIT BREAKERS & LIMITS ---
    bool public paused;
    uint256 public maxEthPerTx = 10 ether;
    uint256 public maxUsdcPerTx = 30_000 * 1e6;

    // --- TOTALS & STATS ---
    uint256 public totalEthRaised;
    uint256 public totalUsdcRaised;
    uint256 public totalTokensAllocated;

    mapping(address => uint256) public userTokensAllocated;
    mapping(address => uint256) public userUsdValueContributed; // Normalized to 6 decimals (USDC equivalent)
    mapping(address => uint256) public referralRewardsEth;
    mapping(address => uint256) public referralRewardsUsdc;

    // --- BOARDROOM LEADERBOARD ---
    struct LeaderboardEntry {
        address user;
        uint256 usdValue; // 6 decimals
    }
    LeaderboardEntry[10] public topBoardroom;

    // --- EVENTS ---
    event DepositETH(address indexed buyer, uint256 amountWei, uint256 tokensAllocated, address indexed referrer);
    event DepositUSDC(address indexed buyer, uint256 amountUnits, uint256 tokensAllocated, address indexed referrer);
    event ReferralPaid(address indexed referrer, address indexed buyer, uint256 amount, bool isEth);
    event JackpotReset(address indexed newLastBuyer, uint256 newDeadline);
    event JackpotClaimed(address indexed winner, uint256 ethAmount, uint256 usdcAmount);
    event CircuitBreakerToggled(bool isPaused);
    event BoardroomUpdated(address indexed user, uint256 totalUsdValue);

    constructor(address _usdcToken, address payable _treasuryWallet) Ownable(msg.sender) {
        require(_usdcToken != address(0), "INVALID_USDC");
        require(_treasuryWallet != address(0), "INVALID_TREASURY");
        usdcToken = IERC20(_usdcToken);
        treasuryWallet = _treasuryWallet;
        jackpotDeadline = block.timestamp + JACKPOT_DURATION;
    }

    modifier whenNotPaused() {
        require(!paused, "CIRCUIT_BREAKER_ACTIVE");
        _;
    }

    // =========================================================================
    // DEPOSIT FUNCTIONS
    // =========================================================================

    /**
     * @notice Deposit ETH to purchase $PREX
     * @param referrer Address of the affiliate referrer
     */
    function depositETH(address referrer) external payable nonReentrant whenNotPaused {
        uint256 amount = msg.value;
        require(amount > 0, "ZERO_DEPOSIT");
        require(amount <= maxEthPerTx, "EXCEEDS_MAX_TX_LIMIT");

        // Check if jackpot expired prior to this transaction
        _checkAndProcessJackpot();

        uint256 tokens = amount * PREX_PER_ETH;
        _recordDeposit(msg.sender, tokens, (amount * PREX_PER_USDC) / (10**12)); // Normalized USD math

        totalEthRaised += amount;

        // Calculate Splits
        uint256 referralShare = 0;
        if (referrer != address(0) && referrer != msg.sender) {
            referralShare = (amount * REFERRAL_BIPS) / BIPS_DIVISOR;
            referralRewardsEth[referrer] += referralShare;
            (bool refSuccess, ) = payable(referrer).call{value: referralShare}("");
            require(refSuccess, "REFERRAL_ETH_TRANSFER_FAILED");
            emit ReferralPaid(referrer, msg.sender, referralShare, true);
        }

        uint256 jackpotShare = (amount * JACKPOT_BIPS) / BIPS_DIVISOR;
        ethJackpotPool += jackpotShare;

        uint256 treasuryShare = amount - referralShare - jackpotShare;
        (bool treasurySuccess, ) = treasuryWallet.call{value: treasuryShare}("");
        require(treasurySuccess, "TREASURY_TRANSFER_FAILED");

        // Update Jackpot Timer if eligible
        if (amount >= minEthJackpotEligibility) {
            _touchJackpot(msg.sender);
        }

        emit DepositETH(msg.sender, amount, tokens, referrer);
    }

    /**
     * @notice Deposit USDC to purchase $PREX
     * @param amount Token units in 6 decimals
     * @param referrer Address of the affiliate referrer
     */
    function depositUSDC(uint256 amount, address referrer) external nonReentrant whenNotPaused {
        require(amount > 0, "ZERO_DEPOSIT");
        require(amount <= maxUsdcPerTx, "EXCEEDS_MAX_TX_LIMIT");

        _checkAndProcessJackpot();

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 tokens = amount * PREX_PER_USDC * (10**12); // Scale to 18 decimals
        _recordDeposit(msg.sender, tokens, amount);

        totalUsdcRaised += amount;

        // Calculate Splits
        uint256 referralShare = 0;
        if (referrer != address(0) && referrer != msg.sender) {
            referralShare = (amount * REFERRAL_BIPS) / BIPS_DIVISOR;
            referralRewardsUsdc[referrer] += referralShare;
            usdcToken.safeTransfer(referrer, referralShare);
            emit ReferralPaid(referrer, msg.sender, referralShare, false);
        }

        uint256 jackpotShare = (amount * JACKPOT_BIPS) / BIPS_DIVISOR;
        usdcJackpotPool += jackpotShare;

        uint256 treasuryShare = amount - referralShare - jackpotShare;
        usdcToken.safeTransfer(treasuryWallet, treasuryShare);

        // Update Jackpot Timer if eligible
        if (amount >= minUsdcJackpotEligibility) {
            _touchJackpot(msg.sender);
        }

        emit DepositUSDC(msg.sender, amount, tokens, referrer);
    }

    // =========================================================================
    // GAMIFICATION & INTERNAL LOGIC
    // =========================================================================

    function _touchJackpot(address buyer) internal {
        lastBuyer = buyer;
        jackpotDeadline = block.timestamp + JACKPOT_DURATION;
        emit JackpotReset(buyer, jackpotDeadline);
    }

    function _checkAndProcessJackpot() internal {
        if (block.timestamp > jackpotDeadline && lastBuyer != address(0)) {
            _distributeJackpot();
        }
    }

    /**
     * @notice Manually claim jackpot if timer expires without new deposits
     */
    function claimJackpot() external nonReentrant {
        require(block.timestamp > jackpotDeadline, "JACKPOT_NOT_EXPIRED");
        require(lastBuyer != address(0), "NO_LAST_BUYER");
        _distributeJackpot();
    }

    function _distributeJackpot() internal {
        address winner = lastBuyer;
        uint256 ethWin = ethJackpotPool;
        uint256 usdcWin = usdcJackpotPool;

        // Reset state before transfer to prevent reentrancy
        ethJackpotPool = 0;
        usdcJackpotPool = 0;
        lastBuyer = address(0);
        jackpotDeadline = block.timestamp + JACKPOT_DURATION;

        if (ethWin > 0) {
            (bool success, ) = payable(winner).call{value: ethWin}("");
            require(success, "ETH_JACKPOT_PAYOUT_FAILED");
        }

        if (usdcWin > 0) {
            usdcToken.safeTransfer(winner, usdcWin);
        }

        emit JackpotClaimed(winner, ethWin, usdcWin);
    }

    function _recordDeposit(address user, uint256 tokenAmount, uint256 usdValue) internal {
        userTokensAllocated[user] += tokenAmount;
        totalTokensAllocated += tokenAmount;

        userUsdValueContributed[user] += usdValue;
        _updateBoardroom(user, userUsdValueContributed[user]);
    }

    function _updateBoardroom(address user, uint256 totalUsdValue) internal {
        // Check if user is already in leaderboard
        int256 existingIndex = -1;
        for (uint256 i = 0; i < 10; i++) {
            if (topBoardroom[i].user == user) {
                existingIndex = int256(i);
                break;
            }
        }

        if (existingIndex >= 0) {
            topBoardroom[uint256(existingIndex)].usdValue = totalUsdValue;
        } else if (totalUsdValue > topBoardroom[9].usdValue) {
            topBoardroom[9] = LeaderboardEntry(user, totalUsdValue);
        } else {
            return; // Not high enough for leaderboard
        }

        // Sort Top 10 (Insertion Sort)
        for (uint256 i = 0; i < 10; i++) {
            for (uint256 j = i + 1; j < 10; j++) {
                if (topBoardroom[j].usdValue > topBoardroom[i].usdValue) {
                    LeaderboardEntry memory temp = topBoardroom[i];
                    topBoardroom[i] = topBoardroom[j];
                    topBoardroom[j] = temp;
                }
            }
        }

        emit BoardroomUpdated(user, totalUsdValue);
    }

    // =========================================================================
    // CIRCUIT BREAKER & ADMIN CONTROLS
    // =========================================================================

    function toggleCircuitBreaker(bool _paused) external onlyOwner {
        paused = _paused;
        emit CircuitBreakerToggled(_paused);
    }

    function setTxLimits(uint256 _maxEth, uint256 _maxUsdc) external onlyOwner {
        maxEthPerTx = _maxEth;
        maxUsdcPerTx = _maxUsdc;
    }

    function setTreasury(address payable _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "INVALID_ADDRESS");
        treasuryWallet = _newTreasury;
    }

    // View helper for frontend leaderboard state
    function getBoardroom() external view returns (LeaderboardEntry[10] memory) {
        return topBoardroom;
    }
}
