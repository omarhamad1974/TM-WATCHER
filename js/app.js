import { sb, BUCKET } from './supabase.js';
import { KEYS, LBL, thumb, shrink, compareAll } from './engine.js';
import { extractPdf } from './pdf.js';
import { DEF, FILTER_GROUPS } from './params.js';

const $ = i => document.getElementById(i);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const say = (id, t) => { $(id).textContent = t; };
const bucket = () => sb.storage.from(BUCKET);

/* ---------- parameter controls ---------- */
const ALL = [];
function build(id, defs) {
  const el = $('g_' + id);
  defs.forEach(([k, l, t, a, d, tip]) => {
    ALL.push(k); const r = document.createElement('label'); r.className = 'f' + (t === 'chk' ? ' k' : ''); let h;
    const q = `<button type="button" class="tip" data-tip="${k}" aria-label="Help: ${esc(l)}">?</button>`;
    if (t === 'sel') h = `<span>${l} ${q}</span><select id="${k}">${a.map(([v, n]) => `<option value="${v}"${v == d ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
    else if (t === 'chk') h = `<input type="checkbox" id="${k}"${d ? ' checked' : ''}><span>${l} ${q}</span>`;
    else if (t === 'num') h = `<span>${l} ${q}</span><input type="number" id="${k}" min="${a[0]}" value="${d}">`;
    else h = `<span>${l}: <b id="${k}_v">${d}</b> ${q}</span><input type="range" id="${k}" min="${a[0]}" max="${a[1]}" step="${a[2]}" value="${d}">`;
    h += `<small class="tipbox" id="tip_${k}" hidden>${esc(tip || '')}</small>`;
    r.innerHTML = h; el.append(r);
  });
  el.addEventListener('input', e => { const v = $(e.target.id + '_v'); if (v) v.textContent = e.target.value; });
}
document.addEventListener('click', e => {
  const b = e.target.closest('.tip'); if (!b) return; e.preventDefault();
  const t = $('tip_' + b.dataset.tip); t.hidden = !t.hidden;
});
$('tipsAll').onclick = () => {
  const boxes = [...document.querySelectorAll('.tipbox')], show = boxes.some(x => x.hidden);
  boxes.forEach(x => { x.hidden = !show; }); $('tipsAll').textContent = show ? 'Hide all tips' : 'Show all tips';
};
Object.keys(DEF).forEach(k => build(k, DEF[k]));
const read = () => { const o = {}; ALL.forEach(k => { const e = $(k); o[k] = e.type === 'checkbox' ? e.checked : e.tagName === 'SELECT' ? (isNaN(e.value) ? e.value : +e.value) : +e.value; }); return o; };
function write(o) {
  ALL.forEach(k => { if (!(k in o)) return; const e = $(k); if (e.type === 'checkbox') e.checked = !!o[k]; else e.value = o[k]; e.dispatchEvent(new Event('input', { bubbles: true })); });
}

/* ---------- file pickers ---------- */
const S = { src: null, srcName: '', pdfFile: null, cache: {}, cats: [], hist: [], presets: [] };
function loadSrc(f) {
  if (!f) return; const fr = new FileReader();
  fr.onload = () => {
    const im = new Image();
    im.onload = () => {
      const w = im.naturalWidth || 512, h = im.naturalHeight || 512, c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
      S.src = c; S.srcName = f.name; $('srcP').innerHTML = `<img src="${fr.result}" alt="Source"><span>${esc(f.name)} · ${w}×${h}</span>`;
    };
    im.onerror = () => { S.src = null; say('srcP', 'This file couldn’t be read as an image. Convert it to PNG or JPG and try again.'); };
    im.src = fr.result;
  };
  fr.readAsDataURL(f);
}
function loadPdf(f) { S.pdfFile = f || null; say('pdfP', f ? `${f.name} · ${(f.size / 1048576).toFixed(1)} MB` : ''); if (f && !$('catName').value) $('catName').value = f.name.replace(/\.pdf$/i, ''); }
$('srcF').addEventListener('change', e => loadSrc(e.target.files[0]));
$('pdfF').addEventListener('change', e => loadPdf(e.target.files[0]));
[['dzS', f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(f.name) ? loadSrc(f) : 0], ['dzP', f => /pdf/i.test(f.type + f.name) ? loadPdf(f) : 0]].forEach(([id, fn]) => {
  const z = $(id);
  ['dragover', 'dragenter'].forEach(t => z.addEventListener(t, e => { e.preventDefault(); z.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => z.addEventListener(t, e => { e.preventDefault(); z.classList.remove('over'); }));
  z.addEventListener('drop', e => fn(e.dataTransfer.files[0]));
});
document.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])][0]; if (f && /^image\//.test(f.type)) loadSrc(f); });

/* ---------- auth ---------- */
let user = null;
function setUser(u) {
  const same = user?.id === (u?.id); user = u || null;
  $('auth').hidden = !!user; $('app').hidden = !user; $('who').hidden = !user; $('who').querySelector('span').textContent = user?.email || '';
  if (user && !same) { S.cache = {}; loadCats(); loadPresets(); }
}
async function authDo(kind) {
  const email = $('email').value.trim(), password = $('pw').value; say('authMsg', '');
  if (!email) return say('authMsg', 'Enter your email address.');
  let r;
  if (kind === 'link') {
    r = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split('#')[0] } });
    return say('authMsg', r.error ? r.error.message : 'Check your inbox for the sign-in link.');
  }
  if (password.length < 6) return say('authMsg', 'Use a password of at least 6 characters.');
  if (kind === 'up') {
    r = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0] } });
    if (r.error) return say('authMsg', r.error.message);
    if (!r.data.session) say('authMsg', 'Account created. Confirm your email, then sign in.');
  } else {
    r = await sb.auth.signInWithPassword({ email, password }); if (r.error) say('authMsg', r.error.message);
  }
}
$('inBtn').onclick = () => authDo('in'); $('upAcc').onclick = () => authDo('up'); $('lnBtn').onclick = () => authDo('link');
$('outBtn').onclick = () => sb.auth.signOut();
document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
  document.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.panel').forEach(p => { p.hidden = p.id !== 'p_' + b.dataset.t; });
  if (b.dataset.t === 'his') loadHist();
});

