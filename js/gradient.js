/* Gradient engine.
 * The reference gradients are "mesh" style swirls. They were decomposed into weight maps
 * (see data.js) so any 4 colours (+ white) reproduce the same swirl.
 */
(function (root) {
  var B = root.Beans = root.Beans || {};

  function hexToRgb(h) {
    h = String(h || '#000').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* Catmull-Rom weights for t in [0,1] */
  function cr(t) {
    var t2 = t * t, t3 = t2 * t;
    return [
      -0.5 * t3 + t2 - 0.5 * t,
      1.5 * t3 - 2.5 * t2 + 1,
      -1.5 * t3 + 2 * t2 + 0.5 * t,
      0.5 * t3 - 0.5 * t2
    ];
  }

  /* Build node colours (gh x gw x 3) from the weights and the 4 user colours. */
  function nodeColors(field, colors) {
    var W = B.FIELDS[field];
    var rgb = colors.map(hexToRgb).concat([[255, 255, 255]]);
    var gh = W[0].length, gw = W[0][0].length;
    var out = new Float32Array(gh * gw * 3);
    for (var y = 0; y < gh; y++) {
      for (var x = 0; x < gw; x++) {
        var s = 0, i, w = [];
        for (i = 0; i < 5; i++) { w[i] = Math.max(0, W[i][y][x]); s += w[i]; }
        if (s <= 0) s = 1;
        var o = (y * gw + x) * 3;
        for (i = 0; i < 5; i++) {
          out[o] += w[i] / s * rgb[i][0];
          out[o + 1] += w[i] / s * rgb[i][1];
          out[o + 2] += w[i] / s * rgb[i][2];
        }
      }
    }
    return { data: out, gh: gh, gw: gw };
  }

  /* Returns {width,height,data(Uint8ClampedArray RGBA)}.
   * rot = number of quarter turns clockwise applied to the whole field. */
  function renderField(field, width, height, colors, rot) {
    rot = ((rot || 0) % 4 + 4) % 4;
    var nc = nodeColors(field, colors), g = nc.data, gh = nc.gh, gw = nc.gw;
    var data = new Uint8ClampedArray(width * height * 4);
    var j, i;
    /* precompute per-column / per-row taps for source coordinates */
    function tap(f, n) {
      var i0 = Math.floor(f); if (i0 > n - 2) i0 = n - 2; if (i0 < 0) i0 = 0;
      var t = f - i0;
      var idx = [i0 - 1, i0, i0 + 1, i0 + 2].map(function (k) { return Math.max(0, Math.min(n - 1, k)); });
      return { idx: idx, w: cr(t) };
    }
    for (j = 0; j < height; j++) {
      var v = (j + 0.5) / height;
      for (i = 0; i < width; i++) {
        var u = (i + 0.5) / width, su, sv;
        if (rot === 0) { su = u; sv = v; }
        else if (rot === 1) { su = v; sv = 1 - u; }
        else if (rot === 2) { su = 1 - u; sv = 1 - v; }
        else { su = 1 - v; sv = u; }
        var tx = tap(su * (gw - 1), gw), ty = tap(sv * (gh - 1), gh);
        var r = 0, gr = 0, b = 0, a, c;
        for (a = 0; a < 4; a++) {
          for (c = 0; c < 4; c++) {
            var wgt = ty.w[a] * tx.w[c];
            var o = (ty.idx[a] * gw + tx.idx[c]) * 3;
            r += wgt * g[o]; gr += wgt * g[o + 1]; b += wgt * g[o + 2];
          }
        }
        var p = (j * width + i) * 4;
        data[p] = r; data[p + 1] = gr; data[p + 2] = b; data[p + 3] = 255;
      }
    }
    return { width: width, height: height, data: data };
  }

  B.hexToRgb = hexToRgb;
  B.renderField = renderField;
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = globalThis.Beans;
