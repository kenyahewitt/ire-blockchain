# IRE blockchain

> **Local/public testnet only (`ire-1`).** A public seed exists (Falkenstein), but this is still one validator, with no independent operator set and no external audit. Do not send real money, list a token, or treat this as mainnet.

Public protocol docs: [https://illustrious-banoffee-92cafd.netlify.app](https://illustrious-banoffee-92cafd.netlify.app/). That host is documentation only. It is not a seed, RPC, or P2P endpoint. What the chain does, usage [points](https://illustrious-banoffee-92cafd.netlify.app/points/), [profiles](https://illustrious-banoffee-92cafd.netlify.app/id/), and the [IRE Vault](https://illustrious-banoffee-92cafd.netlify.app/vault/) (community pool fee sink) are on that site. See [docs/VAULT.md](docs/VAULT.md), [docs/POINTS.md](docs/POINTS.md), [docs/PROFILE.md](docs/PROFILE.md).

IRE is a Cosmos SDK proof-of-stake chain. Validators produce blocks by signing consensus votes; this is the appropriate equivalent of “mining” for IRE and does not use GPU/ASIC proof-of-work.

## Current local network

This repository builds the `ired` node. `ire-1` is a public testnet with one local validator. A public seed is published (see [Join as a node](#join-as-a-node-or-validator) and [`networks/ire-1/`](networks/ire-1/)). The local configuration uses chain ID `ire-1`, base denomination `uire` (6 decimals), one trillion IRE of genesis supply, a bonded local validator, and no protocol inflation. The binary supplies a no-op mint begin-block function; the standard mint module remains available for state/query compatibility, but does not issue new coins.

```sh
make build
./build/ired start --home .ire
```

Check the node with:

```sh
curl -s http://127.0.0.1:26657/status
curl -s 'http://127.0.0.1:1317/cosmos/bank/v1beta1/supply/by_denom?denom=uire'
```

## IRE Sentinel

[IRE Sentinel](agent/README.md) is the local, read-only chain-security agent. It checks the local node’s chain ID, sync status, supply, inflation, and validator health, then writes timestamped reports. It cannot sign transactions, access node keys, change node configuration, or deploy contracts. It can use GPT-5.6 Sol for a concise evidence-based assessment after you store your own OpenAI project key in the macOS Keychain.

```sh
npm run sentinel:no-ai
```

## Smart contracts

The CosmWasm contracts live in `contracts/`. Run their tests with:

```sh
cargo test --workspace
```

Build Wasm artifacts with the CosmWasm-compatible linker setting:

```sh
RUSTFLAGS='-C link-arg=--allow-undefined' cargo build --workspace --release --target wasm32-unknown-unknown
```

Deploy immutable contracts with `--no-admin`. The CW20 wrapper removes any configured minter at instantiation. The CW721 contract intentionally permits its configured collection minter to issue NFTs; choose and protect that minter before deployment.

## Join as a node or validator

A non-validator public seed is published:

```
persistent_peers = "63c21a2befb884a958cdc88a1c78788eae42bf5b@91.99.1.9:26656"
```

Published network files live in [`networks/ire-1/`](networks/ire-1/). That folder is what you share: genesis and the seed peer template. Do not share `.ire/` (validator keys).

Full join and `create-validator` steps: [docs/VALIDATOR.md](docs/VALIDATOR.md).

## Mainnet launch gate

`ire-1` is a public testnet with one validator — not mainnet. A public seed now exists. Still missing: independent validators, a public RPC/domain, a final allocation, a treasury multisig, an external audit, and legal. Do not put real value on this network until those gates are complete.
