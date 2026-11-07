// Finds the trademark image on every PDF page by tracking where images are painted,
// then crops that region out of a rendered copy of the page. Requires the global pdfjsLib (see index.html).
const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * @param {File} file
 * @param {{mode:string,scale:number,minImg:number,pFrom:number,pTo:number}} o
 * @param {{onPage?:(p:number,last:number)=>void,onItem:(page:number,idx:number,canvas:HTMLCanvasElement)=>Promise<void>}} cb
 * @returns {Promise<{numPages:number,fallback:number}>}
 */
export async function extractPdf(file, o, cb) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER;
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const O = pdfjsLib.OPS, U = pdfjsLib.Util, a = Math.max(1, o.pFrom), b = Math.min(pdf.numPages, o.pTo > 0 ? o.pTo : pdf.numPages);
  const IMG = [O.paintImageXObject, O.paintInlineImageXObject, O.paintImageMaskXObject, O.paintJpegXObject].filter(x => x !== undefined);
  let fallback = 0;
  for (let p = a; p <= b; p++) {
    cb.onPage?.(p, b);
    const page = await pdf.getPage(p), vp = page.getViewport({ scale: o.scale }), cv = document.createElement('canvas');
    cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: x, viewport: vp }).promise;
    let boxes = [];
    if (o.mode !== 'page') {
      const ops = await page.getOperatorList(); let m = [1, 0, 0, 1, 0, 0]; const stk = [];
      ops.fnArray.forEach((fn, i) => {
        const ar = ops.argsArray[i];
        if (fn === O.save || fn === O.paintFormXObjectBegin) { stk.push(m.slice()); if (fn === O.paintFormXObjectBegin && ar[0]) m = U.transform(m, ar[0]); }
        else if (fn === O.restore || fn === O.paintFormXObjectEnd) m = stk.pop() || [1, 0, 0, 1, 0, 0];
        else if (fn === O.transform) m = U.transform(m, ar);
        else if (IMG.includes(fn)) {
          const t = U.transform(vp.transform, m), pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(q => U.applyTransform(q, t));
          const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
          const x0 = Math.max(0, Math.floor(Math.min(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys))),
            x1 = Math.min(cv.width, Math.ceil(Math.max(...xs))), y1 = Math.min(cv.height, Math.ceil(Math.max(...ys)));
          if (x1 - x0 >= o.minImg && y1 - y0 >= o.minImg && x1 - x0 > 2 && y1 - y0 > 2) boxes.push([x0, y0, x1 - x0, y1 - y0]);
        }
      });
      boxes.sort((u, v) => v[2] * v[3] - u[2] * u[3]);
      if (o.mode === 'largest') boxes = boxes.slice(0, 1);
    }
    if (!boxes.length) { boxes = [[0, 0, cv.width, cv.height]]; if (o.mode !== 'page') fallback++; }
    for (let i = 0; i < boxes.length; i++) {
      const bx = boxes[i], c = document.createElement('canvas'); c.width = bx[2]; c.height = bx[3];
      c.getContext('2d').drawImage(cv, bx[0], bx[1], bx[2], bx[3], 0, 0, bx[2], bx[3]);
      await cb.onItem(p, i, c);
    }
    page.cleanup();
  }
  return { numPages: b - a + 1, fallback };
}