/* ---------- catalogues ---------- */
async function loadCats() {
  const { data, error } = await sb.from('catalogues').select('*').order('created_at', { ascending: false });
  if (error) return say('upMsg', error.message);
  S.cats = data;
  $('catList').innerHTML = data.length ? data.map(c => `<div class="row"><div><b>${esc(c.name)}</b><div class="mut">${c.mark_count ?? 0} trademarks · ${c.page_count ?? '?'} pages · ${new Date(c.created_at).toLocaleDateString()}</div></div><button class="sm danger" data-del="${c.id}">Delete</button></div>`).join('') : '<p class="mut">No catalogues yet. Upload a PDF above.</p>';
  const cur = $('catSel').value;
  $('catSel').innerHTML = data.map(c => `<option value="${c.id}">${esc(c.name)} (${c.mark_count ?? 0})</option>`).join('') || '<option value="">No catalogues</option>';
  if (cur) $('catSel').value = cur;
}
$('catList').addEventListener('click', e => { const id = e.target.dataset.del; if (id) delCat(id); });
async function delCat(id, silent) {
  if (!silent && !confirm('Delete this catalogue and all its stored images?')) return;
  const dir = `${user.id}/cat/${id}`;
  for (;;) {
    const { data } = await bucket().list(dir, { limit: 1000 }); if (!data?.length) break;
    await bucket().remove(data.map(f => `${dir}/${f.name}`)); if (data.length < 1000) break;
  }
  await sb.from('catalogues').delete().eq('id', id); delete S.cache[id]; loadCats();
}
$('upBtn').onclick = async () => {
  if (!S.pdfFile) return say('upMsg', 'Choose a PDF first.');
  const f = S.pdfFile, o = read(), name = $('catName').value.trim() || f.name; let cat;
  $('upBtn').disabled = true;
  try {
    const ep = { mode: o.mode, scale: o.scale, minImg: o.minImg, pFrom: o.pFrom, pTo: o.pTo };
    const ins = await sb.from('catalogues').insert({ name, extract_params: ep }).select().single(); if (ins.error) throw ins.error; cat = ins.data;
    const dir = `${user.id}/cat/${cat.id}`; say('upMsg', 'Uploading the PDF…');
    const up = await bucket().upload(`${dir}/catalogue.pdf`, f, { contentType: 'application/pdf' }); if (up.error) throw up.error;
    const rows = [], pend = new Set(), errs = [];
    const queue = async fn => { const p = fn().catch(e => errs.push(e)).finally(() => pend.delete(p)); pend.add(p); if (pend.size >= 4) await Promise.race(pend); };
    const ex = await extractPdf(f, o, {
      onPage: (p, last) => say('upMsg', `Reading page ${p} of ${last}…  ${rows.length} trademarks stored`),
      onItem: (p, i, c) => queue(async () => {
        const blob = await new Promise(r => shrink(c, 256).toBlob(r, 'image/webp', .9)), ext = blob.type === 'image/webp' ? 'webp' : 'png', path = `${dir}/p${p}_${i}.${ext}`;
        const u = await bucket().upload(path, blob, { contentType: blob.type }); if (u.error) throw u.error;
        rows.push({ catalogue_id: cat.id, page: p, idx: i, image_path: path, width: c.width, height: c.height });
      })
    });
    await Promise.all(pend); if (errs.length) throw errs[0];
    for (let k = 0; k < rows.length; k += 200) { const r = await sb.from('trademarks').insert(rows.slice(k, k + 200)); if (r.error) throw r.error; }
    await sb.from('catalogues').update({ pdf_path: `${dir}/catalogue.pdf`, page_count: ex.numPages, mark_count: rows.length }).eq('id', cat.id);
    say('upMsg', `Done: ${rows.length} trademarks from ${ex.numPages} pages.` + (ex.fallback ? ` ${ex.fallback} page(s) had no embedded image, so the whole page was used.` : ''));
    $('catName').value = ''; await loadCats(); $('catSel').value = cat.id;
  } catch (e) {
    say('upMsg', 'Upload failed: ' + (e.message || e)); if (cat) await delCat(cat.id, true);
  }
  $('upBtn').disabled = false;
};

