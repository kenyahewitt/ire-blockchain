# Validator / node hardware notes

## Full validator (participates in consensus, stakes IRE)
- 4 CPU cores, 8GB RAM, 200GB SSD, stable internet — comparable to a $20-40/mo VPS
- No GPU or ASIC required — CometBFT consensus is vote-signing, not hashing

## Full non-validating node (syncs full chain state, doesn't stake)
- 2 CPU cores, 4GB RAM, 100GB+ SSD (grows over time — plan for pruning)
- This is realistic on something like a Raspberry Pi 4/5 for a moderate-throughput chain

## Light client (mobile/CPU-constrained, e.g., a phone wallet)
- CometBFT light clients verify block headers and validator signatures
  without downloading full chain state — this is the realistic "mobile"
  story: not mining, but trust-minimized verification of a small amount of
  data per block
- Cosmos SDK chains support this natively via the light client protocol

## Suggested `app.toml` tuning for lower resource nodes
```toml
[pruning]
pruning = "custom"
pruning-keep-recent = "100"
pruning-interval = "10"

[state-sync]
snapshot-interval = 1000
snapshot-keep-recent = 2
```
Pruning trades "can serve historical queries" for "smaller disk footprint" —
appropriate for validators that don't need to be full archive nodes.
