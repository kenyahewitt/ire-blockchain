# NINJ mapping is not a bridge

`ire-1` is a public testnet with one validator. Do not put real value on it.

This document records an **inscription mapping only**. It is **not** a minted
bank denom and **not** a 1:1 bridge. Do not treat tick `NINJ` as the Robinhood
token, and do not send source-chain deposits to IRE until mint/burn exists.

## Source token (Robinhood EVM)

- Name / tick (source): Ninjaagent ERC-20
- Address: `0x5Ce837Cf242e763F9b0E9A87AA7907C3f5DD083C`
- Chain: Robinhood EVM
- Market: Uniswap v3 vs WETH

That contract lives on Robinhood EVM. IRE does not hold it, wrap it, or
redeem it.

## IRE inscription tick `NINJ`

Tick `NINJ` is a memo inscription (`ire-insc`) that **points at** the source
address. The JSON is data on an ordinary `1uire` self-send. It does not create
a bank denom, does not mint supply, and does not move ERC-20 balances.

On-chain mapping (memo carrier, 256-character limit):

```
IREINSCRIBE1 application/json {"p":"ire-insc","op":"deploy","tick":"NINJ","max":"21000000","lim":"1000"}
```

```
IREINSCRIBE1 application/json {"p":"ire-insc","op":"peg","tick":"NINJ","x":"0x5ce837cf242e763f9b0e9a87aa7907c3f5dd083c"}
```

Landed mapping inscriptions:

| op | height | code | inscription id |
| --- | --- | --- | --- |
| deploy | 21637 | 0 | `da4db230d4c6581b7143a47bb110288403c0bf7832766ae3750e8bc08fd2d0fei0` |
| peg | 21640 | 0 | `91f8bb1758fb6a3fe93b65709856550ee817cdc4074e6af8d3a410e1e36af4e9i0` |

Tx hashes: deploy `DA4DB230D4C6581B7143A47BB110288403C0BF7832766AE3750E8BC08FD2D0FE`,
peg `91F8BB1758FB6A3FE93B65709856550EE817CDC4074E6AF8D3A410E1E36AF4E9`.

## What a real peg would need

The running `ired` binary cannot mint a new denom:

- no `x/tokenfactory` (or equivalent mint/burn module)
- no CosmWasm (`noMint` from the chain's point of view: wasm is not in the binary)
- bank can only send existing denoms (`uire`)

A working peg is **lock-on-source / mint-on-IRE** (and burn-on-IRE / unlock-on-source
the other way). That requires mint authority on IRE first. Until then:

1. Do **not** accept Robinhood-chain (or any source-chain) deposits.
2. Do **not** deploy an EVM lock contract as if redemption existed.
3. Do **not** ship a swap UI that trades `NINJ` as if it were the Robinhood token.

When mint exists, upgrade the **Mac validator and the VPS seed together** so
they stay on the same binary and modules. A one-sided upgrade will halt or
split the network.

Proposed IRE denom later (not live): `uninj` with 6 decimals, or similar. That
name is a placeholder until tokenfactory (or equivalent) ships.

## Related

- Inscription carrier and `{txhash}i{index}` ids: [INSCRIPTIONS.md](INSCRIPTIONS.md)
- Create page (command recipes only; this host does not broadcast): `/create/`
