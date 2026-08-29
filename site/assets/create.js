// IRE Create — fill a local ired memo command. No upload, no broadcast.
const PREFIX_JSON = 'IREINSCRIBE1 application/json '
const PREFIX_SVG = 'IREINSCRIBE1 image/svg+xml '
const PREFIX_TEXT = 'IREINSCRIBE1 text/plain '
const PAYLOAD_MAX = 180

const $ = (id) => document.getElementById(id)

function cli(memo) {
  return [
    'ired tx bank send <from> <from> 1uire \\',
    '  --chain-id ire-1 \\',
    '  --from <key> \\',
    '  --gas-prices 0.001uire \\',
    "  --memo '" + memo + "' \\",
    '  --home "$HOME/.ire" \\',
    '  --yes',
  ].join('\n')
}

function setSnippet(codeId, text, blocked) {
  const el = $(codeId)
  el.textContent = text
  const figure = el.closest('.snippet')
  const btn = figure && figure.querySelector('[data-copy]')
  if (btn) btn.hidden = Boolean(blocked)
}

function looksSvg(value) {
  return /^\s*<svg[\s>]/i.test(value)
}

function tokenMemo() {
  const tick = $('tk-tick').value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
  const max = sanitize($('tk-max').value.trim() || '21000000')
  const lim = sanitize($('tk-lim').value.trim() || '1000')
  return PREFIX_JSON + JSON.stringify({
    p: 'ire-insc',
    op: 'deploy',
    tick: tick || 'ABCD',
    max: max,
    lim: lim,
  })
}

function artParts() {
  const title = sanitize($('art-title').value)
  const body = sanitize($('art-body').value)
  if (looksSvg(body)) {
    return { prefix: PREFIX_SVG, payload: body.trim() }
  }
  const payload = [title.trim(), body].filter((s) => s !== '').join('\n')
  return { prefix: PREFIX_TEXT, payload }
}

function fileMemo() {
  const name = sanitize($('file-name').value.trim() || 'clip.mp4')
  const mime = sanitize($('file-mime').value.trim() || 'video/mp4')
  const bytes = sanitize($('file-bytes').value.trim() || '12345')
  return PREFIX_JSON + JSON.stringify({
    p: 'ire-insc',
    op: 'file',
    name: name,
    mime: mime,
    bytes: Number(bytes) || bytes,
    note: 'on-chain catalog; payload needs inscription module',
  })
}

function gameMemo() {
  const name = sanitize($('game-name').value.trim() || 'game')
  const mime = sanitize($('game-mime').value.trim() || 'text/html')
  return PREFIX_JSON + JSON.stringify({
    p: 'ire-insc',
    op: 'game',
    name: name,
    mime: mime,
  })
}

function sanitize(value) {
  return String(value).replace(/'/g, '')
}

function fitOrBlock(codeId, memo) {
  if (memo.length > 256) {
    setSnippet(codeId, 'Blocked — memo is ' + memo.length + ' characters (max 256). Shorten the name.', true)
    return
  }
  setSnippet(codeId, cli(memo), false)
}

function refreshToken() {
  const tick = $('tk-tick').value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
  if ($('tk-tick').value !== tick) $('tk-tick').value = tick
  fitOrBlock('tk-cli', tokenMemo())
}

function refreshArt() {
  const parts = artParts()
  const over = parts.payload.length > PAYLOAD_MAX
  $('art-count').textContent = parts.payload.length + ' / ' + PAYLOAD_MAX + ' payload chars after prefix'
  $('art-count').classList.toggle('is-over', over)
  $('art-warn').hidden = !over
  if (over) {
    setSnippet(
      'art-cli',
      'Blocked — payload is ' + parts.payload.length + ' characters. The memo will not fit until a chain upgrade.',
      true
    )
    return
  }
  setSnippet('art-cli', cli(parts.prefix + parts.payload), false)
}

function refreshFile() {
  fitOrBlock('file-cli', fileMemo())
}

function refreshGame() {
  fitOrBlock('game-cli', gameMemo())
}

$('tk-tick').addEventListener('input', refreshToken)
$('tk-max').addEventListener('input', refreshToken)
$('tk-lim').addEventListener('input', refreshToken)
$('art-title').addEventListener('input', refreshArt)
$('art-body').addEventListener('input', refreshArt)
$('file-name').addEventListener('input', refreshFile)
$('file-mime').addEventListener('input', refreshFile)
$('file-bytes').addEventListener('input', refreshFile)
$('game-name').addEventListener('input', refreshGame)
$('game-mime').addEventListener('input', refreshGame)

$('file-pick').addEventListener('change', (event) => {
  const f = event.target.files && event.target.files[0]
  event.target.value = ''
  if (!f) return
  $('file-name').value = f.name
  $('file-mime').value = f.type || 'application/octet-stream'
  $('file-bytes').value = String(f.size)
  refreshFile()
})

$('game-pick').addEventListener('change', (event) => {
  const f = event.target.files && event.target.files[0]
  event.target.value = ''
  if (!f) return
  $('game-name').value = f.name
  $('game-mime').value = f.type || 'application/octet-stream'
  refreshGame()
})

refreshToken()
refreshArt()
refreshFile()
refreshGame()