/* ---------- saved filter settings ---------- */
const FKEYS = FILTER_GROUPS.flatMap(g => DEF[g].map(d => d[0]));
const filters = () => { const o = read(), r = {}; FKEYS.forEach(k => { r[k] = o[k]; }); return r; };
const defaults = () => { const r = {}; FILTER_GROUPS.forEach(g => DEF[g].forEach(d => { r[d[0]] = d[4]; })); return r; };
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* ignore */ } } };
async function loadPresets(keep) {
  const { data } = await sb.from('presets').select('*').order('name'); S.presets = data || [];
  $('preSel').innerHTML = '<option value="">Default settings</option>' + S.presets.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  const p = S.presets.find(x => x.id === (keep || ls.get('tm_preset')));
  if (p) { $('preSel').value = p.id; $('preName').value = p.name; write(p.params); }
}
$('preSel').onchange = () => {
  const p = S.presets.find(x => x.id === $('preSel').value); ls.set('tm_preset', p?.id || '');
  if (p) { write(p.params); $('preName').value = p.name; say('preMsg', `Loaded “${p.name}”.`); } else { write(defaults()); $('preName').value = ''; say('preMsg', 'Default settings restored.'); }
};
$('preSave').onclick = async () => {
  const name = $('preName').value.trim(); if (!name) return say('preMsg', 'Type a name for these settings first.');
  const existed = S.presets.some(p => p.name === name);
  const { data, error } = await sb.from('presets').upsert({ name, params: filters() }, { onConflict: 'user_id,name' }).select().single();
  if (error) return say('preMsg', error.message);
  ls.set('tm_preset', data.id); await loadPresets(data.id); say('preMsg', `${existed ? 'Updated' : 'Saved'} “${name}”.`);
};
$('preDel').onclick = async () => {
  const id = $('preSel').value; if (!id) return say('preMsg', 'Choose a saved setting to delete.');
  if (!confirm('Delete these saved settings?')) return;
  await sb.from('presets').delete().eq('id', id); ls.set('tm_preset', ''); $('preName').value = ''; await loadPresets(); say('preMsg', 'Deleted.');
};
$('preReset').onclick = () => { write(defaults()); $('preSel').value = ''; $('preName').value = ''; ls.set('tm_preset', ''); say('preMsg', 'Default settings restored.'); };

