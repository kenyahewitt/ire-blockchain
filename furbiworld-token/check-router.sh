#!/usr/bin/env bash
# Confirms $ROUTER is a real Uniswap V2 router on Robinhood Chain before you spend anything.
set -euo pipefail
source .env
RH_WETH=0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73

chain_id=$(cast chain-id --rpc-url "$RPC_URL")
echo "chainId: $chain_id   (want 4663)"
[ "$chain_id" = "4663" ] || { echo "FAIL: RPC is not Robinhood Chain mainnet"; exit 1; }
code=$(cast code "$ROUTER" --rpc-url "$RPC_URL")
[ "$code" = "0x" ] && { echo "FAIL: no contract at ROUTER"; exit 1; }
weth=$(cast call "$ROUTER" "WETH()(address)" --rpc-url "$RPC_URL")
fac=$(cast call "$ROUTER" "factory()(address)" --rpc-url "$RPC_URL")
echo "router.WETH():    $weth"
echo "router.factory(): $fac"
echo "factory pairs:    $(cast call "$fac" "allPairsLength()(uint256)" --rpc-url "$RPC_URL")"
if [ "$(echo "$weth" | tr A-F a-f)" = "$(echo "$RH_WETH" | tr A-F a-f)" ]; then
  echo "OK: router uses Robinhood Chain WETH"
else
  echo "FAIL: router WETH does not match Robinhood Chain WETH"; exit 1
fi
