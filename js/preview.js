// Drawing the two previews: the photo with its background knocked out, and the cutter seen from above.
window.CC = window.CC || {};

CC.preview = (() => {
  const token = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  function rgb(color) {
    const c = document.createElement("canvas").getContext("2d");
    c.fillStyle = color; c.fillRect(0, 0, 1, 1);
    return c.getImageData(0, 0, 1, 1).data;
  }

  // Background pixels become transparent, so the checkerboard behind the canvas shows through.
  // Also used to save the edited picture as a PNG (with a new canvas).
  function photo(canvas, px, mask) {
    canvas.width = px.W; canvas.height = px.H;
    const g = canvas.getContext("2d"), img = g.createImageData(px.W, px.H);
    img.data.set(px.data);
    for (let i = 0; i < mask.length; i++) if (!mask[i]) img.data[i * 4 + 3] = 0;
    g.putImageData(img, 0, 0);
    return canvas;
  }

  // stamp is optional; when given, its raised lines are drawn on the cookie.
  function cutter(canvas, r, stamp) {
    const K = CC.cutter.KIND, pal = [];
    pal[K.NONE] = rgb(token("--paper")); pal[K.COOKIE] = rgb(token("--dough"));
    pal[K.WALL] = rgb(token("--wall")); pal[K.FLANGE] = rgb(token("--flange"));
    const line = rgb(token("--stamp"));
    const off = document.createElement("canvas"); off.width = r.w; off.height = r.h;
    const og = off.getContext("2d"), img = og.createImageData(r.w, r.h);
    for (let i = 0; i < r.kind.length; i++) {
      const c = stamp && stamp.ridge[i] ? line : pal[r.kind[i]];
      img.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    og.putImageData(img, 0, 0);

    const fit = Math.min(1000 / r.w, 1000 / r.h);
    canvas.width = Math.round(r.w * fit); canvas.height = Math.round(r.h * fit);
    const g = canvas.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(off, 0, 0, canvas.width, canvas.height);

    // 10 mm grid, like a cutting mat
    const step = (10 / r.o.res) * fit;
    g.strokeStyle = token("--grid"); g.lineWidth = 1; g.globalAlpha = 0.6;
    g.beginPath();
    for (let x = 0; x <= canvas.width; x += step) { g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, canvas.height); }
    for (let y = 0; y <= canvas.height; y += step) { g.moveTo(0, Math.round(y) + 0.5); g.lineTo(canvas.width, Math.round(y) + 0.5); }
    g.stroke(); g.globalAlpha = 1;
  }

  return { photo, cutter };
})();
