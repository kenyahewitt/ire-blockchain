# IRE inscriptions

IRE inscriptions put the payload **in the transaction**. Every full node that
stores the block stores the data. There is no IPFS, no Arweave, and no
off-chain pointer to pin.

`ire-1` is a public testnet with one validator. Do not put real value on it.

## Identifier

Each message in a transaction has an inscription-style id:

```
{txhash}i{index}
```

- `txhash` is the CometBFT transaction hash: lowercase hex of SHA-256 over the
  raw tx bytes.
- `i` is the literal ASCII letter i.
- `index` is the message index in that transaction, starting at `0`.

A typical self-send with one `MsgSend` is `{txid}i0`. The live explorer at
`/mempool/` prints this id on pending cubes and on confirmed transactions.

## Current carrier: memo convention

The running `ired` binary has no dedicated inscription module. The current
path is a **memo convention** on an ordinary bank send:

```
IREINSCRIBE1 <media-type> <payload>
```

1. The memo **must** start with `IREINSCRIBE1`.
2. A single space, then an IANA media type (`text/plain`, `application/json`,
   `image/svg+xml`, …).
3. A single space, then the payload as UTF-8 text.

Example (self-send of `1uire`; the send is only the carrier):

```sh
ired tx bank send <from> <from> 1uire   --chain-id ire-1   --from <key>   --gas-prices 0.001uire   --memo 'IREINSCRIBE1 application/json {"p":"ire-insc","op":"deploy","tick":"IRE","name":"example"}'   --home "$HOME/.ire"   --yes
```

The transaction sits in the mempool, then lands in a block (~5s on this
chain). Watch it at `/mempool/`.

## Size limit (honest)

Cosmos SDK’s default max memo is **256 characters**. This binary does not
raise that. Text, JSON, and small SVG fit. Photographs, audio, and other
large binaries do **not** fit in the current memo path. That needs a later
chain upgrade (for example a dedicated inscription message with a larger
byte limit). Until then, do not tell people to pin to IPFS or Arweave —
that would put the bytes off this chain.

## How the explorer displays them

The mempool page is read-only. It GETs same-origin `/rpc/` and `/api/` and
never signs or broadcasts.

- A pending tx whose raw bytes contain `IREINSCRIBE1` is colored
  magenta→violet.
- A bank/token send without that prefix is ember/orange.
- Staking and other messages are teal/green.
- A block with no transactions is dim ash.

On each inscription cube and in the detail panel the page shows `{txhash}i{index}`,
the media type, and a truncated payload. Confirmed txs keep the same id
after they leave the mempool.


## Sub-protocol: ire-bet (prediction markets)

Prediction markets use the same memo carrier. There is no IPFS and no
escrow in this binary. Protocol fee is **0%** — gas only (`0.001uire`).
Full rules: [MARKETS.md](MARKETS.md). Live board: `/markets/`.

Keep JSON tiny so the whole memo fits in 256 characters:

```
IREINSCRIBE1 application/json {json}
```

- open: `{"p":"ire-bet","op":"open","q":"ETF approved 2026?","o":["y","n"]}`
- buy: `{"p":"ire-bet","op":"buy","m":"{txid}i0","s":"y","a":"1000000"}` (`a` is uire; also bank-send that amount as the carrier)
- resolve: `{"p":"ire-bet","op":"resolve","m":"{txid}i0","w":"y"}`
- analyze: `{"p":"ire-bet","op":"analyze","m":"{txid}i0","y":65,"n":35,"note":"brief"}`

The market id is the open inscription `{txhash}i{index}`. Buy / resolve /
analyze point at that id in `m`. A buy is a public pledge, not a locked
position. AI analysis is `op:analyze` — an analyst note, not an unsupervised
trading bot, and it must not spend the validator key.

## What this is not

- Not an NFT standard on IPFS.
- Not Ordinals on Bitcoin, even though the `{txid}iN` shape is familiar.
- Not CosmWasm / CW721 — wasm is **not** in the running `ired` binary.
- Not a promise that every wallet will render the payload. Wallets that
  show memos can display it; the chain of record is the tx itself.
