// Step 3: decide how tall every grid cell is: cutting wall, flange, or nothing.
window.CC = window.CC || {};

CC.cutter = (() => {
  const KIND = { NONE: 0, COOKIE: 1, WALL: 2, FLANGE: 3 };
  // "One outline around everything" (only when the picture has more than one piece):
  const FILL_GAP = 6;       // gaps between pieces up to this wide are always filled, mm
  const MAX_JOIN_GAP = 30;  // pieces further apart than this stay separate, mm

  // mask: cleaned shape mask (full photo size, W x H). o: settings in mm.
  function build(mask, W, H, o) {
    o = { ...o, flangeH: Math.min(o.flangeH, o.height) };
    const grid = CC.shape.toGrid(mask, W, H, o), { w, h, t } = grid;
    let m = grid.m;
    if (o.specks) CC.shape.removeSpecks(m, w, h);
    const picture = m.slice(); // the shape exactly as in the picture, before gaps are filled
    // Count pieces in the full-size picture: at cookie size, nearby pieces can touch at a
    // point and look like one piece while still leaving deep gaps between them.
    if (o.join && CC.shape.countPieces(mask, W, H) > 1)
      m = CC.shape.joinPieces(m, w, h, FILL_GAP / 2 / o.res, MAX_JOIN_GAP / 2 / o.res);
    if (o.fill) CC.shape.fillHoles(m, w, h);
    const d = CC.shape.distance(m, w, h);

    // Gaps: parts of the cookie that were background in the picture (between a paw's toes,
    // or holes that got filled). The stamp presses these in, so the cookie keeps those details.
    const gaps = new Uint8Array(w * h);
    for (let i = 0; i < gaps.length; i++) gaps[i] = m[i] && !picture[i] ? 1 : 0;

    const grow = o.grow / o.res, wall = grow + o.wall / o.res, flange = wall + (o.flangeOn ? o.flangeW / o.res : 0);
    const heights = new Float64Array(w * h), kind = new Uint8Array(w * h);
    for (let i = 0; i < heights.length; i++) {
      if (m[i] || d[i] <= grow) kind[i] = KIND.COOKIE;
      else if (d[i] <= wall) { kind[i] = KIND.WALL; heights[i] = o.height; }
      else if (o.flangeOn && d[i] <= flange) { kind[i] = KIND.FLANGE; heights[i] = o.flangeH; }
    }
    // Every distinct height, so the mesh can split side walls at the same levels.
    const levels = [...new Set([0, o.height, ...(o.flangeOn ? [o.flangeH] : [])])].sort((a, b) => a - b);
    // t (where the photo sits on the grid) is kept so the stamp can line up with the cutter.
    return { o, w, h, t, heights, kind, levels, gaps };
  }

  // Outer size of the printed part in mm.
  function footprint(r) {
    let x0 = r.w, x1 = -1, y0 = r.h, y1 = -1;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.heights[y * r.w + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { width: (x1 - x0 + 1) * r.o.res, depth: (y1 - y0 + 1) * r.o.res };
  }

  return { build, footprint, KIND };
})();
