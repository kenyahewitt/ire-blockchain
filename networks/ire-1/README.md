# ire-1 network files

**Local testnet.** Chain ID `ire-1`. Denom `uire` (6 decimals). Not mainnet. Do not send real money.

## Share this folder, not `.ire/`

This directory is safe to publish. It contains the genesis document other nodes need.

Never publish:

- `.ire/config/priv_validator_key.json` (this validator's consensus key)
- `.ire/config/node_key.json` (this node's P2P identity)
- `.ire/data/` (chain state)

Those stay on the machine that already runs the seed validator.

## Seed peer

Replace `SEED_HOST` with a publicly reachable IP or DNS name for a node listening on TCP 26656:

```
07a96f9e703104fb9d03e7da7211ca35cb9089d7@SEED_HOST:26656
```

Genesis sha256: `8f740001b22380f190d9eacf77cb7f6650599c688df0d336a9afc19a0e9d292a`

Build the same `ired` as the seed (`make build`). Prefer commit `a762557` if you need to match the currently running binary.
