// Optional stamp: a flat plate that fits inside the cutter, with raised lines that press
// the picture's inside details into the cookie. Printed plate-down, lines up.
window.CC = window.CC || {};

CC.stamp = (() => {
  const PLATE = 3;        // plate thickness, mm
  const GAP = 0.6;        // space between plate and cutter wall so the stamp slides in, mm
  const EDGE_MARGIN = 1;  // keep lines this far in from the plate edge, mm
  const MIN_LINE_AREA = 1; // ignore line bits smaller than this, mm²

  // How sharply the color changes at each photo pixel (Sobel filter, strongest of R, G, B).
  // Computed once per photo.
  function edgeStrength(px) {
    const { W, H, data: d } = px, out = new Float32Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      let best = 0;
      for (let c = 0; c < 3; c++) {
        const p = (dx, dy) => d[((y + dy) * W + x + dx) * 4 + c];
        const gx = p(1, -1) + 2 * p(1, 0) + p(1, 1) - p(-1, -1) - 2 * p(-1, 0) - p(-1, 1);
        const gy = p(-1, 1) + 2 * p(0, 1) + p(1, 1) - p(-1, -1) - 2 * p(0, -1) - p(1, -1);
        best = Math.max(best, gx * gx + gy * gy);
      }
      out[y * W + x] = Math.sqrt(best);
    }
    return out;
  }

  // Detail lines inside the shape. sensitivity 1–100: higher picks up fainter lines.
  function lineMask(strength, shapeMask, sensitivity) {
    const limit = 600 - 5 * sensitivity, m = new Uint8Array(strength.length);
    for (let i = 0; i < m.length; i++) m[i] = shapeMask[i] && strength[i] > limit ? 1 : 0;
    return m;
  }

  // cut: result of CC.cutter.build (its gaps are pressed in too). lines: photo-sized mask from
  // lineMask. o: settings in mm.
  function build(cut, lines, W, H, o) {
    const { w, h, t, kind } = cut, res = o.res;
    const outside = new Uint8Array(w * h);
    for (let i = 0; i < outside.length; i++) outside[i] = kind[i] === CC.cutter.KIND.COOKIE ? 0 : 1;
    const inset = CC.shape.distance(outside, w, h); // how far each cell is inside the cookie

    const grid = CC.shape.resample(lines, W, H, t, 0, 60);
    CC.shape.removeSpecks(grid, w, h, MIN_LINE_AREA / (res * res));
    const toLine = CC.shape.distance(grid, w, h);

    const half = o.lineW / 2 / res, plateIn = GAP / res, lineIn = (GAP + EDGE_MARGIN) / res;
    const top = PLATE + o.lineH;
    const heights = new Float64Array(w * h), ridge = new Uint8Array(w * h);
    for (let i = 0; i < heights.length; i++) {
      if (inset[i] <= plateIn) continue;
      heights[i] = PLATE;
      // raised where the picture has a line, or where a gap in the picture was filled in
      if ((toLine[i] <= half || cut.gaps[i]) && inset[i] > lineIn) { heights[i] = top; ridge[i] = 1; }
    }
    return { o: { res }, w, h, heights, ridge, levels: [0, PLATE, top] };
  }

  return { edgeStrength, lineMask, build };
})();
