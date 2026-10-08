// Step 2: turn the shape mask into a clean grid measured in millimeters.
window.CC = window.CC || {};

CC.shape = (() => {
  // Square min/max filter using running sums. mode "erode" keeps a pixel only if the
  // whole window is shape; "dilate" sets it if any pixel in the window is shape.
  function boxFilter(m, W, H, r, mode) {
    const pass = (src, len, count, idx) => {
      const out = new Uint8Array(src.length), pre = new Int32Array(len + 1);
      for (let line = 0; line < count; line++) {
        for (let k = 0; k < len; k++) pre[k + 1] = pre[k] + src[idx(line, k)];
        for (let k = 0; k < len; k++) {
          const a = Math.max(0, k - r), b = Math.min(len - 1, k + r), sum = pre[b + 1] - pre[a];
          out[idx(line, k)] = mode === "erode" ? (sum === 2 * r + 1 ? 1 : 0) : (sum > 0 ? 1 : 0);
        }
      }
      return out;
    };
    const rows = pass(m, W, H, (y, x) => y * W + x);
    return pass(rows, H, W, (x, y) => y * W + x);
  }

  // Removes thin leftovers such as the faint halo between two background colors.
  function openMask(m, W, H) {
    const r = Math.max(1, Math.round(Math.max(W, H) / 400));
    return boxFilter(boxFilter(m, W, H, r, "erode"), W, H, r, "dilate");
  }

  // Where the shape lands on the millimeter grid: crop to the shape, scale so its longest
  // side is o.size mm, cells of o.res mm, with room around it for the wall and flange.
  function gridTransform(mask, W, H, o) {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let i = 0; i < mask.length; i++) if (mask[i]) {
      const x = i % W, y = (i / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 < 0) throw new Error("No shape found. Click Reset background, or lower the color tolerance.");
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const k = (o.size / Math.max(bw, bh)) / o.res; // grid cells per photo pixel
    const pad = Math.ceil((o.grow + o.wall + (o.flangeOn ? o.flangeW : 0)) / o.res) + 3;
    const w = Math.ceil(bw * k) + 2 * pad, h = Math.ceil(bh * k) + 2 * pad;
    if (w * h > 9e6) throw new Error("That size is too large at this detail level. Use a smaller size or Draft detail.");
    return { x0, y0, bw, bh, k, pad, w, h };
  }

  // Sample any photo-sized mask onto the grid described by t.
  function resample(mask, W, H, t, blurPx = 0, threshold = 127) {
    const src = document.createElement("canvas"); src.width = W; src.height = H;
    const sg = src.getContext("2d"), img = sg.createImageData(W, H);
    for (let i = 0; i < mask.length; i++) { const v = mask[i] ? 255 : 0; img.data.set([v, v, v, 255], i * 4); }
    sg.putImageData(img, 0, 0);

    const c = document.createElement("canvas"); c.width = t.w; c.height = t.h;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#000"; g.fillRect(0, 0, t.w, t.h);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    if (blurPx > 0) g.filter = `blur(${blurPx}px)`;
    g.drawImage(src, t.x0, t.y0, t.bw, t.bh, t.pad, t.pad, t.bw * t.k, t.bh * t.k);
    const q = g.getImageData(0, 0, t.w, t.h).data, m = new Uint8Array(t.w * t.h);
    for (let i = 0; i < m.length; i++) m[i] = q[i * 4] > threshold ? 1 : 0;
    return m;
  }

  function toGrid(mask, W, H, o) {
    const t = gridTransform(mask, W, H, o);
    const m = resample(mask, W, H, t, o.smooth > 0 ? o.smooth * 0.25 / o.res : 0);
    return { m, w: t.w, h: t.h, t };
  }

  // Drop separate pieces smaller than minCells (default: 1% of the biggest piece).
  function removeSpecks(m, w, h, minCells) {
    const lab = new Int32Array(w * h).fill(-1), sizes = [], stack = [];
    for (let s = 0; s < m.length; s++) {
      if (!m[s] || lab[s] >= 0) continue;
      const id = sizes.length; let n = 0; stack.push(s); lab[s] = id;
      while (stack.length) {
        const i = stack.pop(), x = i % w, y = (i / w) | 0; n++;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
          if (j >= 0 && m[j] && lab[j] < 0) { lab[j] = id; stack.push(j); }
      }
      sizes.push(n);
    }
    const min = minCells ?? Math.max(0, ...sizes) * 0.01;
    for (let i = 0; i < m.length; i++) if (m[i] && sizes[lab[i]] < min) m[i] = 0;
  }

  function countPieces(m, w, h) {
    const seen = new Uint8Array(w * h), stack = [];
    let n = 0;
    for (let s = 0; s < m.length; s++) {
      if (!m[s] || seen[s]) continue;
      n++; seen[s] = 1; stack.push(s);
      while (stack.length) {
        const i = stack.pop(), x = i % w, y = (i / w) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
          if (j >= 0 && m[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    return n;
  }

  // Morphological closing with a round brush of radius r cells: grow by r, then shrink back by r.
  // Fills gaps narrower than about 2r without making the outside of the shape any bigger.
  function close(m, w, h, r) {
    const grown = new Uint8Array(w * h), outside = new Uint8Array(w * h);
    const d = distance(m, w, h);
    for (let i = 0; i < m.length; i++) grown[i] = d[i] <= r ? 1 : 0;
    for (let i = 0; i < m.length; i++) {
      const x = i % w, y = (i / w) | 0;
      // treat the grid's border as outside, so the shrink step works near the edges too
      outside[i] = !grown[i] || x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 1 : 0;
    }
    const back = distance(outside, w, h), out = new Uint8Array(w * h);
    for (let i = 0; i < m.length; i++) out[i] = m[i] || back[i] > r ? 1 : 0;
    return out;
  }

  // Join separate pieces (like a paw's toes and pad) into one outline, using the
  // smallest closing that does it. Gives up at maxCells and returns the best it found.
  function joinPieces(m, w, h, maxCells) {
    if (countPieces(m, w, h) <= 1) return m;
    let lo = 1, hi = Math.max(1, Math.round(maxCells)), best = close(m, w, h, hi);
    if (countPieces(best, w, h) > 1) return best;
    while (lo < hi) {
      const mid = (lo + hi) >> 1, joined = close(m, w, h, mid);
      if (countPieces(joined, w, h) <= 1) { hi = mid; best = joined; } else lo = mid + 1;
    }
    return best;
  }

  // Anything enclosed by the shape becomes part of the shape.
  function fillHoles(m, w, h) {
    const seen = new Uint8Array(w * h), stack = [];
    const push = i => { if (!m[i] && !seen[i]) { seen[i] = 1; stack.push(i); } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0;
      if (x > 0) push(i - 1); if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w); if (y < h - 1) push(i + w);
    }
    for (let i = 0; i < m.length; i++) if (!m[i] && !seen[i]) m[i] = 1;
  }

  // Exact distance (in cells) from every cell to the nearest cell where m is 1 (Felzenszwalb & Huttenlocher).
  function distance(m, w, h) {
    const INF = 1e20, f = new Float64Array(w * h);
    for (let i = 0; i < f.length; i++) f[i] = m[i] ? 0 : INF;
    const n = Math.max(w, h), z = new Float64Array(n + 1), v = new Int32Array(n), tmp = new Float64Array(n), out = new Float64Array(n);
    function pass(get, set, len) {
      for (let i = 0; i < len; i++) tmp[i] = get(i);
      let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
      for (let q = 1; q < len; q++) {
        let s;
        while (true) {
          const r = v[k];
          s = ((tmp[q] + q * q) - (tmp[r] + r * r)) / (2 * q - 2 * r);
          if (s <= z[k]) { k--; if (k < 0) { k = 0; break; } } else break;
        }
        k++; v[k] = q; z[k] = s; z[k + 1] = INF;
      }
      k = 0;
      for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; const r = v[k]; out[q] = (q - r) * (q - r) + tmp[r]; }
      for (let i = 0; i < len; i++) set(i, out[i]);
    }
    for (let x = 0; x < w; x++) pass(y => f[y * w + x], (y, val) => f[y * w + x] = val, h);
    for (let y = 0; y < h; y++) pass(x => f[y * w + x], (x, val) => f[y * w + x] = val, w);
    for (let i = 0; i < f.length; i++) f[i] = Math.sqrt(f[i]);
    return f;
  }

  return { openMask, toGrid, resample, removeSpecks, countPieces, joinPieces, fillHoles, distance };
})();
