# IRE security scan — 2026-08-27

Scope: Go node, genesis/configuration, CLI surface, and both CosmWasm contract wrappers. This is a source review and local build/test pass, not an independent professional audit.

## Remediated

### Production CLI exposed a destructive in-place testnet command

The generated `in-place-testnet` command rewrites validator state and calls `BankKeeper.MintCoins` to fund local test accounts. It requires local node-store access, so it was not remotely exploitable through the public RPC, but exposing it in the normal production binary conflicts with IRE's fixed-supply and operational-safety goals.

Remediation: the command is no longer registered in `cmd/ire-blockchaind/cmd/commands.go`.

### Both contract wrappers initially failed to compile

The CW20 wrapper referenced a private upstream type, and the CW721 wrapper used incompatible upstream generic types. Both were corrected and validated by the workspace tests and release Wasm build.

## Verified controls

- The active local `ire-1` node is synced and has one bonded validator.
- REST reports exactly `1000000000000000000 uire` and zero inflation.
- Sentinel independently checks these values, writes private local reports, and has no transaction, key, configuration, or deployment capability.
- The CW20 wrapper strips any supplied minter at instantiation. Contract immutability still depends on deployment with `--no-admin`.

## Launch risks that remain

- A single validator is not a public mainnet security model. Obtain independently operated validators before launch.
- The retained Cosmos mint module has a module account with the standard Minter permission. Current production block logic does not invoke it, but any future source upgrade must preserve the no-op mint function and should receive independent review.
- The CW721 contract intentionally keeps a configurable collection minter; secure that key or replace the contract with a capped-mint design before using it for scarce assets.
- No public chain, validator set, bridge, DNS domain, key-ceremony process, or external audit has been completed yet.
