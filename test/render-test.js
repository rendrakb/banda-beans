/* Node check:  node test/render-test.js [outDir] [example]   (needs `npm i`) */
const { createCanvas, registerFont } = require('canvas');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const F = (n) => path.join(root, 'assets/fonts', n);
[['Light', 300, 'normal'], ['Regular', 400, 'normal'], ['Italic', 400, 'italic'], ['Bold', 700, 'normal'], ['BoldItalic', 700, 'italic']].forEach(([f, w, s]) =>
  registerFont(F(`NeueMontreal-${f}.otf`), { family: 'Neue Montreal', weight: String(w), style: s }));
registerFont(F('DMMono-Light.ttf'), { family: 'DM Mono', weight: '300' });
globalThis.opentype = require('opentype.js');
['data', 'fonts-data', 'gradient', 'svg', 'render'].forEach((f) => require(path.join(root, 'js', f + '.js')));
const B = globalThis.Beans; B.canvasFactory = (w, h) => createCanvas(w, h);
const out = process.argv[2] || path.join(__dirname, 'out'); fs.mkdirSync(out, { recursive: true });
const data = B.EXAMPLES[process.argv[3] || 'abdul'];
for (const f of ['card', 'sticker', 'donut', 'tube']) {
  let t = Date.now(); const cv = B.render(f, data, { dpi: 300 });
  fs.writeFileSync(path.join(out, f + '.png'), cv.toBuffer('image/png')); const t1 = Date.now() - t; t = Date.now();
  const svg = B.renderSvg(f, data, { dpi: 300 }); fs.writeFileSync(path.join(out, f + '.svg'), svg);
  console.log(f, cv.width, cv.height, 'png', t1, 'ms; svg', Math.round(svg.length / 1024), 'KB', Date.now() - t, 'ms');
}
