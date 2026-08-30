/**
 * Deterministic Crypto Brokers SVG renderer.
 * Unique per token id + traits from mandates.js. Looks like a broker agent card
 * so the site has art before 5000 PNGs are hosted. Not the 3D master render.
 */
(function (root) {
  "use strict";

  var ACCENT = {
    Ember: "#c4622d",
    Teal: "#2a9d8f",
    Magenta: "#c44569",
    Gold: "#d4a054",
    Violet: "#8b6cc1"
  };
  var SUIT = {
    Charcoal: "#2a2622",
    Navy: "#1c2a44",
    Ember: "#6b3218",
    "Paper White": "#ece4d6",
    "Ink Black": "#0c0b09"
  };
  var COAT = {
    "Ash Duster": "#4a453e",
    "Ember Trench": "#8f4620",
    "Teal Lined": "#1e4a46",
    Pinstripe: "#2c2924",
    "No Coat": null,
    "Charcoal Cape": "#161410"
  };
  var HEAD = {
    "Gold Skull": "#d4a054",
    "Chrome Skull": "#c5c8ce",
    "Matte Helm": "#3a3530",
    "Violet Slit": "#5c3d8a",
    "Ember Mask": "#c4622d",
    "Paper Visor": "#ece4d6"
  };
  var BASE = {
    Industrial: "#4a453c",
    Stone: "#6d6559",
    Grid: "#2a2620"
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function mix(id, salt, n) {
    return root.BrokersMandates.rngMod(id, salt, n);
  }

  function headShape(m, hx, hy, accent) {
    var fill = HEAD[m.head] || "#d4a054";
    var slit = m.head === "Violet Slit" ? "#b9a0e0" : accent;
    var g = [];
    g.push('<ellipse cx="' + hx + '" cy="' + hy + '" rx="48" ry="56" fill="' + fill + '" stroke="#100e0b" stroke-width="3"/>');
    if (m.head.indexOf("Skull") !== -1) {
      g.push('<ellipse cx="' + (hx - 16) + '" cy="' + (hy - 4) + '" rx="10" ry="12" fill="#100e0b"/>');
      g.push('<ellipse cx="' + (hx + 16) + '" cy="' + (hy - 4) + '" rx="10" ry="12" fill="#100e0b"/>');
      g.push('<ellipse cx="' + (hx - 16) + '" cy="' + (hy - 4) + '" rx="4" ry="5" fill="' + slit + '" opacity="0.95"/>');
      g.push('<ellipse cx="' + (hx + 16) + '" cy="' + (hy - 4) + '" rx="4" ry="5" fill="' + slit + '" opacity="0.95"/>');
      g.push('<path d="M' + (hx - 10) + ' ' + (hy + 18) + ' Q' + hx + ' ' + (hy + 28) + ' ' + (hx + 10) + ' ' + (hy + 18) + '" fill="none" stroke="#100e0b" stroke-width="3"/>');
      g.push('<rect x="' + (hx - 6) + '" y="' + (hy + 8) + '" width="12" height="8" rx="2" fill="#100e0b" opacity="0.35"/>');
    } else if (m.head === "Violet Slit") {
      g.push('<rect x="' + (hx - 28) + '" y="' + (hy - 6) + '" width="56" height="8" rx="2" fill="#100e0b"/>');
      g.push('<rect x="' + (hx - 24) + '" y="' + (hy - 4) + '" width="48" height="4" fill="' + slit + '"/>');
    } else if (m.head === "Paper Visor") {
      g.push('<rect x="' + (hx - 32) + '" y="' + (hy - 14) + '" width="64" height="22" rx="3" fill="#ece4d6" stroke="#100e0b" stroke-width="2"/>');
      g.push('<rect x="' + (hx - 26) + '" y="' + (hy - 8) + '" width="52" height="8" fill="' + accent + '" opacity="0.85"/>');
    } else {
      g.push('<rect x="' + (hx - 30) + '" y="' + (hy - 10) + '" width="60" height="16" rx="4" fill="#100e0b" opacity="0.8"/>');
      g.push('<rect x="' + (hx - 22) + '" y="' + (hy - 6) + '" width="44" height="6" fill="' + slit + '"/>');
    }
    /* helm ridge */
    g.push('<path d="M' + (hx - 40) + ' ' + (hy - 20) + ' Q' + hx + ' ' + (hy - 72) + ' ' + (hx + 40) + ' ' + (hy - 20) + '" fill="#100e0b" opacity="0.55"/>');
    return g.join("");
  }

  function hud(m, accent, id) {
    if (m.hud === "None") return "";
    var g = ['<g class="hud" fill="none" stroke="' + accent + '" stroke-width="1.4" opacity="0.88">'];
    var i, h, x, y, label;
    if (m.hud === "Charts Halo") {
      for (i = 0; i < 7; i++) {
        x = 120 + i * 58;
        y = 70;
        h = 18 + mix(id, "hudbar" + i, 42);
        g.push('<rect x="' + x + '" y="' + y + '" width="46" height="64" rx="3" fill="rgba(196,98,45,0.08)"/>');
        g.push('<rect x="' + (x + 8) + '" y="' + (y + 56 - h) + '" width="8" height="' + h + '" fill="' + accent + '" stroke="none"/>');
        g.push('<rect x="' + (x + 20) + '" y="' + (y + 48 - (h % 28)) + '" width="8" height="' + ((h % 28) + 8) + '" fill="' + accent + '" opacity="0.55" stroke="none"/>');
        g.push('<rect x="' + (x + 32) + '" y="' + (y + 52 - ((h * 3) % 36)) + '" width="8" height="' + (((h * 3) % 36) + 6) + '" fill="' + accent + '" opacity="0.35" stroke="none"/>');
      }
    } else if (m.hud === "Ticker Cubes") {
      for (i = 0; i < 6; i++) {
        x = 140 + (i % 6) * 62;
        y = 62 + (i % 2) * 12;
        g.push('<rect x="' + x + '" y="' + y + '" width="52" height="28" rx="2" fill="rgba(16,14,11,0.55)"/>');
        label = m.primaryAsset.slice(0, 4);
        g.push('<text x="' + (x + 8) + '" y="' + (y + 18) + '" fill="' + accent + '" stroke="none" font-family="IBM Plex Mono, monospace" font-size="11">' + esc(label) + "</text>");
      }
    } else {
      g.push('<ellipse cx="320" cy="108" rx="210" ry="48" />');
      for (i = 0; i < 9; i++) {
        x = 130 + i * 42;
        h = 6 + mix(id, "ob" + i, 22);
        g.push('<rect x="' + x + '" y="' + (108 - h) + '" width="16" height="' + h + '" fill="' + accent + '" stroke="none" opacity="0.8"/>');
        g.push('<rect x="' + x + '" y="110" width="16" height="' + (h * 0.7) + '" fill="' + accent + '" stroke="none" opacity="0.35"/>');
      }
    }
    g.push("</g>");
    return g.join("");
  }

  function sparks(id, accent) {
    var n = 8 + mix(id, "sparks", 10);
    var g = ['<g opacity="0.7">'];
    var i, x, y, r;
    for (i = 0; i < n; i++) {
      x = 40 + mix(id, "sx" + i, 560);
      y = 80 + mix(id, "sy" + i, 620);
      r = 1 + mix(id, "sr" + i, 3);
      g.push('<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + accent + '"/>');
    }
    g.push("</g>");
    return g.join("");
  }

  function handItem(m, accent) {
    if (m.hand === "Empty") return "";
    var g = ['<g transform="translate(402 430)">'];
    if (m.hand === "Tablet") {
      g.push('<rect x="0" y="0" width="54" height="78" rx="4" fill="#1b1712" stroke="' + accent + '" stroke-width="2"/>');
      g.push('<rect x="8" y="10" width="38" height="22" fill="' + accent + '" opacity="0.7"/>');
      g.push('<rect x="8" y="38" width="38" height="4" fill="#ece4d6" opacity="0.4"/>');
      g.push('<rect x="8" y="46" width="24" height="4" fill="#ece4d6" opacity="0.25"/>');
    } else if (m.hand === "Ledger") {
      g.push('<rect x="0" y="4" width="62" height="70" rx="2" fill="#ece4d6" stroke="#100e0b" stroke-width="2"/>');
      g.push('<rect x="8" y="14" width="46" height="3" fill="#100e0b" opacity="0.35"/>');
      g.push('<rect x="8" y="22" width="38" height="3" fill="#100e0b" opacity="0.25"/>');
      g.push('<rect x="8" y="30" width="42" height="3" fill="#100e0b" opacity="0.2"/>');
    } else {
      g.push('<ellipse cx="28" cy="36" rx="26" ry="36" fill="' + accent + '" opacity="0.18" stroke="' + accent + '"/>');
      g.push('<text x="10" y="40" fill="' + accent + '" font-family="IBM Plex Mono, monospace" font-size="10">' + esc(m.primaryAsset.slice(0, 5)) + "</text>");
    }
    g.push("</g>");
    return g.join("");
  }

  function svg(id, opts) {
    opts = opts || {};
    var m = root.BrokersMandates.mandateFor(id);
    var accent = ACCENT[m.accent] || "#c4622d";
    var suit = SUIT[m.suit] || "#2a2622";
    var coat = COAT[m.coat];
    var base = BASE[m.base] || "#4a453c";
    var w = opts.width || 640;
    var h = opts.height || 800;
    var uid = "bk" + id;
    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 800" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(m.name) + '">');
    parts.push("<defs>");
    parts.push('<radialGradient id="' + uid + 'bg" cx="50%" cy="38%" r="70%">');
    parts.push('<stop offset="0%" stop-color="#2a1c14"/>');
    parts.push('<stop offset="55%" stop-color="#16130f"/>');
    parts.push('<stop offset="100%" stop-color="#100e0b"/>');
    parts.push("</radialGradient>");
    parts.push('<radialGradient id="' + uid + 'glow" cx="50%" cy="42%" r="40%">');
    parts.push('<stop offset="0%" stop-color="' + accent + '" stop-opacity="0.28"/>');
    parts.push('<stop offset="100%" stop-color="' + accent + '" stop-opacity="0"/>');
    parts.push("</radialGradient>");
    parts.push('<filter id="' + uid + 'grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="' + (id % 97) + '"/><feColorMatrix values="0 0 0 0 0.9  0 0 0 0 0.7  0 0 0 0 0.4  0 0 0 0.05 0"/></filter>');
    parts.push("</defs>");
    parts.push('<rect width="640" height="800" fill="url(#' + uid + 'bg)"/>');
    parts.push('<rect width="640" height="800" fill="url(#' + uid + 'glow)"/>');
    parts.push('<rect width="640" height="800" filter="url(#' + uid + 'grain)" opacity="0.35"/>');
    parts.push(sparks(id, accent));
    parts.push(hud(m, accent, id));

    /* base */
    parts.push('<ellipse cx="320" cy="700" rx="150" ry="28" fill="' + base + '" stroke="#100e0b" stroke-width="3"/>');
    if (m.base === "Grid") {
      parts.push('<path d="M190 700 L450 700 M220 688 L420 688 M220 712 L420 712" stroke="#ece4d6" stroke-opacity="0.15" fill="none"/>');
    } else if (m.base === "Industrial") {
      parts.push('<rect x="250" y="688" width="140" height="8" fill="#100e0b" opacity="0.35"/>');
    }
    /* papers on base */
    var p1 = 8 + mix(id, "paper", 18);
    parts.push('<g transform="translate(210 708) rotate(-12)"><rect width="40" height="28" fill="#ece4d6" opacity="0.8"/></g>');
    parts.push('<g transform="translate(390 710) rotate(' + p1 + ')"><rect width="36" height="24" fill="#ece4d6" opacity="0.55"/></g>');

    /* legs */
    parts.push('<rect x="278" y="560" width="28" height="130" rx="4" fill="' + suit + '"/>');
    parts.push('<rect x="334" y="560" width="28" height="130" rx="4" fill="' + suit + '"/>');
    parts.push('<rect x="274" y="678" width="36" height="14" rx="3" fill="#100e0b"/>');
    parts.push('<rect x="330" y="678" width="36" height="14" rx="3" fill="#100e0b"/>');

    /* torso */
    parts.push('<path d="M250 330 L390 330 L410 560 L230 560 Z" fill="' + suit + '" stroke="#100e0b" stroke-width="2"/>');
    parts.push('<path d="M320 330 L320 560" stroke="#100e0b" stroke-width="2" opacity="0.45"/>');
    var tie = m.suit === "Paper White" ? accent : "#ece4d6";
    parts.push('<path d="M320 338 L308 360 L320 430 L332 360 Z" fill="' + tie + '" opacity="0.85"/>');
    /* waistcoat hint */
    parts.push('<path d="M268 390 L372 390" stroke="#100e0b" stroke-opacity="0.25"/>');

    /* coat */
    if (coat) {
      parts.push('<path d="M200 320 L250 330 L236 620 L170 600 Z" fill="' + coat + '" stroke="#100e0b" stroke-width="2"/>');
      parts.push('<path d="M440 320 L390 330 L404 620 L470 600 Z" fill="' + coat + '" stroke="#100e0b" stroke-width="2"/>');
      if (m.coat === "Pinstripe") {
        parts.push('<path d="M214 360 L228 580 M226 350 L240 570" stroke="#ece4d6" stroke-opacity="0.15"/>');
        parts.push('<path d="M426 360 L412 580 M414 350 L400 570" stroke="#ece4d6" stroke-opacity="0.15"/>');
      }
      if (m.coat === "Ember Trench") {
        parts.push('<path d="M176 560 Q236 640 250 600" fill="' + accent + '" opacity="0.45"/>');
        parts.push('<path d="M464 560 Q404 640 390 600" fill="' + accent + '" opacity="0.45"/>');
      }
      /* shoulder coins */
      parts.push('<circle cx="236" cy="340" r="14" fill="' + accent + '" opacity="0.7" stroke="#100e0b"/>');
      parts.push('<circle cx="404" cy="340" r="14" fill="' + accent + '" opacity="0.7" stroke="#100e0b"/>');
    }

    /* arms */
    parts.push('<path d="M250 340 L214 430 L236 438 L268 360 Z" fill="' + suit + '" stroke="#100e0b" stroke-width="2"/>');
    parts.push('<path d="M390 340 L430 430 L408 438 L372 360 Z" fill="' + suit + '" stroke="#100e0b" stroke-width="2"/>');
    parts.push(handItem(m, accent));
    /* left hand in pocket */
    parts.push('<ellipse cx="228" cy="448" rx="16" ry="12" fill="#1b1712" stroke="#100e0b"/>');

    /* neck + head */
    parts.push('<rect x="304" y="292" width="32" height="42" rx="6" fill="#1b1712"/>');
    parts.push(headShape(m, 320, 250, accent));

    /* dossier type */
    parts.push('<text x="36" y="48" fill="#d2b48c" font-family="IBM Plex Sans, sans-serif" font-size="13" letter-spacing="4">CRYPTO BROKERS</text>');
    parts.push('<text x="36" y="72" fill="#6d6559" font-family="IBM Plex Mono, monospace" font-size="10" letter-spacing="3">TOKEN ID</text>');
    parts.push('<text x="36" y="132" fill="#ece4d6" font-family="Instrument Serif, Georgia, serif" font-size="64">' + esc(String(id)) + "</text>");
    parts.push('<rect x="36" y="142" width="72" height="6" fill="' + accent + '"/>');
    parts.push('<text x="36" y="760" fill="' + accent + '" font-family="IBM Plex Mono, monospace" font-size="22" font-weight="500">BROKER #' + esc(String(id).padStart(4, "0")) + "</text>");
    parts.push('<text x="36" y="784" fill="#ece4d6" font-family="Instrument Serif, Georgia, serif" font-size="14" font-style="italic">' + esc(m.quote) + "</text>");
    parts.push('<text x="604" y="48" text-anchor="end" fill="' + accent + '" font-family="IBM Plex Mono, monospace" font-size="12" letter-spacing="2">' + esc(m.rarity.toUpperCase()) + "</text>");
    parts.push('<text x="604" y="70" text-anchor="end" fill="#988f80" font-family="IBM Plex Mono, monospace" font-size="11">' + esc(m.primaryAsset) + "</text>");
    parts.push("</svg>");
    return parts.join("");
  }

  var api = { svg: svg, ACCENT: ACCENT };
  root.BrokersRender = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
