(function () {
  'use strict';
  const A = window.DropActivationCore, $ = id => document.getElementById(id);
  const directions = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  let config, maze, player, gems, moves = 0, revealed = false;
  function status(message, kind = '') { $('status').textContent = message; $('status').className = `activation-status ${kind}`.trim(); }
  function draw() {
    const ctx = $('maze').getContext('2d'), cell = 32;
    ctx.fillStyle = '#050806'; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#303731'; ctx.lineWidth = 1;
    for (let i = 1; i < 16; i++) { ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, 512); ctx.moveTo(0, i * cell); ctx.lineTo(512, i * cell); ctx.stroke(); }
    ctx.fillStyle = '#a100ff';
    for (const key of maze.blocked) { const [x, y] = key.split(',').map(Number); ctx.fillRect((x + .16) * cell, (y + .16) * cell, .68 * cell, .68 * cell); }
    ctx.fillStyle = '#9beaff';
    for (const key of gems) { const [x, y] = key.split(',').map(Number); ctx.fillRect((x + .4) * cell, (y + .4) * cell, .2 * cell, .2 * cell); }
    ctx.fillStyle = '#ffbe55'; ctx.fillRect((maze.goal.x + .28) * cell, (maze.goal.y + .28) * cell, .44 * cell, .44 * cell);
    ctx.fillStyle = '#c8ff00'; ctx.beginPath(); ctx.arc((player.x + .5) * cell, (player.y + .5) * cell, 9, 0, 2 * Math.PI); ctx.fill();
  }
  function move(direction) {
    if (!maze || !directions[direction]) return;
    const [dx, dy] = directions[direction], x = player.x + dx, y = player.y + dy, key = `${x},${y}`;
    if (x < 1 || x > 14 || y < 1 || y > 14 || maze.blocked.has(key)) return;
    player = { x, y }; moves++;
    if (gems.delete(key)) $('gems').textContent = String(Number($('gems').textContent) + 1);
    $('moves').textContent = String(moves); draw();
    if (x === maze.goal.x && y === maze.goal.y) status(`World #${maze.id} complete in ${moves} moves. Try another path or world!`);
  }
  async function load() {
    if (!revealed || !config) return;
    try {
      const id = A.tokenId($('token-id').value, config.maxTokenId);
      $('owner').textContent = await A.ownerOf(config.collection, id);
      const wallet = A.configuredAddress(config.registry) ? A.addressFrom(await A.call(config.registry, '0xd78c1abc' + A.word(id))) : A.ZERO;
      $('world-wallet').textContent = A.configuredAddress(wallet) ? wallet : 'Awaiting activation';
      maze = window.PacWorldMaze.build(id); player = { ...maze.start }; gems = new Set(maze.gems); moves = 0;
      $('moves').textContent = '0'; $('gems').textContent = '0'; $('maze').hidden = false; document.querySelector('.controls').hidden = false;
      draw(); status(`World #${id} loaded. Reach the gold square.`);
    } catch (error) { maze = null; $('maze').hidden = true; document.querySelector('.controls').hidden = true; status(error.message, 'error'); }
  }
  async function init() {
    try {
      const response = await fetch('drop-activation.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('World configuration unavailable.');
      config = await response.json();
      if (config.chainId !== 4663 || config.collection.toLowerCase() !== '0xd5035b128f7afb26fd0d54d55c612f00196be049') throw new Error('Unexpected collection configuration.');
      revealed = config.revealEnabled === true;
      if (revealed) { $('reveal-notice').hidden = true; $('load').disabled = false; status('Enter a minted world ID to play.'); }
    } catch (error) { status(error.message, 'error'); }
  }
  $('load').addEventListener('click', load);
  document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => move(button.dataset.direction)));
  document.addEventListener('keydown', event => { const key = event.key.toLowerCase(), map = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' }; if (maze && map[key] && document.activeElement.tagName !== 'INPUT') { event.preventDefault(); move(map[key]); } });
  init();
})();
