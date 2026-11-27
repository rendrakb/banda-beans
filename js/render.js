/* Renderers for the four formats. All geometry is in "design px" = 300 dpi pixels
 * (so numbers match the Illustrator PNG exports). The same drawing code targets either a
 * canvas 2D context (PNG) or Beans.SvgContext (SVG). */
(function (root) {
  var B = root.Beans = root.Beans || {};
  var PXCM = 300 / 2.54;
  var FAM = '"Neue Montreal", "Helvetica Neue", Arial, sans-serif';
  var MONO = '"DM Mono", ui-monospace, Menlo, Consolas, monospace';
  var DEG = Math.PI / 180;

  function ft(weight, italic, size) { return (italic ? 'italic ' : 'normal ') + weight + ' ' + size + 'px ' + FAM; }

  B.makeCanvas = function (w, h) {
    if (B.canvasFactory) return B.canvasFactory(w, h);
    var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  };

  /* ---------- format specs (measured from the reference exports) ---------- */
  B.SPECS = {
    card: {
      label: 'Card', cm: [5, 7], W: 5 * PXCM, H: 7 * PXCM, gradH: 3.5 * PXCM, bg: '#fff', bodyFg: '#000',
      title: { x: 32, size: 49.7, lastBase: 359, lead: 60, right: 31, nameFrac: 0.65 },
      logo: { h: 39, right: 18.5, top: 21 },
      layouts: {
        'new': { size: 21, lead: 25, xLeft: 31, xVal: 181, right: 31, headerBase: 478.7, gapHeader: 1, gapBlocks: 1,
                 labelItalic: true, colon: false, periodNotes: true, periodOrigin: false, bottom: 805, valMax: 260 },
        classic: { size: 25.5, lead: 30, xLeft: 31, xVal: 181, right: 31, headerBase: 478.5, gapHeader: 1, gapBlocks: 1,
                   labelItalic: false, colon: true, periodNotes: false, periodOrigin: false, bottom: 800 }
      }
    },
    sticker: {
      label: 'Sticker', cm: [7, 10], W: 7 * PXCM, H: 10 * PXCM, gradH: 5 * PXCM, bg: '#000', bodyFg: '#fff',
      title: { x: 65, size: 74.5, lastBase: 506.5, lead: 101, right: 65, nameFrac: 0.65 },
      logo: { h: 80, right: 39.5, top: 32 },
      layouts: {
        'new': { size: 30.3, lead: 35, xLeft: 82, xVal: 232, right: 65, headerBase: 686, gapHeader: 1, gapBlocks: 1,
                 labelItalic: true, colon: false, periodNotes: true, periodOrigin: false, bottom: 1135, valMax: 360 },
        classic: { size: 30.3, lead: 35, xLeft: 82, xVal: 232, right: 65, headerBase: 686, gapHeader: 2, gapBlocks: 2,
                   labelItalic: true, colon: true, periodNotes: true, periodOrigin: true, bottom: 1135 }
      }
    },
    donut: { label: 'Donut', cm: [10, 5], W: 10 * PXCM, H: 5 * PXCM, R: 5 * PXCM, r: 3 * PXCM },
    tube: { label: 'Tube', cm: [21, 29.7], W: 21 * PXCM, H: 29.7 * PXCM, cols: 10, rows: 14, d: 2 * PXCM }
  };

  /* ---------- text helpers ---------- */
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
  /* text following a circle around (cx,cy): tops of the letters face the centre, reading
   * direction = decreasing canvas angle (down the left side, then left→right along the bottom) */
  function arcLine(ctx, line, cx, cy, rho, alphaDeg) {
    var a0 = alphaDeg * DEG, s = 0;
    line.forEach(function (tok) {
      s += tok.sp;
      for (var i = 0; i < tok.t.length; i++) {
        var pre = measure(ctx, tok.f, tok.t.slice(0, i)), post = measure(ctx, tok.f, tok.t.slice(0, i + 1));
        var adv = post - pre, a = a0 - (s + pre + adv / 2) / rho;
        ctx.save();
        ctx.translate(cx + rho * Math.cos(a), cy + rho * Math.sin(a)); ctx.rotate(a - Math.PI / 2);
        ctx.font = tok.f; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
        ctx.fillText(tok.t[i], -adv / 2, 0);
        ctx.restore();
      }
      s += tok.w;
    });
  }
  function single(ctx, t, f) { return [{ t: t, f: f, sp: 0, w: measure(ctx, f, t) }]; }
  function words(str, f) { return String(str || '').split(/\s+/).filter(Boolean).map(function (w) { return { t: w, f: f }; }); }
  function csvTokens(str, f, period) {
    var items = String(str || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return items.map(function (it, i) {
      var last = i === items.length - 1; it = it.replace(/\.$/, '');
      return { t: it + (last ? (period ? '.' : '') : ','), f: f };
    });
  }
  /* wraps comma-separated notes; each newline in the input forces a line break */
  function noteLines(ctx, str, f, period, maxW) {
    var segs = String(str || '').split(/\r?\n/).filter(function (s) { return s.trim(); }), out = [];
    segs.forEach(function (seg, i) { out = out.concat(wrapTokens(ctx, csvTokens(seg, f, period && i === segs.length - 1), maxW)); });
    return out;
  }
  /* origin text: everything before the first comma is the area (italic), the rest regular */
  function originTokens(o, fR, fI, period) {
    var s = String(o.origin || '').trim(), proc = String(o.process || '').trim(), toks = [];
    var i = s.indexOf(',');
    if (i > -1) { toks = words(s.slice(0, i + 1), fI).concat(words(s.slice(i + 1) + ' ' + proc, fR)); }
    else toks = words(s + ' ' + proc, fR);
    if (period && toks.length) toks[toks.length - 1].t = toks[toks.length - 1].t.replace(/\.$/, '') + '.';
    return toks;
  }
  function originRows(d) { return (d.origins || []).filter(function (o) { return o.pct || o.origin || o.process; }); }

  /* ---------- colours / gradient style ---------- */
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function mixHex(list) {
    var rgb = list.map(B.hexToRgb), s = [0, 0, 0];
    rgb.forEach(function (c) { s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; });
    return '#' + s.map(function (v) { return ('0' + Math.round(v / rgb.length).toString(16)).slice(-2); }).join('');
  }
  function gradientInfo(d) {
    var cols = d.colors, full = d.gradient === 'full';
    var fill = !full ? '#ffffff' : (d.fillAuto !== false ? mixHex(uniq(cols.map(function (c) { return c.toLowerCase(); }))) : (d.fill || '#999999'));
    var probe = full ? cols.concat([fill]) : cols.concat(['#ffffff', '#ffffff']);
    var rgb = B.hexToRgb(mixHex(probe)), Y = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
    var fg = d.textColor === 'black' ? '#000' : d.textColor === 'white' ? '#fff' : (Y > 0.55 ? '#000' : '#fff');
    return { full: full, colors5: cols.concat([fill]), fill: fill, fg: fg };
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
    var L = B.LOGO, bb = L.bbox, s = h / (bb[3] - bb[1]), w = (bb[2] - bb[0]) * s;
    ctx.save();
    ctx.translate(rightX - w - bb[0] * s, top - bb[1] * s); ctx.scale(s, s); ctx.fillStyle = color;
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
        if (m[1]) { flush(); cmd = m[1]; if (cmd === 'Z' || cmd === 'z') ctx.closePath(); } else nums.push(parseFloat(m[2]));
      }
      flush(); ctx.fill();
    });
    ctx.restore();
  }

  /* ---------- card & sticker body ---------- */
  function layoutBody(ctx, S, L, d, k) {
    var size = L.size * k, lead = L.lead * k;
    var fR = ft(400, false, size), fI = ft(400, true, size), fBI = ft(700, true, size);
    var fLabel = L.labelItalic ? fI : fR;
    var fullW = S.W - L.right - L.xLeft, valW = Math.min(S.W - L.right - L.xVal, L.valMax || 1e9);
    var ops = [], y = L.headerBase, first = true;
    function add(line, x, yy) { ops.push({ line: line, x: x, y: yy }); }
    function header(t) { if (!first) y += lead * 2; first = false; add(single(ctx, t, fBI), L.xLeft, y); y += lead * L.gapHeader; }

    var rows = originRows(d), hasPct = rows.some(function (o) { return o.pct; });
    if (rows.length) {
      header('Origin');
      rows.forEach(function (o, i) {
        if (i) y += lead;
        var xt = hasPct ? L.xVal : L.xLeft, lines = wrapTokens(ctx, originTokens(o, fR, fI, L.periodOrigin), hasPct ? valW : fullW);
        if (o.pct) add(single(ctx, String(o.pct).replace(/\s*%?$/, '') + '%', fI), L.xLeft, y);
        lines.forEach(function (ln, j) { if (j) y += lead; add(ln, xt, y); });
      });
    }
    if (String(d.process || '').trim()) {
      header('Process');
      wrapTokens(ctx, words(d.process, fR), fullW).forEach(function (ln, j) { if (j) y += lead; add(ln, L.xLeft, y); });
    }
    var blocks = [['Black', d.notesBlack], ['White', d.notesWhite]].filter(function (x) { return String(x[1] || '').trim(); });
    if (blocks.length) {
      header('Notes');
      blocks.forEach(function (bl, i) {
        if (i) y += lead * L.gapBlocks;
        add(single(ctx, bl[0] + (L.colon ? ' :' : ''), fLabel), L.xLeft, y);
        noteLines(ctx, bl[1], fR, L.periodNotes, valW).forEach(function (ln, j) { if (j) y += lead; add(ln, L.xVal, y); });
      });
    }
    return { ops: ops, bottom: y };
  }

  function drawCardLike(ctx, S, d, sc, g) {
    var L = S.layouts[d.layout === 'classic' ? 'classic' : 'new'];
    ctx.fillStyle = S.bg; ctx.fillRect(0, 0, S.W, S.H);
    drawField(ctx, g.full ? 'full' : 'card', g.colors5, 0, 0, S.W, S.gradH, 0, sc);
    drawLogo(ctx, S.W - S.logo.right, S.logo.top, S.logo.h, g.fg);
    /* title: bottom anchored, name wraps, shrinks to fit */
    var T = S.title, maxW = S.W - T.x - T.right, maxName = S.W * T.nameFrac;
    var name = String(d.name || '').trim(), rost = String(d.roastery || '').trim();
    function build(k) {
      var fs = T.size * k, fB = ft(700, false, fs), fR = ft(400, false, fs), fBI = ft(700, true, fs), lines = [];
      name.split(/\r?\n/).forEach(function (seg) { lines = lines.concat(wrapTokens(ctx, words(seg, fB), maxName)); });
      if (rost) lines = lines.concat(wrapTokens(ctx, [{ t: 'by', f: fR }].concat(words(rost, fBI)), maxW));
      return lines;
    }
    var k = 1, lines = build(1), widest = 0;
    lines.forEach(function (l) { widest = Math.max(widest, lineWidth(l)); });
    if (widest > maxW) { k = Math.max(0.5, maxW / widest); lines = build(k); }
    while (k > 0.5 && T.lastBase - (lines.length - 1) * T.lead * k - 0.72 * T.size * k < 80) { k -= 0.05; lines = build(k); }
    ctx.fillStyle = g.fg;
    lines.forEach(function (ln, i) { drawLine(ctx, ln, T.x, T.lastBase - (lines.length - 1 - i) * T.lead * k, 'left'); });
    /* body */
    var k2 = 1, lay;
    do { lay = layoutBody(ctx, S, L, d, k2); k2 -= 0.04; } while (lay.bottom > L.bottom && k2 > 0.55);
    ctx.fillStyle = S.bodyFg;
    lay.ops.forEach(function (o) { drawLine(ctx, o.line, o.x, o.y, 'left'); });
  }

  /* ---------- donut ---------- */
  function arcItems(ctx, items, cx, rho0, alpha0, k, fg, pitch) {
    items.forEach(function (it, i) { if (!it) return; ctx.fillStyle = fg; arcLine(ctx, it, cx, 0, rho0 + pitch * k * i, alpha0); });
  }
  function drawDonut(ctx, S, d, sc, g) {
    var cx = S.W / 2, R = S.R, r = S.r;
    ctx.fillStyle = '#d1d3d4'; ctx.fillRect(0, 0, S.W, S.H);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, 0, R, 0, Math.PI / 2); ctx.arc(cx, 0, r, Math.PI / 2, 0, true); ctx.closePath(); ctx.clip();
    drawField(ctx, g.full ? 'full' : 'card', g.colors5, cx, 0, R, R, g.full ? 0 : 1, sc);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, 0, R, Math.PI / 2, Math.PI); ctx.arc(cx, 0, r, Math.PI, Math.PI / 2, true); ctx.closePath(); ctx.fill();
    /* logo + line-up */
    drawLogo(ctx, 1028, 33, 80, g.fg);
    var lines = (d.months || []).concat([String(d.lineUp == null ? 'Line Up' : d.lineUp).trim()]).filter(Boolean);
    var msz = 12.6 / (measure(ctx, 'normal 300 100px ' + MONO, 'M') / 100);
    ctx.fillStyle = g.fg; ctx.font = 'normal 300 ' + msz + 'px ' + MONO; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    lines.forEach(function (t, i) { ctx.fillText(t, 1048, 60.5 + 25 * i); });

    /* origin + process: left half, following the curve */
    var SZ = 22, PITCH = 23.5;
    function leftItems(k) {
      var fB = ft(700, false, SZ * k), fR = ft(400, false, SZ * k), fI = ft(400, true, SZ * k), items = [];
      var rows = originRows(d);
      if (rows.length) {
        items.push(single(ctx, 'Origin', fB));
        rows.forEach(function (o) {
          var toks = originTokens(o, fR, fI, false);
          if (o.pct) toks.unshift({ t: String(o.pct).replace(/\s*%?$/, '') + '%', f: fI });
          wrapTokens(ctx, toks, 170).forEach(function (l) { items.push(l); });
        });
      }
      if (String(d.process || '').trim()) {
        if (items.length) items.push(null);
        items.push(single(ctx, 'Process', fB));
        wrapTokens(ctx, words(d.process, fI), 170).forEach(function (l) { items.push(l); });
      }
      return items;
    }
    function rightItems(k) {
      var fB = ft(700, false, SZ * k), fR = ft(400, false, SZ * k), items = [];
      [['Black Notes', d.notesBlack], ['White Notes', d.notesWhite]].forEach(function (b) {
        if (!String(b[1] || '').trim()) return;
        if (items.length) items.push(null);
        items.push(single(ctx, b[0], fB));
        noteLines(ctx, b[1], fR, false, 215).forEach(function (l) { var t = l[l.length - 1]; t.t = t.t.replace(/,$/, ''); t.w = measure(ctx, t.f, t.t); items.push(l); });
      });
      return items;
    }
    function fit(fn, rho0) {
      var k = 1, it = fn(1);
      while (rho0 + PITCH * k * (it.length - 1) > 575 && k > 0.6) { k -= 0.05; it = fn(k); }
      return { it: it, k: k };
    }
    var Lf = fit(leftItems, 388), Rf = fit(rightItems, 406);
    arcItems(ctx, Lf.it, cx, 388, 177, Lf.k, '#000', PITCH);
    arcItems(ctx, Rf.it, cx, 406, 87.5, Rf.k, g.fg, PITCH);

    /* title block, right aligned, bottom anchored */
    var size = 33.3, lead = 29, name = String(d.name || '').trim(), rost = String(d.roastery || '').trim();
    function build(k) {
      var fB = ft(700, false, size * k), fR = ft(400, false, size * k), fBI = ft(700, true, size * k), L = [];
      name.split(/\r?\n/).forEach(function (seg) { L = L.concat(wrapTokens(ctx, words(seg, fB), 190)); });
      if (rost) L = L.concat(wrapTokens(ctx, [{ t: 'by', f: fR }].concat(words(rost, fBI)), 190));
      return L;
    }
    var k = 1, L = build(1);
    while (L.length > 5 && k > 0.55) { k -= 0.05; L = build(k); }
    ctx.fillStyle = '#000';
    for (var i = L.length - 1; i >= 0; i--) drawLine(ctx, L[i], 566, 488.5 - (L.length - 1 - i) * lead * k, 'right');
  }

  /* ---------- tube (A4 sheet of 2 cm round gradients) ---------- */
  function drawTube(ctx, S, d, sc, opts, g) {
    var t = (opts && opts.tube) || {};
    var ox = (t.offsetX || 0) * PXCM / 10, oy = (t.offsetY || 0) * PXCM / 10, gap = (t.gap || 0) * PXCM / 10;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, S.W, S.H);
    var D = S.d, pd = Math.max(1, Math.round(D * sc));
    var tile = fieldCanvas('tube', g.colors5, pd, pd, 0);
    for (var r = 0; r < S.rows; r++) {
      for (var c = 0; c < S.cols; c++) {
        var x = ox + c * (D + gap), y = oy + r * (D + gap);
        ctx.save(); ctx.beginPath(); ctx.arc(x + D / 2, y + D / 2, D / 2, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(tile, x, y, D, D); ctx.restore();
      }
    }
  }

  /* ---------- public API ---------- */
  function prep(data) {
    var d = Object.assign({}, data);
    if (!d.colors || d.colors.length !== 4) d.colors = B.DEFAULT_COLORS.slice();
    return d;
  }
  B.draw = function (format, ctx, data, sc, opts) {
    var S = B.SPECS[format], d = prep(data), g = gradientInfo(d);
    if (format === 'card' || format === 'sticker') drawCardLike(ctx, S, d, sc, g);
    else if (format === 'donut') drawDonut(ctx, S, d, sc, g);
    else drawTube(ctx, S, d, sc, opts, g);
  };
  B.render = function (format, data, opts) {
    opts = opts || {};
    var sc = (opts.dpi || 300) / 300, S = B.SPECS[format];
    var cv = B.makeCanvas(Math.round(S.W * sc), Math.round(S.H * sc)), ctx = cv.getContext('2d');
    ctx.scale(sc, sc);
    B.draw(format, ctx, data, sc, opts);
    return cv;
  };
  B.renderSvg = function (format, data, opts) {
    opts = opts || {};
    var S = B.SPECS[format], mctx = B.makeCanvas(2, 2).getContext('2d');
    var sx = new B.SvgContext(S.W, S.H, mctx);
    B.draw(format, sx, data, (opts.dpi || 300) / 300, opts);
    return sx.toString(S.cm);
  };

  B.DEFAULT_COLORS = ['#EC008C', '#FFF200', '#00A651', '#00AEEF'];
  B.EXAMPLES = {
    abdul: {
      name: 'Abdul Aziz Thohari', roastery: 'axy.',
      origins: [{ pct: '', origin: 'Bengkolan Dua, Kerinci', process: '' }], process: 'Lactic Natural',
      notesBlack: 'Red Plum, Mix Berries, Chocolate Milk', notesWhite: 'Berry & Cream',
      colors: ['#7f3f98', '#c01e2e', '#c01e2e', '#c01e2e'], gradient: 'full', fillAuto: false, fill: '#9f1f63', textColor: 'auto',
      layout: 'new', months: ['November', 'December'], lineUp: 'Line Up'
    },
    lollipop: {
      name: 'Lollipop Candy', roastery: 'Koeslan Roastery',
      origins: [{ pct: '45', origin: 'Gayo', process: 'Natural Anaerobic' }, { pct: '35', origin: 'Arjuna', process: 'Co-Ferment Guava' },
                { pct: '20', origin: 'Arjuna', process: 'Co-Ferment Blackcurrant' }], process: '',
      notesBlack: 'Guava Candy, Strawberry Lolipop, Tamarind, Blackcurrant Tea', notesWhite: 'Strawberry Milk Tea, Butter Cookies, Chocolate Bar',
      colors: B.DEFAULT_COLORS.slice(), gradient: 'light', fillAuto: true, fill: '#ffffff', textColor: 'auto',
      layout: 'classic', months: ['November', 'December'], lineUp: 'Line Up'
    }
  };
  B.DEFAULT_DATA = B.EXAMPLES.abdul;
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.Beans;
