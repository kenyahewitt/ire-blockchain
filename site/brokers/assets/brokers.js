/**
 * Crypto Brokers activation site.
 * CONTRACT is null until a real ERC-721 is deployed from OWNER on Robinhood Chain.
 * Live path is owner-signed intent only — no swap calldata, no custody, no unsupervised send.
 */
(function () {
  "use strict";

  var M = window.BrokersMandates;
  var R = window.BrokersRender;

  var CONFIG = {
    CONTRACT: "0x9F7A3ADbF611cBeeC95Ce40e0259bbF96b8Df041",
    PREVIEW: false,
    OWNER: M.OWNER,
    TWITTER: "FURBI50360",
    OPENSEA: "https://opensea.io/collection/crypto-brokers-894013111",
    EXPLORER: "https://robinhoodchain.blockscout.com/token/0x9F7A3ADbF611cBeeC95Ce40e0259bbF96b8Df041",
    BLOCKSCOUT_TOKEN: "https://robinhoodchain.blockscout.com/api/v2/tokens/0x9F7A3ADbF611cBeeC95Ce40e0259bbF96b8Df041",
    CHAIN: {
      chainId: 4663,
      chainIdHex: "0x1237",
      name: "Robinhood Chain",
      rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
      explorer: "https://robinhoodchain.blockscout.com",
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }
    },
    DEXSCREENER: "https://api.dexscreener.com/latest/dex/search?q="
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
    minted: 20,
    maxSupply: 5000
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

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; }
  }

  function writeJSON(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function activateMessage(id) {
    return "Activate Crypto Broker #" + id + " as my agent. Owner signs every live trade. Not a licensed broker.";
  }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }

  function setHtml(id, html) {
    var el = $(id);
    if (el) el.innerHTML = html;
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
    var provider = eth();
    var params = [{ to: CONFIG.CONTRACT, data: data }, "latest"];
    if (provider) {
      return await provider.request({ method: "eth_call", params: params });
    }
    var rpcs = CONFIG.CHAIN.rpcUrls || [];
    var i, res, j;
    for (i = 0; i < rpcs.length; i++) {
      try {
        res = await fetch(rpcs[i], {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: params })
        });
        j = await res.json();
        if (j && j.result) return j.result;
      } catch (e) {}
    }
    res = await fetch(CONFIG.BLOCKSCOUT_TOKEN);
    j = await res.json();
    if (j && j.total_supply) return null;
    return null;
  }

  async function refreshMinted() {
    var n = state.minted;
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
    if (Number.isFinite(n) && n >= 0) state.minted = n;
    var el = $("bk-mint-count");
    if (el) el.innerHTML = "<strong>" + state.minted + " / " + state.maxSupply + "</strong> minted on-chain";
    var live = $("bk-mint-live");
    if (live) live.textContent = "SeaDrop ERC-721 · ids 1–" + state.minted + " live";
    var contractEl = $("bk-contract");
    if (contractEl) contractEl.textContent = CONFIG.CONTRACT;
    document.querySelectorAll("[data-contract]").forEach(function (n) { n.textContent = CONFIG.CONTRACT; });
    renderLandingGrid();
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
      chainText = "Robinhood Chain · " + CONFIG.CHAIN.chainId;
    } else if (eth() && state.chainId) {
      chainText = "Wrong chain " + state.chainId + " — switch to " + CONFIG.CHAIN.chainId;
    }
    labels.forEach(function (el) { el.innerHTML = labelHtml; });
    chains.forEach(function (el) { el.textContent = chainText; });
  }

  async function ensureChain() {
    var provider = eth();
    if (!provider) throw new Error("No injected wallet");
    var current = hexToInt(await provider.request({ method: "eth_chainId" }));
    state.chainId = current;
    if (current === CONFIG.CHAIN.chainId) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CONFIG.CHAIN.chainIdHex }]
      });
    } catch (err) {
      if (err && (err.code === 4902 || err.code === -32603)) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: CONFIG.CHAIN.chainIdHex,
            chainName: CONFIG.CHAIN.name,
            nativeCurrency: CONFIG.CHAIN.nativeCurrency,
            rpcUrls: CONFIG.CHAIN.rpcUrls,
            blockExplorerUrls: [CONFIG.CHAIN.explorer]
          }]
        });
      } else {
        throw err;
      }
    }
    state.chainId = hexToInt(await provider.request({ method: "eth_chainId" }));
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
    renderActivated();
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
    return (
      "<div><dt>Primary asset</dt><dd>" + m.primaryAsset + " · " + m.primaryKind + "</dd></div>" +
      "<div><dt>Secondary</dt><dd>" + m.secondary + "</dd></div>" +
      "<div><dt>Strategy</dt><dd>" + m.strategy + "</dd></div>" +
      "<div><dt>Universe</dt><dd>" + m.universe + "</dd></div>" +
      "<div><dt>Venue</dt><dd>" + m.venue + "</dd></div>" +
      "<div><dt>Timeframe</dt><dd>" + m.timeframe + "</dd></div>" +
      "<div><dt>Max notional</dt><dd>$" + m.maxNotionalUsd.toLocaleString("en-US") + "</dd></div>" +
      "<div><dt>Min mcap filter</dt><dd>$" + m.minMcapUsd.toLocaleString("en-US") + " (mandate, not a floor)</dd></div>" +
      "<div><dt>Head</dt><dd>" + m.head + "</dd></div>" +
      "<div><dt>Coat</dt><dd>" + m.coat + "</dd></div>" +
      "<div><dt>Suit</dt><dd>" + m.suit + "</dd></div>" +
      "<div><dt>Accent</dt><dd>" + m.accent + "</dd></div>" +
      "<div><dt>HUD</dt><dd>" + m.hud + "</dd></div>" +
      "<div><dt>Hand</dt><dd>" + m.hand + "</dd></div>" +
      "<div><dt>Base</dt><dd>" + m.base + "</dd></div>" +
      "<div><dt>Rarity</dt><dd>" + m.rarity + "</dd></div>"
    );
  }


  var HEAD_SHOT = {
    "Gold Skull": "gold-skull.jpg",
    "Chrome Skull": "chrome-skull.jpg",
    "Matte Helm": "matte-helm.jpg",
    "Violet Slit": "violet-slit.jpg",
    "Ember Mask": "ember-mask.jpg",
    "Paper Visor": "paper-visor.jpg"
  };

  function shotUrl(m) {
    var f = HEAD_SHOT[m.head] || "gold-skull.jpg";
    return "/brokers/assets/agents3d/" + f;
  }

  function tapeText(m) {
    var side = (m.id % 2 === 0) ? "BUY" : "SELL";
    var px = ((m.id % 97) / 10).toFixed(2);
    return "LIVE  ·  #" + m.id + "  ·  " + m.primaryAsset + "  " + side + "  " + px +
      "%  ·  " + m.strategy + "  ·  " + m.venue + "  ·  MAX $" + m.maxNotionalUsd +
      "  ·  CRYPTO BROKERS FLOOR  ·  ";
  }

  function shotHtml(m) {
    var t = tapeText(m);
    return '<div class="bk-shot">' +
      '<img src="' + shotUrl(m) + '" alt="' + m.name + ' 3D agent">' +
      '<span class="bk-pulse"><i></i>trading</span>' +
      '<div class="bk-tape"><span>' + t + t + '</span></div>' +
      '</div>';
  }

  function isActivated(id) {
    if (!state.address) return false;
    var rec = readJSON(storageKey("activation", id));
    return !!(rec && rec.signature);
  }

  function matchesFilter(m) {
    if (state.universe && m.universe !== state.universe) return false;
    if (state.strategy && String(m.strategy).toLowerCase() !== String(state.strategy).toLowerCase()) return false;
    var q = (state.filter || "").trim().toLowerCase();
    if (!q) return true;
    var blob = ("#" + m.id + " " + m.name + " " + m.primaryAsset + " " + m.secondary + " " + m.strategy + " " + m.venue + " " + m.universe).toLowerCase();
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
    var tags = "";
    if (minted) tags += ' <span class="bk-tag">minted</span>';
    if (on) tags += ' <span class="bk-tag">activated</span>';
    return '<a href="' + href + '" data-id="' + id + '" data-activated="' + (on ? "1" : "0") + '" data-minted="' + (minted ? "1" : "0") + '">' +
      shotHtml(m) +
      '<p class="bk-card-meta"><strong>#' + id + tags +
      "</strong>" + m.primaryAsset + " · " + m.strategy + " · live tape</p></a>";
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
    var mint = $("bk-mint-count");
    if (mint) mint.textContent = "5000 / 5000 agents in the drop";
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
      if (rec && rec.signature && rec.id) out.push(rec);
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
        empty.innerHTML = "No activations for <code>" + shortAddr(state.address) + "</code> yet. Open <a href=\"/brokers/activate.html\">Activate</a> and sign for a token you own.";
      }
      return;
    }
    if (empty) empty.classList.add("bk-hidden");
    grid.innerHTML = recs.map(function (rec) {
      return cardHtml(rec.id, "/brokers/activate.html?id=" + rec.id);
    }).join("");
  }

  function refreshActivation() {
    var id = state.id;
    var box = $("bk-activation-state");
    if (!box || !id) return;
    if (!state.address) {
      box.textContent = "Connect a wallet to activate. Activation is a personal_sign only — this page never takes custody.";
      return;
    }
    var rec = readJSON(storageKey("activation", id));
    if (rec && rec.signature) {
      box.innerHTML = "Activated for <code>" + shortAddr(rec.address) + "</code> at " + rec.ts + ". Signature stored locally (address+id). Not on-chain until CONTRACT is set.";
    } else {
      box.textContent = "Not activated for this address + id.";
    }
  }

  function renderPaperRows(id) {
    var body = $("bk-blotter-body");
    if (!body) return;
    var rec = readJSON(storageKey("paper", id)) || { orders: [] };
    if (!rec.orders.length) {
      body.innerHTML = '<tr><td colspan="5">No paper fills. Fetch a public mark first. This table will not invent PnL.</td></tr>';
      return;
    }
    body.innerHTML = rec.orders.map(function (o) {
      return "<tr><td>" + o.ts + "</td><td>" + o.side + "</td><td>" + o.size + "</td><td>" +
        (o.markUsd != null ? o.markUsd : "offline") + "</td><td>" + (o.source || "") + "</td></tr>";
    }).join("");
  }

  function renderLiveRows(id) {
    var body = $("bk-live-body");
    if (!body) return;
    var rec = readJSON(storageKey("live", id)) || { intents: [] };
    if (!rec.intents.length) {
      body.innerHTML = "<tr><td colspan=\"3\">No signed live intents.</td></tr>";
      return;
    }
    body.innerHTML = rec.intents.map(function (o) {
      return "<tr><td>" + o.ts + "</td><td>" + o.side + " " + o.size + " " + o.primaryAsset + "</td><td>" + shortAddr(o.signature) + "</td></tr>";
    }).join("");
  }

  async function fetchMark(symbol) {
    var url = CONFIG.DEXSCREENER + encodeURIComponent(symbol);
    var res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error("quote HTTP " + res.status);
    var data = await res.json();
    var pairs = data && data.pairs ? data.pairs : [];
    var i, p, best = null, liq = -1, n;
    for (i = 0; i < pairs.length; i++) {
      p = pairs[i];
      if (!p || p.priceUsd == null) continue;
      n = p.liquidity && p.liquidity.usd != null ? Number(p.liquidity.usd) : 0;
      if (n > liq) { liq = n; best = p; }
    }
    if (!best || best.priceUsd == null) throw new Error("no public priceUsd");
    return {
      priceUsd: String(best.priceUsd),
      source: "dexscreener:" + (best.chainId || "?") + ":" + (best.dexId || "?"),
      pair: (best.baseToken && best.baseToken.symbol) || symbol
    };
  }

  function openConsole(id) {
    state.id = id;
    var m = M.mandateFor(id);
    show("bk-landing", false);
    show("bk-console", true);
    setText("bk-console-name", m.name);
    setText("bk-console-asset", m.primaryAsset);
    setHtml("bk-art", shotHtml(m));
    setHtml("bk-facts", factsHtml(m));
    setText("bk-quote", m.quote);
    var pill = $("bk-mode-pill");
    if (pill) {
      pill.dataset.state = "live";
      pill.innerHTML = "<i></i>ON-CHAIN · " + state.minted + " minted";
    }
    var cap = $("bk-size");
    if (cap) {
      cap.max = String(m.maxNotionalUsd);
      cap.placeholder = "size ≤ " + m.maxNotionalUsd;
    }
    renderPaperRows(id);
    renderLiveRows(id);
    refreshActivation();
    ownerOf(id).then(function (own) {
      var box = $("bk-onchain-owner");
      if (!box) return;
      if (!own) { box.textContent = id <= state.minted ? "Minted; owner lookup failed." : "Not minted yet (supply " + state.minted + " / " + state.maxSupply + ")."; return; }
      var mine = state.address && own.toLowerCase() === state.address.toLowerCase();
      box.innerHTML = (mine ? "You own this token on-chain. " : "On-chain owner <code>" + shortAddr(own) + "</code>. ") +
        "<a href=\"https://opensea.io/item/robinhood/0x9f7a3adbf611cbeec95ce40e0259bbf96b8df041/" + id + "\">OpenSea</a>";
    });
    setHtml("bk-mark", "Public mark not fetched.");
    show("bk-offline", false);
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
    if (id) {
      show("bk-picker", false);
      show("bk-landing", false);
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
    } else {
      show("bk-picker", false);
      openLanding();
    }
  }

  async function onActivate() {
    if (!state.id) return;
    if (!state.address) { await connectWallet(); if (!state.address) return; }
    var msg = activateMessage(state.id);
    var sig = await personalSign(msg);
    var rec = {
      address: state.address,
      id: state.id,
      message: msg,
      signature: sig,
      chainId: state.chainId,
      contract: CONFIG.CONTRACT,
      ts: new Date().toISOString()
    };
    writeJSON(storageKey("activation", state.id), rec);
    refreshActivation();
    renderActivated();
    var box = $("bk-activation-state");
    if (box) {
      box.innerHTML = "Activated #" + state.id + " for <code>" + shortAddr(state.address) + "</code>. Open your <a href=\"/brokers/activated.html\">activated desk</a>. Signature is local until CONTRACT is set.";
    }
  }

  async function onPaper() {
    var id = state.id;
    if (!id) return;
    var m = M.mandateFor(id);
    var off = $("bk-offline");
    var markEl = $("bk-mark");
    show("bk-offline", false);
    try {
      var quote = await fetchMark(m.primaryAsset);
      markEl.innerHTML = "Public mark <strong>" + m.primaryAsset + "</strong> = $" + quote.priceUsd +
        " <span class=\"micro\">" + quote.source + "</span>";
      var rec = readJSON(storageKey("paper", id)) || { orders: [] };
      rec.orders.unshift({
        ts: new Date().toISOString(),
        side: "mark",
        size: 0,
        markUsd: quote.priceUsd,
        source: quote.source,
        asset: m.primaryAsset
      });
      rec.orders = rec.orders.slice(0, 40);
      writeJSON(storageKey("paper", id), rec);
      renderPaperRows(id);
    } catch (err) {
      markEl.textContent = "";
      show("bk-offline", true);
      setText("bk-offline", "OFFLINE — public quote failed for " + m.primaryAsset + ". This page will not invent prices or PnL. " + (err && err.message ? err.message : ""));
    }
  }

  async function onPaperFill() {
    var id = state.id;
    if (!id) return;
    var m = M.mandateFor(id);
    var side = ($("bk-side") && $("bk-side").value) || "buy";
    var size = Number($("bk-size") && $("bk-size").value);
    if (!Number.isFinite(size) || size <= 0) { alert("Enter a size under the notional cap."); return; }
    if (size > m.maxNotionalUsd) { alert("Size exceeds max notional $" + m.maxNotionalUsd); return; }
    try {
      var quote = await fetchMark(m.primaryAsset);
      var rec = readJSON(storageKey("paper", id)) || { orders: [] };
      rec.orders.unshift({
        ts: new Date().toISOString(),
        side: side,
        size: size,
        markUsd: quote.priceUsd,
        source: quote.source,
        asset: m.primaryAsset,
        paper: true
      });
      writeJSON(storageKey("paper", id), rec);
      renderPaperRows(id);
      setHtml("bk-mark", "Paper fill at public mark $" + quote.priceUsd + " — simulated, not a live trade.");
      show("bk-offline", false);
    } catch (err) {
      show("bk-offline", true);
      setText("bk-offline", "OFFLINE — no public mark, so no paper fill and no invented PnL.");
    }
  }

  function buildOrder(m, side, size) {
    return {
      type: "crypto-brokers-live-intent",
      version: 1,
      tokenId: m.id,
      primaryAsset: m.primaryAsset,
      secondary: m.secondary,
      side: side,
      size: size,
      sizeUnit: "usd-notional",
      maxNotionalUsd: m.maxNotionalUsd,
      minMcapUsd: m.minMcapUsd,
      timeframe: m.timeframe,
      venue: m.venue,
      strategy: m.strategy,
      contract: CONFIG.CONTRACT,
      chainId: CONFIG.CHAIN.chainId,
      owner: state.address,
      note: "Owner-signed intent only. Not a swap. Not custody. Not a licensed broker. Not Robinhood Inc.",
      ts: new Date().toISOString()
    };
  }

  async function onLive() {
    var id = state.id;
    if (!id) return;
    var m = M.mandateFor(id);
    var side = ($("bk-side") && $("bk-side").value) || "buy";
    var size = Number($("bk-size") && $("bk-size").value);
    if (!Number.isFinite(size) || size <= 0) { alert("Enter a size under the notional cap."); return; }
    if (size > m.maxNotionalUsd) { alert("Size exceeds max notional $" + m.maxNotionalUsd); return; }
    if (!state.address) { await connectWallet(); if (!state.address) return; }
    var order = buildOrder(m, side, size);
    var pretty = JSON.stringify(order, null, 2);
    setText("bk-intent", pretty);

    if (CONFIG.CONTRACT == null) {
      try { await navigator.clipboard.writeText(pretty); } catch (e) { /* ignore */ }
      var explain = $("bk-live-explain");
      if (explain) {
        explain.textContent = "CONTRACT is null (PREVIEW). Order JSON copied when the clipboard allows. After a real ERC-721 is deployed from " +
          CONFIG.OWNER + " on Robinhood Chain, the owner still signs each live trade. This page will not craft swap-router calldata or call eth_sendTransaction. You sign ERC-20 / swap yourself in your wallet once a collection address exists.";
      }
    }

    var sig = await personalSign(pretty);
    order.signature = sig;
    var rec = readJSON(storageKey("live", id)) || { intents: [] };
    rec.intents.unshift({
      ts: order.ts,
      side: side,
      size: size,
      primaryAsset: m.primaryAsset,
      signature: sig,
      order: order
    });
    writeJSON(storageKey("live", id), rec);
    renderLiveRows(id);
  }

  function copyIntent() {
    var t = $("bk-intent") ? $("bk-intent").textContent : "";
    if (!t) return;
    navigator.clipboard.writeText(t).catch(function () {});
  }

  function bind() {
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
    if (act) act.addEventListener("click", function () { onActivate().catch(function (e) { alert(e.message || e); }); });
    var paper = $("bk-paper-mark");
    if (paper) paper.addEventListener("click", function () { onPaper().catch(function (e) { alert(e.message || e); }); });
    var fill = $("bk-paper-fill");
    if (fill) fill.addEventListener("click", function () { onPaperFill().catch(function (e) { alert(e.message || e); }); });
    var live = $("bk-live");
    if (live) live.addEventListener("click", function () { onLive().catch(function (e) { alert(e.message || e); }); });
    var copy = $("bk-copy-intent");
    if (copy) copy.addEventListener("click", copyIntent);
    window.addEventListener("popstate", route);
    var provider = eth();
    if (provider && provider.on) {
      provider.on("accountsChanged", function (acc) {
        state.address = acc && acc[0] ? acc[0] : null;
        setWalletUi();
        if (state.id) refreshActivation();
        renderActivated();
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
        renderActivated();
      }).catch(function () {});
    }
  });

  window.BrokersSite = { CONFIG: CONFIG, parseId: parseId };
})();
