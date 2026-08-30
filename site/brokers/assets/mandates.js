/**
 * Crypto Brokers mandates — deterministic traits + unique primaryAsset.
 *
 * Trait RNG matches collection generator generate_metadata.py:
 *   sha256("crypto-brokers-{id}-{salt}")[:16] as int, then % len(options)
 *
 * Primary asset: sha256("crypto-brokers-{id}-asset") family. A compact
 * generator builds 5000 unique symbols (no two tokens share a primary).
 * Do not invent market caps or floors; min $1M is a mandate filter only.
 */
(function (root) {
  "use strict";

  var COLLECTION_SIZE = 5000;
  var OWNER = "0xdfF1a5dc565a2D8d0C2818f8B190ca8399B869b3";
  var MIN_MCAP_USD = 1000000;
  var IRE_VAULT = "ire1jv65s3grqf6v6jl3dp4t6c9t9rk99cd8nanfuy";
  var NINJAAGENT = "0x5Ce837Cf242e763F9b0E9A87AA7907C3F5DD083C";

  var HEADS = ["Gold Skull", "Chrome Skull", "Matte Helm", "Violet Slit", "Ember Mask", "Paper Visor"];
  var COATS = ["Ash Duster", "Ember Trench", "Teal Lined", "Pinstripe", "No Coat", "Charcoal Cape"];
  var SUITS = ["Charcoal", "Navy", "Ember", "Paper White", "Ink Black"];
  var ACCENTS = ["Ember", "Teal", "Magenta", "Gold", "Violet"];
  var HUDS = ["Charts Halo", "Ticker Cubes", "Orderbook Ring", "None"];
  var HANDS = ["Tablet", "Ledger", "Hologram", "Empty"];
  var BASES = ["Industrial", "Stone", "Grid"];
  var STRATS = ["Momentum", "Mean Revert", "Top Cap Follow"];
  var UNIVERSE = ["Stocks", "Tokens", "Both"];
  var VENUES = ["Paper blotter", "Owner-signed DEX intent", "Owner-signed CEX", "Robinhood Chain quote"];
  var TIMEFRAMES = ["5m", "15m", "1h", "4h", "1d"];
  var NOTIONALS = [1000, 2500, 5000, 10000, 25000];
  var RARITY_BANDS = [
    [4500, "Common"],
    [4900, "Uncommon"],
    [4980, "Rare"],
    [4995, "Elite"],
    [5000, "Apex"]
  ];
  var QUOTES = [
    "In the ashes of uncertainty, opportunity burns brightest.",
    "I don't follow markets. I navigate chaos.",
    "Paper first. Live only when the owner signs.",
    "One primary. No shared book. No custody.",
    "The mandate is public. The key stays with you.",
    "Size under the cap. Never invent a mark.",
    "Not a license. Not a desk. An agent config.",
    "Different id, different item. That is the collection."
  ];

  /* Real tickers first so some paper blotters can hit a public quote. Fillers are unique generated codes. */
  var STOCK_SEEDS = [
    "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","BRKB","JPM","V","MA","UNH","XOM","JNJ","PG","HD",
    "COST","AVGO","ABBV","WMT","MRK","KO","PEP","CVX","BAC","CRM","AMD","ADBE","NFLX","DIS","INTC","ORCL",
    "CSCO","TMO","ABT","MCD","ACN","DHR","WFC","LIN","TXN","NEE","PM","BMY","UPS","RTX","HON","QCOM","AMGN",
    "LOW","UNP","IBM","GE","CAT","SBUX","BA","GS","BLK","AXP","SPGI","PLD","MDT","DE","LMT","SYK","ELV",
    "TJX","BKNG","GILD","ADP","MMC","C","MO","CB","SO","DUK","ZTS","CI","EQIX","PGR","BDX","SLB","USB",
    "TGT","CL","CME","PNC","SCHW","MMM","ITW","WM","SHW","NOC","FDX","APD","EOG","NSC","AON","ICE","HUM",
    "CSX","GM","F","NKE","T","VZ","CMCSA","PYPL","SQ","SHOP","UBER","ABNB","COIN","HOOD","RIVN","LCID",
    "PLTR","SNOW","CRWD","PANW","DDOG","NET","ZS","OKTA","MDB","TEAM","WDAY","NOW","S","U","RBLX","SOFI",
    "AFRM","NU","MELI","SE","BABA","JD","PDD","NIO","XPEV","LI","BIDU","TSM","ASML","SAP","SONY","TM",
    "NVO","AZN","UL","BP","SHEL","TTE","BHP","RIO","VALE","PBR","ITUB","BBD","SAN","HSBC","DB","UBS"
  ];
  var TOKEN_SEEDS = [
    "BTC","ETH","SOL","BNB","XRP","ADA","DOGE","AVAX","DOT","LINK","UNI","ATOM","NEAR","APT","SUI","SEI",
    "PEPE","WIF","BONK","ORDI","STX","TIA","INJ","FET","RNDR","ARB","OP","MATIC","POL","LTC","BCH","TRX",
    "TON","HBAR","XLM","ALGO","VET","FIL","ICP","EGLD","AAVE","MKR","SNX","CRV","LDO","RPL","ENS","GRT",
    "SAND","MANA","AXS","IMX","GALA","APE","BLUR","DYDX","GMX","PENDLE","JUP","JTO","PYTH","W","TNSR","ENA",
    "ONDO","ETHFI","EIGEN","ZK","STRK","MANTA","ALT","PIXEL","PORTAL","XAI","REZ","LISTA","IO","ZRO","G","OMNI",
    "USDC","USDT","DAI","USDE","FRAX","WETH","WBTC","STETH","WSTETH","RETH","CBETH","WEETH","RSETH","EZETH","USD1","PYUSD",
    "NINJA","AERO","MOG","POPCAT","MEW","BOME","NEIRO","TURBO","FLOKI","SHIB","BRETT","DEGEN","HYPE","TAO","KAS","RUNE"
  ];
  var SECONDARY_POOL = ["USDC","USDT","ETH","BTC","SOL","HOOD","WETH","DAI"];

  var ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var _table = null;

  function sha256pure(ascii) {
    function rr(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    var maxWord = Math.pow(2, 32);
    var i, j;
    var result = "";
    var words = [];
    var asciiBitLength = ascii.length * 8;
    var hash = sha256pure.h;
    var k = sha256pure.k;
    if (!hash) {
      hash = sha256pure.h = [];
      k = sha256pure.k = [];
      var isComposite = {};
      var primeCounter = 0;
      for (var candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
          for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
          hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
          k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
        }
      }
    }
    ascii += "\x80";
    while (ascii.length % 64 !== 56) ascii += "\x00";
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for (j = 0; j < words.length; ) {
      var w = words.slice(j, (j += 16));
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
              w[i - 16]
              + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))
            ) | 0);
        var temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
        hash.pop();
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? "0" : "") + b.toString(16);
      }
    }
    return result;
  }

  function sha256hex(str) {
    if (typeof require === "function") {
      try {
        return require("crypto").createHash("sha256").update(str, "utf8").digest("hex");
      } catch (e) { /* browser or restricted */ }
    }
    return sha256pure(str);
  }

  function rngMod(tokenId, salt, n) {
    var h = sha256hex("crypto-brokers-" + tokenId + "-" + salt);
    return Number(BigInt("0x" + h.slice(0, 16)) % BigInt(n));
  }

  function rng(tokenId, salt) {
    return rngMod(tokenId, salt, 0x100000000);
  }

  function pick(tokenId, salt, options) {
    return options[rngMod(tokenId, salt, options.length)];
  }

  function rarity(tokenId) {
    var rank = rngMod(tokenId, "rarity", COLLECTION_SIZE) + 1;
    for (var i = 0; i < RARITY_BANDS.length; i++) {
      if (rank <= RARITY_BANDS[i][0]) return RARITY_BANDS[i][1];
    }
    return "Apex";
  }

  function encodeBase26(n, width) {
    var s = "";
    for (var i = 0; i < width; i++) {
      s = ALPHA[n % 26] + s;
      n = Math.floor(n / 26);
    }
    return s;
  }

  function uniquePool(seeds, width, count, seen) {
    var out = [];
    seen = seen || {};
    var i, s, n;
    for (i = 0; i < seeds.length; i++) {
      s = String(seeds[i]).toUpperCase();
      if (!seen[s]) {
        seen[s] = 1;
        out.push(s);
      }
    }
    n = 0;
    while (out.length < count) {
      s = encodeBase26(n++, width);
      if (!seen[s]) {
        seen[s] = 1;
        out.push(s);
      }
    }
    return out.slice(0, count);
  }

  function shuffle(arr, salt) {
    var i, j, t;
    for (i = arr.length - 1; i > 0; i--) {
      j = rngMod(i + 1, salt, i + 1);
      t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function buildTable() {
    var i, uni, side, id;
    var stockIds = [];
    var tokenIds = [];
    for (i = 1; i <= COLLECTION_SIZE; i++) {
      uni = pick(i, "uni", UNIVERSE);
      if (uni === "Stocks") stockIds.push(i);
      else if (uni === "Tokens") tokenIds.push(i);
      else {
        side = rngMod(i, "asset", 2);
        if (side === 0) stockIds.push(i);
        else tokenIds.push(i);
      }
    }
    var reserved = {};
    var i;
    for (i = 0; i < TOKEN_SEEDS.length; i++) reserved[TOKEN_SEEDS[i].toUpperCase()] = 1;
    var stocks = uniquePool(STOCK_SEEDS, 4, stockIds.length, reserved);
    var taken = {};
    for (i = 0; i < stocks.length; i++) taken[stocks[i]] = 1;
    var tokens = uniquePool(TOKEN_SEEDS, 3, tokenIds.length, taken);
    stocks = shuffle(stocks, "asset");
    tokens = shuffle(tokens, "asset");
    var table = new Array(COLLECTION_SIZE + 1);
    for (i = 0; i < stockIds.length; i++) {
      id = stockIds[i];
      table[id] = { symbol: stocks[i], kind: "stock", venueClass: "Stocks" };
    }
    for (i = 0; i < tokenIds.length; i++) {
      id = tokenIds[i];
      table[id] = { symbol: tokens[i], kind: "token", venueClass: "Tokens" };
    }
    return table;
  }

  function table() {
    if (!_table) _table = buildTable();
    return _table;
  }

  function primaryAssetFor(tokenId) {
    var row = table()[tokenId];
    if (!row) throw new Error("token id out of range");
    return row;
  }

  function assertUnique() {
    var t = table();
    var seen = {};
    var i, s;
    for (i = 1; i <= COLLECTION_SIZE; i++) {
      s = t[i].symbol;
      if (seen[s]) return { ok: false, collision: s, a: seen[s], b: i };
      seen[s] = i;
    }
    return { ok: true, size: COLLECTION_SIZE };
  }

  function traitsFor(tokenId) {
    if (tokenId < 1 || tokenId > COLLECTION_SIZE) throw new Error("token id out of range");
    return {
      head: pick(tokenId, "head", HEADS),
      coat: pick(tokenId, "coat", COATS),
      suit: pick(tokenId, "suit", SUITS),
      accent: pick(tokenId, "accent", ACCENTS),
      hud: pick(tokenId, "hud", HUDS),
      hand: pick(tokenId, "hand", HANDS),
      base: pick(tokenId, "base", BASES),
      rarity: rarity(tokenId),
      strategy: pick(tokenId, "strat", STRATS),
      universe: pick(tokenId, "uni", UNIVERSE)
    };
  }

  function mandateFor(tokenId) {
    var traits = traitsFor(tokenId);
    var asset = primaryAssetFor(tokenId);
    var secondary = pick(tokenId, "sec", SECONDARY_POOL);
    if (secondary === asset.symbol) {
      secondary = SECONDARY_POOL[(rngMod(tokenId, "sec", SECONDARY_POOL.length) + 1) % SECONDARY_POOL.length];
    }
    var padded = String(tokenId).padStart(4, "0");
    var m = {
      id: tokenId,
      name: "Crypto Broker #" + tokenId,
      inscription: "broker-" + padded,
      owner: OWNER,
      ireVault: IRE_VAULT,
      ninjaagent: NINJAAGENT,
      minMcapUsd: MIN_MCAP_USD,
      head: traits.head,
      coat: traits.coat,
      suit: traits.suit,
      accent: traits.accent,
      hud: traits.hud,
      hand: traits.hand,
      base: traits.base,
      rarity: traits.rarity,
      strategy: traits.strategy,
      universe: traits.universe,
      venue: pick(tokenId, "venue", VENUES),
      primaryAsset: asset.symbol,
      primaryKind: asset.kind,
      secondary: secondary,
      timeframe: pick(tokenId, "tf", TIMEFRAMES),
      maxNotionalUsd: pick(tokenId, "notional", NOTIONALS),
      quote: pick(tokenId, "quote", QUOTES),
      mode: "Paper"
    };
    var live = (root.BROKER_LIVE_AGENTS || {})[String(tokenId)];
    if (live) {
      m.strategy = live.strategy;
      m.venue = live.venue;
      m.primaryAsset = live.primaryAsset;
      m.primaryKind = live.universe === "Stocks" ? "stock" : "token";
      m.secondary = live.secondaryAsset;
      m.universe = live.universe;
      m.timeframe = live.timeframe;
      m.maxNotionalUsd = live.maxNotionalUsd;
      m.mode = "Paper until owner activates";
    }
    return m;
  }

  var api = {
    COLLECTION_SIZE: COLLECTION_SIZE,
    OWNER: OWNER,
    MIN_MCAP_USD: MIN_MCAP_USD,
    IRE_VAULT: IRE_VAULT,
    NINJAAGENT: NINJAAGENT,
    HEADS: HEADS,
    COATS: COATS,
    SUITS: SUITS,
    ACCENTS: ACCENTS,
    HUDS: HUDS,
    HANDS: HANDS,
    BASES: BASES,
    STRATS: STRATS,
    UNIVERSE: UNIVERSE,
    sha256hex: sha256hex,
    rng: rng,
    rngMod: rngMod,
    pick: pick,
    rarity: rarity,
    traitsFor: traitsFor,
    primaryAssetFor: primaryAssetFor,
    mandateFor: mandateFor,
    assertUnique: assertUnique
  };

  root.BrokersMandates = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
