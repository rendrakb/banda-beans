/* SvgContext: a tiny subset of CanvasRenderingContext2D that records drawing as SVG.
 * Text is converted to outlines with opentype.js (fonts embedded in fonts-data.js), so the SVG
 * opens identically in Illustrator/Inkscape without the fonts installed. */
(function (root) {
  var B = root.Beans = root.Beans || {};
  var fonts = {};

  function b64ToBuf(b64) {
    if (typeof atob === 'function') {
      var s = atob(b64), u = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
      return u.buffer;
    }
    var b = Buffer.from(b64, 'base64'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
  }
  function getFont(key) {
    if (!fonts[key]) fonts[key] = root.opentype.parse(b64ToBuf(B.FONTS[key]));
    return fonts[key];
  }
  function n(v) { return (Math.round(v * 100) / 100).toString(); }

  function SvgContext(W, H, measureCtx) {
    this.W = W; this.H = H; this.mctx = measureCtx;
    this.parts = []; this.defs = []; this.images = []; this.clips = 0; this.open = 0;
    this.m = [1, 0, 0, 1, 0, 0]; this.stack = [];
    this.fillStyle = '#000'; this.font = '10px sans-serif'; this.textBaseline = 'alphabetic'; this.textAlign = 'left';
    this.d = []; this.cur = null;
  }
  var P = SvgContext.prototype;
  P._pt = function (x, y) { var m = this.m; return n(m[0] * x + m[2] * y + m[4]) + ' ' + n(m[1] * x + m[3] * y + m[5]); };
  P.save = function () { this.stack.push({ m: this.m.slice(), fillStyle: this.fillStyle, font: this.font, open: this.open }); };
  P.restore = function () {
    var s = this.stack.pop(); if (!s) return;
    while (this.open > s.open) { this.parts.push('</g>'); this.open--; }
    this.m = s.m; this.fillStyle = s.fillStyle; this.font = s.font;
  };
  P.translate = function (x, y) { var m = this.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; };
  P.scale = function (sx, sy) { var m = this.m; m[0] *= sx; m[1] *= sx; m[2] *= sy; m[3] *= sy; };
  P.rotate = function (t) {
    var m = this.m, c = Math.cos(t), s = Math.sin(t);
    var a = m[0] * c + m[2] * s, b = m[1] * c + m[3] * s, cc = -m[0] * s + m[2] * c, d = -m[1] * s + m[3] * c;
    m[0] = a; m[1] = b; m[2] = cc; m[3] = d;
  };
  P.beginPath = function () { this.d = []; this.cur = null; };
  P.moveTo = function (x, y) { this.d.push('M' + this._pt(x, y)); this.cur = [x, y]; };
  P.lineTo = function (x, y) { this.d.push((this.cur ? 'L' : 'M') + this._pt(x, y)); this.cur = [x, y]; };
  P.bezierCurveTo = function (a, b, c, d, x, y) { this.d.push('C' + this._pt(a, b) + ' ' + this._pt(c, d) + ' ' + this._pt(x, y)); this.cur = [x, y]; };
  P.closePath = function () { this.d.push('Z'); };
  P.arc = function (cx, cy, r, a0, a1, ccw) {
    var TAU = Math.PI * 2, sweep;
    if (!ccw) { sweep = a1 - a0; if (sweep >= TAU) sweep = TAU; else while (sweep < 0) sweep += TAU; }
    else { sweep = a1 - a0; if (sweep <= -TAU) sweep = -TAU; else while (sweep > 0) sweep -= TAU; }
    var segs = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9)), step = sweep / segs;
    var k = 4 / 3 * Math.tan(step / 4), a = a0;
    this.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    for (var i = 0; i < segs; i++) {
      var b = a + step, c1 = Math.cos(a), s1 = Math.sin(a), c2 = Math.cos(b), s2 = Math.sin(b);
      this.bezierCurveTo(cx + r * (c1 - k * s1), cy + r * (s1 + k * c1), cx + r * (c2 + k * s2), cy + r * (s2 - k * c2), cx + r * c2, cy + r * s2);
      a = b;
    }
  };
  P.fill = function () { if (this.d.length) this.parts.push('<path d="' + this.d.join('') + '" fill="' + this.fillStyle + '"/>'); };
  P.fillRect = function (x, y, w, h) {
    this.beginPath(); this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); this.fill(); this.beginPath();
  };
  P.clip = function () {
    var id = 'clip' + (++this.clips);
    this.defs.push('<clipPath id="' + id + '"><path d="' + this.d.join('') + '"/></clipPath>');
    this.parts.push('<g clip-path="url(#' + id + ')">'); this.open++;
  };
  P.measureText = function (t) { this.mctx.font = this.font; return this.mctx.measureText(t); };
  P.fillText = function (text, x, y) {
    var m = /(italic|normal)\s+(\d+)\s+([\d.]+)px\s+(.*)$/.exec(this.font); if (!m || !text) return;
    var italic = m[1] === 'italic', weight = +m[2], size = +m[3];
    var key = /DM Mono/.test(m[4]) ? 'mono' : (weight >= 600 ? '700' : '400') + (italic ? 'i' : '');
    var path = getFont(key).getPath(String(text), x, y, size, { kerning: true }), self = this, d = [];
    path.commands.forEach(function (c) {
      if (c.type === 'M') d.push('M' + self._pt(c.x, c.y));
      else if (c.type === 'L') d.push('L' + self._pt(c.x, c.y));
      else if (c.type === 'C') d.push('C' + self._pt(c.x1, c.y1) + ' ' + self._pt(c.x2, c.y2) + ' ' + self._pt(c.x, c.y));
      else if (c.type === 'Q') d.push('Q' + self._pt(c.x1, c.y1) + ' ' + self._pt(c.x, c.y));
      else if (c.type === 'Z') d.push('Z');
    });
    this.parts.push('<path d="' + d.join('') + '" fill="' + this.fillStyle + '"/>');
  };
  P.drawImage = function (img, x, y, w, h) {
    var id = null, i;
    for (i = 0; i < this.images.length; i++) if (this.images[i].img === img) id = this.images[i].id;
    if (!id) {
      id = 'img' + (this.images.length + 1); this.images.push({ img: img, id: id });
      var url = img.toDataURL('image/png');
      this.defs.push('<image id="' + id + '" width="' + img.width + '" height="' + img.height + '" href="' + url + '" xlink:href="' + url + '"/>');
    }
    var m = this.m, sx = w / img.width, sy = h / img.height;
    var t = [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]].map(n).join(' ');
    this.parts.push('<use href="#' + id + '" xlink:href="#' + id + '" transform="matrix(' + t + ')"/>');
  };
  P.toString = function (cm) {
    while (this.open > 0) { this.parts.push('</g>'); this.open--; }
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
      'width="' + cm[0] + 'cm" height="' + cm[1] + 'cm" viewBox="0 0 ' + n(this.W) + ' ' + n(this.H) + '">\n<defs>\n' + this.defs.join('\n') + '\n</defs>\n' + this.parts.join('\n') + '\n</svg>\n';
  };
  B.SvgContext = SvgContext;
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.Beans;
