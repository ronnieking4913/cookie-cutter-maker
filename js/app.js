// Connects the page's controls to the steps: background.js → cutter.js (+ stamp.js) → stl.js.
(() => {
  const $ = id => document.getElementById(id);

  const state = {
    name: "heart",
    px: null,        // photo pixels (CC.background.readPixels)
    strength: null,  // how sharp the color change is at each pixel, for stamp lines
    removed: null,   // 1 = background pixel
    strokes: [],     // each click or drag on the picture: a list of [x, y] spots removed.
                     // Replayed when tolerance changes; right-click undoes the last one.
    mask: null,      // 1 = cookie shape
    result: null,    // latest cutter (CC.cutter.build)
    stamp: null,     // latest stamp (CC.stamp.build), or null when the stamp is off
  };

  function readSettings() {
    return {
      bgMode: $("bgMode").value, tolerance: +$("tolerance").value,
      join: $("join").checked, fill: $("fill").checked, specks: $("specks").checked, smooth: +$("smooth").value,
      size: +$("size").value, grow: +$("grow").value, height: +$("height").value, wall: +$("wall").value,
      flangeOn: $("flangeOn").checked, flangeW: +$("flangeW").value, flangeH: +$("flangeH").value,
      res: +$("res").value,
      stampOn: $("stampOn").checked, sensitivity: +$("sensitivity").value,
      lineW: +$("lineW").value, lineH: +$("lineH").value,
    };
  }

  const usesAlpha = o => o.bgMode === "alpha" || (o.bgMode === "auto" && state.px.hasAlpha);

  // Shape mask with thin halos and (optionally) specks cleaned away, then shown in the picture preview.
  function refreshMask() {
    const { px } = state, o = readSettings();
    const m = CC.shape.openMask(CC.background.shapeMask(px, state.removed, usesAlpha(o)), px.W, px.H);
    if (o.specks) CC.shape.removeSpecks(m, px.W, px.H);
    state.mask = m;
    CC.preview.photo($("photo"), px, m);
  }

  // ---- background (re-run when the photo, mode or tolerance changes) ----
  function updateBackground() {
    const o = readSettings(), px = state.px;
    if (usesAlpha(o)) state.removed = new Uint8Array(px.W * px.H);
    else {
      state.removed = CC.background.replay(px, o.tolerance, state.strokes);
    }
    refreshMask();
    $("photoHint").textContent = usesAlpha(o)
      ? "Using the picture's transparent background."
      : "Click or drag over anything that's still background to remove it. Right-click to undo.";
    updateCutter();
  }

  // ---- cutter and stamp (re-run when any size or stamp setting changes) ----
  function updateCutter() {
    const o = readSettings();
    $("stampControls").hidden = !o.stampOn;
    $("stampLegend").hidden = !o.stampOn;
    try {
      state.result = CC.cutter.build(state.mask, state.px.W, state.px.H, o);
      state.stamp = null;
      if (o.stampOn) {
        state.strength = state.strength || CC.stamp.edgeStrength(state.px);
        const lines = CC.stamp.lineMask(state.strength, state.mask, o.sensitivity);
        state.stamp = CC.stamp.build(state.result, lines, state.px.W, state.px.H, o);
      }
      CC.preview.cutter($("cutter"), state.result, state.stamp);
      const f = CC.cutter.footprint(state.result), r = state.result.o;
      $("stats").innerHTML =
        `<div><dt>Footprint</dt><dd>${f.width.toFixed(1)} × ${f.depth.toFixed(1)} mm</dd></div>` +
        `<div><dt>Height</dt><dd>${r.height} mm</dd></div>` +
        `<div><dt>Wall</dt><dd>${r.wall} mm</dd></div>`;
      showError("");
      $("save").disabled = false;
    } catch (e) {
      showError(e.message);
      $("save").disabled = true;
    }
  }

  function showError(msg) { $("err").textContent = msg; $("err").hidden = !msg; }

  let timer;
  const later = fn => { clearTimeout(timer); timer = setTimeout(fn, 120); };

  // ---- loading a picture ----
  function loadImage(img, name) {
    state.px = CC.background.readPixels(img);
    state.strength = null;
    state.name = name; state.strokes = [];
    updateBackground();
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith("image/")) { showError("That file isn't an image. Use a PNG, JPG, WEBP or AVIF."); return; }
    const img = new Image();
    img.onload = () => {
      $("fname").textContent = file.name;
      $("thumb").src = img.src; $("thumb").hidden = false;
      loadImage(img, file.name.replace(/\.[^.]+$/, ""));
    };
    img.onerror = () => showError("Couldn't read that image. Try saving it as PNG or JPG.");
    img.src = URL.createObjectURL(file);
  }

  function sampleHeart() {
    const c = document.createElement("canvas"); c.width = c.height = 400;
    const g = c.getContext("2d");
    g.fillStyle = "#c33"; g.beginPath(); g.moveTo(200, 360);
    g.bezierCurveTo(40, 250, 20, 140, 90, 80); g.bezierCurveTo(140, 40, 190, 70, 200, 120);
    g.bezierCurveTo(210, 70, 260, 40, 310, 80); g.bezierCurveTo(380, 140, 360, 250, 200, 360);
    g.fill();
    return c;
  }

  // ---- saving ----
  // One STL file: the cutter, plus the stamp as a second object when the stamp is on.
  function save() {
    if (!state.result) return;
    const btn = $("save"), label = btn.textContent;
    btn.disabled = true; btn.textContent = "Building…";
    setTimeout(() => {
      const parts = state.stamp ? [state.result, state.stamp] : [state.result];
      const { blob, count } = CC.stl.build(parts);
      const file = `${state.name}-${state.stamp ? "cutter-and-stamp" : "cutter"}.stl`;
      download(blob, file);
      btn.disabled = false; btn.textContent = label;
      $("saved").textContent = `Saved ${file} · ${(blob.size / 1e6).toFixed(1)} MB · ${count.toLocaleString()} triangles`;
    }, 30);
  }

  // The picture as edited (background removed), as a PNG with a transparent background.
  // Loading it again later gives the same outline, since the app uses its transparency.
  function savePicture() {
    CC.preview.photo(document.createElement("canvas"), state.px, state.mask).toBlob(blob => {
      const file = `${state.name}-edited.png`;
      download(blob, file);
      $("saved").textContent = `Saved ${file}`;
    }, "image/png");
  }

  function download(blob, file) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = file;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ---- wiring ----
  ["bgMode", "tolerance", "specks"].forEach(id => $(id).addEventListener("input", () => later(updateBackground)));
  document.querySelectorAll("#sizeControls input, #sizeControls select, #cleanup input, #stampOn, #stampControls input")
    .forEach(el => el.addEventListener("input", () => later(updateCutter)));
  $("tolerance").addEventListener("input", e => { $("tolVal").textContent = e.target.value; });
  $("sensitivity").addEventListener("input", e => { $("sensVal").textContent = e.target.value; });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change",
    () => state.result && CC.preview.cutter($("cutter"), state.result, state.stamp));

  // ---- removing background by clicking or dragging on the picture ----
  const photo = $("photo");

  // Where the pointer is in picture pixels, or null over the empty space around the picture.
  // The picture is scaled to fit inside the canvas box (CSS object-fit), so work out where it sits.
  function pictureSpot(e) {
    const rect = photo.getBoundingClientRect(), { W, H } = state.px;
    const scale = Math.min(rect.width / W, rect.height / H);
    const left = rect.left + (rect.width - W * scale) / 2, top = rect.top + (rect.height - H * scale) / 2;
    const x = Math.floor((e.clientX - left) / scale), y = Math.floor((e.clientY - top) / scale);
    return x < 0 || y < 0 || x >= state.px.W || y >= state.px.H ? null : [x, y];
  }

  let stroke = null, last = null, frame = 0;

  // Remove whatever is under the pointer, plus everything along the way since the last position.
  function removeAlong(e) {
    const spot = pictureSpot(e);
    if (!spot) { last = null; return; }
    stroke.push(...CC.background.removeAlongLine(state.px, state.removed, last || spot, spot, +$("tolerance").value));
    last = spot;
    // quick preview while dragging; the full clean-up and cutter happen when the button is released
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      CC.preview.photo(photo, state.px, CC.background.shapeMask(state.px, state.removed, false));
    });
  }

  photo.addEventListener("pointerdown", e => {
    if (e.button !== 0 || usesAlpha(readSettings())) return;
    try { photo.setPointerCapture(e.pointerId); } catch { /* keep going without capture */ }
    stroke = []; last = null;
    removeAlong(e);
  });
  photo.addEventListener("pointermove", e => { if (stroke) removeAlong(e); });
  const finishStroke = () => {
    if (!stroke) return;
    if (stroke.length) state.strokes.push(stroke);
    stroke = null; last = null;
    if (frame) { cancelAnimationFrame(frame); frame = 0; } // don't let a late quick preview cover the final one
    refreshMask();
    updateCutter();
  };
  photo.addEventListener("pointerup", finishStroke);
  photo.addEventListener("pointercancel", finishStroke);

  // Undo the last click or drag: right-click on the picture, or Ctrl+Z.
  function undo() {
    if (!state.strokes.length || usesAlpha(readSettings())) return;
    state.strokes.pop();
    updateBackground();
  }
  photo.addEventListener("contextmenu", e => { e.preventDefault(); undo(); });
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !/INPUT|SELECT/.test(document.activeElement.tagName)) {
      e.preventDefault(); undo();
    }
  });
  $("resetBg").addEventListener("click", () => { state.strokes = []; updateBackground(); });

  const drop = $("drop");
  drop.addEventListener("click", () => $("file").click());
  drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file").click(); } });
  $("file").addEventListener("change", e => loadFile(e.target.files[0]));
  ["dragenter", "dragover"].forEach(t => document.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => document.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
  document.addEventListener("drop", e => loadFile(e.dataTransfer.files[0]));
  $("save").addEventListener("click", save);
  $("savePicture").addEventListener("click", savePicture);

  loadImage(sampleHeart(), "heart");
})();
