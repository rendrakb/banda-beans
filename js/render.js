/* Renderers for the four formats. All geometry is in "design px" = 300 dpi pixels
 * (so numbers match the Illustrator PNG exports); output is scaled to the requested dpi. */
(function (root) {
  var B = root.Beans = root.Beans || {};
  var PXCM = 300 / 2.54;
  var FAM = '"Neue Montreal", "Helvetica Neue", Arial, sans-serif';
  var MONO = '"DM Mono", ui-monospace, Menlo, Consolas, monospace';

  function ft(weight, italic, size) { return (italic ? 'italic ' : 'normal ') + weight + ' ' + size + 'px ' + FAM; }

  B.makeCanvas = function (w, h) {
    if (B.canvasFactory) return B.canvasFactory(w, h);
    var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  };

  /* ---------- format specs (measured from the reference exports) ---------- */
  B.SPECS = {
    card: {
      label: 'Card', cm: [5, 7], W: 5 * PXCM, H: 7 * PXCM, gradH: 3.5 * PXCM,
      bg: '#fff', titleFg: '#000', fg: '#000',
      title: { x: 32, size: 49.7, base: 299, lead: 60, right: 31 },
      logo: { h: 39, right: 18.5, top: 21 },
      body: { size: 25.5, lead: 30, xLeft: 31, xVal: 181, right: 31, headerBase: 478.5,
              gapHeader: 1, gapBlocks: 1, labelItalic: false, period: false, bottom: 800 }
    },
    sticker: {
      label: 'Sticker', cm: [7, 10], W: 7 * PXCM, H: 10 * PXCM, gradH: 5 * PXCM,
      bg: '#000', titleFg: '#000', fg: '#fff',
      title: { x: 65, size: 74.5, base: 405.5, lead: 101, right: 65 },
      logo: { h: 80, right: 39.5, top: 32 },
      body: { size: 30.3, lead: 35, xLeft: 82, xVal: 232, right: 65, headerBase: 686,
              gapHeader: 2, gapBlocks: 2, labelItalic: true, period: true, bottom: 1135 }
    },
    donut: {
      label: 'Donut', cm: [10, 5], W: 10 * PXCM, H: 5 * PXCM,
      R: 5 * PXCM, r: 3 * PXCM
    },
    tube: {
      label: 'Tube', cm: [21, 29.7], W: 21 * PXCM, H: 29.7 * PXCM,
      cols: 10, rows: 14, d: 2 * PXCM
    }
  };

  /* ---------- helpers ---------- */
  function measure(ctx, font, text) { ctx.font = font; return ctx.measureText(text).width; }

  function wrapTokens(ctx, tokens, maxW) {
    var lines = [], cur = [], curW = 0;
    tokens.forEach(function (tok) {
      var w = measure(ctx, tok.f, tok.t), sp = measure(ctx, tok.f, ' ');
      if (cur.length && curW + sp + w > maxW) { lines.push(cur); cur = []; curW = 0; }
      var s = cur.length ? sp : 0;
      cur.push({ t: tok.t, f: tok.f, sp: s, w: w }); curW += s + w;
    });
    if (cur.length) lines.push(cur);
    return lines;
  }
  function lineWidth(line) { return line.reduce(function (a, k) { return a + k.w + k.sp; }, 0); }
  function drawLine(ctx, line, x, y, align) {
    var cx = align === 'right' ? x - lineWidth(line) : x;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    line.forEach(function (k) { cx += k.sp; ctx.font = k.f; ctx.fillText(k.t, cx, y); cx += k.w; });
  }
  function words(str, f) {
    return String(str || '').split(/\s+/).filter(Boolean).map(function (w) { return { t: w, f: f }; });
  }
  function csvTokens(str, f, period) {
    var items = String(str || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return items.map(function (it, i) {
      var last = i === items.length - 1;
      it = it.replace(/\.$/, '');
      return { t: it + (last ? (period ? '.' : '') : ','), f: f };
    });
  }

  /* ---------- gradient field -> canvas (cached) ---------- */
  var cache = {};
  function fieldCanvas(field, colors, pw, ph, rot) {
    var key = [field, colors.join(), pw, ph, rot].join('|');
    if (cache[key]) return cache[key];
    var img = B.renderField(field, pw, ph, colors, rot);
    var off = B.makeCanvas(pw, ph), oc = off.getContext('2d');
    var id = oc.createImageData(pw, ph); id.data.set(img.data); oc.putImageData(id, 0, 0);
    var keys = Object.keys(cache); if (keys.length > 8) delete cache[keys[0]];
    return (cache[key] = off);
  }
  function drawField(ctx, field, colors, x, y, w, h, rot, sc) {
    var off = fieldCanvas(field, colors, Math.max(1, Math.round(w * sc)), Math.max(1, Math.round(h * sc)), rot || 0);
    ctx.drawImage(off, x, y, w, h);
  }

  /* ---------- logo ---------- */
  function drawLogo(ctx, rightX, top, h, color) {
    var L = B.LOGO, bb = L.bbox, s = h / (bb[3] - bb[1]);
    var w = (bb[2] - bb[0]) * s;
    ctx.save();
    ctx.translate(rightX - w - bb[0] * s, top - bb[1] * s);
    ctx.scale(s, s);
    ctx.fillStyle = color;
    L.paths.forEach(function (d) {
      var re = /([MZmzc])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g, m, cmd = null, nums = [], x = 0, y = 0;
      ctx.beginPath();
      function flush() {
        if (cmd === 'M' && nums.length >= 2) { x = nums[0]; y = nums[1]; ctx.moveTo(x, y); }
        else if (cmd === 'c') {
          for (var i = 0; i + 5 < nums.length; i += 6) {
            ctx.bezierCurveTo(x + nums[i], y + nums[i + 1], x + nums[i + 2], y + nums[i + 3], x + nums[i + 4], y + nums[i + 5]);
            x += nums[i + 4]; y += nums[i + 5];
          }
        }
        nums = [];
      }
      while ((m = re.exec(d))) {
        if (m[1]) { flush(); cmd = m[1]; if (cmd === 'Z' || cmd === 'z') ctx.closePath(); }
        else nums.push(parseFloat(m[2]));
      }
      flush();
      ctx.fill();
    });
    ctx.restore();
  }

  /* ---------- card & sticker ---------- */
  function layoutBody(ctx, S, d, k) {
    var b = S.body, size = b.size * k, lead = b.lead * k;
    var fR = ft(400, false, size), fI = ft(400, true, size), fBI = ft(700, true, size);
    var fLabel = b.labelItalic ? fI : fR;
    var ops = [], y = b.headerBase;
    var valW = S.W - b.right - b.xVal;
    var origins = (d.origins || []).filter(function (o) { return o.pct || o.origin || o.process; });
    function add(line, x, yy) { ops.push({ line: line, x: x, y: yy }); }
    function single(t, f) { return [{ t: t, f: f, sp: 0, w: measure(ctx, f, t) }]; }

    if (origins.length) {
      add(single('Origin', fBI), b.xLeft, y);
      y += lead * b.gapHeader;
      origins.forEach(function (o, i) {
        var toks = words((o.origin || '') + ' ' + (o.process || ''), fR);
        if (b.period && toks.length) toks[toks.length - 1].t = toks[toks.length - 1].t.replace(/\.$/, '') + '.';
        var lines = wrapTokens(ctx, toks, valW);
        if (o.pct) add(single(String(o.pct).replace(/\s*%?$/, '') + '%', fI), b.xLeft, y);
        lines.forEach(function (ln, j) { if (j) y += lead; add(ln, b.xVal, y); });
        if (!lines.length) { /* pct only */ }
        if (i < origins.length - 1) y += lead;
      });
      y += lead * 2;
    }
    var blocks = [['Black', d.notesBlack], ['White', d.notesWhite]].filter(function (x) { return String(x[1] || '').trim(); });
    if (blocks.length) {
      add(single('Notes', fBI), b.xLeft, y);
      y += lead * b.gapHeader;
      blocks.forEach(function (bl, i) {
        var lines = wrapTokens(ctx, csvTokens(bl[1], fR, b.period), valW);
        add(single(bl[0] + '\u2009:', fLabel), b.xLeft, y);
        lines.forEach(function (ln, j) { if (j) y += lead; add(ln, b.xVal, y); });
        if (i < blocks.length - 1) y += lead * b.gapBlocks;
      });
    }
    return { ops: ops, bottom: y };
  }

  function drawCardLike(ctx, S, d, sc) {
    var colors = d.colors;
    ctx.fillStyle = S.bg; ctx.fillRect(0, 0, S.W, S.H);
    drawField(ctx, 'card', colors, 0, 0, S.W, S.gradH, 0, sc);
    drawLogo(ctx, S.W - S.logo.right, S.logo.top, S.logo.h, '#000');
    /* title (shrinks to fit) */
    var T = S.title, maxW = S.W - T.x - T.right;
    var name = String(d.name || '').trim(), rost = String(d.roastery || '').trim();
    var f1 = ft(700, false, T.size), f2r = ft(400, false, T.size), f2b = ft(700, true, T.size);
    var w1 = name ? measure(ctx, f1, name) : 0;
    var w2 = rost ? measure(ctx, f2r, 'by ') + measure(ctx, f2b, rost) : 0;
    var k = Math.min(1, maxW / Math.max(w1, w2, 1)); if (k < 0.5) k = 0.5;
    var sz = T.size * k;
    ctx.fillStyle = S.titleFg;
    if (name) drawLine(ctx, [{ t: name, f: ft(700, false, sz), sp: 0, w: 0 }], T.x, T.base, 'left');
    if (rost) {
      var fr = ft(400, false, sz), fb = ft(700, true, sz), wby = measure(ctx, fr, 'by');
      drawLine(ctx, [{ t: 'by', f: fr, sp: 0, w: wby }, { t: rost, f: fb, sp: measure(ctx, fr, ' '), w: measure(ctx, fb, rost) }], T.x, T.base + T.lead * k, 'left');
    }
    /* body (shrinks to fit) */
    var k2 = 1, lay;
    do { lay = layoutBody(ctx, S, d, k2); k2 -= 0.04; } while (lay.bottom > S.body.bottom && k2 > 0.55);
    ctx.fillStyle = S.fg;
    lay.ops.forEach(function (o) { drawLine(ctx, o.line, o.x, o.y, 'left'); });
  }

  /* ---------- donut ---------- */
  function drawDonut(ctx, S, d, sc) {
    var cx = S.W / 2, R = S.R, r = S.r;
    ctx.fillStyle = '#d1d3d4'; ctx.fillRect(0, 0, S.W, S.H);
    /* gradient quarter ring (right) */
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, 0, R, 0, Math.PI / 2); ctx.arc(cx, 0, r, Math.PI / 2, 0, true); ctx.closePath(); ctx.clip();
    drawField(ctx, 'card', d.colors, cx, 0, R, R, 1, sc);
    ctx.restore();
    /* white quarter ring (left) */
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, 0, R, Math.PI / 2, Math.PI); ctx.arc(cx, 0, r, Math.PI, Math.PI / 2, true); ctx.closePath(); ctx.fill();
    /* logo + line-up */
    drawLogo(ctx, 1028, 33, 80, '#000');
    var months = (d.months || []).slice();
    var lines = months.concat([String(d.lineUp == null ? 'Line Up' : d.lineUp).trim()]).filter(Boolean);
    var adv = measure(ctx, '300 100px ' + MONO, 'M') / 100;
    var msz = 12.6 / adv;
    ctx.fillStyle = '#000'; ctx.font = '300 ' + msz + 'px ' + MONO; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    lines.forEach(function (t, i) { ctx.fillText(t, 1048, 60.5 + 25 * i); });
    /* title block, right aligned, bottom anchored */
    var size = 33.3, lead = 29;
    var name = String(d.name || '').trim(), rost = String(d.roastery || '').trim();
    var build = function (k) {
      var fB = ft(700, false, size * k), fR = ft(400, false, size * k), fBI = ft(700, true, size * k);
      var L = wrapTokens(ctx, words(name, fB), 190 * (k < 1 ? 1 / k : 1));
      if (rost) L = L.concat(wrapTokens(ctx, [{ t: 'by', f: fR }].concat(words(rost, fBI)), 190 * (k < 1 ? 1 / k : 1)));
      return L;
    };
    var k = 1, L = build(1);
    while (L.length > 5 && k > 0.55) { k -= 0.05; L = build(k); }
    ctx.fillStyle = '#000';
    var yb = 488.5;
    for (var i = L.length - 1; i >= 0; i--) { drawLine(ctx, L[i], 566, yb - (L.length - 1 - i) * lead * k, 'right'); }
  }

  /* ---------- tube (A4 sheet of 2 cm round gradients) ---------- */
  function drawTube(ctx, S, d, sc, opts) {
    var t = (opts && opts.tube) || {};
    var ox = (t.offsetX || 0) * PXCM / 10, oy = (t.offsetY || 0) * PXCM / 10, gap = (t.gap || 0) * PXCM / 10;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, S.W, S.H);
    var D = S.d, pd = Math.max(1, Math.round(D * sc));
    var tile = fieldCanvas('tube', d.colors, pd, pd, 0);
    for (var r = 0; r < S.rows; r++) {
      for (var c = 0; c < S.cols; c++) {
        var x = ox + c * (D + gap), y = oy + r * (D + gap);
        ctx.save(); ctx.beginPath(); ctx.arc(x + D / 2, y + D / 2, D / 2, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(tile, x, y, D, D); ctx.restore();
      }
    }
  }

  /* ---------- public API ---------- */
  B.render = function (format, data, opts) {
    opts = opts || {};
    var dpi = opts.dpi || 300, sc = dpi / 300, S = B.SPECS[format];
    var cv = B.makeCanvas(Math.round(S.W * sc), Math.round(S.H * sc));
    var ctx = cv.getContext('2d');
    ctx.scale(sc, sc);
    var d = Object.assign({}, data, { colors: (data.colors && data.colors.length === 4) ? data.colors : B.DEFAULT_COLORS });
    if (format === 'card' || format === 'sticker') drawCardLike(ctx, S, d, sc);
    else if (format === 'donut') drawDonut(ctx, S, d, sc);
    else drawTube(ctx, S, d, sc, opts);
    return cv;
  };

  /* top, right, bottom, left (as seen on the card) — Illustrator's default swatches */
  B.DEFAULT_COLORS = ['#EC008C', '#FFF200', '#00A651', '#00AEEF'];
  B.DEFAULT_DATA = {
    name: 'Lollipop Candy', roastery: 'Koeslan Roastery',
    origins: [
      { pct: '45', origin: 'Gayo', process: 'Natural Anaerobic' },
      { pct: '35', origin: 'Arjuna', process: 'Co-Ferment Guava' },
      { pct: '20', origin: 'Arjuna', process: 'Co-Ferment Blackcurrant' }
    ],
    notesBlack: 'Guava Candy, Strawberry Lolipop, Tamarind, Blackcurrant Tea',
    notesWhite: 'Strawberry Milk Tea, Butter Cookies, Chocolate Bar',
    colors: B.DEFAULT_COLORS.slice(),
    months: ['November', 'December'], lineUp: 'Line Up'
  };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.Beans;
