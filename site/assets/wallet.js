// IRE Wallet — activity from recent blocks + mempool. Same-origin GET only.
const POLL_MS = 5000
const BLOCK_WINDOW = 50
const MEMPOOL_LIMIT = 50
const BATCH = 8
const STORE_KEY = 'ire-wallet-address'

const $ = (id) => document.getElementById(id)

const state = {
  online: false,
  height: null,
  catchingUp: false,
  address: '',
  balance: null,
  balanceError: '',
  txs: [],
  lastOk: null,
  selected: null,
  windowMin: null,
}

const blockCache = new Map()

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

function parseInscription(ascii) {
  const idx = ascii.indexOf('IREINSCRIBE1')
  if (idx < 0) return null
  const slice = ascii.slice(idx).split('\0')[0].trim()
  const match = slice.match(/^IREINSCRIBE1\s+(\S+)\s+([\s\S]+)$/)
  if (!match) return { mediaType: '', payload: slice, raw: slice }
  return { mediaType: match[1], payload: match[2].trim(), raw: slice }
}

function extractJson(payload) {
  if (!payload) return null
  const start = payload.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < payload.length; i++) {
    const c = payload[i]
    if (inStr) {
      if (esc) { esc = false; continue }
      if (c === '\\') { esc = true; continue }
      if (c === '"') inStr = false
      continue
    }
    if (c === '"') { inStr = true; continue }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        try { return JSON.parse(payload.slice(start, i + 1)) } catch { return null }
      }
    }
  }
  return null
}

function extractAddrs(ascii) {
  const re = /ire1[0-9a-z]{38,58}/g
  const seen = []
  let m
  while ((m = re.exec(ascii))) {
    if (!seen.includes(m[0])) seen.push(m[0])
  }
  return seen
}

function extractUireAmount(ascii) {
  const re = /uire\x00{0,4}([0-9]{1,20})/g
  const found = []
  let m
  while ((m = re.exec(ascii))) found.push(m[1])
  if (!found.length) {
    const alt = ascii.match(/([0-9]{1,20})\x00{0,2}uire/)
    if (alt) return alt[1]
    return '0'
  }
  return found[0]
}

function isStakeAscii(ascii) {
  return (
    ascii.includes('cosmos.staking.') ||
    ascii.includes('cosmos.distribution.') ||
    ascii.includes('cosmos.slashing.')
  )
}

function kindFor(tx, viewer) {
  if (tx.inscription) {
    const body = extractJson(tx.inscription.payload)
    if (body && body.p === 'ire-bet') return 'bet'
    return 'inscribe'
  }
  if (tx.isStake) return 'stake'
  if (viewer && tx.to === viewer && tx.from !== viewer) return 'receive'
  return 'send'
}

function fmtIre(uire) {
  try {
    const n = Number(uire)
    if (!Number.isFinite(n)) return '—'
    const ire = n / 1_000_000
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(ire)
  } catch {
    return '—'
  }
}

function shortAddr(addr) {
  if (!addr) return '—'
  if (addr.length < 16) return addr
  return addr.slice(0, 8) + '…' + addr.slice(-6)
}

function ago(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const s = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000))
  if (s < 60) return s + 's ago'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  return Math.floor(s / 3600) + 'h ago'
}

function isIreAddr(value) {
  return /^ire1[0-9a-z]{38,58}$/.test(value)
}

async function decodeTx(raw, meta) {
  const bytes = bytesFromRpcTx(raw)
  const hash = await sha256Hex(bytes)
  const ascii = asciiFromBytes(bytes)
  const inscription = parseInscription(ascii)
  const addrs = extractAddrs(ascii)
  const from = addrs[0] || ''
  const to = addrs.length > 1 ? addrs[1] : addrs[0] || ''
  const amount = extractUireAmount(ascii)
  const id = hash + 'i0'
  return {
    hash,
    id,
    from,
    to,
    amount,
    inscription,
    isStake: isStakeAscii(ascii),
    pending: Boolean(meta.pending),
    height: meta.height || null,
    time: meta.time || null,
    addrs,
  }
}

function involves(tx, addr) {
  if (!addr) return false
  if (tx.from === addr || tx.to === addr) return true
  return Array.isArray(tx.addrs) && tx.addrs.includes(addr)
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  }
  const n = Math.min(limit, items.length) || 1
  await Promise.all(Array.from({ length: n }, worker))
  return out
}

