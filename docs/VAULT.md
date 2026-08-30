# IRE Vault (Volt)

The IRE vault is the Cosmos SDK **community pool** (`x/distribution`). Nickname: **Volt**. It is not a company wallet, not a CosmWasm contract, and not a new `ire1` invented for the brand.

`ire-1` is a public testnet with one validator. Do not put real value on it.

Live board: `/vault/` on the docs site. That page only GETs `/rpc/` and `/api/`. It never signs.

## Addresses

| Role | Address |
|---|---|
| Vault (module `distribution`) | `ire1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8nanfuy` |
| Fee collector (emptied each block) | `ire17xpfvakm2amg962yls6f84z3kell8c5lym547x` |
| Gov authority | `ire10d07y265gmmuvt4z0w9aw880jnsr700jwqysrg` |

Do not invent a second treasury address.

## Fee flow

1. A tx pays gas in `uire` (`--gas-prices 0.001uire`).
2. Fees land in `fee_collector`.
3. Begin-blocker moves them into distribution.
4. `community_tax` is the fraction that stays in the vault. The rest is validator rewards (the single `ire-1` validator today).
5. Genesis `community_tax` is `0.02` (2% vault / 98% validators).
6. Proposal [`networks/ire-1/proposals/001-community-tax-100.json`](../networks/ire-1/proposals/001-community-tax-100.json) sets `community_tax` to `1.0` so **100% of network gas** stays in the vault.

There is no protocol inflation. After any pre-minted rewards allocation is used, **vault gas is what pays rewards**.

## Pay in

Anyone can add `uire`:

```sh
ired tx distribution fund-community-pool 1000000uire \
  --chain-id ire-1 \
  --from <key> \
  --gas-prices 0.001uire \
  --home "$HOME/.ire" \
  --yes
```

This is a donation to the pool, not a deposit account.

## Pay out (rewards, airdrops, fees)

Spends are governance `CommunityPoolSpend` (or equivalent v1 message) to a named `ire1`. Typical uses:

- **Rewards** — validator or staker payouts once fees, not inflation, are the source.
- **Airdrops** — explicit recipient lists. No automatic spray.
- **Fees** — seed / RPC / explorer ops paid to an operator address.

Voting period is `172800s`. Min deposit is `10000000uire` (10 IRE). The sole validator can pass a proposal today; that is a testnet fact, not a mainnet control.

## Raise community_tax to 100%

After this file is on `main`:

```sh
ired tx gov submit-proposal networks/ire-1/proposals/001-community-tax-100.json \
  --from <key> \
  --chain-id ire-1 \
  --gas-prices 0.001uire \
  --home "$HOME/.ire" \
  --yes
```

Vote yes, wait for `voting_period`, then confirm:

```sh
curl -s http://127.0.0.1:1317/cosmos/distribution/v1beta1/params
```

Do not halt the chain. This is a param change, not a binary upgrade. It is **not** the tokenfactory cutover.

Tradeoff: at 100%, the validator earns **no** gas commission until gov spends rewards back out of the vault. That is the point of a chain-owned fee sink on a 1-validator testnet.

## Public proxy

`deploy/nginx/ire-explorer.conf` GET-allowlists `cosmos/distribution` so `/api/cosmos/distribution/v1beta1/community_pool` and `/params` work. Until that config is loaded on the VPS, `/vault/` reads the vault via the already-open bank balances path for `ire1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8nanfuy`.

Reload nginx on the seed from a machine that already has SSH (do not copy validator or SSH keys into git):

```sh
sudo install -m 644 deploy/nginx/ire-explorer.conf /etc/nginx/sites-available/ire-explorer
sudo nginx -t && sudo systemctl reload nginx
```

## What this is not

- Not a licensed broker or custodian.
- Not escrow for markets (see [MARKETS.md](MARKETS.md)).
- Not CosmWasm. Wasm is not in the running `ired` binary.
- Not `ire-mainnet-1`.
