(function (root) {
  'use strict';
  function randomFor(seed) {
    let a = seed;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function build(tokenId) {
    const id = Number(tokenId);
    if (!Number.isInteger(id) || id < 1 || id > 10000) throw new Error('Invalid world ID.');
    const seed = (Math.imul(id, 2654435761) ^ 0x50414357) >>> 0;
    const random = randomFor(seed);
    const blocked = new Set();
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      if (random() > 0.54 && (x > 2 || y > 2) && (x < 12 || y < 12)) blocked.add(`${x},${y}`);
    }
    const start = { x: 1, y: 1 };
    const visited = new Set(['1,1']);
    const queue = [{ ...start, distance: 0 }];
    let goal = queue[0];
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      if (current.distance > goal.distance) goal = current;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = current.x + dx, y = current.y + dy, key = `${x},${y}`;
        if (x < 1 || x > 14 || y < 1 || y > 14 || blocked.has(key) || visited.has(key)) continue;
        visited.add(key); queue.push({ x, y, distance: current.distance + 1 });
      }
    }
    const gems = new Set();
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) {
      const key = `${x},${y}`;
      if (visited.has(key) && !blocked.has(key) && (x + y) % 2 === 0 && key !== '1,1' && key !== `${goal.x},${goal.y}`) gems.add(key);
    }
    return { id, seed, blocked, gems, start, goal: { x: goal.x, y: goal.y }, reachable: visited.size };
  }
  const api = { build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PacWorldMaze = api;
})(typeof window !== 'undefined' ? window : globalThis);
