// Image comparison engine: pure browser code, no dependencies.
export const KEYS = ['phash', 'dhash', 'ahash', 'ssim', 'ncc', 'edge', 'shape', 'color'];
export const LBL = { phash: 'pHash', dhash: 'dHash', ahash: 'aHash', ssim: 'SSIM', ncc: 'Pixels', edge: 'Edges', shape: 'Shape', color: 'Color' };
const mk = n => { const c = document.createElement('canvas'); c.width = c.height = n; return c; };
const tick = () => new Promise(r => setTimeout(r));

export function shrink(cv, max) {
  const k = Math.min(1, max / Math.max(cv.width, cv.height)), c = document.createElement('canvas');
  c.width = Math.max(1, cv.width * k | 0); c.height = Math.max(1, cv.height * k | 0);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingQuality = 'high'; x.drawImage(cv, 0, 0, c.width, c.height); return c;
}
export const thumb = (cv, max) => shrink(cv, max).toDataURL('image/png');

/** Trim margins, fit into an N x N square padded with the background colour. */
export function fit(src, o) {
  const w = src.width, h = src.height, N = o.N; let sx = 0, sy = 0, sw = w, sh = h, bg = [255, 255, 255];
  const sc = document.createElement('canvas'), k = Math.min(1, 200 / Math.max(w, h));
  sc.width = Math.max(1, w * k | 0); sc.height = Math.max(1, h * k | 0);
  const x = sc.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, sc.width, sc.height); x.drawImage(src, 0, 0, sc.width, sc.height);
  if (o.crop) {
    const W = sc.width, H = sc.height, d = x.getImageData(0, 0, W, H).data; bg = [d[0], d[1], d[2]];
    const t = o.tol * 7.65; let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let q = 0; q < W; q++) {
      const i = (y * W + q) * 4;
      if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > t) { if (q < x0) x0 = q; if (q > x1) x1 = q; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 >= 0) { const kx = W / w, ky = H / h; sx = Math.floor(x0 / kx); sy = Math.floor(y0 / ky); sw = Math.min(w - sx, Math.ceil((x1 + 1) / kx) - sx); sh = Math.min(h - sy, Math.ceil((y1 + 1) / ky) - sy); }
  }
  const c = mk(N), cx = c.getContext('2d', { willReadFrequently: true });
  cx.fillStyle = `rgb(${bg})`; cx.fillRect(0, 0, N, N); cx.imageSmoothingQuality = 'high';
  if (o.fit === 'stretch') cx.drawImage(src, sx, sy, sw, sh, 0, 0, N, N);
  else { const s = N * .94 / Math.max(sw, sh), dw = sw * s, dh = sh * s; cx.drawImage(src, sx, sy, sw, sh, (N - dw) / 2, (N - dh) / 2, dw, dh); }
  return c;
}

export function variant(b, ang, flip) {
  const N = b.width, c = mk(N), x = c.getContext('2d', { willReadFrequently: true }), p = b.getContext('2d').getImageData(0, 0, 1, 1).data;
  x.fillStyle = `rgb(${p[0]},${p[1]},${p[2]})`; x.fillRect(0, 0, N, N);
  const r = ang * Math.PI / 180, s = ang % 90 ? 1 / (Math.abs(Math.cos(r)) + Math.abs(Math.sin(r))) : 1;
  x.translate(N / 2, N / 2); x.rotate(r); x.scale(flip ? -s : s, s); x.drawImage(b, -N / 2, -N / 2); return c;
}

