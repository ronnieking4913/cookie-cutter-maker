// A tiny test runner, in the spirit of Jest/pytest: test("name", fn) + assertions.
// Open tests/index.html in the browser to run every test file.
const T = (() => {
  const tests = [];
  const test = (name, fn) => tests.push({ name, fn });

  const expect = actual => ({
    toBe: (expected, msg = "") => {
      if (actual !== expected) throw new Error(`${msg} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeCloseTo: (expected, tolerance, msg = "") => {
      if (Math.abs(actual - expected) > tolerance) throw new Error(`${msg} expected ${expected} ± ${tolerance}, got ${actual}`);
    },
    toBeGreaterThan: (n, msg = "") => {
      if (!(actual > n)) throw new Error(`${msg} expected more than ${n}, got ${actual}`);
    },
    toThrow: (msg = "") => {
      try { actual(); } catch { return; }
      throw new Error(`${msg} expected an error, but none was thrown`);
    },
  });

  // ---- shared helpers ----

  // Draw a test picture on a canvas: draw(g) gets the 2D context.
  function picture(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"));
    return c;
  }

  // Default settings, same as the page's defaults. Override any of them per test.
  const settings = over => ({
    bgMode: "auto", tolerance: 40, join: true, fill: true, specks: true, smooth: 2,
    size: 80, grow: 0, height: 15, wall: 1.2, flangeOn: true, flangeW: 4, flangeH: 1.6, res: 0.25,
    stampOn: false, sensitivity: 50, lineW: 1.2, lineH: 2, ...over,
  });

  // Picture → cleaned shape mask, exactly like the app does it.
  function maskFor(canvas, o) {
    const px = CC.background.readPixels(canvas);
    const removed = px.hasAlpha ? new Uint8Array(px.W * px.H) : CC.background.autoRemove(px, o.tolerance);
    const mask = CC.shape.openMask(CC.background.shapeMask(px, removed, px.hasAlpha), px.W, px.H);
    return { px, mask };
  }

  // Read a binary STL back and check it's printable: every edge is shared by exactly two
  // triangles going opposite ways (closed, no holes) and every normal points outwards.
  async function checkMesh(blob) {
    const dv = new DataView(await blob.arrayBuffer()), count = dv.getUint32(80, true);
    const edges = new Map(); let badNormals = 0, off = 84, minX = Infinity, maxX = -Infinity;
    for (let t = 0; t < count; t++, off += 50) {
      const n = [0, 1, 2].map(i => dv.getFloat32(off + i * 4, true));
      const P = [0, 1, 2].map(k => [0, 1, 2].map(i => dv.getFloat32(off + 12 + k * 12 + i * 4, true)));
      P.forEach(p => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); });
      const u = P[1].map((x, i) => x - P[0][i]), v = P[2].map((x, i) => x - P[0][i]);
      const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (c[0] * n[0] + c[1] * n[1] + c[2] * n[2] <= 0) badNormals++;
      const key = P.map(p => p.map(x => x.toFixed(3)).join(","));
      for (let k = 0; k < 3; k++) { const e = key[k] + "|" + key[(k + 1) % 3]; edges.set(e, (edges.get(e) || 0) + 1); }
    }
    let openEdges = 0;
    for (const [e, n] of edges) { const [a, b] = e.split("|"); if ((edges.get(b + "|" + a) || 0) !== n) openEdges++; }
    return { count, badNormals, openEdges, minX, maxX };
  }

  // ---- run everything and show the results on the page ----
  async function run() {
    const list = document.getElementById("results");
    let passed = 0;
    for (const t of tests) {
      const li = document.createElement("li");
      const start = performance.now();
      try {
        await t.fn();
        passed++; li.className = "pass"; li.textContent = `✓ ${t.name}`;
      } catch (e) {
        li.className = "fail"; li.textContent = `✗ ${t.name}: ${e.message}`;
        console.error(t.name, e);
      }
      li.dataset.ms = Math.round(performance.now() - start) + " ms";
      list.appendChild(li);
    }
    const summary = document.getElementById("summary");
    summary.textContent = `${passed} of ${tests.length} tests passed`;
    summary.className = passed === tests.length ? "pass" : "fail";
  }

  return { test, expect, picture, settings, maskFor, checkMesh, run };
})();
