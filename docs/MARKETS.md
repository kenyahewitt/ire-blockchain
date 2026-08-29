# IRE prediction markets

Inscription-native prediction markets on `ire-1`. There is no IPFS, no
off-chain order book, and no escrow in the running `ired` binary. Every
open, bet, resolve, and AI analysis is a memo on an ordinary bank send.

`ire-1` is a public testnet with one validator. Do not put real value on it.

The live board is `/markets/` on the docs site. It only GETs same-origin
`/rpc/` (never broadcasts).

## Identifier

Same as [INSCRIPTIONS.md](INSCRIPTIONS.md): `{txhash}i{index}`. A typical
self-send is `{txid}i0`. The `m` field on buy / resolve / analyze points at
the market's open inscription id.

## Sub-protocol `ire-bet`

Memo form (Cosmos default max **256** characters, including the prefix):

```
IREINSCRIBE1 application/json {json}
```

Keep keys tiny. `p` is always `ire-bet`.

### open

```json
{"p":"ire-bet","op":"open","q":"ETF approved 2026?","o":["y","n"]}
```

Carrier: self-send `1uire`. The market id is this transaction's `{txhash}i0`.

### buy

```json
{"p":"ire-bet","op":"buy","m":"{txid}i0","s":"y","a":"1000000"}
```

`s` is the side (`y` or `n`). `a` is the pledged amount in `uire`. The bank
send should carry that same amount (to self or to a counterparty). The send
is only a public carrier — see [No escrow](#no-escrow).

### resolve

```json
{"p":"ire-bet","op":"resolve","m":"{txid}i0","w":"y"}
```

`w` is the winning side. This is a public claim, not an automatic payout.

### analyze

```json
{"p":"ire-bet","op":"analyze","m":"{txid}i0","y":65,"n":35,"note":"brief"}
```

AI (or human) analysis. `y` / `n` are stated percents. `note` must stay
short enough for the 256-character memo. This is **not** a trade.

## Fees — protocol fee is 0%

The cheapest path is **gas only**: `--gas-prices 0.001uire`. There is no
protocol take, no market fee, and no extra treasury address.

Cosmos gas currently pays the validator. The chain “wallet” is the
**community pool** (`x/distribution`). A later governance parameter
`community_tax` can send 100% of gas to the community pool so fees stay
with the chain, not a company. Do not invent a new treasury address.

## No escrow

This binary has no `x/markets` module and **wasm is not in the running
binary**. A buy inscription is a **public pledge** plus an ordinary
`MsgSend`. The chain does not lock funds, match orders, or pay winners.

Honest settlement — locking stake, resolving payouts, punishing lies —
is a future `x/markets` module or a CosmWasm contract after wasm is in
the binary. Until then, treat inscribed amounts as signals, not custody.

## What you may list

Anything people want to bet on that is **not crime, violence, or involving
minors**.

## AI analyst, not an autotrader

The AI agent is an **analyst**. It may post `op:analyze` inscriptions (copy
the CLI from `/markets/`, sign with your own key). It does **not** spend
the validator key, does not auto-bet, and does not run unsupervised as a
trading bot. The docs site holds no API keys.

## Indexer (docs site)

`/markets/` is static. It reconstructs the board by:

1. `GET /rpc/status` — LIVE vs OFFLINE. If this fails, the page shows
   OFFLINE and does not invent markets or volume.
2. `GET /rpc/blockchain?minHeight=&maxHeight=` for the last ~80 heights.
3. `GET /rpc/block?height=` for each height, then scan tx bytes for memos
   starting `IREINSCRIBE1` whose JSON has `p=ire-bet`.
4. `GET /rpc/unconfirmed_txs` so pending opens/bets show in the mempool
   sense.

Odds bars use summed `a` on buy inscriptions. If there are no buys, the
UI shows 50/50 and labels it as no volume — it does not fake a book.
