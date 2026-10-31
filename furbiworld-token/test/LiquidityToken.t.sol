// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {LiquidityToken} from "../src/LiquidityToken.sol";

interface IRouter {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin, address[] calldata path, address to, uint256 deadline
    ) external payable;
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline
    ) external;
    function WETH() external view returns (address);
}

interface IPair {
    function balanceOf(address) external view returns (uint256);
    function getReserves() external view returns (uint112, uint112, uint32);
    function token0() external view returns (address);
}

contract LiquidityTokenTest is Test {
    LiquidityToken token;
    IRouter router;
    address weth;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    function _deploy(bytes memory code) internal returns (address a) {
        assembly { a := create(0, add(code, 0x20), mload(code)) }
        require(a != address(0), "deploy failed");
    }

    function _code(string memory name) internal view returns (bytes memory) {
        return vm.parseBytes(vm.readFile(string.concat("uniswap-build/", name, ".hex")));
    }

    function setUp() public {
        weth = _deploy(_code("WETH9"));
        address factory = _deploy(abi.encodePacked(_code("UniswapV2Factory"), abi.encode(address(this))));
        router = IRouter(_deploy(abi.encodePacked(_code("UniswapV2Router02"), abi.encode(factory, weth))));

        token = new LiquidityToken("Test Token", "TEST", 1_000_000_000, 0, address(router));
        token.launch{value: 0.04 ether}(); // ~$100 of ETH
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function _buy(address who, uint256 eth) internal {
        address[] memory p = new address[](2);
        p[0] = weth; p[1] = address(token);
        vm.prank(who);
        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: eth}(0, p, who, block.timestamp);
    }

    function _sell(address who, uint256 amt) internal {
        address[] memory p = new address[](2);
        p[0] = address(token); p[1] = weth;
        vm.startPrank(who);
        token.approve(address(router), amt);
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(amt, 0, p, who, block.timestamp);
        vm.stopPrank();
    }

    function _wethReserve() internal view returns (uint256) {
        IPair pr = IPair(token.pair());
        (uint112 r0, uint112 r1,) = pr.getReserves();
        return pr.token0() == weth ? r0 : r1;
    }

    function test_launch_locksLpAndRenounces() public view {
        IPair pr = IPair(token.pair());
        assertGt(pr.balanceOf(DEAD), 0, "LP not at dead");
        assertEq(pr.balanceOf(address(this)), 0, "deployer holds LP");
        assertEq(token.owner(), address(0), "not renounced");
        assertTrue(token.launched());
        assertEq(_wethReserve(), 0.04 ether);
    }

    function test_cannotLaunchTwice() public {
        vm.expectRevert(); // owner is now zero
        token.launch{value: 1 ether}();
    }

    function test_buyTakesOnePercent() public {
        uint256 before = token.balanceOf(address(token));
        _buy(alice, 0.001 ether);
        uint256 got = token.balanceOf(alice);
        uint256 fee = token.balanceOf(address(token)) - before;
        assertGt(fee, 0);
        // fee == 1% of gross amount out (gross = got + fee)
        assertApproxEqAbs(fee * 100, got + fee, 100);
    }

    function test_sellTakesOnePercent() public {
        _buy(alice, 0.001 ether);
        uint256 bal = token.balanceOf(alice);
        uint256 before = token.balanceOf(address(token));
        _sell(alice, bal);
        assertEq(token.balanceOf(address(token)) - before, bal / 100);
    }

    function test_walletTransferIsFree() public {
        _buy(alice, 0.001 ether);
        uint256 bal = token.balanceOf(alice);
        vm.prank(alice);
        token.transfer(bob, bal);
        assertEq(token.balanceOf(bob), bal);
    }

    function test_feesGrowLockedLiquidity() public {
        IPair pr = IPair(token.pair());
        uint256 lpBefore = pr.balanceOf(DEAD);

        for (uint256 i; i < 40; i++) {
            _buy(alice, 0.01 ether);
            _sell(alice, token.balanceOf(alice));
        }

        assertGt(token.totalEthToLiquidity(), 0, "no liquidity added");
        assertGt(pr.balanceOf(DEAD), lpBefore, "locked LP did not grow");
        emit log_named_uint("ETH recycled into pool (wei)", token.totalEthToLiquidity());
        emit log_named_uint("tokens recycled into pool", token.totalTokensToLiquidity());
    }

    function test_creatorShareCapped() public {
        vm.expectRevert(LiquidityToken.BadCreatorShare.selector);
        new LiquidityToken("X", "X", 1e9, 1_001, address(router));
    }

    function test_badRouterReverts() public {
        vm.expectRevert();
        new LiquidityToken("X", "X", 1e9, 0, address(0xBEEF));
    }
}
