# Crypto Brokers activation site

Static HTML/CSS/JS for the 5000 Crypto Brokers collection. Copy this folder to `site/brokers/` in [kenyahewitt/ire-blockchain](https://github.com/kenyahewitt/ire-blockchain). No build step.

IRE docs chrome (ember/paper, Instrument Serif, IBM Plex) comes from `/assets/styles.css` on the IRE host. `assets/brokers.css` adds collection UI and repeats the palette so the pages still paint if opened alone.

## Files

| Path | Role |
| --- | --- |
| `index.html` | Collection landing, browse #1–5000, agent console when `?id=N`. Deep link: `/brokers/?id=42`. |
| `activate.html` | Activate flow. `activate.html?id=42` opens the same console. |
| `assets/brokers.css` | Ember/paper layout for cards, blotter, wallet. |
| `assets/brokers.js` | Wallet connect, activation, paper blotter, live intent. |
| `assets/mandates.js` | Trait RNG + unique `primaryAsset` for every id. |
| `assets/render.js` | Deterministic SVG broker card from id + traits. |
| `prove-assets.js` | Node check that id 1 / 42 / 2500 have different primary assets. |

`tokenURI` for token `N` should resolve to this site, e.g. `https://<ire-docs-host>/brokers/?id=N` (and optionally a JSON metadata URL). SVG on this host is the preview until 5000 PNGs are uploaded.

## Config (edit in `assets/brokers.js`)

```js
CONTRACT: null,          // set to the real ERC-721 after deploy — do not invent one
PREVIEW: true,
CHAIN: {
  chainId: 4663,         // Robinhood Chain mainnet
  chainIdHex: "0x1237",
  rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
  explorer: "https://robinhoodchain.blockscout.com",
  nativeCurrency: { symbol: "ETH", decimals: 18 }
}
```

Do not point the drop UI at testnet `46630`.

Owner / minter: `0xdfF1a5dc565a2D8d0C2818f8B190ca8399B869b3`.

Related Robinhood Chain token **Ninjaagent** `0x5Ce837Cf242e763F9b0E9A87AA7907C3F5DD083C` is not this NFT contract.

## Mandates

Traits match `crypto-brokers/generate_metadata.py`:

`sha256("crypto-brokers-{id}-{salt}")`.

Primary assets are unique across 5000 ids (`sha256("crypto-brokers-{id}-asset")` Fisher–Yates of a compact symbol generator). The dashboard always shows a different Primary Asset per id. Min $1M mcap is a mandate filter, not a claimed floor or collection market cap.

## Wallet

Injected `window.ethereum` (MetaMask / Rabby). `eth_requestAccounts`, then `wallet_switchEthereumChain` / `wallet_addEthereumChain` for chainId 4663.

Activation `personal_sign`:

`Activate Crypto Broker #{id} as my agent. Owner signs every live trade. Not a licensed broker.`

Stored in `localStorage` key `crypto-brokers:activation:{address}:{id}`.

## Paper vs live

- **Paper:** Dexscreener public search for the unique primary asset. Fetch fail → offline. No invented prices or PnL.
- **Live:** Human-readable order JSON, `personal_sign` only. If `CONTRACT` is null, the order is copied and ERC-20/swap stays with the owner after deploy. No swap-router calldata. No unsupervised `eth_sendTransaction`. No custody.

## What this is not

- Not a licensed broker-dealer.
- Not Robinhood Inc.
- Not an IRE ERC-721 (wasm is not in `ired`).
- IRE points and vault `ire1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8nanfuy` live on `ire-1`, separately.
- Coattail / StockOre are unrelated comps.

## Prove uniqueness

```sh
node prove-assets.js
```
