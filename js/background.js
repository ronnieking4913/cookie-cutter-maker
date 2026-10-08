// Step 1: read the photo and work out which pixels are background.
// Works like GIMP's magic wand: flood-fill from a starting pixel through
// neighboring pixels whose color is close to the starting color.
window.CC = window.CC || {};

CC.background = (() => {
  const MAX_SIDE = 1400; // larger photos are scaled down first; plenty of detail for a cutter

  // Draw the image onto a canvas and return its pixels.
  function readPixels(img) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const k = Math.min(1, MAX_SIDE / Math.max(iw, ih));
    const W = Math.max(1, Math.round(iw * k)), H = Math.max(1, Math.round(ih * k));
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    const data = g.getImageData(0, 0, W, H).data;
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] < 128) transparent++;
    return { W, H, data, hasAlpha: transparent > W * H * 0.01 };
  }

  const colorKey = (d, i) => ((d[i * 4] >> 5) << 6) | ((d[i * 4 + 1] >> 5) << 3) | (d[i * 4 + 2] >> 5);

  // Keep only the candidate pixels whose color is common among the candidates.
  function commonColorSeeds(px, candidates, minShare, topOnly) {
    const count = new Map();
    for (const i of candidates) { const k = colorKey(px.data, i); count.set(k, (count.get(k) || 0) + 1); }
    let keep = [...count].filter(([, n]) => n >= candidates.length * minShare).sort((a, b) => b[1] - a[1]);
    if (topOnly) keep = keep.slice(0, 1);
    const keys = new Set(keep.map(([k]) => k));
    return candidates.filter(i => keys.has(colorKey(px.data, i)));
  }

  // Magic-wand flood fill. Each seed spreads to neighbors within `tol` of the seed's own color.
  function flood(px, removed, seeds, tol) {
    const { W, H, data: d } = px, q = [];
    const tol2 = tol * tol;
    for (const s of seeds) if (!removed[s]) { removed[s] = 1; q.push(s, d[s * 4], d[s * 4 + 1], d[s * 4 + 2]); }
    while (q.length) {
      const b = q.pop(), g = q.pop(), r = q.pop(), i = q.pop();
      const x = i % W, y = (i / W) | 0;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of nb) {
        if (j < 0 || removed[j]) continue;
        const dr = d[j * 4] - r, dg = d[j * 4 + 1] - g, db = d[j * 4 + 2] - b;
        if (dr * dr + dg * dg + db * db <= tol2) { removed[j] = 1; q.push(j, r, g, b); }
      }
    }
  }

  // How much of its own bounding box the remaining (not removed) area fills.
  // Close to 1 means what's left is still a solid rectangle, i.e. more background.
  function remainingFill(px, removed) {
    const { W, H } = px;
    let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
    for (let i = 0; i < W * H; i++) {
      if (removed[i]) continue;
      const x = i % W, y = (i / W) | 0; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return n ? n / ((x1 - x0 + 1) * (y1 - y0 + 1)) : 0;
  }

  function boundaryPixels(px, removed) {
    const { W, H } = px, out = [];
    for (let i = 0; i < W * H; i++) {
      if (removed[i]) continue;
      const x = i % W, y = (i / W) | 0;
      if ((x > 0 && removed[i - 1]) || (x < W - 1 && removed[i + 1]) ||
          (y > 0 && removed[i - W]) || (y < H - 1 && removed[i + W])) out.push(i);
    }
    return out;
  }

  // Automatic removal: flood in from the picture's edges, then keep peeling
  // layers (like a frame, then a colored backdrop) while what's left is still rectangular.
  function autoRemove(px, tol) {
    const { W, H } = px, removed = new Uint8Array(W * H);
    const edge = [];
    for (let x = 0; x < W; x++) edge.push(x, (H - 1) * W + x);
    for (let y = 1; y < H - 1; y++) edge.push(y * W, y * W + W - 1);
    flood(px, removed, commonColorSeeds(px, edge, 0.1, false), tol);
    const left = r => r.reduce((n, v) => n + (v ? 0 : 1), 0);
    for (let pass = 0; pass < 4 && remainingFill(px, removed) > 0.85; pass++) {
      const seeds = commonColorSeeds(px, boundaryPixels(px, removed), 0.3, true);
      if (!seeds.length) break;
      const trial = removed.slice();
      flood(px, trial, seeds, tol);
      // A layer that takes away nearly everything left was the shape itself (e.g. a rectangular cookie).
      if (left(trial) < left(removed) * 0.05) break;
      removed.set(trial);
    }
    return removed;
  }

  // Manual removal: the user clicked a spot that is still background.
  function removeAt(px, removed, x, y, tol) {
    const i = Math.min(px.H - 1, Math.max(0, y)) * px.W + Math.min(px.W - 1, Math.max(0, x));
    flood(px, removed, [i], tol);
  }

  // Dragging: remove whatever lies along the line from one pointer position to the next,
  // checking every 2 px so a quick drag doesn't skip pieces. Returns the spots it removed from,
  // so the drag can be replayed later.
  function removeAlongLine(px, removed, from, to, tol) {
    const spots = [], steps = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 2));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(from[0] + (to[0] - from[0]) * s / steps), y = Math.round(from[1] + (to[1] - from[1]) * s / steps);
      if (removed[y * px.W + x]) continue; // already background
      spots.push([x, y]);
      removeAt(px, removed, x, y, tol);
    }
    return spots;
  }

  // Background from scratch: automatic removal plus every click or drag (stroke) the user made.
  // Undo is replaying without the last stroke.
  function replay(px, tol, strokes) {
    const removed = autoRemove(px, tol);
    for (const stroke of strokes) for (const [x, y] of stroke) removeAt(px, removed, x, y, tol);
    return removed;
  }

  // 1 = part of the cookie shape, 0 = background.
  function shapeMask(px, removed, useAlpha) {
    const n = px.W * px.H, m = new Uint8Array(n);
    for (let i = 0; i < n; i++) m[i] = useAlpha ? (px.data[i * 4 + 3] > 127 ? 1 : 0) : (removed[i] ? 0 : 1);
    return m;
  }

  return { readPixels, autoRemove, removeAt, removeAlongLine, replay, shapeMask };
})();