async function loadBlock(height) {
  const cached = blockCache.get(height)
  if (cached) return cached
  const data = await getJson('/rpc/block?height=' + height)
  const header = data.result.block.header
  const rawTxs = (data.result.block.data && data.result.block.data.txs) || []
  const txs = []
  for (const raw of rawTxs) {
    txs.push(await decodeTx(raw, { height, pending: false, time: header.time }))
  }
  const rec = { height, time: header.time, txs }
  blockCache.set(height, rec)
  return rec
}

function setPill(name, label) {
  const el = $('wa-pill')
  el.dataset.state = name
  el.lastChild.textContent = label
}

function iconGlyph(kind) {
  if (kind === 'receive') return '↓'
  if (kind === 'inscribe') return '◇'
  if (kind === 'stake') return '✶'
  if (kind === 'bet') return '%'
  return '↑'
}

function kindLabel(kind) {
  if (kind === 'receive') return 'Receive'
  if (kind === 'inscribe') return 'Inscribe'
  if (kind === 'stake') return 'Stake'
  if (kind === 'bet') return 'Bet'
  return 'Send'
}

function counterparty(tx) {
  const addr = state.address
  if (tx.kind === 'receive') return tx.from || tx.to
  if (addr && tx.to && tx.to !== addr) return tx.to
  if (tx.from && tx.from !== addr) return tx.from
  if (tx.from && tx.to && tx.from === tx.to) return tx.to
  return tx.to || tx.from || ''
}

function renderBalance() {
  const wrap = $('wa-amount-wrap')
  const note = $('wa-amount-note')
  const setNum = (value) => {
    wrap.childNodes[0].textContent = value
  }
  if (!state.address) {
    wrap.removeAttribute('data-state')
    setNum('—')
    note.textContent = 'Enter an ire1 address'
    return
  }
  if (!state.online) {
    wrap.dataset.state = 'offline'
    setNum(state.balance == null ? '—' : fmtIre(state.balance))
    note.textContent = 'OFFLINE'
    return
  }
  wrap.removeAttribute('data-state')
  if (state.balanceError) {
    setNum('—')
    note.textContent = state.balanceError
    return
  }
  if (state.balance == null) {
    setNum('—')
    note.textContent = 'Looking up uire…'
    return
  }
  setNum(fmtIre(state.balance))
  note.textContent = 'IRE · uire on ire-1'
}

function renderList() {
  const list = $('wa-list')
  const empty = $('wa-empty')
  const offline = $('wa-offline')
  const label = $('wa-feed-label')
  $('wa-updated').textContent = state.lastOk
    ? 'Polled ' + state.lastOk.toLocaleTimeString('en-US', { hour12: false })
    : 'Waiting for /rpc/status'

  if (!state.online) {
    offline.hidden = false
    if (!state.txs.length) {
      list.innerHTML = ''
      empty.hidden = false
      empty.textContent = 'OFFLINE — could not reach /rpc/status.'
      label.textContent = 'offline'
      return
    }
  } else {
    offline.hidden = true
  }

  if (!state.address) {
    list.innerHTML = ''
    empty.hidden = false
    empty.textContent = 'Enter an ire1 address to look up activity.'
    label.textContent = 'no address'
    return
  }

  if (!state.txs.length) {
    list.innerHTML = ''
    empty.hidden = false
    empty.textContent = 'No transactions in the last blocks.'
    label.textContent = state.online
      ? (state.windowMin != null ? '#' + state.windowMin + '–#' + state.height : 'empty')
      : 'offline'
    return
  }

  empty.hidden = true
  label.textContent = state.txs.length + (state.txs.length === 1 ? ' tx' : ' txs')

  list.innerHTML = state.txs.map((tx) => {
    const open = state.selected === tx.hash
    const peer = counterparty(tx)
    const sign = tx.kind === 'receive' ? '+' : (tx.kind === 'send' ? '−' : '')
    const memo = tx.inscription
      ? (tx.inscription.payload || tx.inscription.raw || '').slice(0, 180)
      : ''
    return (
      '<li>' +
      '<button type="button" class="wa-row' + (open ? ' is-open' : '') + '" data-hash="' + escapeHtml(tx.hash) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
      '<span class="wa-icon wa-icon--' + tx.kind + '" aria-hidden="true">' + iconGlyph(tx.kind) + '</span>' +
      '<span class="wa-main">' +
      '<span class="wa-kind">' + kindLabel(tx.kind) + '</span>' +
      '<span class="wa-peer">' + escapeHtml(shortAddr(peer)) + '</span>' +
      '<span class="wa-id">' + escapeHtml(tx.id) + '</span>' +
      '</span>' +
      '<span class="wa-end">' +
      '<span class="wa-amt' + (tx.kind === 'receive' ? ' wa-amt--in' : '') + '">' + sign + fmtIre(tx.amount) + ' IRE</span>' +
      '<span class="wa-meta">' + escapeHtml(tx.pending ? '' : ago(tx.time)) + '</span>' +
      '<span class="wa-chip' + (tx.pending ? ' wa-chip--pending' : '') + '">' + (tx.pending ? 'Pending' : 'Confirmed') + '</span>' +
      '</span>' +
      (open
        ? '<span class="wa-detail">' +
          '<dl>' +
          '<dt>Hash</dt><dd>' + escapeHtml(tx.hash) + '</dd>' +
          '<dt>Memo</dt><dd>' + escapeHtml(memo || '—') + '</dd>' +
          '<dt>Id</dt><dd>' + escapeHtml(tx.id) + '</dd>' +
          (tx.height ? '<dt>Height</dt><dd>#' + tx.height + '</dd>' : '') +
          '</dl>' +
          '<button type="button" class="wa-copy" data-copy-id="' + escapeHtml(tx.id) + '">Copy id</button>' +
          '</span>'
        : '') +
      '</button></li>'
    )
  }).join('')
}

