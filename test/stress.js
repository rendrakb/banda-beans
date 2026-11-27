const { createCanvas, registerFont } = require('canvas'); const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'); const F = (n) => path.join(root, 'assets/fonts', n);
[['Light',300,'normal'],['Regular',400,'normal'],['Italic',400,'italic'],['Bold',700,'normal'],['BoldItalic',700,'italic']].forEach(([f,w,s]) => registerFont(F(`NeueMontreal-${f}.otf`), {family:'Neue Montreal',weight:String(w),style:s}));
registerFont(F('DMMono-Light.ttf'), {family:'DM Mono',weight:'300'});
require(root+'/js/data.js'); require(root+'/js/gradient.js'); const B = require(root+'/js/render.js'); B.canvasFactory=(w,h)=>createCanvas(w,h);
const d = { name:'Washed Ethiopian Guji Hambela Reserve', roastery:'Some Very Long Roastery Name Co.', colors:['#ff5a00','#7a2cff','#00c2a8','#ffd400'],
 origins:[{pct:'50',origin:'Guji',process:'Washed Anaerobic Honey Double Ferment'},{pct:'30',origin:'Kerinci',process:'Natural'},{pct:'10',origin:'Toraja',process:'Wine'},{pct:'10',origin:'Flores',process:'Honey'}],
 notesBlack:'Dark Chocolate, Roasted Almond, Orange Peel, Brown Sugar, Black Tea, Cacao Nibs, Molasses', notesWhite:'Caramel, Hazelnut, Cream, Vanilla Bean, Toasted Marshmallow', months:['October','November','December'], lineUp:'Line Up' };
for (const f of ['card','sticker','donut']) fs.writeFileSync('/home/claude/w/stress_'+f+'.png', B.render(f,d,{dpi:150}).toBuffer('image/png'));
