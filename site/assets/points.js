(function () {
  const WINDOW = 80;
  const BATCH = 8;
  const $ = function (id) { return document.getElementById(id); };

  function setPill(state, label) {
    const p = $("pt-pill"); if (p) p.dataset.state = state;
    const l = $("pt-pill-label"); if (l) l.textContent = label;
  }
  function asciiFromBytes(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i++) {
      const c = bytes[i];
      out += c >= 32 && c < 127 ? String.fromCharCode(c) : "\0";
    }
    return out;
  }
  function bytesFromRpcTx(raw) {
    if (!raw || typeof raw !== "string") return new Uint8Array();
    const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0 && hex.length >= 64) {
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return out;
    }
    const bin = atob(raw);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function addrs(ascii) {
    const re = /ire1[0-9a-z]{38,58}/g;
    const seen = [];
    let m;
    while ((m = re.exec(ascii))) if (!seen.includes(m[0])) seen.push(m[0]);
    return seen;
  }
  function scoreTx(ascii) {
    let pts = 1;
    if (ascii.indexOf("IREINSCRIBE1") >= 0) pts += 5;
    if (ascii.indexOf("ire-bet") >= 0) pts += 10;
    if (ascii.indexOf("fund-community-pool") >= 0 || ascii.indexOf("CommunityPool") >= 0) pts += 20;
    if (ascii.indexOf("IREVAL1") >= 0) pts += 25;
    return pts;
  }
  async function mapPool(items, n, fn) {
    const out = new Array(items.length);
    let i = 0;
    async function worker() {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }
    const ws = [];
    for (let k = 0; k < n; k++) ws.push(worker());
    await Promise.all(ws);
    return out;
  }

  async function refresh() {
    try {
      const st = await (await fetch("/rpc/status")).json();
      const height = Number(st.result.sync_info.latest_block_height);
      const minH = Math.max(1, height - WINDOW + 1);
      $("pt-height").textContent = String(height);
      $("pt-window").textContent = minH + "–" + height;
      $("pt-updated").textContent = "height " + height;
      setPill("live", "LIVE");
      $("pt-offline").hidden = true;
      const heights = [];
      for (let h = minH; h <= height; h++) heights.push(h);
      const scores = {};
      await mapPool(heights, BATCH, async function (h) {
        const blk = await (await fetch("/rpc/block?height=" + h)).json();
        const txs = (((blk.result || {}).block || {}).data || {}).txs || [];
        for (const raw of txs) {
          const ascii = asciiFromBytes(bytesFromRpcTx(raw));
          const pts = scoreTx(ascii);
          addrs(ascii).forEach(function (a) {
            scores[a] = (scores[a] || 0) + pts;
          });
        }
      });
      const rows = Object.keys(scores).map(function (a) { return [a, scores[a]]; }).sort(function (x, y) { return y[1] - x[1]; });
      $("pt-count").textContent = String(rows.length);
      const board = $("pt-board");
      if (!rows.length) {
        board.textContent = "No scored txs in this window.";
        return;
      }
      board.innerHTML = "<ol style=\"padding-left:1.2rem\">" + rows.slice(0, 25).map(function (r) {
        const short = r[0].slice(0, 12) + "…" + r[0].slice(-6);
        return "<li style=\"margin:0.35rem 0\"><a href=\"/id/?a=" + encodeURIComponent(r[0]) + "\">" + short + "</a> · " + r[1] + " pts · <a href=\"/wallet/?a=" + encodeURIComponent(r[0]) + "\">wallet</a></li>";
      }).join("") + "</ol>";
    } catch (e) {
      setPill("offline", "OFFLINE");
      $("pt-updated").textContent = "could not reach /rpc/status";
      $("pt-offline").hidden = false;
      $("pt-board").textContent = "Offline. Will not invent points.";
    }
  }
  setPill("offline", "CONNECTING");
  refresh();
  setInterval(refresh, 20000);
})();
