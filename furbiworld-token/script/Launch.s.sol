// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {LiquidityToken} from "../src/LiquidityToken.sol";

interface IRouterView {
    function WETH() external view returns (address);
    function factory() external view returns (address);
}

/// Deploys the token and seeds the pool in two transactions.
///
/// Env vars (see .env.example):
///   TOKEN_NAME, TOKEN_SYMBOL, TOKEN_SUPPLY, CREATOR_BPS, ROUTER, LAUNCH_ETH_WEI
contract Launch is Script {
    // Robinhood Chain mainnet WETH (docs.robinhood.com/chain/contracts)
    address constant RH_WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;

    function run() external {
        string memory name_ = vm.envString("TOKEN_NAME");
        string memory symbol_ = vm.envString("TOKEN_SYMBOL");
        uint256 supply = vm.envUint("TOKEN_SUPPLY");
        uint256 creatorBps = vm.envOr("CREATOR_BPS", uint256(0));
        address router = vm.envAddress("ROUTER");
        uint256 launchEth = vm.envUint("LAUNCH_ETH_WEI");

        // ---- safety checks before spending anything ----
        require(block.chainid == 4663, "not Robinhood Chain mainnet");
        require(router.code.length > 0, "ROUTER has no code on this chain");
        address w = IRouterView(router).WETH();
        address f = IRouterView(router).factory();
        require(f.code.length > 0, "router.factory() has no code");
        require(w == RH_WETH, "router WETH != Robinhood Chain WETH");

        console2.log("chainId      ", block.chainid);
        console2.log("router       ", router);
        console2.log("factory      ", f);
        console2.log("WETH         ", w);
        console2.log("launch ETH   ", launchEth);

        vm.startBroadcast();
        LiquidityToken token = new LiquidityToken(name_, symbol_, supply, creatorBps, router);
        token.launch{value: launchEth}();
        vm.stopBroadcast();

        console2.log("TOKEN        ", address(token));
        console2.log("PAIR         ", token.pair());
    }
}
