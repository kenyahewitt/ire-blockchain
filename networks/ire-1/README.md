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

Public seed (non-validator) in Falkenstein:

```
63c21a2befb884a958cdc88a1c78788eae42bf5b@91.99.1.9:26656
```

Genesis sha256: `20ddba9d70780a09c841287345272cfb82a94c9f67cb98f6b8aa4ec2058a6ea8`

Build the same `ired` as the seed (`make build`). Prefer commit `a762557` if you need to match the currently running binary.
