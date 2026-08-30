(function () {
  const VAULT = "ire1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8nanfuy";
  const GENESIS_TAX = "0.020000000000000000";

  const pill = document.getElementById("vt-pill");
  const pillLabel = document.getElementById("vt-pill-label");
  const updated = document.getElementById("vt-updated");
  const heightEl = document.getElementById("vt-height");
  const balEl = document.getElementById("vt-balance");
  const noteEl = document.getElementById("vt-balance-note");
  const splitEl = document.getElementById("vt-split");
  const taxEl = document.getElementById("vt-tax");
  const offline = document.getElementById("vt-offline");

  function setPill(state, label) {
    if (pill) pill.dataset.state = state;
    if (pillLabel) pillLabel.textContent = label;
  }

  function formatIre(uireStr) {
    const n = BigInt(uireStr || "0");
    const whole = n / 1000000n;
    const frac = n % 1000000n;
    const fracS = frac.toString().padStart(6, "0").replace(/0+$/, "");
    return fracS ? whole.toString() + "." + fracS : whole.toString();
  }

  function taxPct(dec) {
    const n = Number(dec);
    if (!Number.isFinite(n)) return null;
    return (n * 100).toFixed(n >= 1 || n === 0 ? 0 : 1);
  }

  async function getJson(url) {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(url + " " + r.status);
    return r.json();
  }

  async function refresh() {
    try {
      const status = await getJson("/rpc/status");
      const sync = (status.result && status.result.sync_info) || {};
      const height = sync.latest_block_height || "—";
      if (heightEl) heightEl.textContent = height;
      if (updated) updated.textContent = "height " + height;
      setPill("live", "LIVE");
      if (offline) offline.hidden = true;

      const bank = await getJson("/api/cosmos/bank/v1beta1/balances/" + VAULT);
      const coins = bank.balances || [];
      const uire = (coins.find(function (c) { return c.denom === "uire"; }) || {}).amount || "0";
      if (balEl) {
        balEl.innerHTML = formatIre(uire) + " <em>IRE</em>";
      }
      if (noteEl) noteEl.textContent = uire + " uire at " + VAULT;

      let tax = GENESIS_TAX;
      let taxSource = "genesis";
      try {
        const dist = await getJson("/api/cosmos/distribution/v1beta1/params");
        const p = dist.params || dist;
        if (p.community_tax) {
          tax = p.community_tax;
          taxSource = "on-chain";
        }
      } catch (e) {
        /* distribution LCD may still be blocked until nginx is updated */
      }
      const pct = taxPct(tax);
      if (taxEl) taxEl.textContent = pct === null ? tax : pct + "%";
      if (splitEl) {
        if (pct === "100") {
          splitEl.textContent = "100% of gas to the vault";
        } else {
          const rest = pct === null ? "—" : String(Math.round((100 - Number(pct)) * 10) / 10);
          splitEl.textContent = pct + "% vault / " + rest + "% validators (" + taxSource + ")";
        }
      }
    } catch (e) {
      setPill("offline", "OFFLINE");
      if (updated) updated.textContent = "could not reach /rpc/status";
      if (offline) offline.hidden = false;
      if (balEl && balEl.textContent.trim() === "—") {
        /* leave em dash; do not invent a balance */
      }
    }
  }

  setPill("offline", "CONNECTING");
  refresh();
  setInterval(refresh, 15000);
})();
