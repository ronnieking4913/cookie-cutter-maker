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

  test("a plain shape with no inside lines gives a flat plate", () => {
    const o = settings({ stampOn: true });
    const plain = picture(300, 300, g => { g.fillStyle = "#c33"; g.fillRect(50, 50, 200, 200); });
    const { px, mask } = maskFor(plain, o);
    const cut = CC.cutter.build(mask, px.W, px.H, o);
    const stamp = CC.stamp.build(cut, CC.stamp.lineMask(CC.stamp.edgeStrength(px), mask, o.sensitivity), px.W, px.H, o);
    expect(stamp.ridge.reduce((a, v) => a + v, 0)).toBe(0, "line cells:");
  });
})();
