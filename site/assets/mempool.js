// Live rainbow mempool + recent blocks. Same-origin GET only. No signing.
const POLL_MS = 4000
const BLOCK_WINDOW = 10
const MEMPOOL_LIMIT = 30

const $ = (id) => document.getElementById(id)

const state = {
  online: false,
  height: null,
  catchingUp: false,
  unconfirmed: [],
  blocks: [],
  supply: null,
  validators: 0,
  pendingTotal: null,
  seenPending: new Set(),
  selected: null,
  lastOk: null,
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function getJson(path) {
  const res = await fetch(path, { method: 'GET', headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(path + ' ' + res.status)
  return res.json()
}

function bytesFromRpcTx(raw) {
  if (!raw || typeof raw !== 'string') return new Uint8Array()
  const hex = raw.startsWith('0x') ? raw.slice(2) : raw
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0 && hex.length >= 64) {
    const out = new Uint8Array(hex.length / 2)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    return out
  }
  const bin = atob(raw)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function asciiFromBytes(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i]
    out += c >= 32 && c < 127 ? String.fromCharCode(c) : '\0'
  }
  return out
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function messageUrls(ascii) {
  return ascii.match(/\/(?:cosmos|ibc)\.[A-Za-z0-9./]+/g) || []
}

function parseInscription(ascii) {
  const idx = ascii.indexOf('IREINSCRIBE1')
  if (idx < 0) return null
  const slice = ascii.slice(idx).split('\0')[0].trim()
  const match = slice.match(/^IREINSCRIBE1\s+(\S+)\s+([\s\S]+)$/)
  if (!match) return { mediaType: '', payload: slice, raw: slice }
  return { mediaType: match[1], payload: match[2].trim(), raw: slice }
}

function classify(ascii, inscription) {
  if (inscription) return 'inscription'
  if (ascii.includes('cosmos.bank.v1beta1.MsgSend') || ascii.includes('cosmos.bank.v1beta1.MsgMultiSend')) return 'bank'
  return 'other'
}

function inscriptionIds(hash, urls) {
  const count = Math.max(1, urls.length)
  return Array.from({ length: count }, (_, i) => hash + 'i' + i)
}

async function decodeTx(raw) {
  const bytes = bytesFromRpcTx(raw)
  const hash = await sha256Hex(bytes)
  const ascii = asciiFromBytes(bytes)
  const inscription = parseInscription(ascii)
  const urls = messageUrls(ascii)
  const kind = classify(ascii, inscription)
  return {
    hash,
    kind,
    urls,
    inscription,
    ids: inscriptionIds(hash, urls),
    size: bytes.length,
  }
}

function fmtIre(uire) {
  const n = Number(uire) / 1_000_000
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)
}

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-US', { hour12: false })
}

function ago(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000))
  if (s < 60) return s + 's ago'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  return Math.floor(s / 3600) + 'h ago'
}

function setPill(stateName, label) {
  const el = $('mp-pill')
  el.dataset.state = stateName
  el.lastChild.textContent = label
}

function cubeButton(tx, extraClass) {
  const id = tx.ids[0] || (tx.hash + 'i0')
  const title = (tx.kind === 'inscription' ? id + ' · ' : '') + tx.hash.slice(0, 12)
  return (
    '<button type="button" class="mp-cube mp-cube--' + tx.kind +
    (extraClass ? ' ' + extraClass : '') +
    (state.selected && state.selected.hash === tx.hash ? ' is-on' : '') +
    '" data-hash="' + escapeHtml(tx.hash) + '" title="' + escapeHtml(title) + '"></button>'
  )
}

function renderFacts() {
  $('mp-height').textContent = state.height == null ? '—' : '#' + state.height.toLocaleString('en-US')
  $('mp-pending').textContent = state.pendingTotal == null ? '—' : String(state.pendingTotal)
  $('mp-supply').textContent = state.supply == null ? '—' : fmtIre(state.supply) + ' IRE'
  $('mp-vals').textContent = state.validators ? String(state.validators) : (state.online ? '0' : '—')
  $('mp-updated').textContent = state.lastOk
    ? 'Polled ' + state.lastOk.toLocaleTimeString('en-US', { hour12: false })
    : 'Waiting for /rpc/status'
}

