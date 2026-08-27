# Security model — what's actually improved, and what isn't

## Genuinely improved vs. a typical fast-launched fork

1. **Protocol inflation disabled.** The app supplies a no-op mint
   begin-block function and the genesis mint parameters are set to zero. The
   standard Cosmos mint module is retained for compatible state/query wiring,
   so this is a source-level invariant that must be protected by review and
   tests for every future release.
2. **No contract admin key.** Deploying CosmWasm contracts with `--no-admin`
   means there's no `MsgMigrateContract` that a compromised or malicious
   deployer key could use to swap the logic after people have funds in it.
3. **Instant finality.** CometBFT blocks are final on commit — no reorg risk,
   which removes a class of double-spend attacks possible on probabilistic-
   finality PoW chains during low-hashrate periods.
4. **Slashing for misbehavior.** Validators that double-sign or go offline
   lose staked funds automatically — this is stock Cosmos SDK `x/slashing`,
   not custom, but worth having explicitly rather than assumed.
5. **Destructive in-place testnet command disabled.** The generated command
   that rewrites validator state and mints local testing funds is not exposed
   from the production CLI.

## Not improved by this design — still real risks

- **Rust/CosmWasm contract bugs.** Immutable code is only as safe as what you
  wrote. Immutability means a bug found post-deploy **cannot be patched** —
  this cuts both ways. Audit before deploying with `--no-admin`, since you
  don't get a second chance.
- **Validator centralization.** If 5 people run all the validators, "PoS
  security" is theater. Real decentralization needs genuine incentive design
  and community buy-in, not just code.
- **Bridges to other chains (ETH, BTC, etc.).** If IRE ever bridges assets
  in/out, the bridge contract is a new, separate attack surface with its own
  history of nine-figure hacks industry-wide. Treat any future bridge as a
  from-scratch security project.
- **Phishing / key theft / social engineering.** No blockchain design fixes
  this. Wallet UX and user education matter more here than protocol choice.
- **Regulatory risk.** A "fixed supply, tradable token" is very likely to be
  treated as a security or commodity depending on jurisdiction. That's a
  legal question, not a technical one — get real legal advice before public
  distribution, especially before any public sale.

## Recommended process before mainnet

1. Testnet with faucet-only tokens, run for real by outside validators
2. Third-party smart contract audit (the CW20/CW721 contracts here are
   starting points, not audited)
3. Bug bounty period
4. Only then: mainnet genesis with real value
