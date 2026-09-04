/**
 * Crypto Brokers unique skills — tokenId 1..5000 → one skill object.
 *
 * Deterministic: sha256("crypto-brokers-skill-{id}-{salt}") plus linear probe
 * so every token gets a distinct skillId AND a distinct
 * (desk, role, pair, timeframe, risk) tuple. Names are unique because they
 * include that full tuple.
 *
 * Paper = live public quotes from the desk's real API. Never a fake fill tape.
 * Live = owner-signed personal_sign of a skill intent. No custody, no swap.
 * Not a licensed broker. Not Robinhood Inc. ire-1 is a testnet.
 */
(function (root) {
  "use strict";

  var COLLECTION_SIZE = 5000;
  var M = root.BrokersMandates;

  function sha256hex(str) {
    if (M && typeof M.sha256hex === "function") return M.sha256hex(str);
    throw new Error("BrokersMandates.sha256hex required — load mandates.js first");
  }

  var DESKS = [
    {
      id: "kraken-spot",
      name: "Kraken public ticker",
      venue: "Kraken spot",
      dataSource: "https://api.kraken.com/0/public/Ticker",
      quoteKind: "usd",
      pairs: [
        "XBTUSD","ETHUSD","SOLUSD","XRPUSD","ADAUSD","LTCUSD","DOGEUSD","DOTUSD",
        "LINKUSD","UNIUSD","ATOMUSD","AVAXUSD","FILUSD","NEARUSD","APTUSD","SUIUSD",
        "XLMUSD","ALGOUSD","TRXUSD","BCHUSD","AAVEUSD"
      ]
    },
    {
      id: "kraken-fut",
      name: "Kraken futures ticker",
      venue: "Kraken futures",
      dataSource: "https://futures.kraken.com/derivatives/api/v3/tickers",
      quoteKind: "usd",
      pairs: [
        "PF_XBTUSD","PF_ETHUSD","PF_SOLUSD","PF_XRPUSD","PF_LTCUSD","PF_BCHUSD","PF_ADAUSD",
        "PF_DOTUSD","PF_LINKUSD","PF_UNIUSD","PF_AVAXUSD","PF_ATOMUSD","PF_NEARUSD","PF_APTUSD",
        "PF_FILUSD","PF_XLMUSD","PF_ALGOUSD","PF_TRXUSD","PF_AAVEUSD","PF_DOGEUSD","PF_SUIUSD"
      ]
    },
    {
      id: "phantom-sol",
      name: "Phantom/SOL watch",
      venue: "Solana public (Jupiter lite price / RPC)",
      dataSource: "https://lite-api.jup.ag/price/v2",
      quoteKind: "usd",
      pairs: [
        "SOL","JUP","BONK","WIF","PYTH","JTO","RAY","MSOL","JITOSOL","RENDER",
        "ORCA","MNDE","HNT","W","TNSR","USDC","WBTC","WETH","JTO-SOL","BONK-SOL","JUP-SOL"
      ]
    },
    {
      id: "ire-rpc",
      name: "IRE testnet RPC",
      venue: "ire-1 public RPC (testnet)",
      dataSource: "https://boomer250.com/rpc/status",
      quoteKind: "height",
      pairs: [
        "uire","IREVAL1","ire-1-height","ire-1-mempool","inscriptions","markets","points",
        "vault-gas","seed-status","join-wait","bank-send","note-memo","validator-set",
        "consensus-power","gov-proposal","staking-bonded","supply-uire","community-pool",
        "fee-collector","unconfirmed-txs","latest-block"
      ]
    },
    {
      id: "codex-read",
      name: "Codex Supergraph (read)",
      venue: "Codex GraphQL read",
      dataSource: "https://graph.codex.io/graphql",
      quoteKind: "usd",
      pairs: [
        "ETH","BTC","SOL","UNI","LINK","AAVE","MKR","ARB","OP","SUI","APT","TIA",
        "JUP","WIF","ONDO","ENA","PENDLE","LDO","RPL","GRT","ENS"
      ]
    },
    {
      id: "rh-blockscout",
      name: "Robinhood Blockscout floor",
      venue: "Robinhood Chain Blockscout",
      dataSource: "https://robinhoodchain.blockscout.com/api/v2/tokens/0x9F7A3ADbF611cBeeC95Ce40e0259bbF96b8Df041",
      quoteKind: "stats",
      pairs: [
        "CRYPTO-BROKERS","NINJAAGENT","RH-ETH","token-holders","totalSupply","NFT-1",
        "NFT-42","NFT-2500","contract-metadata","gas-ETH","latest-block","token-transfers",
        "NFT-inventory","ERC721-count","floor-stats","ownerOf-scan","OpenSea-link",
        "mint-bar","SeaDrop","collection-page","Blockscout-counters"
      ]
    },
    {
      id: "combat-dea",
      name: "Combat DEA token",
      venue: "Robinhood Chain Blockscout (Ninjaagent / Brokers public stats)",
      dataSource: "https://robinhoodchain.blockscout.com/api/v2/tokens/0x5Ce837Cf242e763F9b0E9A87AA7907C3F5DD083C",
      quoteKind: "stats",
      pairs: [
        "NINJAAGENT","CRYPTO-BROKERS","RH-ETH","Combat-watch","DEA-watch","holders",
        "transfers","token-stats","related-RH","collection-floor","inventory","metadata",
        "owner-scan","combat-desk","dea-ticker","ninja-quote","broker-quote","gas-ETH",
        "latest-block","verified-contract","Blockscout-token"
      ]
    },
    {
      id: "ire-volt",
      name: "IRE Volt",
      venue: "ire-1 Volt (community pool)",
      dataSource: "https://boomer250.com/api/cosmos/bank/v1beta1/balances/ire1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8nanfuy",
      quoteKind: "balance",
      pairs: [
        "VOLT-POOL","uire-balance","community_tax","fee-split","height","rewards-spend",
        "airdrop-gov","ops-spend","no-treasury","genesis-tax","proposal-001",
        "module-distribution","bank-balances","status","supply","bonded","unbonding",
        "inflation-0","points-fund","vault-page","gas-in"
      ]
    }
  ];

  var ROLES = [
    {
      name: "Scanner",
      action: "scan",
      paperBehavior: "Fetch the desk's public API for this pair and display the last published value. If the fetch fails, show quote unavailable. Never invent a print.",
      liveBehavior: "Owner personal_sign of a scan intent JSON (skillId + pair). No eth_sendTransaction.",
      does: "Watches the public feed for this pair and reports the last published quote. Not a fill. Not a licensed desk."
    },
    {
      name: "Clock-In crank helper",
      action: "clock-in-helper",
      paperBehavior: "Read-only helper copy for a Clock-In crank. Does not deploy Clock In, send txs, or hold keys.",
      liveBehavior: "Owner personal_sign of a clock-in-helper intent. This page does not deploy unaudited Clock In.",
      does: "Drafts an owner-signed helper intent for a Clock-In crank. Unaudited Clock In is not deployed from this page. No chain txs. No keys."
    },
    {
      name: "Drawdown guard",
      action: "drawdown-check",
      paperBehavior: "Compare the latest public quote to the last stored public quote for this token. No prior quote → no drawdown number. Never invent PnL.",
      liveBehavior: "Owner personal_sign of a drawdown-check intent using the last public quote, not a made-up mark.",
      does: "Guards against a drop vs the last real public quote stored locally. If no prior quote, it says so. No invented PnL."
    },
    {
      name: "Portfolio snapshot",
      action: "snapshot",
      paperBehavior: "Store a timestamped public quote locally. This is not a brokerage statement.",
      liveBehavior: "Owner personal_sign of a snapshot intent. No custody of assets.",
      does: "Takes a local snapshot of the public quote for this pair. Not a broker statement. Not a fill."
    },
    {
      name: "Grid designer",
      action: "grid-plan",
      paperBehavior: "From a live public quote, show ±1/2% grid levels. No quote → quote unavailable, no grid. Does not place orders.",
      liveBehavior: "Owner personal_sign of the grid-plan JSON. No approve, no swap calldata.",
      does: "Designs a grid from a real public quote (not a fake tape). Does not place the grid. Owner must sign to accept the plan."
    },
    {
      name: "DCA planner",
      action: "dca-plan",
      paperBehavior: "Show a schedule description anchored to the live public quote. Does not buy. Fail → quote unavailable.",
      liveBehavior: "Owner personal_sign of a dca-plan intent. No custody, no auto-buy.",
      does: "Plans a DCA schedule from a real public quote. Does not execute buys. Owner signs the plan."
    },
    {
      name: "Funding scan",
      action: "funding-scan",
      paperBehavior: "Read public funding / token stats from the desk API. No API field → quote unavailable, never a made-up rate.",
      liveBehavior: "Owner personal_sign of a funding-scan intent.",
      does: "Reads public funding or token-stat fields. Reports what the API published. Does not invent a funding rate."
    },
    {
      name: "TBA collector",
      action: "tba-collect",
      paperBehavior: "Read public NFT/token metadata (Blockscout / tokenURI). Does not deploy a token-bound account.",
      liveBehavior: "Owner personal_sign of a tba-collect intent. No TBA deploy tx.",
      does: "Collects public metadata for this token. Not an ERC-6551 deployer. Not custody."
    },
    {
      name: "Mempool watch",
      action: "mempool-watch",
      paperBehavior: "GET public mempool or latest-block endpoints (ire-1 /rpc/unconfirmed_txs or Blockscout). Fail → quote unavailable.",
      liveBehavior: "Owner personal_sign of a mempool-watch intent. Read-only.",
      does: "Watches a public mempool or latest-block feed. Does not broadcast. Does not frontrun."
    },
    {
      name: "Validator waitlist",
      action: "validator-waitlist",
      paperBehavior: "Show ire-1 waitlist copy. IREVAL1 is waitlist points, not a consensus seat. ire-1 is a testnet.",
      liveBehavior: "Owner personal_sign of a validator-waitlist intent. Does not add a key to the current set.",
      does: "IRE validator waitlist helper. IREVAL1 is waitlist + testnet points, not a seat in the current one-validator set. Not 5000 validators."
    }
  ];

  var TIMEFRAMES = ["1m","5m","15m","1h","4h","1d","1w","8h-funding"];
  var RISKS = ["watch-only","tight","standard","wide","halt-first"];
  var PAIR_COUNT = DESKS[0].pairs.length;
  var SPACE = DESKS.length * ROLES.length * PAIR_COUNT * TIMEFRAMES.length * RISKS.length;

  var JUP_MINT = {
    SOL: "So11111111111111111111111111111111111111112",
    JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    JTO: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    MSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    JITOSOL: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    RENDER: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
    ORCA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
    MNDE: "MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey",
    HNT: "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux",
    W: "85VBFQZC9TZkfaptBWtvpwW1pY32idK1ZGtzKjeo82Sz",
    TNSR: "TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqBydADFo5rX",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    WBTC: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
    WETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    "JTO-SOL": "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
    "BONK-SOL": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "JUP-SOL": "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN"
  };

  var CODEX_ADDR = {
    ETH: { address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", networkId: 1 },
    BTC: { address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", networkId: 1 },
    SOL: { address: "So11111111111111111111111111111111111111112", networkId: 1399811149 },
    UNI: { address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", networkId: 1 },
    LINK: { address: "0x514910771af9ca656af840dff83e8264ecf986ca", networkId: 1 },
    AAVE: { address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", networkId: 1 },
    MKR: { address: "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", networkId: 1 },
    ARB: { address: "0x912ce59144191c1204e64559fe8253a0e49e6548", networkId: 42161 },
    OP: { address: "0x4200000000000000000000000000000000000042", networkId: 10 },
    SUI: { address: "0x2::sui::SUI", networkId: 101 },
    APT: { address: "0x1::aptos_coin::AptosCoin", networkId: 108 },
    TIA: { address: "utia", networkId: 201 },
    JUP: { address: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", networkId: 1399811149 },
    WIF: { address: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", networkId: 1399811149 },
    ONDO: { address: "0xfaba6f8e4a5e8ab594d12622500fa397b1ea385d", networkId: 1 },
    ENA: { address: "0x57e114b691db790c35207b2e685d4a43181e6061", networkId: 1 },
    PENDLE: { address: "0x808507121b80c02388fad14726482e061b8da827", networkId: 1 },
    LDO: { address: "0x5a98fcbea516cf06857215779fd812ca3bef1b32", networkId: 1 },
    RPL: { address: "0xd33526068d116ce69f19a9ee46f0bd304f21a51f", networkId: 1 },
    GRT: { address: "0xc944e90c64b2c07662a292be6244bdf05cda44a7", networkId: 1 },
    ENS: { address: "0xc18360217d8f7ab5e7c516566761ea12ce7f9d72", networkId: 1 }
  };

  function decodeIndex(idx) {
    var n = idx;
    var riskI = n % RISKS.length; n = Math.floor(n / RISKS.length);
    var tfI = n % TIMEFRAMES.length; n = Math.floor(n / TIMEFRAMES.length);
    var pairI = n % PAIR_COUNT; n = Math.floor(n / PAIR_COUNT);
    var roleI = n % ROLES.length; n = Math.floor(n / ROLES.length);
    var deskI = n % DESKS.length;
    return { deskI: deskI, roleI: roleI, pairI: pairI, tfI: tfI, riskI: riskI };
  }

  function comboKey(d) {
    return d.deskI + "|" + d.roleI + "|" + d.pairI + "|" + d.tfI + "|" + d.riskI;
  }

  function hexInt(str, salt) {
    var h = sha256hex("crypto-brokers-skill-" + str + "-" + salt);
    return BigInt("0x" + h.slice(0, 16));
  }

  var _table = null;

  function buildTable() {
    var usedCombo = Object.create(null);
    var usedSid = Object.create(null);
    var table = new Array(COLLECTION_SIZE + 1);
    var id, start, idx, probe, dec, key, sid, sidProbe, role, desk, pair, name;
    for (id = 1; id <= COLLECTION_SIZE; id++) {
      start = Number(hexInt(String(id), "combo") % BigInt(SPACE));
      idx = start;
      for (probe = 0; probe < SPACE; probe++) {
        dec = decodeIndex(idx);
        key = comboKey(dec);
        if (!usedCombo[key]) break;
        idx = (idx + 1) % SPACE;
      }
      if (usedCombo[key]) throw new Error("skill combo space exhausted at id " + id);
      usedCombo[key] = id;

      sid = "CBK-S-" + sha256hex("crypto-brokers-skillid-" + id).slice(0, 10).toUpperCase();
      sidProbe = 0;
      while (usedSid[sid]) {
        sidProbe++;
        sid = "CBK-S-" + sha256hex("crypto-brokers-skillid-" + id + "-p" + sidProbe).slice(0, 10).toUpperCase();
        if (sidProbe > 64) throw new Error("skillId probe failed at " + id);
      }
      usedSid[sid] = id;

      desk = DESKS[dec.deskI];
      role = ROLES[dec.roleI];
      pair = desk.pairs[dec.pairI];
      name = role.name + " · " + pair + " " + TIMEFRAMES[dec.tfI] + " · " + desk.name + " · " + RISKS[dec.riskI];

      table[id] = {
        tokenId: id,
        skillId: sid,
        name: name,
        desk: desk.name,
        deskId: desk.id,
        role: role.name,
        action: role.action,
        pair: pair,
        venue: desk.venue,
        timeframe: TIMEFRAMES[dec.tfI],
        risk: RISKS[dec.riskI],
        execution: "owner-signed",
        dataSource: desk.dataSource,
        quoteKind: desk.quoteKind,
        paperBehavior: role.paperBehavior,
        liveBehavior: role.liveBehavior,
        does: role.does,
        ticker: tickerFor(desk.id, pair)
      };
    }
    return table;
  }

  function tickerFor(deskId, pair) {
    if (deskId === "phantom-sol") return JUP_MINT[pair] || pair;
    if (deskId === "codex-read") return CODEX_ADDR[pair] || null;
    return pair;
  }

  function table() {
    if (!_table) _table = buildTable();
    return _table;
  }

  function skillFor(tokenId) {
    var n = parseInt(tokenId, 10);
    if (!Number.isFinite(n) || n < 1 || n > COLLECTION_SIZE) return null;
    return table()[n];
  }

  function assertUnique() {
    var t = table();
    var names = Object.create(null);
    var ids = Object.create(null);
    var combos = Object.create(null);
    var i, s, c;
    for (i = 1; i <= COLLECTION_SIZE; i++) {
      s = t[i];
      if (!s) return { ok: false, reason: "missing " + i };
      if (s.execution !== "owner-signed") return { ok: false, reason: "execution " + i };
      if (ids[s.skillId]) return { ok: false, reason: "skillId collision", a: ids[s.skillId], b: i, skillId: s.skillId };
      if (names[s.name]) return { ok: false, reason: "name collision", a: names[s.name], b: i, name: s.name };
      c = s.deskId + "|" + s.role + "|" + s.pair + "|" + s.timeframe + "|" + s.risk;
      if (combos[c]) return { ok: false, reason: "combo collision", a: combos[c], b: i, combo: c };
      ids[s.skillId] = i;
      names[s.name] = i;
      combos[c] = i;
    }
    return {
      ok: true,
      size: COLLECTION_SIZE,
      distinctSkillIds: Object.keys(ids).length,
      distinctNames: Object.keys(names).length,
      space: SPACE
    };
  }

  var api = {
    COLLECTION_SIZE: COLLECTION_SIZE,
    DESKS: DESKS,
    ROLES: ROLES,
    TIMEFRAMES: TIMEFRAMES,
    RISKS: RISKS,
    JUP_MINT: JUP_MINT,
    CODEX_ADDR: CODEX_ADDR,
    skillFor: skillFor,
    assertUnique: assertUnique,
    SPACE: SPACE
  };

  root.BrokersSkills = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
