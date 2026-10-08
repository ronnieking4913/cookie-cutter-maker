// Tests for js/cutter.js and js/stl.js: sizes, wall, and a printable mesh.
(() => {
  const { test, expect, picture, settings, maskFor, checkMesh } = T;

  const circle = () => picture(400, 400, g => { g.fillStyle = "#c33"; g.beginPath(); g.arc(200, 200, 150, 0, Math.PI * 2); g.fill(); });

  test("the cookie's longest side matches the Longest side setting", () => {
    const o = settings({ size: 60 });
    const { px, mask } = maskFor(circle(), o);
    const r = CC.cutter.build(mask, px.W, px.H, o);
    let x0 = r.w, x1 = -1;
    for (let i = 0; i < r.kind.length; i++) if (r.kind[i] === CC.cutter.KIND.COOKIE) { const x = i % r.w; x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    expect((x1 - x0 + 1) * o.res).toBeCloseTo(60, 0.75, "cookie width (mm):");
  });

  test("the footprint is the cookie plus wall and flange on both sides", () => {
    const o = settings({ size: 60 });
    const { px, mask } = maskFor(circle(), o);
    const f = CC.cutter.footprint(CC.cutter.build(mask, px.W, px.H, o));
    expect(f.width).toBeCloseTo(60 + 2 * (o.wall + o.flangeW), 1, "footprint width (mm):");
  });

  test("the cutter mesh is closed and every face points outwards", async () => {
    const o = settings();
    const { px, mask } = maskFor(circle(), o);
    const mesh = await checkMesh(CC.stl.build(CC.cutter.build(mask, px.W, px.H, o)).blob);
    expect(mesh.count).toBeGreaterThan(0);
    expect(mesh.openEdges).toBe(0, "open edges:");
    expect(mesh.badNormals).toBe(0, "inward-facing triangles:");
  });

  test("the STL is mirrored left-to-right, so the cookie matches the picture after flipping the cutter", async () => {
    // one raised cell at the far left of a 3-cell row should end up at the far right
    const r = { o: { res: 1 }, w: 3, h: 1, heights: Float64Array.from([5, 0, 0]), levels: [0, 5] };
    const mesh = await checkMesh(CC.stl.build(r).blob);
    expect(mesh.minX).toBe(2, "left edge (mm):");
    expect(mesh.maxX).toBe(3, "right edge (mm):");
  });

  // Width in mm of the cells of one kind along the middle row, from the left edge inwards.
  function runWidth(r, kind) {
    const y = r.h >> 1; let x = 0;
    while (x < r.w && r.kind[y * r.w + x] !== kind) x++;
    let n = 0;
    while (x < r.w && r.kind[y * r.w + x] === kind) { n++; x++; }
    return n * r.o.res;
  }

  const build = (pic, over) => {
    const o = settings(over);
    const { px, mask } = maskFor(pic, o);
    return CC.cutter.build(mask, px.W, px.H, o);
  };

  test("the wall and flange are as thick as the settings", () => {
    const r = build(circle(), { wall: 1.2, flangeW: 4 });
    expect(runWidth(r, CC.cutter.KIND.WALL)).toBeCloseTo(1.2, 0.3, "wall (mm):");
    expect(runWidth(r, CC.cutter.KIND.FLANGE)).toBeCloseTo(4, 0.3, "flange (mm):");
  });

  test("the wall and flange are as tall as the settings", () => {
    const r = build(circle(), { height: 18, flangeH: 2 });
    const wallH = r.heights[r.kind.indexOf(CC.cutter.KIND.WALL)];
    const flangeH = r.heights[r.kind.indexOf(CC.cutter.KIND.FLANGE)];
    expect(wallH).toBe(18, "wall height (mm):");
    expect(flangeH).toBe(2, "flange height (mm):");
  });

  test("turning the flange off leaves only the wall", () => {
    const r = build(circle(), { size: 60, flangeOn: false });
    expect(r.kind.indexOf(CC.cutter.KIND.FLANGE)).toBe(-1, "flange cells found at index");
    expect(CC.cutter.footprint(r).width).toBeCloseTo(60 + 2 * 1.2, 1, "footprint width (mm):");
  });

  test("Grow outline makes the cookie bigger on every side", () => {
    const plain = build(circle(), { size: 60, grow: 0 }), grown = build(circle(), { size: 60, grow: 2 });
    const cookieWidth = r => {
      let x0 = r.w, x1 = -1;
      for (let i = 0; i < r.kind.length; i++) if (r.kind[i] === CC.cutter.KIND.COOKIE) { const x = i % r.w; x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      return (x1 - x0 + 1) * r.o.res;
    };
    expect(cookieWidth(grown) - cookieWidth(plain)).toBeCloseTo(4, 0.6, "extra width (mm):");
  });

  test("Grow outline joins pieces that are close together (like Bluey's paws and head)", () => {
    // two circles 8 px apart; the pair is 512 px wide = 80 mm, so the gap is about 1.25 mm
    const twoParts = () => picture(520, 260, g => {
      g.fillStyle = "#c33";
      g.beginPath(); g.arc(130, 130, 126, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(390, 130, 126, 0, Math.PI * 2); g.fill();
    });
    const pieces = r => {
      const m = Uint8Array.from(r.kind, k => (k === CC.cutter.KIND.COOKIE ? 1 : 0));
      const seen = new Uint8Array(m.length); let n = 0;
      for (let s = 0; s < m.length; s++) {
        if (!m[s] || seen[s]) continue;
        n++; const stack = [s]; seen[s] = 1;
        while (stack.length) {
          const i = stack.pop(), x = i % r.w;
          for (const j of [x > 0 ? i - 1 : -1, x < r.w - 1 ? i + 1 : -1, i - r.w, i + r.w])
            if (j >= 0 && j < m.length && m[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
        }
      }
      return n;
    };
    expect(pieces(build(twoParts(), { grow: 0 }))).toBe(2, "pieces without grow:");
    expect(pieces(build(twoParts(), { grow: 1 }))).toBe(1, "pieces with 1 mm grow:");
  });

  test("an empty picture gives a clear error instead of a broken file", () => {
    const o = settings();
    const blank = picture(100, 100, () => {});
    const { px, mask } = maskFor(blank, o);
    expect(() => CC.cutter.build(mask, px.W, px.H, o)).toThrow();
  });
})();
