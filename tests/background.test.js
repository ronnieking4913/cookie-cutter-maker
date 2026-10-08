// Tests for js/background.js: telling the shape apart from the background.
(() => {
  const { test, expect, picture } = T;

  // White frame, light-blue backdrop, dark square in the middle (like a photo of a framed print).
  const framedSquare = () => picture(300, 300, g => {
    g.fillStyle = "#fff"; g.fillRect(0, 0, 300, 300);
    g.fillStyle = "#8fd0e8"; g.fillRect(30, 30, 240, 240);
    g.fillStyle = "#223"; g.fillRect(110, 110, 80, 80);
  });

  const countShape = (px, removed) => {
    const m = CC.background.shapeMask(px, removed, false);
    return m.reduce((a, v) => a + v, 0);
  };

  test("removes a white frame and a colored backdrop, keeping only the shape", () => {
    const px = CC.background.readPixels(framedSquare());
    const removed = CC.background.autoRemove(px, 40);
    expect(countShape(px, removed)).toBe(80 * 80, "shape pixels:");
  });

  test("keeps a rectangular cookie instead of mistaking it for another background layer", () => {
    const px = CC.background.readPixels(picture(300, 300, g => {
      g.fillStyle = "#fff"; g.fillRect(0, 0, 300, 300);
      g.fillStyle = "#c33"; g.fillRect(60, 80, 180, 140);
    }));
    expect(countShape(px, CC.background.autoRemove(px, 40))).toBe(180 * 140, "shape pixels:");
  });

  test("uses transparency when the picture has a transparent background", () => {
    const px = CC.background.readPixels(picture(100, 100, g => { g.fillStyle = "#c33"; g.fillRect(25, 25, 50, 50); }));
    expect(px.hasAlpha).toBe(true);
    const m = CC.background.shapeMask(px, new Uint8Array(px.W * px.H), true);
    expect(m.reduce((a, v) => a + v, 0)).toBe(50 * 50, "shape pixels:");
  });

  test("clicking a leftover area removes it", () => {
    // gray square inside the shape, touching nothing else
    const px = CC.background.readPixels(picture(200, 200, g => {
      g.fillStyle = "#fff"; g.fillRect(0, 0, 200, 200);
      g.fillStyle = "#223"; g.fillRect(50, 50, 100, 100);
      g.fillStyle = "#e33"; g.fillRect(90, 90, 20, 20);
    }));
    const removed = CC.background.autoRemove(px, 40);
    CC.background.removeAt(px, removed, 100, 100, 40);
    expect(countShape(px, removed)).toBe(100 * 100 - 20 * 20, "shape pixels:");
  });
})();