const C8 = Array.from({ length: 8 }, (_, u) => Array.from({ length: 32 }, (_, x) => Math.cos((2 * x + 1) * u * Math.PI / 64)));
function rs(g, N, W, H) {
  const r = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor(y * N / H), y1 = Math.max(y0 + 1, Math.ceil((y + 1) * N / H));
    for (let x = 0; x < W; x++) {
      const x0 = Math.floor(x * N / W), x1 = Math.max(x0 + 1, Math.ceil((x + 1) * N / W)); let s = 0, c = 0;
      for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) { s += g[j * N + i]; c++; }
      r[y * W + x] = s / c;
    }
  }
  return r;
}
function otsu(g) {
  const h = new Float32Array(256); g.forEach(v => h[Math.min(255, v * 255 | 0)]++);
  const n = g.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * h[i];
  let wb = 0, sb = 0, best = 0, t = 127;
  for (let i = 0; i < 256; i++) {
    wb += h[i]; if (!wb) continue; const wf = n - wb; if (!wf) break; sb += i * h[i];
    const d = sb / wb - (sum - sb) / wf, v = wb * wf * d * d; if (v > best) { best = v; t = i; }
  }
  return (t + 1) / 255;
}
function blur(a, N) {
  const b = new Float32Array(a.length);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let s = 0, c = 0;
    for (let j = -1; j < 2; j++) for (let i = -1; i < 2; i++) { const yy = y + j, xx = x + i; if (yy >= 0 && yy < N && xx >= 0 && xx < N) { s += a[yy * N + xx]; c++; } }
    b[y * N + x] = s / c;
  }
  return b;
}

/** Extract grayscale, mask, edge map, colour histogram and 3 perceptual hashes. */
export function feat(cv, neg, o) {
  const N = cv.width, n = N * N, d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, N, N).data, g = new Float32Array(n);
  let lo = 1, hi = 0;
  for (let i = 0; i < n; i++) { const v = (.299 * d[i * 4] + .587 * d[i * 4 + 1] + .114 * d[i * 4 + 2]) / 255; g[i] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  if (o.norm && hi > lo) for (let i = 0; i < n; i++) g[i] = (g[i] - lo) / (hi - lo);
  if (neg) for (let i = 0; i < n; i++) g[i] = 1 - g[i];
  const th = o.thr > 0 ? o.thr / 100 : otsu(g), m = new Uint8Array(n); let cnt = 0;
  for (let i = 0; i < n; i++) if (g[i] < th) { m[i] = 1; cnt++; }
  if (cnt > n / 2) { for (let i = 0; i < n; i++) m[i] ^= 1; cnt = n - cnt; }
  const hist = new Float32Array(64); let hs = 0;
  for (let i = 0; i < n; i++) if (m[i]) { hist[(d[i * 4] >> 6) * 16 + (d[i * 4 + 1] >> 6) * 4 + (d[i * 4 + 2] >> 6)]++; hs++; }
  if (hs) for (let i = 0; i < 64; i++) hist[i] /= hs;
  let e = new Float32Array(n);
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = y * N + x, gx = g[i - N + 1] + 2 * g[i + 1] + g[i + N + 1] - g[i - N - 1] - 2 * g[i - 1] - g[i + N - 1],
      gy = g[i + N - 1] + 2 * g[i + N] + g[i + N + 1] - g[i - N - 1] - 2 * g[i - N] - g[i - N + 1];
    e[i] = Math.hypot(gx, gy);
  }
  e = blur(e, N);
  const r8 = rs(g, N, 8, 8), mean = r8.reduce((s, v) => s + v, 0) / 64, ah = Uint8Array.from(r8, v => v > mean ? 1 : 0);
  const r9 = rs(g, N, 9, 8), dh = new Uint8Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) dh[y * 8 + x] = r9[y * 9 + x] > r9[y * 9 + x + 1] ? 1 : 0;
  const r32 = rs(g, N, 32, 32), tmp = new Float32Array(32 * 8);
  for (let y = 0; y < 32; y++) for (let u = 0; u < 8; u++) { let s = 0; for (let x = 0; x < 32; x++) s += r32[y * 32 + x] * C8[u][x]; tmp[y * 8 + u] = s; }
  const co = new Float32Array(64);
  for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) { let s = 0; for (let y = 0; y < 32; y++) s += tmp[y * 8 + u] * C8[v][y]; co[v * 8 + u] = s; }
  const med = Array.from(co).slice(1).sort((a, b) => a - b)[31], ph = Uint8Array.from(co, (v, i) => i && v > med ? 1 : 0);
  return { N, g, m, cnt, hist, hs, e, ah, dh, ph };
}
const hsim = (x, y) => { let h = 0; for (let i = 1; i < 64; i++) h += x[i] ^ y[i]; return Math.max(0, 1 - 2 * h / 63); };

