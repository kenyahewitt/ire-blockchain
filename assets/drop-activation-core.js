(function () {
  'use strict';
  const RPC = 'https://rpc.mainnet.chain.robinhood.com';
  const CHAIN_ID = '0x1237';
  const OWNER_OF = '0x6352211e';
  const ZERO = '0x0000000000000000000000000000000000000000';
  let sequence = 0;

  function validAddress(value) { return /^0x[0-9a-fA-F]{40}$/.test(value || ''); }
  function configuredAddress(value) { return validAddress(value) && value.toLowerCase() !== ZERO; }
  function tokenId(value, max) {
    if (!/^[1-9][0-9]*$/.test(String(value))) throw new Error('Enter a whole token ID above zero.');
    const id = BigInt(value);
    if (id > BigInt(max)) throw new Error(`Token ID must be at most ${max}.`);
    return id;
  }
  function word(value) { return BigInt(value).toString(16).padStart(64, '0'); }
  function addressFrom(result) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(result || '')) throw new Error('Contract returned an invalid address.');
    return '0x' + result.slice(-40);
  }
  function boolFrom(result) { return BigInt(result || '0x0') !== 0n; }
  function short(value) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—'; }
  async function rpc(method, params) {
    const response = await fetch(RPC, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method, params })
    });
    if (!response.ok) throw new Error('Robinhood Chain RPC is unavailable.');
    const body = await response.json();
    if (body.error) throw new Error(body.error.message || 'Chain read failed.');
    return body.result;
  }
  async function call(to, data) { return rpc('eth_call', [{ to, data }, 'latest']); }
  async function ownerOf(collection, id) { return addressFrom(await call(collection, OWNER_OF + word(id))); }
  async function verifiedRegistry(registry, reads) {
    if (!configuredAddress(registry)) return false;
    const code = await rpc('eth_getCode', [registry, 'latest']);
    if (!code || code === '0x') throw new Error('Activation registry has no deployed code.');
    for (const [selector, expected] of reads) {
      const actual = addressFrom(await call(registry, selector));
      if (actual.toLowerCase() !== expected.toLowerCase()) throw new Error('Activation registry points to the wrong NFT contract.');
    }
    return true;
  }
  function provider() {
    const candidates = Array.isArray(window.ethereum?.providers) ? window.ethereum.providers : [window.ethereum];
    return candidates.find(p => p?.isMetaMask && !p?.isPhantom) || candidates.find(Boolean) || null;
  }
  async function connect() {
    const wallet = provider();
    if (!wallet) throw new Error('Install or open a compatible wallet, then reconnect.');
    const accounts = await wallet.request({ method: 'eth_requestAccounts' });
    if (!accounts?.[0] || !validAddress(accounts[0])) throw new Error('No wallet account selected.');
    return { wallet, account: accounts[0] };
  }
  async function send(wallet, account, to, data) {
    const network = await wallet.request({ method: 'eth_chainId' });
    if (String(network).toLowerCase() !== CHAIN_ID) {
      await wallet.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_ID }] });
    }
    return wallet.request({ method: 'eth_sendTransaction', params: [{ from: account, to, data }] });
  }
  async function confirmed(hash) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const receipt = await rpc('eth_getTransactionReceipt', [hash]);
      if (receipt) {
        if (BigInt(receipt.status || '0x0') !== 1n) throw new Error('Transaction reverted.');
        return receipt;
      }
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    throw new Error('Transaction submitted but not confirmed yet. Check its hash in Blockscout.');
  }
  window.DropActivationCore = { ZERO, validAddress, configuredAddress, tokenId, word, addressFrom, boolFrom, short, rpc, call, ownerOf, verifiedRegistry, connect, send, confirmed };
})();
