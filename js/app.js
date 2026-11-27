(function () {
  var B = window.Beans;
  var $ = function (id) { return document.getElementById(id); };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var FORMATS = ['card', 'sticker', 'donut', 'tube'];
  var LS_LIB = 'beans.library.v1', LS_DRAFT = 'beans.draft.v2';
  var PREVIEW_DPI = { card: 150, sticker: 150, donut: 150, tube: 45 };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  function blank() {
    return { name: '', roastery: '', origins: [{ pct: '', origin: '', process: '' }], process: '', notesBlack: '', notesWhite: '',
      colors: B.DEFAULT_COLORS.slice(), gradient: 'light', fillAuto: true, fill: '#ffffff', textColor: 'auto', layout: 'new', months: [], lineUp: 'Line Up' };
  }
  function normalize(d) { var o = Object.assign(blank(), d || {}); o.origins = o.origins || []; o.months = o.months || []; return o; }
  function slug(s) { return String(s || 'bean').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'bean'; }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2400); }

  var D = normalize(load(LS_DRAFT) || clone(B.EXAMPLES.abdul)), currentId = null, fontsReady = false;

  /* ---------------- form <-> data ---------------- */
  function renderOrigins() {
    var host = $('origins'); host.innerHTML = '';
    D.origins.forEach(function (o, i) {
      var row = document.createElement('div'); row.className = 'origin-row';
      row.innerHTML = '<input type="text" inputmode="numeric" placeholder="%" aria-label="Percent">' +
        '<input type="text" placeholder="Origin (Gayo)" aria-label="Origin">' +
        '<input type="text" placeholder="Process (optional)" aria-label="Row process">' +
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
      cb.onchange = function () { D.months = MONTHS.filter(function (x) { return x === m ? cb.checked : D.months.indexOf(x) > -1; }); changed(); };
      host.appendChild(l);
    });
  }
  function syncFull() { $('fullOpts').hidden = D.gradient !== 'full'; $('fill').disabled = $('fillAuto').checked; }
  function fillForm() {
    $('name').value = D.name; $('roastery').value = D.roastery; $('process').value = D.process;
    $('notesBlack').value = D.notesBlack; $('notesWhite').value = D.notesWhite;
    for (var i = 0; i < 4; i++) $('c' + i).value = D.colors[i].toLowerCase();
    Array.prototype.forEach.call(document.querySelectorAll('input[name=gradient]'), function (r) { r.checked = r.value === D.gradient; });
    $('fillAuto').checked = D.fillAuto !== false; $('fill').value = (D.fill || '#9f1f63').toLowerCase();
    $('textColor').value = D.textColor || 'auto'; $('layout').value = D.layout || 'new';
    $('lineUp').value = D.lineUp == null ? 'Line Up' : D.lineUp;
    renderOrigins(); renderMonths(); syncFull();
  }
  function wire() {
    [['name'], ['roastery'], ['process'], ['notesBlack'], ['notesWhite'], ['lineUp']].forEach(function (p) {
      $(p[0]).addEventListener('input', function () { D[p[0]] = $(p[0]).value; changed(); });
    });
    for (var i = 0; i < 4; i++) (function (i) { $('c' + i).addEventListener('input', function () { D.colors[i] = $('c' + i).value; changed(); }); })(i);
    Array.prototype.forEach.call(document.querySelectorAll('input[name=gradient]'), function (r) {
      r.onchange = function () { if (r.checked) { D.gradient = r.value; syncFull(); changed(); } };
    });
    $('fillAuto').onchange = function () { D.fillAuto = $('fillAuto').checked; syncFull(); changed(); };
    $('fill').oninput = function () { D.fill = $('fill').value; changed(); };
    $('textColor').onchange = function () { D.textColor = $('textColor').value; changed(); };
    $('layout').onchange = function () { D.layout = $('layout').value; changed(); };
    $('resetColors').onclick = function () { D.colors = B.DEFAULT_COLORS.slice(); fillForm(); changed(); };
    $('addOrigin').onclick = function () { D.origins.push({ pct: '', origin: '', process: '' }); renderOrigins(); changed(); };
    ['tubeX', 'tubeY', 'tubeGap'].forEach(function (id) { $(id).addEventListener('input', function () { drawPreview('tube'); }); });
    $('downloadAll').onclick = downloadAll;
    Array.prototype.forEach.call(document.querySelectorAll('figure .dl'), function (btn) {
      btn.onclick = function () { downloadOne(btn.closest('figure').dataset.format, btn.dataset.type); };
    });
    $('exAbdul').onclick = function () { D = normalize(clone(B.EXAMPLES.abdul)); currentId = null; fillForm(); changed(); };
    $('exLollipop').onclick = function () { D = normalize(clone(B.EXAMPLES.lollipop)); currentId = null; fillForm(); changed(); };
    $('saveBean').onclick = saveBean;
    $('newBean').onclick = function () { D = blank(); currentId = null; fillForm(); changed(); };
    $('exportLib').onclick = exportLib; $('importLib').onchange = importLib;
  }

  /* ---------------- rendering ---------------- */
  function tubeOpts() {
    return { tube: { offsetX: parseFloat($('tubeX').value) || 0, offsetY: parseFloat($('tubeY').value) || 0, gap: parseFloat($('tubeGap').value) || 0 } };
  }
  function drawPreview(f) {
    if (!fontsReady) return;
    var opts = tubeOpts(); opts.dpi = PREVIEW_DPI[f];
    var cv = B.render(f, D, opts), target = document.querySelector('figure[data-format="' + f + '"] canvas');
    target.width = cv.width; target.height = cv.height; target.getContext('2d').drawImage(cv, 0, 0);
  }
  var timer;
  function changed() { save(LS_DRAFT, D); clearTimeout(timer); timer = setTimeout(function () { FORMATS.forEach(drawPreview); }, 120); }

  /* ---------------- export ---------------- */
  function canvasToPng(cv, dpi) {
    return new Promise(function (res, rej) {
      cv.toBlob(function (blob) {
        if (!blob) return rej(new Error('Canvas too large for this browser — try a lower resolution.'));
        blob.arrayBuffer().then(function (ab) { res(new Blob([B.setPngDpi(ab, dpi)], { type: 'image/png' })); });
      }, 'image/png');
    });
  }
  function exportOpts() { var o = tubeOpts(); o.dpi = parseInt($('dpi').value, 10) || 300; return o; }
  function makePng(f) { var o = exportOpts(); return canvasToPng(B.render(f, D, o), o.dpi); }
  function makeSvg(f) { return new Blob([B.renderSvg(f, D, exportOpts())], { type: 'image/svg+xml' }); }
  function fileName(f, ext) { return 'stickers_' + slug(D.name) + '_' + f + '.' + ext; }
  function saveBlob(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function downloadOne(f, type) {
    toast('Rendering ' + f + '…');
    setTimeout(function () {
      var p = type === 'svg' ? Promise.resolve(makeSvg(f)) : makePng(f);
      p.then(function (b) { saveBlob(b, fileName(f, type)); toast('Saved ' + fileName(f, type)); }).catch(function (e) { toast(e.message); });
    }, 30);
  }
  function downloadAll() {
    var btn = $('downloadAll'); btn.disabled = true; toast('Rendering all formats…');
    var zip = new JSZip(), chain = Promise.resolve();
    FORMATS.forEach(function (f) {
      chain = chain.then(function () { return makePng(f); }).then(function (b) { zip.file(fileName(f, 'png'), b); zip.file(fileName(f, 'svg'), makeSvg(f)); });
    });
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
      li.firstChild.textContent = (it.data.name || 'Untitled').replace(/\s+/g, ' ') + (it.data.roastery ? ' — ' + it.data.roastery : '');
      var b = li.querySelectorAll('button');
      b[0].onclick = function () { D = normalize(clone(it.data)); currentId = it.id; fillForm(); changed(); toast('Loaded'); };
      b[1].onclick = function () { save(LS_LIB, lib().filter(function (x) { return x.id !== it.id; })); renderLib(); };
      ul.appendChild(li);
    });
  }
  function saveBean() {
    var items = lib(), id = currentId || ('b' + Date.now());
    var idx = items.findIndex(function (x) { return x.id === id; }), rec = { id: id, data: clone(D) };
    if (idx > -1) items[idx] = rec; else items.push(rec);
    currentId = id; save(LS_LIB, items); renderLib(); toast('Saved to library');
  }
  function exportLib() { saveBlob(new Blob([JSON.stringify(lib(), null, 2)], { type: 'application/json' }), 'beans-library.json'); }
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
  fillForm(); wire(); renderLib();
  var specs = ['italic 400 20px "Neue Montreal"', 'normal 400 20px "Neue Montreal"', 'italic 700 20px "Neue Montreal"', 'normal 700 20px "Neue Montreal"', 'normal 300 20px "DM Mono"'];
  Promise.all(specs.map(function (s) { return document.fonts.load(s, 'Aa'); }))
    .catch(function () {}).then(function () { fontsReady = true; FORMATS.forEach(drawPreview); });
})();
