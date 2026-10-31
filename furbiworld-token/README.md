# FurbiWorld (FURBI) on Robinhood Chain

FurbiWorld is a fixed-supply ERC-20 with a hard-coded 1% fee on buys and sells through its Uniswap V2 pool. Fee tokens are periodically paired with ETH and added to liquidity. Wallet-to-wallet transfers have no fee.

## Live deployment

| Item | Address or transaction |
| --- | --- |
| Token | [`0xdc39395c2284ccbf5186391d185fd5dea2be0474`](https://robinhoodchain.blockscout.com/address/0xdc39395c2284ccbf5186391d185fd5dea2be0474) |
| Uniswap V2 pair | [`0xE52AE48782505bC922716d131Ba35BD1007e8648`](https://robinhoodchain.blockscout.com/address/0xE52AE48782505bC922716d131Ba35BD1007e8648) |
| Launch transaction | [`0xd9352d17…082170f`](https://robinhoodchain.blockscout.com/tx/0xd9352d174f9618b39a8b7189f288d32bfc2ce84630c2505acedb454ab082170f) |
| Chain | Robinhood Chain, ID 4663 |
| Supply | 1,000,000,000 FURBI |
| Initial pool | 0.048 ETH plus 1,000,000,000 FURBI |
| V2 router | `0x89e5db8b5aa49aa85ac63f691524311aeb649eba` |

The launch transaction succeeded on October 31, 2026. It shows the initial LP tokens sent to `0x000000000000000000000000000000000000dEaD`. A live `owner()` read returns the zero address. [Sourcify verified the deployed source as an exact match](https://sourcify.dev/#/lookup/0xdc39395c2284ccbf5186391d185fd5dea2be0474?chainId=4663). The contract has not had an independent audit.

## Repository

- `src/LiquidityToken.sol`: Solidity token source
- `test/LiquidityToken.t.sol`: eight local tests using Uniswap V2 bytecode
- `script/Launch.s.sol`: original deployment script, retained for reproducibility; **do not rerun for the live token**
- `site/index.html`: public swap and token information page, fixed to the live contract

Install dependencies with `npm ci` and `forge install foundry-rs/forge-std --no-git`, then run `forge test -vv`. `.env`, build outputs, transaction broadcasts, and dependencies are excluded from Git. No wallet key is needed to build or host the site.

## Trading and risks

The site sends buy and sell transactions through the Robinhood Chain Uniswap V2 router. It estimates pool price impact and blocks trades above 5% estimated impact. Every transaction needs wallet confirmation and network gas. A 1% token fee and pool price impact affect the result. Auto-liquidity swaps can move the price before a sell executes. Fees sent to the contract may remain there if a liquidity add fails, and V2 liquidity sent to the dead address cannot be withdrawn. The token and website are unaudited; test with small amounts. External markets may continue to warn about low liquidity, few holders, or low volume until those conditions change.
