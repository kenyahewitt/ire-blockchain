# x/tokenfactory

Vendored from [`cosmos/tokenfactory` v0.53.5](https://github.com/cosmos/tokenfactory/tree/v0.53.5/x/tokenfactory)
(Osmosis-style, compiled against Cosmos SDK v0.53). CosmWasm bindings are **not**
included; wasm is not in the running `ired` binary.

This module mints and burns **new factory denoms** such as
`factory/<creator>/uninj`. It does **not** inflate `uire`. Native `uire` mint
remains the existing `noMint` no-op on `x/mint`.
