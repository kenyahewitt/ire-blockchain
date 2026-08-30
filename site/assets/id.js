(function () {
  const PREFIX = "IREINSCRIBE1 application/json ";
  const MAX = 256;
  const WINDOW = 80;
  const $ = function (id) { return document.getElementById(id); };

  function ireOk(a) { return /^ire1[0-9a-z]{38,90}$/.test(a || ""); }
  function clean(s) { return String(s || "").trim().replace(/^@/, "").replace(/https?:\/\//, ""); }

  function payload() {
    const o = { p: "ire-id", op: "set" };
    const n = clean($("id-n").value); if (n) o.n = n.slice(0, 24);
    const x = clean($("id-x").value); if (x) o.x = x.slice(0, 20);
    const tg = clean($("id-tg").value); if (tg) o.tg = tg.slice(0, 32);
    const d = clean($("id-d").value); if (d) o.d = d.slice(0, 32);
    const w = clean($("id-w").value); if (w) o.w = w.slice(0, 40);
    return o;
  }
  function memo() { return PREFIX + JSON.stringify(payload()); }
  function updateLen() {
    const m = memo();
    const el = $("id-len");
    if (el) el.textContent = "memo " + m.length + " / " + MAX + (m.length > MAX ? " — too long, shorten handles" : "");
  }
  ["id-n","id-x","id-tg","id-d","id-w"].forEach(function (id) {
    const el = $(id); if (el) el.addEventListener("input", updateLen);
  });
  updateLen();

  function copy(btn, text) {
    const label = btn.textContent;
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = "Copied"; setTimeout(function () { btn.textContent = label; }, 1600);
    }).catch(function () {
      btn.textContent = "Blocked"; setTimeout(function () { btn.textContent = label; }, 1600);
    });
  }

  $("id-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const addr = $("id-addr").value.trim();
    const btn = $("id-form").querySelector('button[type="submit"]');
    if (!ireOk(addr)) { btn.textContent = "Need ire1"; setTimeout(function(){ btn.textContent = "Copy inscribe command"; }, 1800); return; }
    const m = memo();
    if (m.length > MAX) { btn.textContent = "Memo too long"; setTimeout(function(){ btn.textContent = "Copy inscribe command"; }, 1800); return; }
    const cmd = "ired tx bank send " + addr + " " + addr + " 1uire --chain-id ire-1 --from <key> --gas-prices 0.001uire --note '" + m.replace(/'/g, "") + "' --home $HOME/.ire --yes";
    copy(btn, cmd);
    try {
      const url = new URL(location.href);
      url.searchParams.set("a", addr);
      history.replaceState(null, "", url);
    } catch (err) {}
  });

  $("id-share").addEventListener("click", function () {
    const addr = $("id-addr").value.trim();
    if (!ireOk(addr)) { copy($("id-share"), location.origin + "/id/"); return; }
    copy($("id-share"), location.origin + "/id/?a=" + encodeURIComponent(addr));
  });
  $("id-recv").addEventListener("click", function () {
    const addr = $("id-addr").value.trim();
    if (!ireOk(addr)) { $("id-recv").textContent = "Need ire1"; setTimeout(function(){ $("id-recv").textContent = "Copy receive link"; }, 1600); return; }
    copy($("id-recv"), location.origin + "/wallet/?a=" + encodeURIComponent(addr));
  });
  $("id-addr-copy").addEventListener("click", function () {
    const addr = $("id-addr").value.trim();
    if (!ireOk(addr)) { $("id-addr-copy").textContent = "Need ire1"; setTimeout(function(){ $("id-addr-copy").textContent = "Copy address"; }, 1600); return; }
    copy($("id-addr-copy"), addr);
  });

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
  function extractJson(payload) {
    const start = payload.indexOf("{");
    if (start < 0) return null;
    try { return JSON.parse(payload.slice(start)); } catch (e) { return null; }
  }

  async function loadOnchain(addr) {
    const note = $("id-onchain");
    if (!ireOk(addr)) { if (note) note.textContent = "Enter an ire1 to load the latest inscribed profile."; return; }
    try {
      const st = await (await fetch("/rpc/status")).json();
      const height = Number(st.result.sync_info.latest_block_height);
      const minH = Math.max(1, height - WINDOW + 1);
      let found = null;
      for (let h = height; h >= minH; h--) {
        const blk = await (await fetch("/rpc/block?height=" + h)).json();
        const txs = (((blk.result || {}).block || {}).data || {}).txs || [];
        for (const raw of txs) {
          const ascii = asciiFromBytes(bytesFromRpcTx(raw));
          if (ascii.indexOf(addr) < 0) continue;
          const idx = ascii.indexOf("IREINSCRIBE1");
          if (idx < 0) continue;
          const slice = ascii.slice(idx).split("\0")[0];
          const j = extractJson(slice.replace(/^IREINSCRIBE1\s+\S+\s+/, ""));
          if (j && j.p === "ire-id" && j.op === "set") { found = j; break; }
        }
        if (found) break;
      }
      if (found) {
        if (found.n) $("id-n").value = found.n;
        if (found.x) $("id-x").value = found.x;
        if (found.tg) $("id-tg").value = found.tg;
        if (found.d) $("id-d").value = found.d;
        if (found.w) $("id-w").value = found.w;
        updateLen();
        if (note) note.textContent = "Loaded latest ire-id memo in this window.";
      } else if (note) note.textContent = "No on-chain profile in the last ~80 blocks.";
    } catch (e) {
      if (note) note.textContent = "Could not scan /rpc/block. Will not invent a profile.";
    }
  }

  try {
    const q = new URLSearchParams(location.search);
    const a = (q.get("a") || "").trim();
    if (a) { $("id-addr").value = a; loadOnchain(a); }
  } catch (e) {}
  $("id-addr").addEventListener("change", function () { loadOnchain($("id-addr").value.trim()); });
})();