async function lookupBalance(addr) {
  if (!addr || !isIreAddr(addr)) {
    state.balance = null
    state.balanceError = addr ? 'Not an ire1 account address.' : ''
    return
  }
  try {
    const data = await getJson('/api/cosmos/bank/v1beta1/balances/' + encodeURIComponent(addr) + '/by_denom?denom=uire')
    state.balance = (data.balance && data.balance.amount) || '0'
    state.balanceError = ''
  } catch {
    state.balance = null
    state.balanceError = 'Balance unavailable.'
  }
}

function setAddress(addr) {
  const next = addr.trim()
  state.address = next
  if ($('wa-address')) $('wa-address').value = next
  try { localStorage.setItem(STORE_KEY, next) } catch { /* ignore */ }
  try {
    const url = new URL(location.href)
    if (next) url.searchParams.set('a', next)
    else url.searchParams.delete('a')
    history.replaceState(null, '', url)
  } catch { /* ignore */ }
}

function shareUrl() {
  const url = new URL(location.origin + '/wallet/')
  if (state.address) url.searchParams.set('a', state.address)
  return url.toString()
}

function copyText(btn, text) {
  const label = btn.textContent
  navigator.clipboard.writeText(text).then(function () {
    btn.textContent = 'Copied'
    setTimeout(function () { btn.textContent = label }, 1600)
  }).catch(function () {
    btn.textContent = 'Blocked'
    setTimeout(function () { btn.textContent = label }, 1600)
  })
}

async function tick() {
  try {
    const status = await getJson('/rpc/status')
    const sync = status.result.sync_info
    const height = Number(sync.latest_block_height)
    if (!Number.isFinite(height) || height < 1) throw new Error('bad height')

    const minH = Math.max(1, height - BLOCK_WINDOW + 1)
    const mempool = await getJson('/rpc/unconfirmed_txs?limit=' + MEMPOOL_LIMIT)
    const heights = []
    for (let h = minH; h <= height; h++) heights.push(h)
    for (const h of [...blockCache.keys()]) {
      if (h < minH || h > height) blockCache.delete(h)
    }

    const blocks = await mapPool(heights, BATCH, (h) => loadBlock(h))
    const pendingRaw = (mempool.result && mempool.result.txs) || []
    const pending = []
    for (const raw of pendingRaw) {
      pending.push(await decodeTx(raw, { height: null, pending: true, time: null }))
    }

    const confirmed = []
    const seen = new Set()
    for (const b of blocks.slice().sort((a, c) => c.height - a.height)) {
      if (!b || !b.txs) continue
      for (const tx of b.txs) {
        seen.add(tx.hash)
        confirmed.push(tx)
      }
    }
    const pendingOnly = pending.filter((tx) => !seen.has(tx.hash))

    let txs = pendingOnly.concat(confirmed)
    if (state.address && isIreAddr(state.address)) {
      txs = txs.filter((tx) => involves(tx, state.address)).map((tx) => ({
        ...tx,
        kind: kindFor(tx, state.address),
      }))
    } else {
      txs = []
    }

    if (state.address && isIreAddr(state.address)) {
      await lookupBalance(state.address)
    }

    state.online = true
    state.height = height
    state.catchingUp = Boolean(sync.catching_up)
    state.windowMin = minH
    state.txs = txs
    state.lastOk = new Date()
    setPill(state.catchingUp ? 'syncing' : 'live', state.catchingUp ? 'SYNCING' : 'LIVE')
    renderBalance()
    renderList()
  } catch {
    state.online = false
    state.txs = []
    setPill('offline', 'OFFLINE')
    renderBalance()
    renderList()
  }
}

