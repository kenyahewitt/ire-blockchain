# x/ire-mint

Replaces the standard Cosmos SDK `x/mint` module. The standard module runs a
`BeginBlocker` every block that mints new tokens based on an inflation
schedule — that's the exact mechanism this design needs to NOT have.

## What this module does

**Nothing, on purpose.** It is registered in `app.go` so the module manager
and CLI don't error out expecting a mint module to exist, but its
`BeginBlocker` is a no-op and it exposes no `Msg` service — there is
literally no message type in the entire chain binary that results in new
`uire` being created after genesis.

## Implementation sketch (Go, for `x/ire-mint/module.go`)

```go
package ire_mint

import (
    sdk "github.com/cosmos/cosmos-sdk/types"
    "github.com/cosmos/cosmos-sdk/types/module"
)

// AppModule implements module.AppModule for x/ire-mint.
// Deliberately has no keeper methods that create coins, and no Msg service.
type AppModule struct{}

// BeginBlock intentionally does nothing — no inflation, no scheduled minting.
func (am AppModule) BeginBlock(ctx sdk.Context) {
    // no-op by design — do not add minting logic here.
    // If a future governance proposal wants to change monetary policy,
    // it requires a coordinated software upgrade / hard fork, not a
    // parameter change — this is the point.
}

// RegisterServices intentionally registers no Msg service.
// There is no MsgMint, no MsgInflate — nothing to call.
func (am AppModule) RegisterServices(cfg module.Configurator) {}
```

## Why a no-op module instead of just "not including x/mint"

Some Cosmos SDK plumbing (CLI genesis commands, some module manager
assumptions) expects a mint module interface to exist. Keeping an explicit,
documented no-op module is clearer for auditors than a series of deleted
imports scattered through `app.go` — anyone reviewing the code sees exactly
one file that says "minting is intentionally absent" rather than having to
prove a negative across the whole codebase.

## Auditing checklist for this guarantee

When you (or an auditor) verify the "supply can never change" claim, check:
- [ ] No `Msg` type anywhere in the chain implements coin creation via `bankKeeper.MintCoins`
- [ ] `x/ire-mint` `BeginBlock`/`EndBlock` are empty
- [ ] No CosmWasm contract has been granted the `x/wasm` "mint permission" hook (Cosmos SDK supports custom keeper bindings that could reintroduce minting via a contract — make sure none are wired up)
- [ ] Genesis `bank.supply` matches the intended 1 trillion IRE exactly, since that's the only place supply is ever set
