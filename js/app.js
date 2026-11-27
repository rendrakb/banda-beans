(function () {
  var B = window.Beans;
  var $ = function (id) { return document.getElementById(id); };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var FORMATS = ['card', 'sticker', 'donut', 'tube'];
  var LS_LIB = 'beans.library.v1', LS_DRAFT = 'beans.draft.v1';
  var PREVIEW_DPI = { card: 150, sticker: 150, donut: 150, tube: 45 };

  var D = load(LS_DRAFT) || clone(B.DEFAULT_DATA);
  var currentId = null;
  var fontsReady = false;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  function slug(s) { return String(s || 'bean').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'bean'; }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200); }

  /* ---------------- form <-> data ---------------- */
  function renderOrigins() {
    var host = $('origins'); host.innerHTML = '';
    D.origins.forEach(function (o, i) {
      var row = document.createElement('div'); row.className = 'origin-row';
      row.innerHTML = '<input type="text" inputmode="numeric" placeholder="%" aria-label="Percent">' +
        '<input type="text" placeholder="Origin (Gayo)" aria-label="Origin">' +
        '<input type="text" placeholder="Process (Natural Anaerobic)" aria-label="Process">' +
        '<button type="button" class="x" title="Remove" aria-label="Remove origin">×</button>';
      var ins = row.querySelectorAll('input');
      ins[0].value = o.pct || ''; ins[1].value = o.origin || ''; ins[2].value = o.process || '';
      ins[0].oninput = function () { o.pct = ins[0].value; changed(); };
      ins[1].oninput = function () { o.origin = ins[1].value; changed(); };
      ins[2].oninput = function () { o.process = ins[2].value; changed(); };
      row.querySelector('.x').onclick = function () { D.origins.splice(i, 1); renderOrigins(); changed(); };
      host.appendChild(row);
    });
  }
  function renderMonths() {
    var host = $('months'); host.innerHTML = '';
    MONTHS.forEach(function (m) {
      var l = document.createElement('label');
      l.innerHTML = '<input type="checkbox"><span>' + m.slice(0, 3) + '</span>';
      var cb = l.querySelector('input'); cb.checked = D.months.indexOf(m) > -1;
      cb.onchange = function () {
        D.months = MONTHS.filter(function (x) { return x === m ? cb.checked : D.months.indexOf(x) > -1; });
        changed();
      };
      host.appendChild(l);
    });
  }
  function fillForm() {
    $('name').value = D.name || ''; $('roastery').value = D.roastery || '';
    $('notesBlack').value = D.notesBlack || ''; $('notesWhite').value = D.notesWhite || '';
    D.colors = (D.colors && D.colors.length === 4) ? D.colors : B.DEFAULT_COLORS.slice();
    for (var i = 0; i < 4; i++) $('c' + i).value = D.colors[i].toLowerCase();
    $('lineUp').value = D.lineUp == null ? 'Line Up' : D.lineUp;
    renderOrigins(); renderMonths();
  }
  function wire() {
    [['name', 'name'], ['roastery', 'roastery'], ['notesBlack', 'notesBlack'], ['notesWhite', 'notesWhite'], ['lineUp', 'lineUp']].forEach(function (p) {
      $(p[0]).addEventListener('input', function () { D[p[1]] = $(p[0]).value; changed(); });
    });
    for (var i = 0; i < 4; i++) (function (i) { $('c' + i).addEventListener('input', function () { D.colors[i] = $('c' + i).value; changed(); }); })(i);
    $('resetColors').onclick = function () { D.colors = B.DEFAULT_COLORS.slice(); fillForm(); changed(); };
    $('addOrigin').onclick = function () { D.origins.push({ pct: '', origin: '', process: '' }); renderOrigins(); changed(); };
    ['tubeX', 'tubeY', 'tubeGap'].forEach(function (id) { $(id).addEventListener('input', function () { drawPreview('tube'); }); });
    $('downloadAll').onclick = downloadAll;
    Array.prototype.forEach.call(document.querySelectorAll('figure .dl'), function (btn) {
      btn.onclick = function () { downloadOne(btn.closest('figure').dataset.format); };
    });
    $('saveBean').onclick = saveBean;
    $('newBean').onclick = function () {
      D = { name: '', roastery: '', origins: [{ pct: '', origin: '', process: '' }], notesBlack: '', notesWhite: '', colors: B.DEFAULT_COLORS.slice(), months: [], lineUp: 'Line Up' };
      currentId = null; fillForm(); changed();
    };
    $('exportLib').onclick = exportLib;
    $('importLib').onchange = importLib;
  }

  /* ---------------- rendering ---------------- */
  function tubeOpts() {
    return { tube: { offsetX: parseFloat($('tubeX').value) || 0, offsetY: parseFloat($('tubeY').value) || 0, gap: parseFloat($('tubeGap').value) || 0 } };
  }
  function drawPreview(f) {
    if (!fontsReady) return;
    var opts = tubeOpts(); opts.dpi = PREVIEW_DPI[f];
    var cv = B.render(f, D, opts);
    var target = document.querySelector('figure[data-format="' + f + '"] canvas');
    target.width = cv.width; target.height = cv.height;
    target.getContext('2d').drawImage(cv, 0, 0);
  }
  var timer;
  function changed() {
    save(LS_DRAFT, D);
    clearTimeout(timer);
    timer = setTimeout(function () { FORMATS.forEach(drawPreview); }, 120);
  }

  /* ---------------- export ---------------- */
  function canvasToPng(cv, dpi) {
    return new Promise(function (res, rej) {
      cv.toBlob(function (blob) {
        if (!blob) return rej(new Error('Canvas too large for this browser — try a lower resolution.'));
        blob.arrayBuffer().then(function (ab) { res(new Blob([B.setPngDpi(ab, dpi)], { type: 'image/png' })); });
      }, 'image/png');
    });
  }
  function makePng(f) {
    var dpi = parseInt($('dpi').value, 10) || 300, opts = tubeOpts(); opts.dpi = dpi;
    return canvasToPng(B.render(f, D, opts), dpi);
  }
  function fileName(f) { return 'stickers_' + slug(D.name) + '_' + f + '.png'; }
  function saveBlob(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function downloadOne(f) {
    toast('Rendering ' + f + '…');
    setTimeout(function () { makePng(f).then(function (b) { saveBlob(b, fileName(f)); toast('Saved ' + fileName(f)); }).catch(function (e) { toast(e.message); }); }, 30);
  }
  function downloadAll() {
    var btn = $('downloadAll'); btn.disabled = true; toast('Rendering all formats…');
    var zip = new JSZip(), chain = Promise.resolve();
    FORMATS.forEach(function (f) { chain = chain.then(function () { return makePng(f); }).then(function (b) { zip.file(fileName(f), b); }); });
    chain.then(function () { return zip.generateAsync({ type: 'blob' }); })
      .then(function (z) { saveBlob(z, 'stickers_' + slug(D.name) + '.zip'); toast('ZIP ready'); })
      .catch(function (e) { toast(e.message); })
      .then(function () { btn.disabled = false; });
  }

  /* ---------------- library ---------------- */
  function lib() { return load(LS_LIB) || []; }
  function renderLib() {
    var ul = $('library'), items = lib(); ul.innerHTML = '';
    if (!items.length) { ul.innerHTML = '<li><span class="hint">Nothing saved yet.</span></li>'; return; }
    items.forEach(function (it) {
      var li = document.createElement('li');
      li.innerHTML = '<span></span><button type="button">Load</button><button type="button">×</button>';
      li.firstChild.textContent = (it.data.name || 'Untitled') + (it.data.roastery ? ' — ' + it.data.roastery : '');
      var b = li.querySelectorAll('button');
      b[0].onclick = function () { D = clone(it.data); currentId = it.id; fillForm(); changed(); toast('Loaded'); };
      b[1].onclick = function () { save(LS_LIB, lib().filter(function (x) { return x.id !== it.id; })); renderLib(); };
      ul.appendChild(li);
    });
  }
  function saveBean() {
    var items = lib(), id = currentId || ('b' + Date.now());
    var idx = items.findIndex(function (x) { return x.id === id; });
    var rec = { id: id, data: clone(D) };
    if (idx > -1) items[idx] = rec; else items.push(rec);
    currentId = id; save(LS_LIB, items); renderLib(); toast('Saved to library');
  }
  function exportLib() {
    saveBlob(new Blob([JSON.stringify(lib(), null, 2)], { type: 'application/json' }), 'beans-library.json');
  }
  function importLib(e) {
    var file = e.target.files[0]; if (!file) return;
    file.text().then(function (txt) {
      var incoming = JSON.parse(txt), items = lib();
      if (!Array.isArray(incoming)) throw new Error('Not a beans library file');
      incoming.forEach(function (r) {
        if (!r || !r.data) return;
        var i = items.findIndex(function (x) { return x.id === r.id; });
        if (i > -1) items[i] = r; else items.push(r);
      });
      save(LS_LIB, items); renderLib(); toast('Imported ' + incoming.length + ' bean(s)');
    }).catch(function (err) { toast(err.message); }).then(function () { e.target.value = ''; });
  }

  /* ---------------- boot ---------------- */
  D.origins = D.origins || []; D.months = D.months || [];
  fillForm(); wire(); renderLib();
  var specs = ['300 20px "Neue Montreal"', 'italic 300 20px "Neue Montreal"', '400 20px "Neue Montreal"', 'italic 400 20px "Neue Montreal"',
    '700 20px "Neue Montreal"', 'italic 700 20px "Neue Montreal"', '300 20px "DM Mono"'];
  Promise.all(specs.map(function (s) { return document.fonts.load(s, 'Aa'); }))
    .catch(function () {}).then(function () { fontsReady = true; FORMATS.forEach(drawPreview); });
})();