/** Eight similarity metrics, each 0..1. */
export function metr(a, b) {
  const N = a.N, n = N * N, ga = a.g, gb = b.g; let tot = 0, c = 0;
  for (let by = 0; by < N; by += 8) for (let bx = 0; bx < N; bx += 8) {
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const i = (by + y) * N + bx + x, p = ga[i], q = gb[i]; sa += p; sb += q; saa += p * p; sbb += q * q; sab += p * q; }
    const ma = sa / 64, mb = sb / 64, va = saa / 64 - ma * ma, vb = sbb / 64 - mb * mb, cv = sab / 64 - ma * mb;
    if (va < 1e-4 && vb < 1e-4 && Math.abs(ma - mb) < .05) continue;
    tot += ((2 * ma * mb + .0001) * (2 * cv + .0009)) / ((ma * ma + mb * mb + .0001) * (va + vb + .0009)); c++;
  }
  const ssim = c ? Math.max(0, tot / c) : 1;
  let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += ga[i]; mb += gb[i]; } ma /= n; mb /= n;
  let cov = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { const p = ga[i] - ma, q = gb[i] - mb; cov += p * q; va += p * p; vb += q * q; }
  const den = Math.sqrt(va * vb), ncc = den < 1e-9 ? (Math.abs(ma - mb) < .05 ? 1 : 0) : Math.max(0, cov / den);
  let dt = 0, na = 0, nb = 0; for (let i = 0; i < n; i++) { dt += a.e[i] * b.e[i]; na += a.e[i] ** 2; nb += b.e[i] ** 2; }
  const edge = na && nb ? dt / Math.sqrt(na * nb) : (na || nb ? 0 : 1);
  let it = 0; for (let i = 0; i < n; i++) if (a.m[i] && b.m[i]) it++;
  const shape = a.cnt + b.cnt ? 2 * it / (a.cnt + b.cnt) : 1;
  let color; if (!a.hs || !b.hs) color = a.hs === b.hs ? 1 : 0; else { color = 0; for (let i = 0; i < 64; i++) color += Math.min(a.hist[i], b.hist[i]); }
  return { phash: hsim(a.ph, b.ph), dhash: hsim(a.dh, b.dh), ahash: hsim(a.ah, b.ah), ssim, ncc, edge, shape, color };
}
export function combine(m, o) {
  const ks = KEYS.filter(k => o['w_' + k] > 0); if (!ks.length) return 0;
  if (o.mix === 'min') return Math.min(...ks.map(k => m[k]));
  if (o.mix === 'max') return Math.max(...ks.map(k => m[k]));
  let s = 0, t = 0; ks.forEach(k => { s += m[k] * o['w_' + k]; t += o['w_' + k]; }); return s / t;
}

/** Compare one source canvas against candidates [{cv, ...}]. Returns [{c, s, m, lb}] unsorted. */
export async function compareAll(src, cands, o, progress) {
  const base = fit(src, o), angs = [0]; if (o.rot) for (let a = o.rot; a < 360; a += o.rot) angs.push(a);
  const V = [];
  angs.forEach(a => [false, ...(o.flip ? [true] : [])].forEach(fl => [false, ...(o.neg ? [true] : [])].forEach(ng => {
    const lb = [a ? `rotated ${a}°` : '', fl ? 'mirrored' : '', ng ? 'inverted' : ''].filter(Boolean).join(', ') || 'as uploaded';
    V.push({ lb, f: feat(variant(base, a, fl), ng, o) });
  })));
  const out = [];
  for (let i = 0; i < cands.length; i++) {
    if (i % 5 === 0) { progress(i, cands.length, V.length); await tick(); }
    const cf = feat(fit(cands[i].cv, o), false, o); let best = null;
    for (const v of V) { const m = metr(v.f, cf), s = combine(m, o); if (!best || s > best.s) best = { s, m, lb: v.lb }; }
    out.push({ c: cands[i], ...best });
  }
  return out;
}
