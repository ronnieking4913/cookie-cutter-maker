// Tests for js/stamp.js: the plate fits inside the cutter and carries the inside lines.
(() => {
  const { test, expect, picture, settings, maskFor, checkMesh } = T;

  // A yellow circle with a dark smile line inside it, on white.
  const face = () => picture(400, 400, g => {
    g.fillStyle = "#fff"; g.fillRect(0, 0, 400, 400);
    g.fillStyle = "#f2c230"; g.beginPath(); g.arc(200, 200, 150, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#222"; g.lineWidth = 8; g.beginPath(); g.arc(200, 200, 80, 0.2, Math.PI - 0.2); g.stroke();
  });

  function buildStamp(over) {
    const o = settings({ stampOn: true, ...over });
    const { px, mask } = maskFor(face(), o);
    const cut = CC.cutter.build(mask, px.W, px.H, o);
    const lines = CC.stamp.lineMask(CC.stamp.edgeStrength(px), mask, o.sensitivity);
    return { o, cut, stamp: CC.stamp.build(cut, lines, px.W, px.H, o) };
  }

  test("the stamp picks up the line inside the shape", () => {
    const { stamp } = buildStamp();
    expect(stamp.ridge.reduce((a, v) => a + v, 0)).toBeGreaterThan(100, "line cells:");
  });

  test("the stamp plate stays clear of the cutter wall so it slides in", () => {
    const { cut, stamp } = buildStamp();
    for (let i = 0; i < stamp.heights.length; i++)
      if (stamp.heights[i] > 0 && cut.kind[i] !== CC.cutter.KIND.COOKIE) throw new Error("plate overlaps the cutter wall");
  });

  test("the stamp mesh is closed and every face points outwards", async () => {
    const { stamp } = buildStamp();
    const mesh = await checkMesh(CC.stl.build(stamp).blob);
    expect(mesh.openEdges).toBe(0, "open edges:");
    expect(mesh.badNormals).toBe(0, "inward-facing triangles:");
  });

  test("the stamp is a 3 mm plate with lines as tall as the Line height setting", () => {
    const { stamp } = buildStamp({ lineH: 2.4 });
    const tallest = stamp.heights.reduce((a, v) => Math.max(a, v), 0);
    const plate = stamp.heights.find((v, i) => v > 0 && !stamp.ridge[i]);
    expect(plate).toBe(3, "plate thickness (mm):");
    expect(tallest).toBeCloseTo(5.4, 0.001, "plate + line height (mm):");
  });

  test("after mirroring, the stamp still sits inside the cutter's opening", async () => {
    const { cut, stamp } = buildStamp();
    const cutterMesh = await checkMesh(CC.stl.build(cut).blob);
    const stampMesh = await checkMesh(CC.stl.build(stamp).blob);
    const rim = cut.o.wall + cut.o.flangeW; // wall + flange on each side
    expect(stampMesh.minX > cutterMesh.minX + rim).toBe(true, "stamp clear of the left wall:");
    expect(stampMesh.maxX < cutterMesh.maxX - rim).toBe(true, "stamp clear of the right wall:");
  });

  test("with the stamp on, one STL holds both objects side by side without overlapping", async () => {
    const { cut, stamp } = buildStamp();
    const alone = await checkMesh(CC.stl.build(cut).blob);
    const stampAlone = await checkMesh(CC.stl.build(stamp).blob);
    const both = await checkMesh(CC.stl.build([cut, stamp]).blob);
    expect(both.count).toBe(alone.count + stampAlone.count, "triangles:");
    expect(both.openEdges).toBe(0, "open edges:");
    expect(both.badNormals).toBe(0, "inward-facing triangles:");
    const stampWidth = stampAlone.maxX - stampAlone.minX;
    expect(both.maxX).toBeCloseTo(alone.maxX + 5 + stampWidth, 0.01, "right edge of the stamp (mm):");
  });

  test("the stamp presses in the gaps between a paw's toes and pad", () => {
    // big pad and four toes, all separate, with white gaps between them
    const paw = picture(500, 500, g => {
      g.fillStyle = "#fff"; g.fillRect(0, 0, 500, 500);
      g.fillStyle = "#6b0f24";
      g.beginPath(); g.ellipse(250, 340, 130, 110, 0, 0, Math.PI * 2); g.fill();
      for (const [x, y] of [[90, 190], [190, 110], [310, 110], [410, 190]]) {
        g.beginPath(); g.ellipse(x, y, 48, 62, 0, 0, Math.PI * 2); g.fill();
      }
    });
    const o = settings({ stampOn: true, join: true });
    const { px, mask } = maskFor(paw, o);
    const cut = CC.cutter.build(mask, px.W, px.H, o);
    const stamp = CC.stamp.build(cut, CC.stamp.lineMask(CC.stamp.edgeStrength(px), mask, o.sensitivity), px.W, px.H, o);
    // the middle of the gap between the second toe (bottom at y=172) and the pad (top at y=230)
    const t = cut.t, gx = Math.round(t.pad + (190 - t.x0) * t.k), gy = Math.round(t.pad + (201 - t.y0) * t.k);
    expect(cut.gaps[gy * cut.w + gx]).toBe(1, "is a gap:");
    expect(stamp.ridge[gy * stamp.w + gx]).toBe(1, "stamp raised there:");
  });

  test("the stamp has no tiny raised specks (nothing smaller than 4 mm²)", () => {
    // A paw with ragged, fur-like toe edges leaves scraps of gap along the cookie's edge.
    const ragged = picture(500, 500, g => {
      g.fillStyle = "#fff"; g.fillRect(0, 0, 500, 500);
      g.fillStyle = "#6b0f24";
      const blob = (cx, cy, rx, ry) => {
        g.beginPath();
        for (let a = 0; a <= 360; a += 6) {
          const r = 1 + (a % 12 === 0 ? 0.08 : 0); // jagged edge
          const p = [cx + rx * r * Math.cos(a * Math.PI / 180), cy + ry * r * Math.sin(a * Math.PI / 180)];
          a ? g.lineTo(...p) : g.moveTo(...p);
        }
        g.fill();
      };
      blob(250, 340, 130, 110);
      for (const [x, y] of [[95, 190], [190, 112], [310, 112], [405, 190]]) blob(x, y, 50, 64);
    });
    const o = settings({ stampOn: true, join: true });
    const { px, mask } = maskFor(ragged, o);
    const cut = CC.cutter.build(mask, px.W, px.H, o);
    const stamp = CC.stamp.build(cut, CC.stamp.lineMask(CC.stamp.edgeStrength(px), mask, o.sensitivity), px.W, px.H, o);
    const seen = new Uint8Array(stamp.ridge.length), cellArea = o.res * o.res;
    let smallest = Infinity;
    for (let s = 0; s < seen.length; s++) {
      if (!stamp.ridge[s] || seen[s]) continue;
      let n = 0; const q = [s]; seen[s] = 1;
      while (q.length) {
        const i = q.pop(), x = i % stamp.w; n++;
        for (const j of [x > 0 ? i - 1 : -1, x < stamp.w - 1 ? i + 1 : -1, i - stamp.w, i + stamp.w])
          if (j >= 0 && j < seen.length && stamp.ridge[j] && !seen[j]) { seen[j] = 1; q.push(j); }
      }
      smallest = Math.min(smallest, n * cellArea);
    }
    expect(smallest >= 4).toBe(true, `smallest raised piece is ${smallest.toFixed(2)} mm²:`);
  });

  test("a plain shape with no inside lines gives a flat plate", () => {
    const o = settings({ stampOn: true });
    const plain = picture(300, 300, g => { g.fillStyle = "#c33"; g.fillRect(50, 50, 200, 200); });
    const { px, mask } = maskFor(plain, o);
    const cut = CC.cutter.build(mask, px.W, px.H, o);
    const stamp = CC.stamp.build(cut, CC.stamp.lineMask(CC.stamp.edgeStrength(px), mask, o.sensitivity), px.W, px.H, o);
    expect(stamp.ridge.reduce((a, v) => a + v, 0)).toBe(0, "line cells:");
  });
})();
