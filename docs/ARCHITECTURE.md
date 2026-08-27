# Architecture

## Why Cosmos SDK + CometBFT

| Concern | Cosmos SDK / CometBFT | Forked Geth (PoW) | From scratch |
|---|---|---|---|
| Low-power validation | Native — PoS voting, no hashing | Needs a custom PoW algo (RandomX-style) to be CPU-friendly at all | You build consensus from zero — highest risk of subtle bugs |
| Time to a running testnet | Weeks | Weeks–months (consensus rewrite) | Months–years |
| Audited primitives | Yes — IBC, staking, slashing, gov all battle-tested across hundreds of live chains | Ethereum's own code is audited, but PoW retrofitting isn't | None |
| Smart contracts | CosmWasm (Rust, sandboxed, no reentrancy-by-default class of bugs) | Solidity/EVM (mature but reentrancy, unbounded gas footguns are well-known attack classes) | Your choice — but you're now also maintaining a VM |
| Sovereign control over supply/consensus | Full | Full | Full |

CometBFT gives you **instant finality** (a block is final the moment it's
committed — no "wait 6 confirmations" ambiguity like Bitcoin/Ethereum PoW),
which is also a genuine safety improvement: no reorg risk once a block lands.

## Module layout (Cosmos SDK apps are composed of modules)

- `x/auth` — accounts (stock Cosmos SDK)
- `x/bank` — token transfers (stock, but see `x/ire-mint` below for supply cap)
- `x/staking` — validator bonding/unbonding (stock)
- `x/slashing` — penalizes double-signing/downtime (stock)
- `x/gov` — on-chain governance for parameter changes (stock — but supply cap
  itself is NOT a governable param, see TOKENOMICS.md)
- `x/wasm` (CosmWasm) — smart contract execution
- `x/ire-mint` — **custom**, replaces the standard `x/mint` inflation module

## Validator hardware reality

CometBFT validators for a moderate-throughput chain run comfortably on:
- 2-4 CPU cores, 4-8GB RAM, SSD storage
- No GPU, no ASIC

This is why "CPU/mobile" framing works for *validating* — it does not mean
someone mines blocks by burning phone battery on hash puzzles (that model,
used by projects like Pi Network, generally isn't real PoW; it's usually a
centralized ledger with a mining-themed UI). Full validating nodes on Cosmos
chains have run on Raspberry Pi hardware in testnets.

## What this design does NOT solve

Being honest about limits, since "fixing everything wrong with crypto" isn't
a real technical target:
- **Bridge/exchange risk** — most stolen funds in crypto history come from
  bridge and exchange hacks, not base-layer consensus flaws. This
  architecture doesn't make a future bridge automatically safe.
- **Key management** — a fixed-supply, immutable-contract chain still loses
  user funds the moment a private key leaks or a seed phrase is phished.
- **Validator decentralization** — the protocol can be perfectly designed and
  still end up with 3 validators controlling 90% of stake if nobody else
  bothers running a node. Decentralization is a social/economic outcome, not
  just code.
