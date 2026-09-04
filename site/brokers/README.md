# Crypto Brokers activation site

Static HTML/CSS/JS for the 5000 Crypto Brokers ERC-721. Copy this folder to `site/brokers/` in [kenyahewitt/ire-blockchain](https://github.com/kenyahewitt/ire-blockchain). No build step. Netlify publishes `site/` via the repo `netlify.toml`.

IRE docs chrome (ember/paper, Instrument Serif, IBM Plex) comes from `/assets/styles.css` on the IRE host. `assets/brokers.css` adds collection UI and repeats the palette so the pages still paint if opened alone.

Each NFT is a paid trading agent with a **unique real skill** (see `assets/skills.js` and `skills/README.md`). This is **not** 5000 unique 3D models, unsupervised AI trading, or 5000 validators. Art is a small set of shared 3D head styles plus deterministic SVG cards. IREVAL1 is waitlist + testnet points only. `ire-1` is a testnet. Not a licensed broker. Not Robinhood Inc.

## Files

| Path | Role |
| --- | --- |
| `index.html` | Collection landing, browse #1–5000, agent console when `?id=N`. Deep link: `/brokers/?id=42`. |
| `activate.html` | Activate flow. `activate.html?id=42` opens the same console. `ownerOf` must match first. |
| `activated.html` | Local activations for the connected wallet (saved only after owner check). |
| `my.html` | My Brokers: `ownerOf` scan of 1..live `totalSupply` (batched) + that token's skill. |
| `assets/brokers.css` | Ember/paper layout for cards, blotter, wallet, skill card. |
| `assets/brokers.js` | Wallet connect, ownerOf gate, activation, public quotes, owner-signed skill intent. |
| `assets/mandates.js` | Trait RNG + unique `primaryAsset` for every id. |
| `assets/skills.js` | Deterministic unique skill for every id 1–5000 (`skillId` + name). |
| `assets/render.js` | Deterministic SVG broker card from id + traits. Not a 3D master. |
| `skills/` | Skill matrix README. Full `skills/{id}.json` pack lands from the reveal drop. |
| `metadata/` | Reveal convention + sample `1.json`. Do not commit 5000 JSON files. |

`tokenURI` for token `N` after reveal should be `https://boomer250.com/brokers/metadata/{id}.json`. Collection page: `https://boomer250.com/brokers/?id=N`.

## Config (edit in `assets/brokers.js`)

```js
CONTRACT: "0x9F7A3ADbF611cBeeC95Ce40e0259bbF96b8Df041",
METADATA_BASE: "https://boomer250.com/brokers/metadata/",  // trailing slash required for setBaseURI
CHAIN: {
  chainId: 4663,         // Robinhood Chain mainnet
  chainIdHex: "0x1237",
  rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
  explorer: "https://robinhoodchain.blockscout.com",
  nativeCurrency: { symbol: "ETH", decimals: 18 }
}
```

Do not point the drop UI at testnet `46630`.

Owner / minter: `0xdfF1a5dc565a2D8d0C2818f8B190ca8399B869b3`. Twitter: [@FURBI50360](https://x.com/FURBI50360).

Related Robinhood Chain token **Ninjaagent** `0x5Ce837Cf242e763F9b0E9A87AA7907C3F5DD083C` is not this NFT contract.

Mint count is live `totalSupply` (`eth_call` `0x18160ddd`), not a hardcoded 20/5000 or 5000/5000.

## Mandates

Traits match `crypto-brokers/generate_metadata.py`:

`sha256("crypto-brokers-{id}-{salt}")`.

Primary assets are unique across 5000 ids (`sha256("crypto-brokers-{id}-asset")` Fisher–Yates of a compact symbol generator). The dashboard always shows a different Primary Asset per id. Min $1M mcap is a mandate filter, not a claimed floor or collection market cap.

## Wallet

Injected `window.ethereum` (MetaMask / Rabby). `eth_requestAccounts`, then `wallet_switchEthereumChain` / `wallet_addEthereumChain` for chainId 4663.

Before **activate** or **live intent**, the page `eth_call`s `ownerOf(tokenId)` (`0x6352211e`) on `CONTRACT` and requires the result to equal the connected wallet (case-insensitive). If not the owner, it refuses with a clear message and does **not** write `localStorage`.

Activation `personal_sign`:

`Activate Crypto Broker #{id} as my agent. Owner signs every live trade. Not a licensed broker.`

Stored in `localStorage` key `crypto-brokers:activation:{address}:{id}` only after the owner check.

## Skills

`assets/skills.js` maps tokenId 1–5000 → one skill object. Uniqueness: sha256 linear probe over desk × role × pair × timeframe × risk (space 67,200). 5000 distinct `skillId`s and 5000 distinct names. Execution is always `owner-signed`.

Paper quotes come from the desk's real public API (Kraken ticker preferred). Fetch fail → **quote unavailable**. Never a Dexscreener fill tape, never invented PnL.

## Paper vs live

- **Paper:** Live public quote for that skill's pair/venue. Fail → quote unavailable. No fills. No invented prices or PnL.
- **Live:** `personal_sign` of `{type:"crypto-brokers-skill", tokenId, skillId, desk, pair, action, nonce, deadline}`. Button label: owner signs. No approve. No `eth_sendTransaction`. No swap-router calldata. No key custody.

## IREVAL1

Waitlist + 25 testnet points when the `IREVAL1` memo lands from an IRE key that has `uire`. Not a seat in the current one-validator `ire-1` set. Not 5000 validators.

## What this is not

- Not a licensed broker-dealer.
- Not Robinhood Inc.
- Not an IRE ERC-721 (wasm is not in `ired`).
- Not unsupervised AI trading.
- Not 5000 unique 3D models.
- IRE points and vault `ire1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8nanfuy` live on `ire-1`, separately.
- Coattail / StockOre are unrelated comps.
