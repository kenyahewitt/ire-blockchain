# IRE blockchain

IRE is a Cosmos SDK proof-of-stake chain. Validators produce blocks by signing consensus votes; this is the appropriate equivalent of “mining” for IRE and does not use GPU/ASIC proof-of-work.

## Current local network

This repository builds the `ired` node. The local configuration uses chain ID `ire-1`, base denomination `uire` (6 decimals), one trillion IRE of genesis supply, a bonded local validator, and no protocol inflation. The binary supplies a no-op mint begin-block function; the standard mint module remains available for state/query compatibility, but does not issue new coins.

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

Published network files live in [`networks/ire-1/`](networks/ire-1/). That folder is what you share: genesis and the seed peer template. Do not share `.ire/` (validator keys).

Full join and `create-validator` steps: [docs/VALIDATOR.md](docs/VALIDATOR.md).

## Mainnet launch gate

`ire-1` is currently a local, single-validator network—not a public mainnet. A real mainnet requires independently operated validators, public seed/peer infrastructure, finalized genesis and upgrade governance, external security audit, monitoring/incident response, backups, and a staged public testnet. Do not put real value on this network until those gates are complete.
