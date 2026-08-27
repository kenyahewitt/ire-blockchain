const rpc = "/rpc";
const api = "/api";
const $ = (id) => document.getElementById(id);
const number = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(Number(value) / 1_000_000);
const json = async (url) => { const response = await fetch(url); if (!response.ok) throw new Error("unavailable"); return response.json(); };

function row(columns) { return `<div class="row">${columns.map((column) => `<span>${column}</span>`).join("")}</div>`; }
async function refresh() {
  try {
    const [status, mempool, supply, inflation, validators] = await Promise.all([
      json(`${rpc}/status`), json(`${rpc}/num_unconfirmed_txs`),
      json(`${api}/cosmos/bank/v1beta1/supply/by_denom?denom=uire`), json(`${api}/cosmos/mint/v1beta1/inflation`),
      json(`${api}/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED`),
    ]);
    const sync = status.result.sync_info; const height = Number(sync.latest_block_height);
    $("network").textContent = status.result.node_info.network;
    $("connection").textContent = sync.catching_up ? "SYNCING" : "LIVE";
    $("height").textContent = `#${height.toLocaleString()}`;
    $("blockTime").textContent = new Date(sync.latest_block_time).toLocaleString();
    $("mempool").textContent = mempool.result.n_txs ?? "0";
    $("mempoolBytes").textContent = `${Number(mempool.result.total_bytes ?? 0).toLocaleString()} bytes pending`;
    $("supply").textContent = `${number(supply.amount.amount)} IRE`;
    $("inflation").textContent = `${(Number(inflation.inflation) * 100).toFixed(2)}%`;
    $("validatorCount").textContent = `${validators.validators.length} bonded`;
    const blocks = await json(`${rpc}/blockchain?minHeight=${Math.max(1, height - 5)}&maxHeight=${height}`);
    $("blocks").innerHTML = row(["HEIGHT", "TIME", "TXS"]) + blocks.result.block_metas.reverse().map((block) => row([
      `#${block.header.height}`, new Date(block.header.time).toLocaleTimeString(), block.num_txs,
    ])).join("");
    const totalStake = validators.validators.reduce((total, validator) => total + Number(validator.tokens), 0) || 1;
    $("validators").innerHTML = row(["VALIDATOR", "STAKE", "SHARE"]) + validators.validators.slice(0, 8).map((validator) => row([
      validator.description.moniker || validator.operator_address.slice(0, 14), `${number(validator.tokens)} IRE`, `${(Number(validator.tokens) / totalStake * 100).toFixed(2)}%`,
    ])).join("");
  } catch { $("connection").textContent = "OFFLINE"; }
}
$("refresh").addEventListener("click", refresh);
$("balanceForm").addEventListener("submit", async (event) => { event.preventDefault(); const address = $("address").value.trim(); if (!address) return; $("balanceResult").textContent = "Checking…"; try { const data = await json(`${api}/cosmos/bank/v1beta1/balances/${encodeURIComponent(address)}/by_denom?denom=uire`); $("balanceResult").textContent = `${number(data.balance?.amount ?? 0)} IRE`; } catch { $("balanceResult").textContent = "Balance unavailable. Check the address and node connection."; } });
refresh(); setInterval(refresh, 12_000);
