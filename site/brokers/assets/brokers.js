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
    CONTRACT: null,
    PREVIEW: true,
    OWNER: M.OWNER,
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
    pageSize: 24,
    id: null
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

  function renderLandingGrid() {
    var grid = $("bk-grid");
    if (!grid) return;
    var start = (state.page - 1) * state.pageSize + 1;
    var end = Math.min(M.COLLECTION_SIZE, start + state.pageSize - 1);
    var html = "";
    var i, m, href;
    for (i = start; i <= end; i++) {
      m = M.mandateFor(i);
      href = "./?id=" + i;
      html += '<a href="' + href + '" data-id="' + i + '">';
      html += R.svg(i);
      html += '<p class="bk-card-meta"><strong>#' + i + "</strong>" + m.primaryAsset + " · " + m.strategy + "</p></a>";
    }
    grid.innerHTML = html;
    setText("bk-page-label", "#" + start + "–" + end + " of " + M.COLLECTION_SIZE);
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
    setHtml("bk-art", R.svg(id));
    setHtml("bk-facts", factsHtml(m));
    setText("bk-quote", m.quote);
    var pill = $("bk-mode-pill");
    if (pill) {
      pill.dataset.state = CONFIG.CONTRACT ? "live" : "preview";
      pill.innerHTML = CONFIG.CONTRACT
        ? "<i></i>CONTRACT SET"
        : "<i></i>PREVIEW · CONTRACT null";
    }
    var cap = $("bk-size");
    if (cap) {
      cap.max = String(m.maxNotionalUsd);
      cap.placeholder = "size ≤ " + m.maxNotionalUsd;
    }
    renderPaperRows(id);
    renderLiveRows(id);
    refreshActivation();
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
    var activatePage = document.body.getAttribute("data-page") === "activate";
    if (id) {
      show("bk-picker", false);
      openConsole(id);
    } else if (activatePage) {
      show("bk-landing", false);
      show("bk-console", false);
      show("bk-picker", true);
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
      location.href = "./?id=" + id;
    });
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
    if (contractEl) contractEl.textContent = CONFIG.CONTRACT == null ? "null (PREVIEW)" : CONFIG.CONTRACT;
    route();
    if (eth()) {
      eth().request({ method: "eth_accounts" }).then(function (acc) {
        state.address = acc && acc[0] ? acc[0] : null;
        return eth().request({ method: "eth_chainId" });
      }).then(function (hex) {
        state.chainId = hexToInt(hex);
        setWalletUi();
        if (state.id) refreshActivation();
      }).catch(function () {});
    }
  });

  window.BrokersSite = { CONFIG: CONFIG, parseId: parseId };
})();