function renderWell() {
  const well = $('mp-cubes')
  const empty = $('mp-empty')
  const total = state.pendingTotal
  $('mp-pending-label').textContent = state.online
    ? (total == null ? 'pending' : total + ' pending')
    : 'offline'
  if (!state.unconfirmed.length) {
    well.innerHTML = ''
    empty.hidden = false
    empty.textContent = state.online ? 'Mempool empty — waiting for transactions.' : 'OFFLINE — could not reach /rpc.'
    return
  }
  empty.hidden = true
  well.innerHTML = state.unconfirmed.map((tx) => {
    const enter = !state.seenPending.has(tx.hash)
    return cubeButton(tx, enter ? 'mp-cube--enter' : 'mp-cube--static')
  }).join('')
}

function renderBlocks() {
  const root = $('mp-blocks')
  if (!state.blocks.length) {
    root.innerHTML = '<p class="mp-placeholder">' + (state.online ? 'No blocks yet.' : 'OFFLINE') + '</p>'
    return
  }
  root.innerHTML = state.blocks.map((block) => {
    const empty = !block.txs.length
    const cubes = block.txs.slice(0, 16).map((tx) => cubeButton(tx, 'mp-cube--static')).join('')
    const extra = block.txs.length > 16 ? '<span class="mp-block-meta">+' + (block.txs.length - 16) + '</span>' : ''
    return (
      '<article class="mp-block' +
      (empty ? ' mp-block--empty' : '') +
      (block.fresh ? ' mp-block--new' : '') +
      (state.selected && state.selected.blockHeight === block.height && !state.selected.hash ? ' is-on' : '') +
      '" data-height="' + block.height + '">' +
      '<div class="mp-block-h">#' + block.height.toLocaleString('en-US') + '</div>' +
      '<div class="mp-block-meta">' + escapeHtml(fmtTime(block.time)) + '<br>' +
      (empty ? 'empty' : block.txs.length + ' tx') +
      (block.time ? '<br>' + escapeHtml(ago(block.time)) : '') + '</div>' +
      (empty ? '<div class="mp-block-empty-mark">ash</div>' : '<div class="mp-block-txs">' + cubes + extra + '</div>') +
      '</article>'
    )
  }).join('')
  state.blocks.forEach((b) => { b.fresh = false })
}

function kindLabel(kind) {
  if (kind === 'inscription') return 'Inscription'
  if (kind === 'bank') return 'Bank / token send'
  return 'Staking / other'
}

function showDetail(entry) {
  const box = $('mp-detail')
  const body = $('mp-detail-body')
  state.selected = entry
  if (!entry) {
    box.hidden = true
    return
  }
  box.hidden = false
  if (entry.type === 'block') {
    body.innerHTML =
      '<h3>Block</h3><dl class="mp-kv">' +
      '<dt>Height</dt><dd>#' + entry.height + '</dd>' +
      '<dt>Time</dt><dd>' + escapeHtml(fmtTime(entry.time)) + '</dd>' +
      '<dt>Transactions</dt><dd>' + entry.txs.length + '</dd>' +
      '<dt>Hash</dt><dd>' + escapeHtml(entry.hash || '—') + '</dd>' +
      '</dl>'
    return
  }
  const ins = entry.inscription
  const ids = (entry.ids && entry.ids.length) ? entry.ids.map(escapeHtml).join('<br>') : '—'
  body.innerHTML =
    '<h3>Transaction</h3><dl class="mp-kv">' +
    '<dt>Kind</dt><dd class="mp-kind-' + entry.kind + '">' + kindLabel(entry.kind) + '</dd>' +
    '<dt>Tx hash</dt><dd>' + escapeHtml(entry.hash) + '</dd>' +
    '<dt>Inscription id</dt><dd>' + ids + '</dd>' +
    '<dt>Status</dt><dd>' + (entry.blockHeight || entry.rpcHeight ? 'Block #' + (entry.blockHeight || entry.rpcHeight) : 'Mempool') + '</dd>' +
    (entry.rpcCode != null ? '<dt>Code</dt><dd>' + escapeHtml(entry.rpcCode) + '</dd>' : '') +
    (ins ? '<dt>Media type</dt><dd>' + escapeHtml(ins.mediaType || '—') + '</dd>' : '') +
    (ins ? '<dt>Payload</dt><dd>' + escapeHtml((ins.payload || '').slice(0, 280)) + '</dd>' : '') +
    '<dt>Messages</dt><dd>' + (entry.urls && entry.urls.length ? entry.urls.map(escapeHtml).join('<br>') : '—') + '</dd>' +
    '</dl>'
}

