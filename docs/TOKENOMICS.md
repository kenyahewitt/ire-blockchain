# Tokenomics

## Supply

- **Denom**: `uire` (micro-IRE, 1 IRE = 1,000,000 `uire`, standard Cosmos SDK convention)
- **Max supply**: 1,000,000,000,000 IRE (1 trillion) — fixed forever
- **Mechanism**: the entire supply is minted exactly once, in the genesis
  block, and allocated per the distribution table below. After genesis, no
  code path in the chain can create new `uire`. This is enforced by
  **omitting** the `x/mint` module's periodic inflation logic entirely (see
  `x/ire-mint/README.md`) — there's no minting function to call, not even one
  gated behind governance.

## Why this is stronger than "we promise not to inflate it"

Many tokens claim a fixed supply but retain a mint function gated by
multisig/governance "just in case." That's a *policy* promise, not a
*protocol* guarantee — the code can still do it. Ire's Blockchain removes the
mint capability from the binary itself. Changing it would require a hard
fork that every validator would have to knowingly opt into — the same bar as
Bitcoin's 21M cap.

## Market cap note (important honesty check)

You mentioned a "max market cap of 1 trillion." That's not something a
blockchain can enforce — **market cap = circulating supply × market price**,
and price is set by whoever is willing to buy and sell, not by protocol code.
What you *can* enforce is the supply side (done above). If price rises,
market cap rises with it; no contract can cap that without literally halting
trading, which defeats the purpose of a tradable asset.

## Suggested initial distribution (edit to your actual plan)

| Allocation | % | Notes |
|---|---|---|
| Community/ecosystem fund | 30% | Grants, liquidity incentives |
| Validator/staking rewards pool | 25% | Pre-minted since there's no ongoing inflation — this pool pays staking rewards until exhausted, then rewards taper to transaction fees only |
| Team/founders | 15% | Should vest over 3-4 years, enforced by a vesting module, not a promise |
| Public sale / airdrop | 20% | However you plan to distribute to early users |
| Reserve | 10% | Held for future partnerships, exchange listings, etc. |

This table is a placeholder — the actual split is a product/business decision,
not a technical one. The important technical property is that whatever
numbers go in the genesis file are the permanent total.