$('wa-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const addr = $('wa-address').value.trim()
  setAddress(addr)
  state.selected = null
  if (addr && !isIreAddr(addr)) {
    state.balance = null
    state.balanceError = 'Not an ire1 account address.'
    state.txs = []
    renderBalance()
    renderList()
    return
  }
  await lookupBalance(state.address)
  await tick()
})

$('wa-list').addEventListener('click', async (event) => {
  const copyBtn = event.target.closest('[data-copy-id]')
  if (copyBtn) {
    event.preventDefault()
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(copyBtn.dataset.copyId)
      copyBtn.textContent = 'Copied'
      setTimeout(() => { copyBtn.textContent = 'Copy id' }, 1600)
    } catch {
      copyBtn.textContent = 'Blocked'
      setTimeout(() => { copyBtn.textContent = 'Copy id' }, 1600)
    }
    return
  }
  const row = event.target.closest('.wa-row')
  if (!row) return
  const hash = row.dataset.hash
  state.selected = state.selected === hash ? null : hash
  renderList()
})

try {
  const saved = localStorage.getItem(STORE_KEY) || ''
  if (saved) setAddress(saved)
} catch { /* ignore */ }

setPill('offline', 'CONNECTING')
tick()
setInterval(tick, POLL_MS)


try {
  const q = new URLSearchParams(location.search)
  const fromQ = (q.get('a') || q.get('address') || '').trim()
  if (fromQ) setAddress(fromQ)
} catch { /* ignore */ }

const shareBtn = $('wa-share')
if (shareBtn) shareBtn.addEventListener('click', function () {
  if (!state.address) { shareBtn.textContent = 'Enter address first'; setTimeout(function(){ shareBtn.textContent = 'Copy share link' }, 1600); return }
  copyText(shareBtn, shareUrl())
})
const copyAddrBtn = $('wa-copy-addr')
if (copyAddrBtn) copyAddrBtn.addEventListener('click', function () {
  if (!state.address) { copyAddrBtn.textContent = 'Enter address first'; setTimeout(function(){ copyAddrBtn.textContent = 'Copy address' }, 1600); return }
  copyText(copyAddrBtn, state.address)
})
const sendForm = $('wa-send')
if (sendForm) sendForm.addEventListener('submit', function (event) {
  event.preventDefault()
  const from = state.address
  const to = ($('wa-to') && $('wa-to').value.trim()) || ''
  const ire = ($('wa-amt') && $('wa-amt').value.trim()) || ''
  const btn = sendForm.querySelector('button')
  const reset = function (msg) {
    if (!btn) return
    const old = 'Copy send'
    btn.textContent = msg
    setTimeout(function () { btn.textContent = old }, 1800)
  }
  if (!from || !/^ire1[0-9a-z]{38,90}$/.test(from)) { reset('Set your ire1 first'); return }
  if (!/^ire1[0-9a-z]{38,90}$/.test(to)) { reset('Bad to address'); return }
  const n = Number(ire)
  if (!Number.isFinite(n) || n <= 0) { reset('Set amount'); return }
  const uire = Math.round(n * 1e6)
  const cmd = 'ired tx bank send ' + from + ' ' + to + ' ' + uire + 'uire --chain-id ire-1 --from <key> --gas-prices 0.001uire --home $HOME/.ire --yes'
  copyText(btn, cmd)
})