/* ---------- compare ---------- */
async function loadMarks(catId, prog) {
  if (S.cache[catId]) return S.cache[catId];
  const rows = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await sb.from('trademarks').select('id,page,idx,image_path').eq('catalogue_id', catId).order('page').order('idx').range(f, f + 999);
    if (error) throw error; rows.push(...data); if (data.length < 1000) break;
  }
  const out = new Array(rows.length); let n = 0, k = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (k < rows.length) {
      const j = k++, { data, error } = await bucket().download(rows[j].image_path); if (error) throw error;
      const bm = await createImageBitmap(data), c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bm, 0, 0);
      out[j] = { id: rows[j].id, page: rows[j].page, i: rows[j].idx, cv: c }; prog(++n, rows.length);
    }
  }));
  return (S.cache[catId] = out);
}
S.view = {};
const STAT = [['new', 'New'], ['cleared', 'Cleared'], ['watch', 'Watch'], ['conflict', 'Conflict']];
const statLabel = v => (STAT.find(x => x[0] === v) || STAT[0])[1];
function cardsHtml(rows, srcUrl, act) {
  return rows.map(r => {
    const p = r.s * 100, cl = p >= 85 ? 'hi' : p >= 70 ? 'mid' : 'lo', st = r.status || 'new';
    const rv = r.rid ? `<div class="rv"><select class="rv-status" data-rid="${r.rid}" aria-label="Review status">${STAT.map(([v, l]) => `<option value="${v}"${v === st ? ' selected' : ''}>${l}</option>`).join('')}</select><input class="rv-note" data-rid="${r.rid}" type="text" maxlength="500" placeholder="Add a note" value="${esc(r.note || '')}" aria-label="Note"><span class="rv-print">${statLabel(st)}${r.note ? ': ' + esc(r.note) : ''}</span></div>` : '';
    return `<div class="card st-${st}"><div class="pair"><figure><div class="im"><img src="${srcUrl}" alt="Source"></div><figcaption>Source</figcaption></figure>
<div class="pct ${cl}">${p.toFixed(1)}%<small>similar</small></div>
<figure><div class="im"><img src="${r.url}" alt="Page ${r.p}"></div><figcaption>Page ${r.p}${r.i ? ' · image ' + (r.i + 1) : ''}</figcaption></figure></div>
<div class="bars">${act.map(k => { const v = ((r.m?.[k] ?? 0) * 100).toFixed(0); return `<div class="bar"><span>${LBL[k]}</span><i><u style="width:${v}%"></u></i><em>${v}%</em></div>`; }).join('')}</div>
<div class="meta">Best match found with source ${esc(r.lb)}.</div>${rv}</div>`;
  }).join('');
}
function renderView(id, v) {
  S.view[id] = v; const o = v.params || {};
  const wts = KEYS.filter(k => o['w_' + k] > 0).map(k => `${LBL[k]} ${o['w_' + k]}`).join(', ');
  $(id).innerHTML = `<div data-view="${id}"><div class="acts"><button class="sm sec" data-act="csv">Download CSV</button><button class="sm sec" data-act="print">Print / save as PDF</button></div>
<div class="printhead"><h2>Trademark match report</h2><p>Source: ${esc(v.srcName)} · Catalogue: ${esc(v.catName)} · ${esc(v.date)}</p><p>Minimum similarity ${o.min}% · Combined by ${esc(o.mix)} · Weights: ${esc(wts)} · ${v.rows.length} matches listed</p></div>
${cardsHtml(v.rows, v.srcUrl, v.act)}</div>`;
}
function downloadCsv(v) {
  const q = x => { let t = String(x ?? ''); if (/^[=+\-@\t\r]/.test(t) && isNaN(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const head = ['Rank', 'Page', 'Image', 'Similarity %', ...KEYS.map(k => LBL[k] + ' %'), 'Best variation', 'Status', 'Note', 'Source', 'Catalogue', 'Date'];
  const lines = [head.map(q).join(',')];
  v.rows.forEach((r, i) => lines.push([i + 1, r.p, r.i + 1, (r.s * 100).toFixed(1), ...KEYS.map(k => r.m ? (r.m[k] * 100).toFixed(0) : ''), r.lb, r.status ? statLabel(r.status) : '', r.note || '', v.srcName, v.catName, v.date].map(q).join(',')));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = `matches-${String(v.srcName || 'search').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_')}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const v = S.view[b.closest('[data-view]')?.dataset.view]; if (!v) return;
  if (b.dataset.act === 'print') window.print(); else downloadCsv(v);
});
document.addEventListener('change', async e => {
  const t = e.target, isS = t.classList?.contains('rv-status'); if (!t.dataset?.rid || !(isS || t.classList.contains('rv-note'))) return;
  const patch = isS ? { status: t.value } : { note: t.value.trim() || null };
  const { error } = await sb.from('search_results').update(patch).eq('id', +t.dataset.rid);
  if (error) return alert('Couldn’t save: ' + error.message);
  Object.values(S.view).forEach(v => v.rows.forEach(r => { if (String(r.rid) === t.dataset.rid) Object.assign(r, patch); }));
  const card = t.closest('.card'), r = Object.values(S.view).flatMap(v => v.rows).find(x => String(x.rid) === t.dataset.rid);
  if (card && r) { card.className = 'card st-' + (r.status || 'new'); card.querySelector('.rv-print').textContent = statLabel(r.status || 'new') + (r.note ? ': ' + r.note : ''); }
  if (S.hisCur) renderHistSummary();
});
$('go').onclick = async () => {
  if (!S.src) return say('st', 'Add a source trademark image first.');
  const catId = $('catSel').value; if (!catId) return say('st', 'Choose a catalogue. Upload one in the Catalogues tab first.');
  $('go').disabled = true; $('res').innerHTML = '';
  try {
    const o = read(), marks = await loadMarks(catId, (n, t) => say('st', `Loading catalogue images ${n} of ${t}…`));
    if (!marks.length) throw new Error('This catalogue has no trademarks.');
    const out = await compareAll(S.src, marks, o, (i, n, v) => say('st', `Comparing ${i + 1} of ${n} (${v} source variation${v > 1 ? 's' : ''})…`));
    const top = Math.max(...out.map(r => r.s)), hits = out.filter(r => r.s * 100 >= o.min).sort((a, b) => b.s - a.s), shown = hits.slice(0, o.maxRes);
    let ids = null, note = '';
    if ($('saveChk').checked && hits.length) { try { ids = await saveSearch(catId, o, marks.length, hits, shown); note = ' Saved to History. Set a status or note on each match.'; } catch (e) { note = ' Couldn’t save to History: ' + e.message; } }
    say('st', `${marks.length} trademarks compared · ${hits.length} at ${o.min}% or higher.` + (hits.length > shown.length ? ` Showing the top ${shown.length}.` : '') + note);
    if (!hits.length) { $('res').innerHTML = `<div class="card">No trademark reached ${o.min}%. The closest scored ${(top * 100).toFixed(1)}%. Lower the minimum similarity to see it.</div>`; }
    else renderView('res', {
      srcUrl: thumb(S.src, 360), srcName: S.srcName, catName: S.cats.find(c => c.id === catId)?.name || '', date: new Date().toLocaleString(), params: o, act: KEYS.filter(k => o['w_' + k] > 0),
      rows: shown.map(r => ({ p: r.c.page, i: r.c.i, url: thumb(r.c.cv, 360), s: r.s, m: r.m, lb: r.lb, rid: ids?.get(r.c.id), status: 'new', note: '' }))
    });
  } catch (e) { say('st', 'Something went wrong: ' + (e.message || e)); }
  $('go').disabled = false;
};
async function saveSearch(catId, o, compared, hits, shown) {
  const sid = crypto.randomUUID(), path = `${user.id}/src/${sid}.png`, ids = new Map();
  const blob = await new Promise(r => shrink(S.src, 600).toBlob(r, 'image/png'));
  const up = await bucket().upload(path, blob, { contentType: 'image/png' }); if (up.error) throw up.error;
  const s = await sb.from('searches').insert({ id: sid, catalogue_id: catId, source_path: path, source_name: S.srcName, params: o, min_similarity: o.min, compared, match_count: hits.length }); if (s.error) throw s.error;
  const rows = shown.map(r => ({ search_id: sid, trademark_id: r.c.id, score: +r.s.toFixed(4), metrics: r.m, variant: r.lb }));
  for (let k = 0; k < rows.length; k += 200) {
    const r = await sb.from('search_results').insert(rows.slice(k, k + 200)).select('id,trademark_id'); if (r.error) throw r.error;
    r.data.forEach(x => ids.set(x.trademark_id, x.id));
  }
  return ids;
}

/* ---------- history ---------- */
async function loadHist() {
  const { data, error } = await sb.from('searches').select('*,catalogues(name)').order('created_at', { ascending: false }).limit(100);
  if (error) return say('hisMsg', error.message); S.hist = data;
  $('hisList').innerHTML = data.length ? data.map(h => `<div class="row"><div><b>${esc(h.source_name || 'Search')}</b><div class="mut">${esc(h.catalogues?.name || 'Deleted catalogue')} · ${h.match_count} matches ≥ ${h.min_similarity}% of ${h.compared} · ${new Date(h.created_at).toLocaleString()}</div></div><div class="btns"><button class="sm" data-open="${h.id}">Open</button><button class="sm danger" data-hdel="${h.id}">Delete</button></div></div>`).join('') : '<p class="mut">Saved searches appear here.</p>';
}
function renderHistSummary() {
  const c = S.hisCur; if (!c) return; const n = {}; c.rows.forEach(r => { n[r.status] = (n[r.status] || 0) + 1; });
  say('hisMsg', `${c.rows.length} saved matches · ` + STAT.map(([v, l]) => `${l} ${n[v] || 0}`).join(' · '));
}
function renderHist() {
  const c = S.hisCur; if (!c) return; const f = $('hisFilter').value, rows = f ? c.rows.filter(r => r.status === f) : c.rows;
  renderView('hisRes', { srcUrl: c.srcUrl, srcName: c.s.source_name, catName: c.s.catalogues?.name || 'Deleted catalogue', date: new Date(c.s.created_at).toLocaleString(), params: c.s.params, act: c.act, rows });
  renderHistSummary();
}
$('hisFilter').onchange = renderHist;
$('hisList').addEventListener('click', async e => {
  const open = e.target.dataset.open, del = e.target.dataset.hdel;
  if (open) {
    say('hisMsg', 'Loading…'); $('hisRes').innerHTML = ''; S.hisCur = null;
    try {
      const s = S.hist.find(h => h.id === open);
      const { data, error } = await sb.from('search_results').select('id,score,metrics,variant,status,note,trademarks(page,idx,image_path)').eq('search_id', open).order('score', { ascending: false }).limit(1000); if (error) throw error;
      const urls = data.length ? (await bucket().createSignedUrls(data.map(r => r.trademarks.image_path), 3600)).data : [];
      const srcUrl = (await bucket().createSignedUrl(s.source_path, 3600)).data.signedUrl;
      S.hisCur = { s, srcUrl, act: KEYS.filter(k => s.params['w_' + k] > 0), rows: data.map((r, i) => ({ rid: r.id, p: r.trademarks.page, i: r.trademarks.idx, url: urls[i].signedUrl, s: +r.score, m: r.metrics, lb: r.variant, status: r.status, note: r.note })) };
      renderHist();
    } catch (err) { say('hisMsg', err.message); }
  }
  if (del && confirm('Delete this saved search?')) {
    const s = S.hist.find(h => h.id === del); if (s?.source_path) await bucket().remove([s.source_path]);
    await sb.from('searches').delete().eq('id', del); $('hisRes').innerHTML = ''; S.hisCur = null; say('hisMsg', ''); loadHist();
  }
});

/* ---------- start ---------- */
sb.auth.onAuthStateChange((_e, s) => setUser(s?.user));
sb.auth.getSession().then(({ data }) => setUser(data.session?.user));
