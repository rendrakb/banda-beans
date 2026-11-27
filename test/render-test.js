/* Node smoke test / reference comparison:  node test/render-test.js  (needs `npm i canvas`) */
const { createCanvas, registerFont } = require('canvas');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const F = (n) => path.join(root, 'assets/fonts', n);
[['Light', 300, 'normal'], ['LightItalic', 300, 'italic'], ['Regular', 400, 'normal'], ['Italic', 400, 'italic'],
 ['Medium', 500, 'normal'], ['Bold', 700, 'normal'], ['BoldItalic', 700, 'italic']].forEach(([f, w, s]) =>
  registerFont(F(`NeueMontreal-${f}.otf`), { family: 'Neue Montreal', weight: String(w), style: s }));
registerFont(F('DMMono-Light.ttf'), { family: 'DM Mono', weight: '300' });
require(path.join(root, 'js/data.js')); require(path.join(root, 'js/gradient.js')); const B = require(path.join(root, 'js/render.js'));
B.canvasFactory = (w, h) => createCanvas(w, h);
const out = process.argv[2] || path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
for (const f of ['card', 'sticker', 'donut', 'tube']) {
  const t = Date.now(); const cv = B.render(f, B.DEFAULT_DATA, { dpi: 300 });
  fs.writeFileSync(path.join(out, f + '.png'), cv.toBuffer('image/png')); console.log(f, cv.width, cv.height, Date.now() - t, 'ms');
}
