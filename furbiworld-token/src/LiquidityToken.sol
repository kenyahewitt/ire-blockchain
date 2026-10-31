// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IUniswapV2Factory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

interface IUniswapV2Router02 {
    function factory() external view returns (address);
    function WETH() external view returns (address);
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

/// @title LiquidityToken
/// @notice ERC-20 with a fixed 1% fee on every buy and sell through its Uniswap V2 pool.
///         The fee is collected by this contract and periodically turned back into
///         pool liquidity (half swapped to ETH, both halves added to the pool).
///         LP tokens from every add go to the dead address, so that liquidity is locked forever.
///
///         - Fee is hard-coded at 1%. It cannot be raised, by anyone, ever.
///         - Wallet-to-wallet transfers are fee-free.
///         - No mint, no blacklist, no max-tx, no pause.
///         - Ownership exists only to call launch() once; launch() renounces it.
contract LiquidityToken is ERC20, Ownable {
    uint256 public constant FEE_BPS = 100; // 1.00%
    uint256 private constant BPS = 10_000;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    IUniswapV2Router02 public immutable router;
    address public immutable pair;
    address public immutable weth;
    uint256 public immutable swapThreshold; // fee tokens needed before a liquidity add

    bool public launched;
    bool private inSwap;

    uint256 public totalFeesCollected;
    uint256 public totalTokensToLiquidity;
    uint256 public totalEthToLiquidity;

    event Launched(uint256 tokens, uint256 eth, uint256 liquidity);
    event LiquidityAdded(uint256 tokens, uint256 eth, uint256 liquidity);

    error AlreadyLaunched();
    error NoEth();
    error BadCreatorShare();

    modifier lockSwap() {
        inSwap = true;
        _;
        inSwap = false;
    }

    /// @param name_        token name
    /// @param symbol_      token symbol
    /// @param supply       whole tokens (no decimals), e.g. 1_000_000_000
    /// @param creatorBps   share minted to deployer, max 10% (1000). Rest goes to the pool.
    /// @param router_      Uniswap V2 Router02 on the target chain
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply,
        uint256 creatorBps,
        address router_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        if (creatorBps > 1_000) revert BadCreatorShare();

        router = IUniswapV2Router02(router_);
        weth = router.WETH(); // reverts if router_ is not a V2 router
        pair = IUniswapV2Factory(router.factory()).createPair(address(this), weth);

        uint256 total = supply * 10 ** decimals();
        swapThreshold = total / 2_000; // 0.05% of supply per liquidity add

        uint256 creatorAmt = (total * creatorBps) / BPS;
        if (creatorAmt > 0) _mint(msg.sender, creatorAmt);
        _mint(address(this), total - creatorAmt);

        _approve(address(this), router_, type(uint256).max);
    }

    /// @notice One-time: seeds the pool with every token held by this contract plus msg.value ETH,
    ///         sends the LP tokens to the dead address, then renounces ownership.
    function launch() external payable onlyOwner {
        if (launched) revert AlreadyLaunched();
        if (msg.value == 0) revert NoEth();
        launched = true;

        uint256 tokens = balanceOf(address(this));
        (uint256 t, uint256 e, uint256 liq) =
            router.addLiquidityETH{value: msg.value}(address(this), tokens, tokens, msg.value, DEAD, block.timestamp);

        emit Launched(t, e, liq);
        renounceOwnership();
    }

    function _update(address from, address to, uint256 value) internal override {
        bool isTrade = (from == pair || to == pair);
        bool exempt = inSwap || from == address(this) || to == address(this);

        if (isTrade && !exempt && launched) {
            // Sell: convert accumulated fees into liquidity before this sell hits the pool.
            if (to == pair) _maybeLiquify();

            uint256 fee = (value * FEE_BPS) / BPS;
            if (fee > 0) {
                super._update(from, address(this), fee);
                totalFeesCollected += fee;
                value -= fee;
            }
        }
        super._update(from, to, value);
    }

    function _maybeLiquify() private {
        if (balanceOf(address(this)) < swapThreshold) return;
        _liquify(swapThreshold);
    }

    function _liquify(uint256 amount) private lockSwap {
        uint256 half = amount / 2;
        uint256 rest = amount - half;

        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = weth;

        // Never let a router problem block a user's sell.
        try router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            half, 0, path, address(this), block.timestamp
        ) {} catch {
            return;
        }

        uint256 ethBal = address(this).balance;
        if (ethBal == 0) return;

        try router.addLiquidityETH{value: ethBal}(address(this), rest, 0, 0, DEAD, block.timestamp) returns (
            uint256 t, uint256 e, uint256 liq
        ) {
            totalTokensToLiquidity += t;
            totalEthToLiquidity += e;
            emit LiquidityAdded(t, e, liq);
        } catch {}
    }

    /// @notice Anyone can trigger a liquidity add once fees reach the threshold.
    function liquify() external {
        require(launched && !inSwap, "not ready");
        uint256 bal = balanceOf(address(this));
        require(bal >= swapThreshold, "below threshold");
        _liquify(swapThreshold);
    }

    receive() external payable {}
}
