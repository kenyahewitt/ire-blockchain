(function () {
  'use strict';
  const A = window.DropActivationCore;
  const $ = id => document.getElementById(id);
  const SELECTORS = { collection: '0x7de1e536', wallet: '0xd78c1abc', activate: '0xb260c42a' };
  let config, session, owner, token, registryReady = false, existingWallet = false;
  function status(message, kind = '') { $('status').textContent = message; $('status').className = `activation-status ${kind}`.trim(); }
  function disable() { $('activate').disabled = true; }
  async function inspect() {
    disable(); owner = null; existingWallet = false;
    if (!config) throw new Error('Activation configuration unavailable.');
    token = A.tokenId($('token-id').value, config.maxTokenId);
    owner = await A.ownerOf(config.collection, token);
    $('owner').textContent = owner;
    $('account').textContent = session ? session.account : 'Not connected';
    $('world-wallet').textContent = registryReady ? A.addressFrom(await A.call(config.registry, SELECTORS.wallet + A.word(token))) : 'Awaiting activation contract';
    existingWallet = registryReady && A.configuredAddress($('world-wallet').textContent);
    if (existingWallet) { status('This world wallet is active. Its current NFT owner controls it.'); return; }
    if (!session) { status(registryReady && config.walletConnectEnabled === true ? 'NFT owner verified. Connect that wallet to prepare activation.' : 'NFT owner verified. Wallet connection remains off until activation is live.'); return; }
    if (owner.toLowerCase() !== session.account.toLowerCase()) { status('The connected wallet does not own this NFT.', 'warn'); return; }
    if (!registryReady) { status('Ownership verified. Activation awaits the reviewed, deployed Genesis registry.', 'warn'); return; }
    $('activate').disabled = false;
    status('Ownership verified. Review the wallet prompt before activating.');
  }
  async function activate() {
    disable();
    try {
      await inspect();
      if (!registryReady || existingWallet || !session || owner.toLowerCase() !== session.account.toLowerCase()) throw new Error('Activation is not available for this wallet and token.');
      disable();
      const hash = await A.send(session.wallet, session.account, config.registry, SELECTORS.activate + A.word(token));
      status(`Transaction submitted: ${hash}. Waiting for confirmation…`);
      await A.confirmed(hash);
      await inspect();
    } catch (error) { status(error.message, 'error'); disable(); }
  }
  async function init() {
    try {
      const response = await fetch('drop-activation.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Activation configuration unavailable.');
      config = await response.json();
      if (config.chainId !== 4663 || config.collection.toLowerCase() !== '0xd5035b128f7afb26fd0d54d55c612f00196be049') throw new Error('Unexpected Genesis collection configuration.');
      registryReady = await A.verifiedRegistry(config.registry, [[SELECTORS.collection, config.collection]]);
      const walletConnectReady = registryReady && config.walletConnectEnabled === true;
      $('connect').disabled = !walletConnectReady;
      $('connect').textContent = walletConnectReady ? 'Connect wallet' : 'Wallet connection unavailable';
      status(walletConnectReady ? 'Connect your wallet and verify a token.' : 'Check NFT ownership without connecting a wallet. World-wallet activation is pending.');
    } catch (error) { status(error.message, 'error'); }
  }
  $('token-id').addEventListener('change', () => inspect().catch(error => { disable(); status(error.message, 'error'); }));
  $('verify').addEventListener('click', () => inspect().catch(error => { disable(); status(error.message, 'error'); }));
  $('connect').addEventListener('click', async () => {
    try { if (!registryReady || config?.walletConnectEnabled !== true) throw new Error('Wallet connection is unavailable until activation is live.'); session = await A.connect(); $('account').textContent = session.account; $('connect').textContent = A.short(session.account); session.wallet.on?.('accountsChanged', () => { session = null; disable(); $('account').textContent = 'Reconnect wallet'; status('Wallet account changed. Reconnect and verify ownership again.', 'warn'); }); await inspect(); }
    catch (error) { disable(); status(error.message, 'error'); }
  });
  $('activate').addEventListener('click', activate);
  init();
})();
