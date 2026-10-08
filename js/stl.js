// Step 4: turn the height map into a closed 3D mesh and write it as a binary STL file.
window.CC = window.CC || {};

CC.stl = (() => {
  // Each raised cell becomes a block: top, bottom, and a side wall wherever the neighbor is lower.
  function triangles(r) {
    const { w, h, heights, levels, o } = r, s = o.res, tris = [];
    const quad = (a, b, c, d, n) => {
      // wind the two triangles so the face points along n (outwards)
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * n[0] + cy * n[1] + cz * n[2] < 0) tris.push(n, a, d, c, n, a, c, b);
      else tris.push(n, a, b, c, n, a, c, d);
    };
    const at = i => (i < 0 ? 0 : heights[i]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, z = heights[i];
      if (!z) continue;
      const X0 = x * s, X1 = (x + 1) * s, Y0 = (h - 1 - y) * s, Y1 = (h - y) * s;
      quad([X0, Y0, z], [X1, Y0, z], [X1, Y1, z], [X0, Y1, z], [0, 0, 1]);
      quad([X0, Y0, 0], [X1, Y0, 0], [X1, Y1, 0], [X0, Y1, 0], [0, 0, -1]);
      const sides = [
        [x < w - 1 ? i + 1 : -1, [1, 0, 0], [X1, Y0], [X1, Y1]],
        [x > 0 ? i - 1 : -1, [-1, 0, 0], [X0, Y0], [X0, Y1]],
        [y > 0 ? i - w : -1, [0, 1, 0], [X0, Y1], [X1, Y1]],
        [y < h - 1 ? i + w : -1, [0, -1, 0], [X0, Y0], [X1, Y0]],
      ];
      for (const [j, n, p, q] of sides) {
        const nz = at(j);
        if (nz >= z) continue;
        // split at every height level so neighboring faces share edges (keeps the mesh watertight)
        for (let L = 0; L < levels.length - 1; L++) {
          const za = Math.max(levels[L], nz), zb = Math.min(levels[L + 1], z);
          if (zb > za) quad([p[0], p[1], za], [q[0], q[1], za], [q[0], q[1], zb], [p[0], p[1], zb], n);
        }
      }
    }
    return tris;
  }

  // Mirror left-to-right: the part is printed face-up and flipped over to use,
  // so mirroring here makes the cookie match the picture.
  function mirrored(r) {
    const heights = new Float64Array(r.heights.length);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) heights[y * r.w + x] = r.heights[y * r.w + (r.w - 1 - x)];
    return { ...r, heights };
  }

  const PART_GAP = 5; // space between objects on the print bed, mm

  // parts: one height map, or a list of them ({ w, h, heights, levels, o: { res } }: cutter, stamp).
  // Each part becomes its own object in the same file, laid out left to right.
  function build(parts) {
    if (!Array.isArray(parts)) parts = [parts];
    let count = 0, nextX = null;
    const placed = parts.map(r => {
      const tris = triangles(mirrored(r));
      let minX = Infinity, maxX = -Infinity;
      for (let t = 0; t < tris.length; t += 4) for (let v = 1; v < 4; v++) {
        minX = Math.min(minX, tris[t + v][0]); maxX = Math.max(maxX, tris[t + v][0]);
      }
      const shift = nextX === null ? 0 : nextX - minX; // the first part stays where it is
      nextX = maxX + shift + PART_GAP;
      count += tris.length / 4;
      return { tris, shift };
    });

    const buf = new ArrayBuffer(84 + count * 50), dv = new DataView(buf);
    const header = "Cookie cutter made with Cookie Cutter Maker";
    for (let i = 0; i < header.length; i++) dv.setUint8(i, header.charCodeAt(i));
    dv.setUint32(80, count, true);
    let off = 84;
    for (const { tris, shift } of placed) {
      for (let t = 0; t < tris.length; t += 4) {
        for (let v = 0; v < 4; v++) for (let c = 0; c < 3; c++) {
          dv.setFloat32(off, tris[t + v][c] + (v > 0 && c === 0 ? shift : 0), true); off += 4;
        }
        off += 2;
      }
    }
    return { blob: new Blob([buf], { type: "model/stl" }), count };
  }

  return { build };
})();