function findTx(hash) {
  const pending = state.unconfirmed.find((t) => t.hash === hash)
  if (pending) return pending
  for (const block of state.blocks) {
    const tx = block.txs.find((t) => t.hash === hash)
    if (tx) return { ...tx, blockHeight: block.height }
  }
  return null
}

async function enrichTx(tx) {
  try {
    const data = await getJson('/rpc/tx?hash=0x' + tx.hash)
    const result = data.result || {}
    tx.rpcHeight = result.height
    tx.rpcCode = result.tx_result && result.tx_result.code
  } catch {
    /* still in mempool, or hash not indexed yet */
  }
  return tx
}

document.addEventListener('click', async (event) => {
  const cube = event.target.closest('.mp-cube')
  if (cube) {
    const tx = findTx(cube.dataset.hash)
    if (tx) {
      showDetail(tx)
      await enrichTx(tx)
      if (state.selected && state.selected.hash === tx.hash) showDetail(tx)
    }
    document.querySelectorAll('.mp-cube.is-on').forEach((el) => el.classList.remove('is-on'))
    cube.classList.add('is-on')
    return
  }
  const blockEl = event.target.closest('.mp-block')
  if (blockEl) {
    const height = Number(blockEl.dataset.height)
    const block = state.blocks.find((b) => b.height === height)
    if (block) showDetail({ type: 'block', ...block, hash: block.blockHash })
    document.querySelectorAll('.mp-block.is-on').forEach((el) => el.classList.remove('is-on'))
    blockEl.classList.add('is-on')
  }
})

async function loadBlock(height) {
  const data = await getJson('/rpc/block?height=' + height)
  const header = data.result.block.header
  const rawTxs = data.result.block.data.txs || []
  const txs = await Promise.all(rawTxs.map(decodeTx))
  return {
    height: Number(header.height),
    time: header.time,
    blockHash: data.result.block_id && data.result.block_id.hash,
    txs,
    fresh: false,
  }
}

async function tick() {
  try {
    const status = await getJson('/rpc/status')
    const sync = status.result.sync_info
    const height = Number(sync.latest_block_height)
    if (!Number.isFinite(height) || height < 1) throw new Error('bad height')

    const [num, mempool, supply, validators] = await Promise.all([
      getJson('/rpc/num_unconfirmed_txs'),
      getJson('/rpc/unconfirmed_txs?limit=' + MEMPOOL_LIMIT),
      getJson('/api/cosmos/bank/v1beta1/supply/by_denom?denom=uire'),
      getJson('/api/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED'),
    ])

    const rawPending = mempool.result.txs || []
    const unconfirmed = await Promise.all(rawPending.map(decodeTx))

    const minH = Math.max(1, height - BLOCK_WINDOW + 1)
    const chain = await getJson('/rpc/blockchain?minHeight=' + minH + '&maxHeight=' + height)
    const metas = (chain.result.block_metas || []).slice().sort((a, b) => Number(b.header.height) - Number(a.header.height))

    const prevByHeight = new Map(state.blocks.map((b) => [b.height, b]))
    const blocks = []
    for (const meta of metas) {
      const h = Number(meta.header.height)
      const cached = prevByHeight.get(h)
      if (cached) {
        cached.fresh = false
        blocks.push(cached)
        continue
      }
      const block = await loadBlock(h)
      block.fresh = state.height != null && h > state.height
      blocks.push(block)
    }

    state.online = true
    state.height = height
    state.catchingUp = Boolean(sync.catching_up)
    state.unconfirmed = unconfirmed
    state.blocks = blocks
    state.supply = supply.amount && supply.amount.amount
    state.validators = (validators.validators || []).length
    state.lastOk = new Date()

    const nextSeen = new Set(unconfirmed.map((tx) => tx.hash))
    state.pendingTotal = Number(num.result.n_txs ?? unconfirmed.length)
    setPill(state.catchingUp ? 'syncing' : 'live', state.catchingUp ? 'SYNCING' : 'LIVE')
    renderFacts()
    renderWell()
    renderBlocks()
    state.seenPending = nextSeen
  } catch {
    state.online = false
    setPill('offline', 'OFFLINE')
    renderFacts()
    renderWell()
    renderBlocks()
  }
}

setPill('offline', 'CONNECTING')
tick()
setInterval(tick, POLL_MS)
