// IRE Markets — reconstruct ire-bet inscriptions from recent blocks + mempool.
// Same-origin GET /rpc only. No signing, no broadcast, no keys, no auto-bet.
const POLL_MS = 8000
const BLOCK_WINDOW = 80
const MEMPOOL_LIMIT = 50
const BATCH = 8

const $ = (id) => document.getElementById(id)

const state = {
  online: false,
  height: null,
  catchingUp: false,
  markets: [],
  lastOk: null,
  scanned: 0,
  pendingCount: 0,
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

function parseAmount(a) {
  if (a == null) return 0n
  const s = String(a).trim()
  if (!/^[0-9]+$/.test(s)) return 0n
  try { return BigInt(s) } catch { return 0n }
}

function messageCount(ascii) {
  const urls = ascii.match(/\/(?:cosmos|ibc)\.[A-Za-z0-9./]+/g) || []
  return Math.max(1, urls.length)
}

async function decodeBets(raw, meta) {
  const bytes = bytesFromRpcTx(raw)
  const hash = await sha256Hex(bytes)
  const ascii = asciiFromBytes(bytes)
  const ins = parseInscription(ascii)
  if (!ins) return []
  const body = extractJson(ins.payload)
  if (!body || body.p !== 'ire-bet' || typeof body.op !== 'string') return []
  const index = 0
  return [{
    op: body.op,
    body,
    id: hash + 'i' + index,
    hash,
    msgs: messageCount(ascii),
    height: meta.height,
    pending: Boolean(meta.pending),
  }]
}

function reconstruct(events) {
  const markets = new Map()
  for (const ev of events) {
    if (ev.op !== 'open') continue
    const q = typeof ev.body.q === 'string' ? ev.body.q.trim() : ''
    if (!q) continue
    markets.set(ev.id, {
      id: ev.id,
      q,
      o: Array.isArray(ev.body.o) ? ev.body.o.map(String) : ['y', 'n'],
      height: ev.height,
      pending: ev.pending,
      yes: 0n,
      no: 0n,
      pendingYes: 0n,
      pendingNo: 0n,
      resolve: null,
      analyses: [],
      buys: 0,
      pendingBuys: 0,
    })
  }
  for (const ev of events) {
    const mid = typeof ev.body.m === 'string' ? ev.body.m.trim() : ''
    if (!mid || !markets.has(mid)) continue
    const mk = markets.get(mid)
    if (ev.op === 'buy') {
      const amt = parseAmount(ev.body.a)
      const side = String(ev.body.s || '').toLowerCase()
      if (amt === 0n) continue
      if (side === 'y' || side === 'yes') {
        mk.yes += amt
        if (ev.pending) mk.pendingYes += amt
      } else if (side === 'n' || side === 'no') {
        mk.no += amt
        if (ev.pending) mk.pendingNo += amt
      } else continue
      mk.buys += 1
      if (ev.pending) mk.pendingBuys += 1
    } else if (ev.op === 'resolve') {
      const w = String(ev.body.w || '').toLowerCase()
      if (!w) continue
      mk.resolve = { w, id: ev.id, pending: ev.pending, height: ev.height }
    } else if (ev.op === 'analyze') {
      const note = typeof ev.body.note === 'string' ? ev.body.note.trim() : ''
      const y = Number(ev.body.y)
      const n = Number(ev.body.n)
      mk.analyses.push({
        id: ev.id,
        y: Number.isFinite(y) ? y : null,
        n: Number.isFinite(n) ? n : null,
        note,
        pending: ev.pending,
        height: ev.height,
      })
    }
  }
  const list = [...markets.values()]
  list.forEach((mk) => {
    mk.analyses.sort((a, b) => {
      if (a.pending !== b.pending) return a.pending ? -1 : 1
      return (b.height || 0) - (a.height || 0)
    })
  })
  list.sort((a, b) => {
    if (a.pending !== b.pending) return a.pending ? -1 : 1
    return (b.height || 0) - (a.height || 0)
  })
  return list
}

function fmtIre(uire) {
  const n = Number(uire) / 1_000_000
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(n)
}

function odds(mk) {
  const total = mk.yes + mk.no
  if (total === 0n) return { yes: 50, no: 50, known: false, vol: 0n }
  const yesPct = Number((mk.yes * 100n) / total)
  return { yes: yesPct, no: 100 - yesPct, known: true, vol: total }
}

function memoFor(obj) {
  return 'IREINSCRIBE1 application/json ' + JSON.stringify(obj)
}

function cliSend(amount, memo) {
  return [
    'ired tx bank send <from> <from> ' + amount + 'uire \\',
    '  --chain-id ire-1 \\',
    '  --from <key> \\',
    '  --gas-prices 0.001uire \\',
    "  --memo '" + memo + "' \\",
    '  --home "$HOME/.ire" \\',
    '  --yes',
  ].join('\n')
}

function snippet(code) {
  return (
    '<figure class="snippet"><button class="copy" type="button" data-copy>Copy</button>' +
    '<pre><code class="language-sh">' + escapeHtml(code) + '</code></pre></figure>'
  )
}

function openCli(question) {
  const q = question || 'ETF approved 2026?'
  return cliSend('1', memoFor({ p: 'ire-bet', op: 'open', q, o: ['y', 'n'] }))
}

function buyCli(id, side) {
  return cliSend('1000000', memoFor({ p: 'ire-bet', op: 'buy', m: id, s: side, a: '1000000' }))
}

function resolveCli(id, w) {
  return cliSend('1', memoFor({ p: 'ire-bet', op: 'resolve', m: id, w }))
}

function analyzeCli(id) {
  return cliSend('1', memoFor({ p: 'ire-bet', op: 'analyze', m: id, y: 65, n: 35, note: 'brief' }))
}

function setPill(name, label) {
  const el = $('mk-pill')
  el.dataset.state = name
  el.lastChild.textContent = label
}

function renderFacts() {
  $('mk-height').textContent = state.height == null ? '—' : '#' + state.height.toLocaleString('en-US')
  $('mk-count').textContent = state.online ? String(state.markets.length) : '—'
  $('mk-window').textContent = state.online && state.windowMin != null
    ? '#' + state.windowMin + '–#' + state.height
    : '—'
  $('mk-pending').textContent = state.online ? String(state.pendingCount) : '—'
  $('mk-updated').textContent = state.lastOk
    ? 'Polled ' + state.lastOk.toLocaleTimeString('en-US', { hour12: false })
    : 'Waiting for /rpc/status'
}

function card(mk) {
  const o = odds(mk)
  const latest = mk.analyses[0]
  const winner = mk.resolve && (mk.resolve.w === 'y' || mk.resolve.w === 'yes')
    ? 'Yes'
    : mk.resolve && (mk.resolve.w === 'n' || mk.resolve.w === 'no')
      ? 'No'
      : mk.resolve
        ? mk.resolve.w
        : null
  const classes = ['mk-card']
  if (mk.pending) classes.push('is-pending')
  if (mk.resolve && !mk.resolve.pending) classes.push('is-resolved')
  const badges = []
  if (mk.pending) badges.push('<span class="mk-badge mk-badge--pending">mempool</span>')
  if (mk.pendingBuys) badges.push('<span class="mk-badge mk-badge--pending">' + mk.pendingBuys + ' pending bet' + (mk.pendingBuys === 1 ? '' : 's') + '</span>')
  if (winner) badges.push('<span class="mk-badge ' + (winner === 'Yes' ? 'mk-badge--yes' : 'mk-badge--no') + '">resolved ' + escapeHtml(winner) + (mk.resolve.pending ? ' (mempool)' : '') + '</span>')
  if (mk.height && !mk.pending) badges.push('<span>block #' + mk.height + '</span>')
  const note = latest && (latest.note || latest.y != null)
    ? '<div class="mk-note"><strong>Latest analyze' + (latest.pending ? ' · mempool' : '') + '</strong>' +
      escapeHtml(
        (latest.y != null && latest.n != null ? latest.y + '/' + latest.n + ' y/n. ' : '') +
        (latest.note || '')
      ) + '</div>'
    : ''
  return (
    '<article class="' + classes.join(' ') + '">' +
    '<div class="mk-card-meta">' + badges.join('') + '</div>' +
    '<h3>' + escapeHtml(mk.q) + '</h3>' +
    '<p class="mk-id">' + escapeHtml(mk.id) + '</p>' +
    '<dl class="mk-bars">' +
    '<div class="mk-side"><dt>Yes</dt><dd class="mk-track"><span class="mk-fill mk-fill--yes" style="width:' + o.yes + '%"></span></dd><dd>' + o.yes + '%</dd></div>' +
    '<div class="mk-side"><dt>No</dt><dd class="mk-track"><span class="mk-fill mk-fill--no" style="width:' + o.no + '%"></span></dd><dd>' + o.no + '%</dd></div>' +
    '</dl>' +
    '<p class="mk-odds-note">' + (o.known
      ? 'From inscribed buy amounts only.'
      : 'No buy inscriptions yet — 50/50 placeholder, not a book.') + '</p>' +
    '<p class="mk-vol">Volume ' + fmtIre(o.vol) + ' IRE' +
    ((mk.pendingYes + mk.pendingNo) > 0n ? ' · ' + fmtIre(mk.pendingYes + mk.pendingNo) + ' IRE in mempool' : '') +
    '</p>' +
    note +
    '<div class="mk-actions">' +
    '<details><summary>Buy yes · 1 IRE pledge</summary>' + snippet(buyCli(mk.id, 'y')) + '</details>' +
    '<details><summary>Buy no · 1 IRE pledge</summary>' + snippet(buyCli(mk.id, 'n')) + '</details>' +
    '<details><summary>Resolve</summary>' + snippet(resolveCli(mk.id, 'y')) + '</details>' +
    '<details><summary>Analyze (analyst CLI)</summary>' + snippet(analyzeCli(mk.id)) + '</details>' +
    '</div></article>'
  )
}

function renderBoard() {
  const empty = $('mk-empty')
  const grid = $('mk-grid')
  const offline = $('mk-offline')
  const label = $('mk-board-label')

  if (!state.online) {
    grid.innerHTML = ''
    empty.hidden = true
    offline.hidden = false
    label.textContent = 'OFFLINE'
    return
  }

  offline.hidden = true
  label.textContent = state.markets.length
    ? state.markets.length + ' market' + (state.markets.length === 1 ? '' : 's') + ' in window'
    : 'empty window'

  if (!state.markets.length) {
    grid.innerHTML = ''
    empty.hidden = false
    return
  }

  empty.hidden = true
  grid.innerHTML = state.markets.map(card).join('')
}

async function loadBlock(height) {
  const cached = blockCache.get(height)
  if (cached) return cached
  const data = await getJson('/rpc/block?height=' + height)
  const rawTxs = (data.result && data.result.block && data.result.block.data && data.result.block.data.txs) || []
  const events = []
  for (const raw of rawTxs) {
    const found = await decodeBets(raw, { height, pending: false })
    events.push(...found)
  }
  const rec = { height, events }
  blockCache.set(height, rec)
  return rec
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

async function tick() {
  try {
    const status = await getJson('/rpc/status')
    const sync = status.result.sync_info
    const height = Number(sync.latest_block_height)
    if (!Number.isFinite(height) || height < 1) throw new Error('bad height')

    const minH = Math.max(1, height - BLOCK_WINDOW + 1)
    const [chain, mempool] = await Promise.all([
      getJson('/rpc/blockchain?minHeight=' + minH + '&maxHeight=' + height),
      getJson('/rpc/unconfirmed_txs?limit=' + MEMPOOL_LIMIT),
    ])

    const metas = (chain.result.block_metas || [])
      .map((m) => Number(m.header && m.header.height))
      .filter((h) => Number.isFinite(h) && h >= minH && h <= height)

    const heights = [...new Set(metas)]
    if (!heights.length) {
      for (let h = minH; h <= height; h++) heights.push(h)
    }

    for (const h of [...blockCache.keys()]) {
      if (h < minH || h > height) blockCache.delete(h)
    }

    const blocks = await mapPool(heights, BATCH, (h) => loadBlock(h))
    const events = []
    for (const b of blocks) {
      if (b && b.events) events.push(...b.events)
    }

    const rawPending = (mempool.result && mempool.result.txs) || []
    let pendingCount = 0
    for (const raw of rawPending) {
      const found = await decodeBets(raw, { height: null, pending: true })
      pendingCount += found.length
      events.push(...found)
    }

    state.online = true
    state.height = height
    state.catchingUp = Boolean(sync.catching_up)
    state.windowMin = minH
    state.scanned = heights.length
    state.pendingCount = pendingCount
    state.markets = reconstruct(events)
    state.lastOk = new Date()
    setPill(state.catchingUp ? 'syncing' : 'live', state.catchingUp ? 'SYNCING' : 'LIVE')
    renderFacts()
    renderBoard()
  } catch {
    state.online = false
    state.markets = []
    setPill('offline', 'OFFLINE')
    renderFacts()
    renderBoard()
  }
}

setPill('offline', 'CONNECTING')
tick()
setInterval(tick, POLL_MS)
