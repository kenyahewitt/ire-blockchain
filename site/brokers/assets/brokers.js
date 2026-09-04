/**
 * Crypto Brokers activation site.
 * Live ERC-721 on Robinhood Chain 4663: 0x9F7A3ADbF611cBeeC95Ce40e0259bbF96b8Df041.
 * ownerOf (0x6352211e) must match the connected wallet before activate or live intent.
 * Activation verifies ownerOf, then sends the disclosed 0.001 ETH activation fee.
 * Live trading is not executed by this site; its live path remains an owner-signed intent.
 * Paper = live public quotes for that token's skill pair/venue. Never a fake fill tape.
 */
(function () {
  "use strict";

  var M = window.BrokersMandates;
  var R = window.BrokersRender;
  var S = window.BrokersSkills;

  var CONFIG = {
    CONTRACT: "0x9F7A3ADbF611cBeeC95Ce40e0259bbF96b8Df041",
    ACTIVATION_FEE_RECIPIENT: "0xdfF1a5dc565a2D8d0C2818f8B190ca8399B869b3",
    ACTIVATION_FEE_ETH: "0.001",
    ACTIVATION_FEE_WEI: "0x38d7ea4c68000",
    METADATA_BASE: "https://boomer250.com/brokers/metadata/",
    OWNER: M.OWNER,
    TWITTER: "FURBI50360",
    OPENSEA: "https://opensea.io/collection/crypto-brokers-894013111",
    EXPLORER: "https://robinhoodchain.blockscout.com/token/0x9F7A3ADbF611cBeeC95Ce40e0259bbF96b8Df041",
    BLOCKSCOUT_TOKEN: "https://robinhoodchain.blockscout.com/api/v2/tokens/0x9F7A3ADbF611cBeeC95Ce40e0259bbF96b8Df041",
    BLOCKSCOUT_NINJA: "https://robinhoodchain.blockscout.com/api/v2/tokens/0x5Ce837Cf242e763F9b0E9A87AA7907C3F5DD083C",
    KRAKEN_TICKER: "https://api.kraken.com/0/public/Ticker?pair=",
    KRAKEN_FUT: "https://futures.kraken.com/derivatives/api/v3/tickers",
    JUP_PRICE: "https://lite-api.jup.ag/price/v3?ids=",
    CODEX_GQL: "https://graph.codex.io/graphql",
    IRE_STATUS: "/rpc/status",
    IRE_MEMPOOL: "/rpc/unconfirmed_txs",
    VOLT_BANK: "/api/cosmos/bank/v1beta1/balances/ire1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8nanfuy",
    VOLT_DIST: "/api/cosmos/distribution/v1beta1/params",
    CHAIN: {
      chainId: 4663,
      chainIdHex: "0x1237",
      name: "Robinhood Chain",
      rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
      explorer: "https://robinhoodchain.blockscout.com",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }
    }
  };

  var state = {
    address: null,
    chainId: null,
    page: 1,
    pageSize: 48,
    id: null,
    filter: "",
    universe: "",
    strategy: "",
    minted: null,
    maxSupply: 5000,
    mintFetched: false,
    deskTimer: null,
    lastTicket: null
  };

  function $(id) { return document.getElementById(id); }
  function qs() { return new URLSearchParams(location.search); }

  function parseId(raw) {
    var n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > M.COLLECTION_SIZE) return null;
    return n;
  }

  function shortAddr(a) {
    if (!a) return "";
    return a.slice(0, 6) + "…" + a.slice(-4);
  }

  function storageKey(kind, id) {
    var addr = (state.address || "unsigned").toLowerCase();
    return "crypto-brokers:" + kind + ":" + addr + ":" + id;
  }

  function normalizeWei(v) {
    if (v == null || v === "") return "";
    var s = String(v).toLowerCase();
    if (s.indexOf("0x") === 0) s = s.slice(2);
    s = s.replace(/^0+/, "");
    return "0x" + (s || "0");
  }

  function activationDataMatches(input, expectedId) {
    var got = String(input || "").toLowerCase();
    var need = String(activationData(expectedId)).toLowerCase();
    if (got === need) return true;
    if (!got || got === "0x") return false;
    return got.replace(/^0x/, "") === need.replace(/^0x/, "");
  }

  function activationStorageKey(address, id) {
    return "crypto-brokers:activation:" + String(address || "unsigned").toLowerCase() + ":" + id;
  }

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }

  function writeJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function validatorMessage(addr, id) {
    return "IRE validator candidate. Wallet " + addr +
      " for Crypto Broker #" + id +
      " on 0x9F7A3ADbF611cBeeC95Ce40e0259bbF96b8Df041. ire-1 is a testnet. This does not mint uire, take custody, or add this key to the current consensus set.";
  }

  function validatorMemo(addr, id) {
    return 'IREVAL1 {"e":"' + addr + '","b":' + id + "}";
  }

  function validatorCli(addr, id) {
    var note = validatorMemo(addr, id);
    return "./build/ired tx bank send \\\n" +
      "  $(./build/ired keys show myvalidator -a --home \"$HOME/.ire\") \\\n" +
      "  $(./build/ired keys show myvalidator -a --home \"$HOME/.ire\") 1uire \\\n" +
      "  --from myvalidator --chain-id ire-1 --home \"$HOME/.ire\" \\\n" +
      "  --gas-prices 0.001uire --yes --note '" + note + "'\n\n" +
      "# Needs uire in that key. No faucet. Does not join the current 1-validator set.\n" +
      "# 25 testnet points score when this memo lands. See /join and /points.";
  }

  function validatorKey(addr) {
    return "crypto-brokers:validator:" + String(addr || "").toLowerCase();
  }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }

  function setHtml(id, html) {
    var el = $(id);
    if (el) el.innerHTML = html;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function show(id, on) {
    var el = $(id);
    if (!el) return;
    el.classList.toggle("bk-hidden", !on);
  }

  function eth() {
    return window.ethereum || null;
  }

  function pad32(n) {
    var h = (typeof n === "number" ? n.toString(16) : String(n).replace(/^0x/, ""));
    return h.padStart(64, "0");
  }

  function decodeUint(hex) {
    if (!hex || hex === "0x") return null;
    return parseInt(hex, 16);
  }

  function decodeAddress(hex) {
    if (!hex || hex === "0x" || hex.length < 66) return null;
    return "0x" + hex.slice(-40);
  }

  async function ethCall(data) {
    var params = [{ to: CONFIG.CONTRACT, data: data }, "latest"];
    var body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: params });
    var rpcs = CONFIG.CHAIN.rpcUrls || [];
    var i, res, j, lastErr = null;
    /* Public Robinhood RPC first — injected wallets often rate-limit mass ownerOf scans. */
    for (i = 0; i < rpcs.length; i++) {
      try {
        res = await fetch(rpcs[i], {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: body
        });
        if (!res.ok) { lastErr = new Error("rpc HTTP " + res.status); continue; }
        j = await res.json();
        if (j && j.error) { lastErr = new Error(j.error.message || "rpc error"); continue; }
        if (j && j.result != null) return j.result;
      } catch (e) { lastErr = e; }
    }
    var provider = eth();
    if (provider) {
      try {
        return await provider.request({ method: "eth_call", params: params });
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("eth_call failed");
  }

  function updateMintUi() {
    var el = $("bk-mint-count");
    var live = $("bk-mint-live");
    var facts = $("bk-mint-facts");
    var label, liveText, factsText;
    if (Number.isFinite(state.minted) && state.minted >= 0) {
      label = "<strong>" + state.minted + " / " + state.maxSupply + "</strong> minted on-chain";
      if (state.minted >= state.maxSupply) {
        liveText = "ids 1–" + state.minted + " minted · sold out · revealed";
        factsText = state.minted + " / " + state.maxSupply + " · sold out · revealed";
      } else {
        liveText = "ids 1–" + state.minted + " minted · reveal metadata live on IPFS";
        factsText = state.minted + " / " + state.maxSupply + " · reveal live";
      }
    } else if (!state.mintFetched) {
      label = "Loading on-chain totalSupply…";
      liveText = "Fetching totalSupply (0x18160ddd)…";
      factsText = "on-chain totalSupply";
    } else {
      label = "On-chain totalSupply unavailable";
      liveText = "Could not read totalSupply (0x18160ddd). Collection size " + state.maxSupply + ".";
      factsText = "on-chain totalSupply unavailable / " + state.maxSupply + " max";
    }
    if (el) el.innerHTML = label;
    if (live) live.textContent = liveText;
    if (facts) facts.textContent = factsText;
    var contractEl = $("bk-contract");
    if (contractEl) contractEl.textContent = CONFIG.CONTRACT;
    document.querySelectorAll("[data-contract]").forEach(function (n) { n.textContent = CONFIG.CONTRACT; });
  }

  async function refreshMinted() {
    var n = null;
    try {
      var hex = await ethCall("0x18160ddd");
      if (hex) n = decodeUint(hex);
    } catch (e) {
      try {
        var res = await fetch(CONFIG.BLOCKSCOUT_TOKEN);
        var j = await res.json();
        if (j && j.total_supply) n = parseInt(j.total_supply, 10);
      } catch (e2) {}
    }
    state.mintFetched = true;
    if (Number.isFinite(n) && n >= 0) state.minted = n;
    updateMintUi();
    renderLandingGrid();
    if (document.body.getAttribute("data-page") === "my") renderMyBrokers();
  }

  async function balanceOf(addr) {
    if (!CONFIG.CONTRACT || !addr) return null;
    var data = "0x70a08231" + String(addr).replace(/^0x/i, "").toLowerCase().padStart(64, "0");
    try {
      var hex = await ethCall(data);
      var n = decodeUint(hex);
      return Number.isFinite(n) ? n : null;
    } catch (e) {
      return null;
    }
  }

  async function ownerOf(id) {
    if (!CONFIG.CONTRACT) return null;
    var data = "0x6352211e" + pad32(id);
    try {
      var hex = await ethCall(data);
      var a = decodeAddress(hex);
      if (!a || a === "0x0000000000000000000000000000000000000000") return null;
      return a;
    } catch (e) {
      return null;
    }
  }

  async function ownerOfWithRetry(id) {
    var n, own, lastErr = null;
    for (n = 0; n < 3; n++) {
      try {
        own = await ownerOf(id);
        return { id: id, own: own, ok: true };
      } catch (e) {
        lastErr = e;
        await new Promise(function (r) { setTimeout(r, 250 * (n + 1)); });
      }
    }
    return { id: id, own: null, ok: false, error: String((lastErr && lastErr.message) || "ownerOf fail") };
  }

  function sameAddr(a, b) {
    return !!(a && b && String(a).toLowerCase() === String(b).toLowerCase());
  }

  function activationExplorer(txHash) {
    return CONFIG.CHAIN.explorer + "/tx/" + encodeURIComponent(txHash);
  }

  function activationData(id) {
    return "0x4342524b" + CONFIG.CONTRACT.slice(2).toLowerCase() + BigInt(id).toString(16).padStart(64, "0");
  }

  function activationRecordIsConfirmed(rec) {
    return !!(rec && rec.id && rec.txHash && rec.confirmed === true &&
      sameAddr(rec.feeRecipient, CONFIG.ACTIVATION_FEE_RECIPIENT) &&
      normalizeWei(rec.feeWei) === normalizeWei(CONFIG.ACTIVATION_FEE_WEI));
  }

  async function waitForReceipt(txHash) {
    var provider = eth();
    var deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      var receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [txHash] });
      if (receipt) return receipt;
      await new Promise(function (resolve) { setTimeout(resolve, 2500); });
    }
    throw new Error("The payment was submitted but is still pending. Reopen this agent after it confirms. Transaction: " + txHash);
  }

  async function verifyActivationPayment(txHash, expectedFrom, expectedId) {
    var provider = eth();
    var results = await Promise.all([
      provider.request({ method: "eth_getTransactionReceipt", params: [txHash] }),
      provider.request({ method: "eth_getTransactionByHash", params: [txHash] })
    ]);
    var receipt = results[0], tx = results[1];
    if (!receipt || !tx) return false;
    if (String(receipt.status).toLowerCase() !== "0x1") throw new Error("The activation payment reverted. The agent was not activated.");
    if (!sameAddr(tx.from, expectedFrom) || !sameAddr(tx.to, CONFIG.ACTIVATION_FEE_RECIPIENT)) {
      throw new Error("Activation tx from/to mismatch. Must pay from the owning wallet to " + CONFIG.ACTIVATION_FEE_RECIPIENT + " on Robinhood Chain.");
    }
    if (normalizeWei(tx.value) !== normalizeWei(CONFIG.ACTIVATION_FEE_WEI)) {
      throw new Error("Activation tx value mismatch. Need exactly 0.001 ETH on Robinhood Chain, got " + String(tx.value) + ".");
    }
    if (!activationDataMatches(tx.input || tx.data, expectedId)) {
      throw new Error("Activation tx calldata mismatch for token #" + expectedId + ". Re-run Activate from this page so the memo is included.");
    }
    return true;
  }

  async function requireOwner(id) {
    if (!CONFIG.CONTRACT) {
      throw new Error("No ERC-721 contract configured. Activation and live intents are blocked.");
    }
    if (!state.address) {
      throw new Error("Connect a wallet first.");
    }
    var own = await ownerOf(id);
    if (!own) {
      var supply = Number.isFinite(state.minted) ? (" On-chain totalSupply is " + state.minted + ".") : "";
      throw new Error("Cannot verify on-chain owner for Crypto Broker #" + id + "." + supply +
        " The connected wallet must own this token (ownerOf). No local activation was saved.");
    }
    if (!sameAddr(own, state.address)) {
      throw new Error("Connected wallet " + shortAddr(state.address) +
        " does not own Crypto Broker #" + id + " (on-chain owner " + shortAddr(own) +
        "). Only the owner can activate or sign a live intent. No local activation was saved.");
    }
    return own;
  }



  function hexToInt(hex) {
    if (hex == null) return null;
    return parseInt(hex, 16);
  }

  function setWalletUi() {
    var labels = document.querySelectorAll(".bk-wallet-label");
    var chains = document.querySelectorAll(".bk-wallet-chain");
    var labelHtml, chainText = "";
    if (!eth()) {
      labelHtml = "No <code>window.ethereum</code>. Install MetaMask or Rabby to activate.";
    } else if (!state.address) {
      labelHtml = "Wallet not connected.";
    } else {
      labelHtml = "Connected <strong>" + shortAddr(state.address) + "</strong>";
    }
    if (eth() && state.chainId === CONFIG.CHAIN.chainId) {
      chainText = "Robinhood Chain · ETH · chainId " + CONFIG.CHAIN.chainId;
    } else if (eth() && state.chainId) {
      chainText = "Wrong chain " + state.chainId + " — switch to Robinhood Chain ETH (" + CONFIG.CHAIN.chainId + ")";
    } else if (eth()) {
      chainText = "Chain unknown — switch to Robinhood Chain ETH (" + CONFIG.CHAIN.chainId + ")";
    }
    labels.forEach(function (el) { el.innerHTML = labelHtml; });
    chains.forEach(function (el) { el.textContent = chainText; });
  }

  async function ensureChain() {
    var provider = eth();
    if (!provider) throw new Error("No injected wallet");
    var current = hexToInt(await provider.request({ method: "eth_chainId" }));
    state.chainId = current;
    if (current === CONFIG.CHAIN.chainId) {
      setWalletUi();
      return;
    }
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CONFIG.CHAIN.chainIdHex }]
      });
    } catch (err) {
      var msg = String((err && err.message) || "");
      if (err && (err.code === 4902 || err.code === -32603 || msg.toLowerCase().indexOf("unrecognized chain") >= 0)) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: CONFIG.CHAIN.chainIdHex,
            chainName: "Robinhood Chain",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: CONFIG.CHAIN.rpcUrls,
            blockExplorerUrls: [CONFIG.CHAIN.explorer]
          }]
        });
      } else {
        throw new Error("Switch wallet network to Robinhood Chain (ETH, chainId 4663). " + msg);
      }
    }
    state.chainId = hexToInt(await provider.request({ method: "eth_chainId" }));
    setWalletUi();
    if (state.chainId !== CONFIG.CHAIN.chainId) {
      throw new Error("Still not on Robinhood Chain. In MetaMask/Rabby choose Robinhood Chain (4663) with native ETH, then retry Activate.");
    }
  }


  async function connectWallet() {
    var provider = eth();
    if (!provider) {
      alert("No injected wallet (window.ethereum). Use MetaMask or Rabby.");
      return;
    }
    var accounts = await provider.request({ method: "eth_requestAccounts" });
    state.address = accounts && accounts[0] ? accounts[0] : null;
    await ensureChain();
    setWalletUi();
    if (state.id) refreshActivation();
    refreshValidator();
    renderActivated();
    renderMyBrokers();
  }

  async function personalSign(message) {
    var provider = eth();
    if (!provider || !state.address) throw new Error("Connect a wallet first");
    await ensureChain();
    try {
      return await provider.request({
        method: "personal_sign",
        params: [message, state.address]
      });
    } catch (e) {
      var hex = "0x" + Array.from(new TextEncoder().encode(message)).map(function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
      return await provider.request({
        method: "personal_sign",
        params: [hex, state.address]
      });
    }
  }

  function factsHtml(m) {
    var R = window.BrokersReveal;
    var reveal = R && typeof R.forId === "function" ? R.forId(m.id) : null;
    var html = "";
    if (reveal) {
      html += "<div><dt>Reveal name</dt><dd>" + escapeHtml(reveal.name) + "</dd></div>";
      html += "<div><dt>tokenURI</dt><dd><code>" + escapeHtml(reveal.tokenURI) + "</code></dd></div>";
      html += "<div><dt>file_name</dt><dd><code>" + escapeHtml(reveal.file_name) + "</code></dd></div>";
      Object.keys(reveal.attributes).forEach(function (k) {
        html += "<div><dt>" + escapeHtml(k) + "</dt><dd>" + escapeHtml(reveal.attributes[k]) + "</dd></div>";
      });
    }
    html += (
      "<div><dt>Primary asset</dt><dd>" + escapeHtml(String(m.primaryAsset)) + " · " + escapeHtml(String(m.primaryKind)) + "</dd></div>" +
      "<div><dt>Secondary</dt><dd>" + escapeHtml(String(m.secondary)) + "</dd></div>" +
      "<div><dt>Strategy</dt><dd>" + escapeHtml(String(m.strategy)) + "</dd></div>" +
      "<div><dt>Universe</dt><dd>" + escapeHtml(String(m.universe)) + "</dd></div>" +
      "<div><dt>Venue</dt><dd>" + escapeHtml(String(m.venue)) + "</dd></div>" +
      "<div><dt>Timeframe</dt><dd>" + escapeHtml(String(m.timeframe)) + "</dd></div>" +
      "<div><dt>Max notional</dt><dd>$" + m.maxNotionalUsd.toLocaleString("en-US") + "</dd></div>" +
      "<div><dt>Min mcap filter</dt><dd>$" + m.minMcapUsd.toLocaleString("en-US") + " (mandate, not a floor)</dd></div>" +
      "<div><dt>Mode</dt><dd>" + escapeHtml(String(m.mode)) + "</dd></div>" +
      "<div><dt>Inscription</dt><dd><code>" + escapeHtml(String(m.inscription)) + "</code></dd></div>"
    );
    return html;
  }


  var HEAD_SHOT = {
    "Gold Skull": "gold-skull.jpg",
    "Chrome Skull": "chrome-skull.jpg",
    "Matte Helm": "matte-helm.jpg",
    "Violet Slit": "violet-slit.jpg",
    "Ember Mask": "ember-mask.jpg",
    "Paper Visor": "paper-visor.jpg"
  };

  var HEAD_TRADE = {
    "Gold Skull": "trade-gold-skull.mp4",
    "Chrome Skull": "trade-chrome-skull.mp4",
    "Matte Helm": "trade-matte-helm.mp4",
    "Violet Slit": "trade-violet-slit.mp4",
    "Ember Mask": "trade-ember-mask.mp4",
    "Paper Visor": "trade-paper-visor.mp4"
  };

  function shotUrl(m) {
    var R = window.BrokersReveal;
    if (R && typeof R.imageUrlFor === "function") {
      var u = R.imageUrlFor(m.id);
      if (u) return u;
    }
    var f = HEAD_SHOT[m.head] || "gold-skull.jpg";
    return "/brokers/assets/agents3d/" + f;
  }

  function tradeUrl(m) {
    var f = HEAD_TRADE[m.head] || "trade-gold-skull.mp4";
    return "/brokers/assets/agents3d/" + f;
  }

  function tapeText(m) {
    var skill = S && S.skillFor(m.id);
    if (skill) {
      return "CRYPTO BROKER #" + m.id + "  ·  " + skill.name +
        "  ·  " + skill.desk + "  ·  " + skill.pair + "  ·  OWNER SIGNS LIVE  ·  PAPER = PUBLIC QUOTE ONLY  ·  ";
    }
    return "CRYPTO BROKER #" + m.id + "  ·  " + m.primaryAsset + "  ·  " + m.strategy +
      "  ·  OWNER SIGNS LIVE  ·  PAPER = PUBLIC QUOTE ONLY  ·  ";
  }

  function shotHtml(m) {
    var t = tapeText(m);
    var R = window.BrokersReveal;
    var revealImg = R && typeof R.imageUrlFor === "function" ? R.imageUrlFor(m.id) : null;
    if (revealImg) {
      return '<div class="bk-shot">' +
        '<img class="bk-reveal-img" src="' + revealImg + '" alt="' + escapeHtml(m.name || ("Crypto Broker #" + m.id)) + '" loading="lazy" width="768" height="768">' +
        '<span class="bk-pulse"><i></i>agent</span>' +
        '<div class="bk-tape"><span>' + t + t + '</span></div>' +
        '</div>';
    }
    return '<div class="bk-shot">' +
      '<video autoplay muted loop playsinline poster="' + shotUrl(m) + '" src="' + tradeUrl(m) + '"></video>' +
      '<span class="bk-pulse"><i></i>agent</span>' +
      '<div class="bk-tape"><span>' + t + t + '</span></div>' +
      '</div>';
  }

  function isActivated(id) {
    if (!state.address) return false;
    var rec = readJSON(storageKey("activation", id));
    return activationRecordIsConfirmed(rec);
  }

  function workingRecord(id) {
    return readJSON(storageKey("working", id));
  }

  function markAgentWorking(id, quote, skill) {
    writeJSON(storageKey("working", id), {
      status: "WORKING",
      id: id,
      skillId: skill && skill.skillId,
      desk: skill && skill.desk,
      pair: skill && skill.pair,
      role: skill && skill.role,
      lastLabel: quote && (quote.label || String(quote.value)),
      lastSource: quote && quote.source,
      ts: new Date().toISOString()
    });
  }

  /** After activation, run the agent's desk: fetch a real public quote and mark WORKING. No custody, no unsupervised fills. */
  async function startAgentDesk(id) {
    if (!id || !isActivated(id)) return null;
    var prev = state.id;
    state.id = id;
    try {
      await runBrokerDesk();
      var skill = S && S.skillFor(id);
      var rec = readJSON(storageKey("paper", id));
      var last = rec && rec.quotes && rec.quotes[0];
      if (last) {
        markAgentWorking(id, { label: last.label || last.value, value: last.value, source: last.source }, skill);
      } else if (skill) {
        writeJSON(storageKey("working", id), {
          status: "READY",
          id: id,
          skillId: skill.skillId,
          desk: skill.desk,
          pair: skill.pair,
          role: skill.role,
          ts: new Date().toISOString(),
          note: "Activated; public quote unavailable on this pass. Desk still ready for owner-signed live."
        });
      }
      startDeskHeartbeat(id);
      return workingRecord(id);
    } finally {
      if (prev != null && prev !== id) state.id = prev;
    }
  }

  function matchesFilter(m) {
    if (state.universe && m.universe !== state.universe) return false;
    if (state.strategy && String(m.strategy).toLowerCase() !== String(state.strategy).toLowerCase()) return false;
    var q = (state.filter || "").trim().toLowerCase();
    if (!q) return true;
    var skill = S && S.skillFor(m.id);
    var skillBlob = skill ? (" " + skill.name + " " + skill.desk + " " + skill.role + " " + skill.pair + " " + skill.venue + " " + skill.skillId) : "";
    var blob = ("#" + m.id + " " + m.name + " " + m.primaryAsset + " " + m.secondary + " " + m.strategy + " " + m.venue + " " + m.universe + skillBlob).toLowerCase();
    return blob.indexOf(q) >= 0 || String(m.id) === q;
  }

  function catalogIds() {
    var ids = [];
    var filtered = !!(state.filter || state.universe || state.strategy);
    var i, m;
    for (i = 1; i <= M.COLLECTION_SIZE; i++) {
      if (!filtered) { ids.push(i); continue; }
      m = M.mandateFor(i);
      if (matchesFilter(m)) ids.push(i);
    }
    return ids;
  }

  function cardHtml(id, href) {
    var m = M.mandateFor(id);
    var on = isActivated(id);
    var minted = id <= state.minted;
    var work = workingRecord(id);
    var tags = "";
    if (minted) tags += ' <span class="bk-tag">minted</span>';
    if (on) tags += ' <span class="bk-tag">activated</span>';
    if (on && work && work.status === "WORKING") tags += ' <span class="bk-tag bk-tag-live">working</span>';
    else if (on) tags += ' <span class="bk-tag">ready</span>';
    var skill = S && S.skillFor(id);
    var job = skill ? (escapeHtml(skill.role) + " · " + escapeHtml(skill.pair)) : (escapeHtml(m.primaryAsset) + " · " + escapeHtml(m.strategy));
    return '<a href="' + href + '" data-id="' + id + '" data-activated="' + (on ? "1" : "0") + '" data-minted="' + (minted ? "1" : "0") + '">' +
      shotHtml(m) +
      '<p class="bk-card-meta"><strong>#' + id + tags +
      "</strong>" + job + "</p></a>";
  }

  function renderLandingGrid() {
    var grid = $("bk-grid");
    if (!grid) return;
    var ids = catalogIds();
    var maxPage = Math.max(1, Math.ceil(ids.length / state.pageSize));
    if (state.page > maxPage) state.page = maxPage;
    var start = (state.page - 1) * state.pageSize;
    var slice = ids.slice(start, start + state.pageSize);
    var html = "";
    var i;
    for (i = 0; i < slice.length; i++) {
      html += cardHtml(slice[i], "/brokers/?id=" + slice[i]);
    }
    grid.innerHTML = html || '<p class="bk-empty">No agents match that search.</p>';
    var a = ids.length ? (start + 1) : 0;
    var b = start + slice.length;
    setText("bk-page-label", (ids.length === M.COLLECTION_SIZE
      ? ("#" + (slice[0] || 0) + "–" + (slice[slice.length - 1] || 0) + " of 5000")
      : (a + "–" + b + " of " + ids.length + " matches")));
  }

  function listActivations() {
    var addr = (state.address || "").toLowerCase();
    if (!addr || !window.localStorage) return [];
    var prefix = "crypto-brokers:activation:" + addr + ":";
    var out = [], i, k, rec;
    for (i = 0; i < localStorage.length; i++) {
      k = localStorage.key(i);
      if (!k || k.indexOf(prefix) !== 0) continue;
      rec = readJSON(k);
      if (activationRecordIsConfirmed(rec)) out.push(rec);
    }
    out.sort(function (a, b) { return String(b.ts || "").localeCompare(String(a.ts || "")); });
    return out;
  }

  function renderActivated() {
    var grid = $("bk-activated-grid");
    var empty = $("bk-activated-empty");
    if (!grid) return;
    if (!state.address) {
      grid.innerHTML = "";
      if (empty) {
        empty.classList.remove("bk-hidden");
        empty.textContent = "Connect a wallet to see agents you have activated on this device.";
      }
      return;
    }
    var recs = listActivations();
    if (!recs.length) {
      grid.innerHTML = "";
      if (empty) {
        empty.classList.remove("bk-hidden");
        empty.innerHTML = "No confirmed activations for <code>" + shortAddr(state.address) + "</code> yet. Open <a href=\"/brokers/activate.html\">Activate</a>, verify ownership, and confirm the 0.001 ETH fee.";
      }
      return;
    }
    if (empty) empty.classList.add("bk-hidden");
    grid.innerHTML = recs.map(function (rec) {
      return cardHtml(rec.id, "/brokers/activate.html?id=" + rec.id);
    }).join("");
  }

  function refreshValidator() {
    var box = $("bk-validator-state");
    var cli = $("bk-validator-cli");
    if (!box) return;
    if (!state.address) {
      box.textContent = "Connect a wallet, then sign to join the IRE validator waitlist.";
      if (cli) { cli.hidden = true; cli.textContent = ""; }
      return;
    }
    var rec = readJSON(validatorKey(state.address));
    if (rec && rec.signature) {
      box.innerHTML = "Validator candidate for <code>" + shortAddr(rec.address) + "</code> (broker #" + rec.id +
        "). Waitlist only — not in the current consensus set. 25 testnet points when you broadcast the <code>IREVAL1</code> memo from an IRE key that has <code>uire</code>.";
      if (cli) {
        cli.hidden = false;
        cli.textContent = rec.cli || validatorCli(rec.address, rec.id);
      }
    } else {
      box.textContent = "This wallet is not on the IRE validator waitlist yet.";
      if (cli) { cli.hidden = true; cli.textContent = ""; }
    }
  }

  function refreshActivation() {
    var id = state.id;
    var box = $("bk-activation-state");
    if (!box || !id) return;
    if (!state.address) {
      box.textContent = "Connect a wallet to verify ownership and pay the 0.001 ETH activation fee.";
      return;
    }
    var rec = readJSON(storageKey("activation", id));
    if (activationRecordIsConfirmed(rec)) {
      var work = workingRecord(id);
      var workLine = (work && work.status === "WORKING")
        ? (" Desk status: <strong>WORKING</strong> · " + escapeHtml(work.pair || "") + " @ " + escapeHtml(work.desk || "") +
           (work.lastLabel ? (" · last public quote " + escapeHtml(work.lastLabel)) : "") + ".")
        : " Desk status: <strong>READY</strong> — fetching public quote so this agent can work.";
      box.innerHTML = "Agent access activated for <code>" + shortAddr(rec.address) + "</code> at " + rec.ts +
        " after a confirmed 0.001 ETH payment. <a href=\"" + activationExplorer(rec.txHash) + "\" target=\"_blank\" rel=\"noopener noreferrer\">View transaction</a>." + workLine;
      if (!work || work.status !== "WORKING") {
        startAgentDesk(id).then(function () { refreshActivation(); renderActivated(); }).catch(function () {});
      }
    } else if (rec && rec.txHash) {
      box.innerHTML = "Activation payment submitted and awaiting confirmation. <a href=\"" + activationExplorer(rec.txHash) + "\" target=\"_blank\" rel=\"noopener noreferrer\">View transaction</a>.";
      verifyActivationPayment(rec.txHash, rec.address, rec.id).then(function (confirmed) {
        if (!confirmed) return;
        rec.confirmed = true;
        rec.confirmedAt = new Date().toISOString();
        writeJSON(storageKey("activation", id), rec);
        refreshActivation();
        renderActivated();
      }).catch(function (error) {
        box.textContent = error.message || "The activation payment could not be verified.";
      });
    } else {
      box.textContent = "Not activated for this wallet and token. You must own the NFT and confirm the 0.001 ETH fee transaction.";
    }
  }

  function renderPaperRows(id) {
    var body = $("bk-blotter-body");
    if (!body) return;
    var rec = readJSON(storageKey("paper", id)) || { quotes: [] };
    var rows = rec.quotes || rec.orders || [];
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="4">No public quotes yet. Fetch the live feed for this skill\'s pair. This table is not a fill tape and will not invent PnL.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (o) {
      return "<tr><td>" + escapeHtml(o.ts) + "</td><td>" + escapeHtml(o.pair || "") + "</td><td>" +
        escapeHtml(o.label || o.value || "quote unavailable") + "</td><td>" + escapeHtml(o.source || "") + "</td></tr>";
    }).join("");
  }

  function renderLiveRows(id) {
    var body = $("bk-live-body");
    if (!body) return;
    var rec = readJSON(storageKey("live", id)) || { intents: [] };
    if (!rec.intents.length) {
      body.innerHTML = "<tr><td colspan=\"3\">No owner-signed skill intents.</td></tr>";
      return;
    }
    body.innerHTML = rec.intents.map(function (o) {
      var label = (o.action || "skill") + " " + (o.pair || "") + " " + (o.skillId || "");
      return "<tr><td>" + escapeHtml(o.ts) + "</td><td>" + escapeHtml(label) + "</td><td>" + escapeHtml(shortAddr(o.signature)) + "</td></tr>";
    }).join("");
  }

  function jsonGet(url) {
    return fetch(url, { headers: { accept: "application/json" } }).then(function (res) {
      if (!res.ok) throw new Error("quote HTTP " + res.status);
      return res.json();
    });
  }

  async function quoteKrakenSpot(skill) {
    var data = await jsonGet(CONFIG.KRAKEN_TICKER + encodeURIComponent(skill.pair));
    if (data && data.error && data.error.length) throw new Error(String(data.error.join(", ")));
    var result = data && data.result ? data.result : {};
    var keys = Object.keys(result);
    if (!keys.length) throw new Error("no ticker");
    var row = result[keys[0]] || {};
    var last = row.c && row.c[0];
    if (last == null || last === "") throw new Error("no last");
    return { value: String(last), label: "$" + last, source: "kraken-public-ticker:" + keys[0], kind: "usd" };
  }

  async function quoteKrakenFut(skill) {
    var data = await jsonGet(CONFIG.KRAKEN_FUT);
    var tickers = data && data.tickers ? data.tickers : [];
    var i, row = null;
    for (i = 0; i < tickers.length; i++) {
      if (tickers[i] && tickers[i].symbol === skill.pair) { row = tickers[i]; break; }
    }
    if (!row) throw new Error("no futures ticker");
    var last = row.last != null ? row.last : row.markPrice;
    if (last == null || last === "") throw new Error("no last");
    return { value: String(last), label: "$" + last, source: "kraken-futures:" + skill.pair, kind: "usd" };
  }

  async function quoteJupiter(skill) {
    var mint = typeof skill.ticker === "string" ? skill.ticker : null;
    if (!mint) throw new Error("no mint");
    var data = await jsonGet(CONFIG.JUP_PRICE + encodeURIComponent(mint));
    /* Jupiter price v3: { [mint]: { usdPrice } }. Keep a v2-shaped fallback. */
    var row = null;
    if (data && data[mint]) row = data[mint];
    else if (data && data.data && data.data[mint]) row = data.data[mint];
    var price = row && (row.usdPrice != null ? row.usdPrice : row.price);
    if (price == null || price === "") throw new Error("no price");
    return { value: String(price), label: "$" + price, source: "jup-lite-v3:" + skill.pair, kind: "usd" };
  }

  async function quoteIreRpc(skill) {
    if (skill.action === "mempool-watch" || skill.pair === "unconfirmed-txs" || skill.pair === "ire-1-mempool") {
      var mem = await jsonGet(CONFIG.IRE_MEMPOOL);
      var n = mem && mem.result && mem.result.n_txs != null ? mem.result.n_txs : (mem && mem.result && mem.result.txs ? mem.result.txs.length : null);
      if (n == null) throw new Error("no mempool");
      return { value: String(n), label: n + " unconfirmed txs (ire-1 testnet)", source: "ire-rpc/unconfirmed_txs", kind: "count" };
    }
    var data = await jsonGet(CONFIG.IRE_STATUS);
    var height = data && data.result && data.result.sync_info && data.result.sync_info.latest_block_height;
    if (height == null || height === "") throw new Error("no height");
    return { value: String(height), label: "ire-1 height " + height + " (testnet)", source: "ire-rpc/status", kind: "height" };
  }

  async function quoteCodex(skill) {
    /* Codex GraphQL price needs a key. Fall back to public Kraken / Dexscreener marks so every activated desk can work. */
    var map = {
      ETH: "ETHUSD", BTC: "XBTUSD", SOL: "SOLUSD", UNI: "UNIUSD", LINK: "LINKUSD",
      AAVE: "AAVEUSD", ARB: "ARBUSD", OP: "OPUSD", SUI: "SUIUSD", APT: "APTUSD",
      AVAX: "AVAXUSD", DOT: "DOTUSD", ATOM: "ATOMUSD", NEAR: "NEARUSD", FIL: "FILUSD"
    };
    var k = map[String(skill.pair || "").toUpperCase()];
    if (k) {
      var qk = await quoteKrakenSpot({ pair: k });
      qk.source = "kraken-public-fallback:" + skill.pair + " (codex desk)";
      return qk;
    }
    var data = await jsonGet("https://api.dexscreener.com/latest/dex/search?q=" + encodeURIComponent(skill.pair || ""));
    var pairs = data && data.pairs ? data.pairs : [];
    var i, row = null;
    for (i = 0; i < pairs.length; i++) {
      if (pairs[i] && pairs[i].priceUsd) { row = pairs[i]; break; }
    }
    if (!row) throw new Error("no public mark for codex desk pair");
    return {
      value: String(row.priceUsd),
      label: "$" + row.priceUsd,
      source: "dexscreener-fallback:" + (row.baseToken && row.baseToken.symbol ? row.baseToken.symbol : skill.pair),
      kind: "usd"
    };
  }

  async function quoteBlockscout(skill, url) {
    var data;
    try {
      data = await jsonGet(url);
    } catch (err) {
      /* Blockscout sometimes 403s from locked-down edges — fall back to Dexscreener search on the pair label. */
      var q = encodeURIComponent(skill.pair || skill.ticker || "ETH");
      var dex = await jsonGet("https://api.dexscreener.com/latest/dex/search?q=" + q);
      var pairs = dex && dex.pairs ? dex.pairs : [];
      var row = null, i;
      for (i = 0; i < pairs.length; i++) {
        if (pairs[i] && pairs[i].priceUsd) { row = pairs[i]; break; }
      }
      if (!row) throw new Error((err && err.message ? err.message : "blockscout unavailable") + "; no dexscreener fallback");
      return {
        value: String(row.priceUsd),
        label: "$" + row.priceUsd,
        source: "dexscreener-fallback:" + skill.pair,
        kind: "usd"
      };
    }
    var rate = data && data.exchange_rate;
    if (rate != null && rate !== "" && Number.isFinite(Number(rate)) && Number(rate) > 0) {
      return { value: String(rate), label: "$" + rate + " Blockscout exchange_rate (public quote, not a claimed NFT floor)", source: "blockscout:" + skill.pair, kind: "usd" };
    }
    /* NFTs / non-priced tokens: still work the desk with real public stats — never invent a USD floor. */
    var holders = data && (data.holders_count != null ? data.holders_count : data.holders);
    var supply = data && data.total_supply;
    if (holders != null && holders !== "") {
      return {
        value: String(holders),
        label: holders + " holders on Robinhood Chain Blockscout (public, not a USD quote)",
        source: "blockscout-holders:" + skill.pair,
        kind: "count"
      };
    }
    if (supply != null && supply !== "") {
      return {
        value: String(supply),
        label: "total_supply " + supply + " (Blockscout public)",
        source: "blockscout-supply:" + skill.pair,
        kind: "count"
      };
    }
    throw new Error("no exchange_rate / holders / supply");
  }

  async function quoteVolt(skill) {
    if (skill.pair === "community_tax" || skill.pair === "fee-split" || skill.pair === "genesis-tax") {
      var dist = await jsonGet(CONFIG.VOLT_DIST);
      var tax = dist && (dist.params || dist).community_tax;
      if (tax == null || tax === "") throw new Error("no community_tax");
      return { value: String(tax), label: "community_tax " + tax + " (ire-1 testnet)", source: "ire-lcd/distribution/params", kind: "ratio" };
    }
    var bank = await jsonGet(CONFIG.VOLT_BANK);
    var coins = bank && bank.balances ? bank.balances : [];
    var i, uire = null;
    for (i = 0; i < coins.length; i++) {
      if (coins[i] && coins[i].denom === "uire") { uire = coins[i].amount; break; }
    }
    if (uire == null) throw new Error("no uire");
    return { value: String(uire), label: uire + " uire at Volt (ire-1 testnet, not USD)", source: "ire-lcd/bank/volt", kind: "balance" };
  }

  async function fetchSkillQuote(skill) {
    if (!skill) throw new Error("no skill");
    if (skill.deskId === "kraken-spot") return await quoteKrakenSpot(skill);
    if (skill.deskId === "kraken-fut") return await quoteKrakenFut(skill);
    if (skill.deskId === "phantom-sol") return await quoteJupiter(skill);
    if (skill.deskId === "ire-rpc") return await quoteIreRpc(skill);
    if (skill.deskId === "codex-read") return await quoteCodex(skill);
    if (skill.deskId === "rh-blockscout") return await quoteBlockscout(skill, CONFIG.BLOCKSCOUT_TOKEN);
    if (skill.deskId === "combat-dea") return await quoteBlockscout(skill, CONFIG.BLOCKSCOUT_NINJA);
    if (skill.deskId === "ire-volt") return await quoteVolt(skill);
    throw new Error("unknown desk");
  }

  function gridLevels(price) {
    var p = Number(price);
    if (!Number.isFinite(p) || p <= 0) return null;
    function f(x) { return (Math.round(x * 1e8) / 1e8).toString(); }
    return [f(p * 0.98), f(p * 0.99), f(p), f(p * 1.01), f(p * 1.02)];
  }

  function renderSkill(id) {
    var box = $("bk-skill");
    var nameEl = $("bk-skill-name");
    var chips = $("bk-skill-chips");
    var facts = $("bk-skill-facts");
    var job = $("bk-skill-job");
    var skill = S && S.skillFor(id);
    if (!skill) {
      if (nameEl) nameEl.textContent = "Skill unavailable";
      return;
    }
    if (box) box.classList.remove("bk-hidden");
    if (nameEl) nameEl.textContent = skill.name;
    if (chips) {
      chips.innerHTML =
        '<span class="bk-skill-chip">' + escapeHtml(skill.role) + "</span>" +
        '<span class="bk-skill-chip">' + escapeHtml(skill.desk) + "</span>" +
        '<span class="bk-skill-chip">' + escapeHtml(skill.pair) + "</span>" +
        '<span class="bk-skill-chip">' + escapeHtml(skill.timeframe) + "</span>" +
        '<span class="bk-skill-chip">' + escapeHtml(skill.risk) + "</span>" +
        '<span class="bk-skill-chip">owner-signed</span>';
    }
    if (facts) {
      facts.innerHTML =
        "<div><dt>Skill</dt><dd>" + escapeHtml(skill.name) + "</dd></div>" +
        "<div><dt>skillId</dt><dd><code>" + escapeHtml(skill.skillId) + "</code></dd></div>" +
        "<div><dt>Desk</dt><dd>" + escapeHtml(skill.desk) + "</dd></div>" +
        "<div><dt>Role</dt><dd>" + escapeHtml(skill.role) + "</dd></div>" +
        "<div><dt>Pair</dt><dd>" + escapeHtml(skill.pair) + "</dd></div>" +
        "<div><dt>Venue</dt><dd>" + escapeHtml(skill.venue) + "</dd></div>" +
        "<div><dt>Timeframe</dt><dd>" + escapeHtml(skill.timeframe) + "</dd></div>" +
        "<div><dt>Risk</dt><dd>" + escapeHtml(skill.risk) + "</dd></div>" +
        "<div><dt>Execution</dt><dd>owner-signed</dd></div>" +
        "<div><dt>Data source</dt><dd><code>" + escapeHtml(skill.dataSource) + "</code></dd></div>";
    }
    if (job) {
      job.textContent = "This is the agent's job. " + skill.does +
        " Paper: " + skill.paperBehavior +
        " Live: owner signs a personal_sign intent JSON that includes skillId. Not a licensed broker.";
    }
  }

  function buildBrokerTicket(skill, quote, rec) {
    var ticket = {
      type: "crypto-brokers-desk-ticket",
      tokenId: state.id,
      skillId: skill.skillId,
      broker: skill.name,
      role: skill.role,
      action: skill.action,
      desk: skill.desk,
      pair: skill.pair,
      venue: skill.venue,
      timeframe: skill.timeframe,
      risk: skill.risk,
      mark: {
        value: quote.value,
        label: quote.label || String(quote.value),
        source: quote.source,
        kind: quote.kind
      },
      job: skill.does,
      recommendation: [],
      nextStep: "Owner personal_sign of this ticket. Broker does not send swap tx or take custody.",
      ts: new Date().toISOString()
    };
    var v = Number(quote.value);
    var usd = quote.kind === "usd" && Number.isFinite(v) && v > 0;

    if (skill.action === "grid-plan" && usd) {
      var g = gridLevels(quote.value);
      ticket.recommendation = [
        "Grid plan from live public mark " + ticket.mark.label,
        "Levels: " + (g ? g.join(" · ") : "n/a"),
        "Owner may place these as limit ideas on their own venue — this page does not place them."
      ];
      ticket.grid = g;
    } else if (skill.action === "dca-plan" && usd) {
      ticket.recommendation = [
        "DCA plan anchored to live mark " + ticket.mark.label,
        "Suggested slices: 4 buys over " + skill.timeframe + " (idea only)",
        "Size each slice yourself — broker ticket has no notional authority."
      ];
    } else if (skill.action === "drawdown-check") {
      var prev = rec && rec.quotes && rec.quotes[1];
      if (prev && usd && Number(prev.value) > 0) {
        var pct = ((v - Number(prev.value)) / Number(prev.value)) * 100;
        ticket.recommendation = [
          "Mark move vs last stored public quote: " + pct.toFixed(2) + "%",
          pct <= -3 ? "Desk flag: mark is soft vs prior quote — review risk before signing size." : "Desk flag: no hard drawdown vs prior stored quote.",
          "This is quote-to-quote change, not realized PnL."
        ];
        ticket.changePct = pct;
      } else {
        ticket.recommendation = ["Need a second public quote in the blotter before drawdown % is available."];
      }
    } else if (skill.action === "funding-scan") {
      ticket.recommendation = [
        "Funding / stats read: " + ticket.mark.label + " from " + ticket.mark.source,
        "Watch " + skill.pair + " on " + skill.venue + " for the next " + skill.timeframe,
        "No invented funding rate — only what the public API returned."
      ];
    } else if (skill.action === "mempool-watch" || skill.action === "snapshot") {
      ticket.recommendation = [
        "Desk snapshot: " + ticket.mark.label,
        "Source " + ticket.mark.source,
        "Log this mark and re-run the desk before any owner-signed live intent."
      ];
    } else if (skill.action === "clock-in-helper") {
      ticket.recommendation = [
        "Clock-in helper mark: " + ticket.mark.label,
        "Use this public reading when you prepare an owner-signed clock-in / intent.",
        "Broker does not broadcast the clock-in for you."
      ];
    } else if (skill.action === "scan") {
      ticket.recommendation = [
        "Market scan mark: " + skill.pair + " = " + ticket.mark.label,
        "Risk band: " + skill.risk + " · timeframe " + skill.timeframe,
        "Scan complete — sign the ticket to stamp this desk run on-record."
      ];
    } else {
      ticket.recommendation = [
        skill.role + " complete for " + skill.pair + ": " + ticket.mark.label,
        skill.does,
        "Sign the ticket to authorize this desk run (not a swap)."
      ];
    }
    return ticket;
  }

  function renderBrokerTicket(ticket) {
    var box = $("bk-ticket");
    var status = $("bk-desk-status");
    state.lastTicket = ticket || null;
    if (!box) return;
    if (!ticket) {
      box.innerHTML = '<p class="micro">No ticket yet.</p>';
      if (status) status.textContent = "Desk idle — activate or click Run broker desk.";
      return;
    }
    var lines = (ticket.recommendation || []).map(function (x) {
      return "<li>" + escapeHtml(x) + "</li>";
    }).join("");
    box.innerHTML =
      "<h3>" + escapeHtml(ticket.role) + " · " + escapeHtml(ticket.pair) + "</h3>" +
      "<p><strong>Mark:</strong> " + escapeHtml(ticket.mark.label) + " <span class=\"micro\">(" + escapeHtml(ticket.mark.source) + ")</span></p>" +
      "<p><strong>Job:</strong> " + escapeHtml(ticket.job) + "</p>" +
      "<ul>" + lines + "</ul>" +
      "<p class=\"micro\">" + escapeHtml(ticket.nextStep) + "</p>";
    if (status) {
      status.innerHTML = "Desk <strong>WORKING</strong> · last run " + escapeHtml(ticket.ts) +
        (isActivated(state.id) ? " · activated" : " · activate to unlock live sign");
    }
    var intent = $("bk-intent");
    if (intent && !intent.textContent.trim()) {
      /* preview unsigned ticket JSON for transparency */
    }
  }

  async function runBrokerDesk() {
    var id = state.id;
    if (!id) return;
    var skill = S && S.skillFor(id);
    var status = $("bk-desk-status");
    if (!skill) {
      if (status) status.textContent = "No skill for this id.";
      return;
    }
    if (status) status.textContent = "Desk running — fetching live public mark…";
    await onPaper();
    var rec = readJSON(storageKey("paper", id)) || { quotes: [] };
    var last = rec.quotes && rec.quotes[0];
    if (!last) {
      renderBrokerTicket(null);
      if (status) status.textContent = "Desk blocked — public quote unavailable (will not invent a mark).";
      return;
    }
    var quote = { value: last.value, label: last.label, source: last.source, kind: last.kind };
    var ticket = buildBrokerTicket(skill, quote, rec);
    writeJSON(storageKey("ticket", id), ticket);
    renderBrokerTicket(ticket);
    setText("bk-intent", JSON.stringify(ticket, null, 2));
    var explain = $("bk-live-explain");
    if (explain) {
      explain.textContent = "Ticket ready. Click Sign this broker ticket to personal_sign it. That records the desk run. It is not a swap and does not move funds.";
    }
  }

  function stopDeskHeartbeat() {
    if (state.deskTimer) {
      clearInterval(state.deskTimer);
      state.deskTimer = null;
    }
  }

  function startDeskHeartbeat(id) {
    stopDeskHeartbeat();
    if (!id || !isActivated(id)) return;
    state.deskTimer = setInterval(function () {
      if (state.id !== id || !isActivated(id)) { stopDeskHeartbeat(); return; }
      runBrokerDesk().catch(function () {});
    }, 60000);
  }

  async function onPaper() {
    var id = state.id;
    if (!id) return;
    var skill = S && S.skillFor(id);
    var off = $("bk-offline");
    var markEl = $("bk-mark");
    var extra = $("bk-quote-extra");
    show("bk-offline", false);
    if (extra) extra.textContent = "";
    if (!skill) {
      if (markEl) markEl.textContent = "quote unavailable";
      show("bk-offline", true);
      setText("bk-offline", "quote unavailable — no skill for this id.");
      return;
    }
    try {
      var quote = await fetchSkillQuote(skill);
      var label = quote.label || String(quote.value);
      if (markEl) {
        markEl.textContent = "Public quote " + skill.pair + " @ " + skill.venue + " = " + label + " · " + quote.source + " · not a fill";
      }
      var rec = readJSON(storageKey("paper", id)) || { quotes: [] };
      if (!rec.quotes) rec.quotes = [];
      rec.quotes.unshift({
        ts: new Date().toISOString(),
        pair: skill.pair,
        value: quote.value,
        label: label,
        source: quote.source,
        kind: quote.kind,
        skillId: skill.skillId
      });
      rec.quotes = rec.quotes.slice(0, 40);
      rec.orders = [];
      writeJSON(storageKey("paper", id), rec);
      renderPaperRows(id);
      try {
        var ticket = buildBrokerTicket(skill, quote, rec);
        writeJSON(storageKey("ticket", id), ticket);
        renderBrokerTicket(ticket);
      } catch (e) {}

      if (skill.action === "grid-plan" && quote.kind === "usd") {
        var g = gridLevels(quote.value);
        if (extra && g) extra.textContent = "Grid from live public quote (not orders): " + g.join(" · ");
      } else if (skill.action === "drawdown-check") {
        var prev = rec.quotes[1];
        if (extra) {
          if (!prev || prev.value == null) extra.textContent = "No prior public quote stored — no drawdown number.";
          else if (quote.kind === "usd" && Number(prev.value) > 0 && Number.isFinite(Number(quote.value))) {
            var pct = ((Number(quote.value) - Number(prev.value)) / Number(prev.value)) * 100;
            extra.textContent = "Change vs last stored public quote: " + pct.toFixed(2) + "% (from published quotes, not PnL).";
          } else extra.textContent = "Prior quote is not a USD mark — no drawdown %.";
        }
      } else if (skill.action === "dca-plan" && extra) {
        extra.textContent = "DCA plan uses this public quote as the mark. This page does not buy and does not invent fills.";
      }
    } catch (err) {
      if (markEl) markEl.textContent = "quote unavailable";
      show("bk-offline", true);
      setText("bk-offline", "quote unavailable for " + skill.pair + " @ " + skill.venue + ". This page will not invent a number. " + (err && err.message ? err.message : ""));
    }
  }

  function openConsole(id) {
    state.id = id;
    var m = M.mandateFor(id);
    var skill = S && S.skillFor(id);
    show("bk-landing", false);
    show("bk-console", true);
    setText("bk-console-name", m.name + (skill ? (" · " + skill.role) : ""));
    setText("bk-console-asset", skill ? (skill.pair + " · " + skill.desk) : m.primaryAsset);
    setHtml("bk-art", shotHtml(m));
    setHtml("bk-facts", factsHtml(m));
    setText("bk-quote", m.quote);
    renderSkill(id);
    var pill = $("bk-mode-pill");
    if (pill) {
      pill.dataset.state = "live";
      pill.innerHTML = "<i></i>ON-CHAIN" + (Number.isFinite(state.minted) ? (" · " + state.minted + " minted") : "");
    }
    renderPaperRows(id);
    renderLiveRows(id);
    refreshActivation();
    refreshValidator();
    ownerOf(id).then(function (own) {
      var box = $("bk-onchain-owner");
      if (!box) return;
      if (!own) {
        box.textContent = (Number.isFinite(state.minted) && id <= state.minted)
          ? "Minted; owner lookup failed."
          : "Not minted yet" + (Number.isFinite(state.minted) ? (" (supply " + state.minted + " / " + state.maxSupply + ").") : ".");
        return;
      }
      var mine = state.address && own.toLowerCase() === state.address.toLowerCase();
      box.innerHTML = (mine
        ? "You own this token on-chain. This is the agent's job. "
        : "On-chain owner <code>" + shortAddr(own) + "</code>. Skill is public; live run requires ownerOf. ") +
        "<a href=\"https://opensea.io/item/robinhood/0x9f7a3adbf611cbeec95ce40e0259bbf96b8df041/" + id + "\">OpenSea</a>";
    });
    setHtml("bk-mark", "Public quote not fetched.");
    show("bk-offline", false);
    var prior = readJSON(storageKey("ticket", id));
    if (prior) renderBrokerTicket(prior);
    else renderBrokerTicket(null);
    stopDeskHeartbeat();
    if (isActivated(id)) {
      startAgentDesk(id).then(function () {
        refreshActivation();
        renderPaperRows(id);
      }).catch(function () {});
    }
    var link = $("bk-activate-link");
    if (link) link.setAttribute("href", "activate.html?id=" + id);
  }

  function openLanding() {
    state.id = null;
    show("bk-landing", true);
    show("bk-console", false);
    renderLandingGrid();
  }

  function route() {
    var id = parseId(qs().get("id"));
    var page = document.body.getAttribute("data-page") || "";
    show("bk-activated", page === "activated" && !id);
    show("bk-my", page === "my" && !id);
    if (id) {
      show("bk-picker", false);
      show("bk-landing", false);
      show("bk-my", false);
      openConsole(id);
    } else if (page === "activate") {
      show("bk-landing", false);
      show("bk-console", false);
      show("bk-picker", true);
    } else if (page === "activated") {
      show("bk-landing", false);
      show("bk-console", false);
      show("bk-picker", false);
      renderActivated();
    } else if (page === "my") {
      show("bk-landing", false);
      show("bk-console", false);
      show("bk-picker", false);
      renderMyBrokers();
    } else {
      show("bk-picker", false);
      openLanding();
    }
  }

  async function recoverActivationFromTx(rawHash, rawId) {
    if (!state.address) { await connectWallet(); if (!state.address) return; }
    await ensureChain();
    var txHash = String(rawHash || "").trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error("Paste a full tx hash (0x… 66 chars) from Robinhood Chain Blockscout.");
    var id = parseId(rawId != null ? rawId : (state.id || ($("bk-recover-id") && $("bk-recover-id").value)));
    if (!id) throw new Error("Enter the token id this payment was for (1–5000).");
    await requireOwner(id);
    var ok = await verifyActivationPayment(txHash, state.address, id);
    if (!ok) throw new Error("Tx not found or not confirmed yet on Robinhood Chain. Wait and retry.");
    var rec = {
      address: state.address,
      id: id,
      txHash: txHash,
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      feeEth: CONFIG.ACTIVATION_FEE_ETH,
      feeWei: CONFIG.ACTIVATION_FEE_WEI,
      feeRecipient: CONFIG.ACTIVATION_FEE_RECIPIENT,
      data: activationData(id),
      chainId: state.chainId,
      contract: CONFIG.CONTRACT,
      ownerVerified: true,
      recovered: true,
      ts: new Date().toISOString()
    };
    writeJSON(activationStorageKey(state.address, id), rec);
    state.id = id;
    try { await startAgentDesk(id); } catch (e) {}
    refreshActivation();
    renderActivated();
    window.alert("Activation RECOVERED for #" + id + " on Robinhood Chain ETH.\nTx: " + txHash);
    renderBrokerTicket(readJSON(storageKey("ticket", id)));
  }

  async function onActivate() {
    if (!state.id) return;
    if (!state.address) { await connectWallet(); if (!state.address) return; }
    await ensureChain();
    var activationId = state.id;
    var activationAddress = state.address;
    await requireOwner(activationId);
    if (isActivated(activationId)) { refreshActivation(); return; }
    var approved = window.confirm(
      "Activate Crypto Broker #" + activationId + "?\n\n" +
      "Network: Robinhood Chain ETH — chainId 4663 (NOT Ethereum mainnet)\n" +
      "Activation fee: " + CONFIG.ACTIVATION_FEE_ETH + " ETH + network gas\n" +
      "Recipient: " + CONFIG.ACTIVATION_FEE_RECIPIENT + "\n\n" +
      "This payment enables this site's agent access and funds the public data/API path that keeps this desk WORKING (quotes + upgrades). It does not deploy an autonomous trading contract, take custody, or place unsupervised fills."
    );
    if (!approved) return;
    var accounts = await eth().request({ method: "eth_accounts" });
    if (!accounts || !sameAddr(accounts[0], activationAddress)) {
      throw new Error("The connected wallet changed. Verify ownership again before paying.");
    }
    var data = activationData(activationId);
    var txHash = await eth().request({
      method: "eth_sendTransaction",
      params: [{
        from: activationAddress,
        to: CONFIG.ACTIVATION_FEE_RECIPIENT,
        value: CONFIG.ACTIVATION_FEE_WEI,
        data: data
      }]
    });
    var rec = {
      address: activationAddress,
      id: activationId,
      txHash: txHash,
      confirmed: false,
      feeEth: CONFIG.ACTIVATION_FEE_ETH,
      feeWei: CONFIG.ACTIVATION_FEE_WEI,
      feeRecipient: CONFIG.ACTIVATION_FEE_RECIPIENT,
      data: data,
      chainId: state.chainId,
      contract: CONFIG.CONTRACT,
      ownerVerified: true,
      ts: new Date().toISOString()
    };
    writeJSON(activationStorageKey(activationAddress, activationId), rec);
    refreshActivation();
    var boxPend = $("bk-activation-state");
    if (boxPend) {
      boxPend.innerHTML = "Submitted on <strong>Robinhood Chain ETH (4663)</strong>. Waiting for confirmation… <a href=\"" + activationExplorer(txHash) + "\" target=\"_blank\" rel=\"noopener noreferrer\">View tx " + shortAddr(txHash) + "</a>";
    }
    await waitForReceipt(txHash);
    await verifyActivationPayment(txHash, activationAddress, activationId);
    rec.confirmed = true;
    rec.confirmedAt = new Date().toISOString();
    writeJSON(activationStorageKey(activationAddress, activationId), rec);
    try { await startAgentDesk(activationId); } catch (e) { /* quote miss still leaves agent READY */ }
    renderActivated();
    var box = $("bk-activation-state");
    var work = workingRecord(activationId);
    var statusWord = (work && work.status === "WORKING") ? "WORKING" : "READY";
    if (box && state.id === activationId && sameAddr(state.address, activationAddress)) {
      box.innerHTML = "ACTIVATED on Robinhood Chain ETH. Agent #" + activationId + " is <strong>" + statusWord +
        "</strong> for <code>" + shortAddr(activationAddress) +
        "</code>. <a href=\"" + activationExplorer(txHash) + "\" target=\"_blank\" rel=\"noopener noreferrer\">View transaction</a>. Open <a href=\"/brokers/activated.html\">Activated</a>.";
    }
    refreshActivation();
    refreshValidator();
    window.alert("Activation CONFIRMED on Robinhood Chain (ETH / 4663).\n\nBroker #" + activationId + " is " + statusWord + ".\nTx: " + txHash + "\n\nNext: Join the IRE (ire-1) validator waitlist on this page for 25 testnet points (IREVAL1).");
    refreshValidator();
    var joinVal = window.confirm("Join the IRE validator waitlist now from this wallet?\n\nWaitlist only — not a consensus seat. 25 testnet points when you broadcast IREVAL1.");
    if (joinVal) {
      try { await onValidatorSignup(); } catch (e) { alert(e.message || e); }
    }
  }

  async function onValidatorSignup() {
    if (!state.address) { await connectWallet(); if (!state.address) return; }
    var id = state.id || 1;
    var existing = readJSON(validatorKey(state.address));
    if (existing && existing.signature) {
      refreshValidator();
      return;
    }
    var msg = validatorMessage(state.address, id);
    var sig = await personalSign(msg);
    var rec = {
      address: state.address,
      id: id,
      message: msg,
      signature: sig,
      chainId: state.chainId,
      memo: validatorMemo(state.address, id),
      cli: validatorCli(state.address, id),
      reward: "25 testnet points on IREVAL1 inscription",
      ts: new Date().toISOString()
    };
    writeJSON(validatorKey(state.address), rec);
    refreshValidator();
  }

  function makeNonce() {
    var bytes = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else {
      var i;
      for (i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  function buildSkillIntent(skill, id) {
    var deadline = Math.floor(Date.now() / 1000) + 900;
    var ticket = state.lastTicket || readJSON(storageKey("ticket", id));
    return {
      type: "crypto-brokers-skill",
      tokenId: id,
      skillId: skill.skillId,
      desk: skill.desk,
      pair: skill.pair,
      action: skill.action,
      nonce: makeNonce(),
      deadline: deadline,
      role: skill.role,
      venue: skill.venue,
      timeframe: skill.timeframe,
      risk: skill.risk,
      execution: "owner-signed",
      contract: CONFIG.CONTRACT,
      chainId: CONFIG.CHAIN.chainId,
      owner: state.address,
      ticket: ticket,
      note: "Owner-signed broker desk ticket. Not a swap. Not custody. Not a licensed broker. Not Robinhood Inc. ire-1 is a testnet. IREVAL1 is waitlist points.",
      ts: new Date().toISOString()
    };
  }

  async function onLive() {
    var id = state.id;
    if (!id) return;
    var skill = S && S.skillFor(id);
    if (!skill) { alert("Skill unavailable for this id."); return; }
    if (!state.address) { await connectWallet(); if (!state.address) return; }
    await requireOwner(id);
    if (!isActivated(id)) throw new Error("Activate this Broker Agent with the 0.001 ETH fee before signing a live intent.");
    if (!state.lastTicket) {
      try { await runBrokerDesk(); } catch (e) {}
    }
    var order = buildSkillIntent(skill, id);
    var pretty = JSON.stringify(order, null, 2);
    setText("bk-intent", pretty);
    var explain = $("bk-live-explain");
    if (explain) {
      explain.textContent = "Live path is personal_sign of this JSON skill intent only. Owner signs. This page does not call approve, eth_sendTransaction, or swap calldata, and it does not take custody or invent PnL.";
    }
    var sig = await personalSign(pretty);
    order.signature = sig;
    var rec = readJSON(storageKey("live", id)) || { intents: [] };
    rec.intents.unshift({
      ts: order.ts,
      action: skill.action,
      pair: skill.pair,
      skillId: skill.skillId,
      signature: sig,
      order: order
    });
    writeJSON(storageKey("live", id), rec);
    renderLiveRows(id);
  }

  async function scanOwned() {
    var grid = $("bk-my-grid");
    var empty = $("bk-my-empty");
    var prog = $("bk-my-progress");
    if (!grid) return [];
    if (!state.address) {
      grid.innerHTML = "";
      if (empty) {
        empty.classList.remove("bk-hidden");
        empty.textContent = "Connect a wallet. This page then ownerOf-scans 1..totalSupply (batched) and shows skills for tokens you own.";
      }
      if (prog) prog.textContent = "";
      return [];
    }
    if (!Number.isFinite(state.minted)) {
      if (empty) {
        empty.classList.remove("bk-hidden");
        empty.textContent = state.mintFetched
          ? "On-chain totalSupply unavailable. Will not invent a mint count or owned set."
          : "Fetching totalSupply (0x18160ddd)…";
      }
      grid.innerHTML = "";
      return [];
    }
    var cap = Math.min(state.minted, M.COLLECTION_SIZE);
    if (cap <= 0) {
      if (empty) {
        empty.classList.remove("bk-hidden");
        empty.textContent = "On-chain totalSupply is 0. No tokens to scan.";
      }
      grid.innerHTML = "";
      return [];
    }
    if (empty) empty.classList.remove("bk-hidden");

    var bal = await balanceOf(state.address);
    if (prog) {
      prog.textContent = "balanceOf " + (bal == null ? "?" : bal) + " · scanning ownerOf 1–" + cap + " via Robinhood public RPC…";
    }

    var owned = [];
    var failed = 0;
    var batch = 20;
    var i = 1;
    while (i <= cap) {
      var chunk = [];
      var j;
      for (j = 0; j < batch && i + j <= cap; j++) chunk.push(i + j);
      var results = await Promise.all(chunk.map(function (tid) { return ownerOfWithRetry(tid); }));
      for (j = 0; j < results.length; j++) {
        if (!results[j].ok) { failed += 1; continue; }
        if (results[j].own && sameAddr(results[j].own, state.address)) owned.push(results[j].id);
      }
      if (prog) {
        prog.textContent = "ownerOf scan " + Math.min(i + chunk.length - 1, cap) + " / " + cap +
          " · owned " + owned.length +
          (bal != null ? (" · balanceOf " + bal) : "") +
          (failed ? (" · rpc fails " + failed) : "");
      }
      if (empty) {
        empty.textContent = "Scanning ownerOf via public Robinhood RPC (batch " + batch + "). balanceOf=" +
          (bal == null ? "?" : bal) + ".";
      }
      i += batch;
      await new Promise(function (r) { setTimeout(r, 40); });
    }

    state._lastScan = { owned: owned.slice(), bal: bal, failed: failed, cap: cap, ts: new Date().toISOString() };
    if (failed > 0 && owned.length === 0 && bal > 0 && empty) {
      empty.innerHTML = "Scan hit <strong>" + failed + " RPC failures</strong> and found 0 ids, but on-chain <code>balanceOf</code> is <strong>" +
        bal + "</strong> for <code>" + shortAddr(state.address) +
        "</code>. Hit <strong>Scan ownerOf</strong> again.";
    }
    return owned;
  }

  async function renderMyBrokers() {
    var grid = $("bk-my-grid");
    var empty = $("bk-my-empty");
    var prog = $("bk-my-progress");
    if (!grid) return;
    if (!state.address) {
      grid.innerHTML = "";
      if (empty) {
        empty.classList.remove("bk-hidden");
        empty.textContent = "Connect a wallet to list Crypto Brokers you own on-chain (ownerOf) and their skills.";
      }
      if (prog) prog.textContent = "";
      return;
    }
    if (!state.mintFetched) {
      if (empty) {
        empty.classList.remove("bk-hidden");
        empty.textContent = "Fetching totalSupply (0x18160ddd)…";
      }
      return;
    }
    var owned = await scanOwned();
    if (!owned.length) {
      grid.innerHTML = "";
      if (empty) {
        empty.classList.remove("bk-hidden");
        var scan = state._lastScan || {};
        if (scan.bal > 0) {
          empty.innerHTML = "Scan returned 0 ids but <code>balanceOf</code> is <strong>" + scan.bal +
            "</strong> for <code>" + shortAddr(state.address) +
            "</code>" + (scan.failed ? (" (" + scan.failed + " RPC fails)") : "") +
            ". Hit <strong>Scan ownerOf</strong> again — reads use the public Robinhood RPC.";
        } else {
          empty.innerHTML = "No tokens in 1–totalSupply currently ownerOf-match <code>" + shortAddr(state.address) +
            "</code>" + (scan.bal === 0 ? " (balanceOf 0)." : ".");
        }
      }
      return;
    }
    if (empty) empty.classList.add("bk-hidden");
    grid.innerHTML = owned.map(function (id) {
      var skill = S && S.skillFor(id);
      var card = cardHtml(id, "/brokers/activate.html?id=" + id);
      if (!skill) return card;
      return card.replace("</p></a>", "</p><p class=\"bk-card-skill\">" + escapeHtml(skill.name) + "</p></a>");
    }).join("");
  }

  function copyIntent() {
    var t = $("bk-intent") ? $("bk-intent").textContent : "";
    if (!t) return;
    navigator.clipboard.writeText(t).catch(function () {});
  }

  function bind() {
        document.querySelectorAll("[data-switch-chain]").forEach(function (b) {
      b.addEventListener("click", function () {
        ensureChain().catch(function (e) { alert(e.message || e); });
      });
    });
    document.querySelectorAll("[data-connect]").forEach(function (b) {
      b.addEventListener("click", function () { connectWallet().catch(function (e) { alert(e.message || e); }); });
    });
    var prev = $("bk-prev");
    var next = $("bk-next");
    if (prev) prev.addEventListener("click", function () {
      state.page = Math.max(1, state.page - 1);
      renderLandingGrid();
    });
    if (next) next.addEventListener("click", function () {
      var max = Math.ceil(M.COLLECTION_SIZE / state.pageSize);
      state.page = Math.min(max, state.page + 1);
      renderLandingGrid();
    });
    var jump = $("bk-jump-form");
    if (jump) jump.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = parseId($("bk-jump").value);
      if (!id) return;
      location.href = "/brokers/activate.html?id=" + id;
    });
    function applyFilters() {
      state.filter = ($("bk-search") && $("bk-search").value) || "";
      state.universe = ($("bk-universe") && $("bk-universe").value) || "";
      state.strategy = ($("bk-strategy") && $("bk-strategy").value) || "";
      state.page = 1;
      renderLandingGrid();
    }
    var search = $("bk-search");
    if (search) search.addEventListener("input", applyFilters);
    var uni = $("bk-universe");
    if (uni) uni.addEventListener("change", applyFilters);
    var strat = $("bk-strategy");
    if (strat) strat.addEventListener("change", applyFilters);
    var act = $("bk-activate");
    if (act) act.addEventListener("click", function () {
      var original = act.textContent;
      act.disabled = true;
      act.textContent = "Processing activation…";
      onActivate().catch(function (e) { alert(e.message || e); }).finally(function () {
        act.disabled = false;
        act.textContent = original;
      });
    });
    var valBtn = $("bk-validator");
    if (valBtn) valBtn.addEventListener("click", function () { onValidatorSignup().catch(function (e) { alert(e.message || e); }); });
    var recoverBtn = $("bk-recover");
    if (recoverBtn) recoverBtn.addEventListener("click", function () {
      var hashEl = $("bk-recover-tx");
      var idEl = $("bk-recover-id");
      recoverActivationFromTx(hashEl && hashEl.value, idEl && idEl.value).catch(function (e) { alert(e.message || e); });
    });
    var runDesk = $("bk-run-desk");
    if (runDesk) runDesk.addEventListener("click", function () { runBrokerDesk().catch(function (e) { alert(e.message || e); }); });
    var paper = $("bk-paper-mark");
    if (paper) paper.addEventListener("click", function () { onPaper().catch(function (e) { alert(e.message || e); }); });
    var live = $("bk-live");
    if (live) live.addEventListener("click", function () { onLive().catch(function (e) { alert(e.message || e); }); });
    var copy = $("bk-copy-intent");
    if (copy) copy.addEventListener("click", copyIntent);
    var myScan = $("bk-my-scan");
    if (myScan) myScan.addEventListener("click", function () {
      renderMyBrokers().catch(function (e) { alert(e.message || e); });
    });
    window.addEventListener("popstate", route);
    var provider = eth();
    if (provider && provider.on) {
      provider.on("accountsChanged", function (acc) {
        state.address = acc && acc[0] ? acc[0] : null;
        setWalletUi();
        if (state.id) refreshActivation();
        refreshValidator();
        renderActivated();
        renderMyBrokers();
      });
      provider.on("chainChanged", function (hex) {
        state.chainId = hexToInt(hex);
        setWalletUi();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    bind();
    setWalletUi();
    var contractEl = $("bk-contract");
    if (contractEl) contractEl.textContent = CONFIG.CONTRACT;
    route();
    refreshMinted();
    if (eth()) {
      eth().request({ method: "eth_accounts" }).then(function (acc) {
        state.address = acc && acc[0] ? acc[0] : null;
        return eth().request({ method: "eth_chainId" });
      }).then(function (hex) {
        state.chainId = hexToInt(hex);
        setWalletUi();
        if (state.id) refreshActivation();
        refreshValidator();
        renderActivated();
        renderMyBrokers();
      }).catch(function () {});
    }
  });

  window.BrokersSite = { CONFIG: CONFIG, parseId: parseId, skillFor: function (id) { return S && S.skillFor(id); } };
})();
