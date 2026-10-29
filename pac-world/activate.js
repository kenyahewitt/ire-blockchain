(function () {
  'use strict';
  const A = window.DropActivationCore;
  const $ = id => document.getElementById(id);
  let config;

  function status(message, kind = '') {
    $('status').textContent = message;
    $('status').className = `activation-status ${kind}`.trim();
  }

  async function inspect() {
    $('play').hidden = true;
    $('play').style.display = 'none';
    $('owner').textContent = '—';
    if (!config) throw new Error('World configuration unavailable.');
    const tokenId = A.tokenId($('token-id').value, config.maxTokenId);
    const owner = await A.ownerOf(config.collection, tokenId);
    $('owner').textContent = owner;
    $('play').href = `play.html?token=${tokenId}`;
    $('play').hidden = false;
    $('play').style.display = 'inline-flex';
    status(`World #${tokenId} is ready. Open its game for free; no wallet connection or payment is needed.`);
  }

  async function init() {
    try {
      const response = await fetch('drop-activation.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('World configuration unavailable.');
      config = await response.json();
      if (config.chainId !== 4663 || config.collection.toLowerCase() !== '0xd5035b128f7afb26fd0d54d55c612f00196be049' || config.revealEnabled !== true) {
        throw new Error('Unexpected Genesis collection configuration.');
      }
      $('token-id').max = String(config.maxTokenId);
      status('Enter a minted token ID to check its owner and open its world.');
    } catch (error) {
      status(error.message, 'error');
      $('verify').disabled = true;
    }
  }

  $('verify').addEventListener('click', () => inspect().catch(error => status(error.message, 'error')));
  $('token-id').addEventListener('change', () => inspect().catch(error => status(error.message, 'error')));
  init();
})();
