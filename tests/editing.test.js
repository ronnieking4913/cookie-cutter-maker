// Tests for editing the picture: dragging to remove pieces, undo, and saving the edited picture.
(() => {
  const { test, expect, picture } = T;

  // Three dark squares in a row (like letters) and one below them, on white.
  const letters = () => picture(400, 300, g => {
    g.fillStyle = "#fff"; g.fillRect(0, 0, 400, 300);
    g.fillStyle = "#6b0f24";
    for (const x of [40, 160, 280]) g.fillRect(x, 40, 80, 80);
    g.fillRect(160, 180, 80, 80); // not on the drag path
  });
  const shapePixels = (px, removed) => CC.background.shapeMask(px, removed, false).reduce((a, v) => a + v, 0);
  const isRemoved = (px, removed, x, y) => removed[y * px.W + x] === 1;

  test("one drag across several pieces removes all of them", () => {
    const px = CC.background.readPixels(letters()), removed = CC.background.autoRemove(px, 40);
    CC.background.removeAlongLine(px, removed, [20, 80], [380, 80], 40);
    expect(isRemoved(px, removed, 80, 80) && isRemoved(px, removed, 200, 80) && isRemoved(px, removed, 320, 80)).toBe(true, "all three letters removed:");
    expect(shapePixels(px, removed)).toBe(80 * 80, "only the square below is left (pixels):");
  });

  test("a quick drag (two far-apart pointer positions) doesn't skip the pieces in between", () => {
    const px = CC.background.readPixels(letters()), removed = CC.background.autoRemove(px, 40);
    // the pointer jumped straight from the first letter to the last
    CC.background.removeAlongLine(px, removed, [80, 80], [320, 80], 40);
    expect(isRemoved(px, removed, 200, 80)).toBe(true, "middle letter removed:");
  });

  test("undo (right-click) puts back exactly what the last drag removed", () => {
    const px = CC.background.readPixels(letters());
    const first = [[80, 80]];                                                  // a click on the first letter
    const before = CC.background.replay(px, 40, [first]);
    const drag = CC.background.removeAlongLine(px, before.slice(), [160, 80], [380, 80], 40);
    expect(drag.length).toBeGreaterThan(0, "drag removed something:");
    const undone = CC.background.replay(px, 40, [first]);                     // replay without the drag
    let different = 0;
    for (let i = 0; i < before.length; i++) if (before[i] !== undone[i]) different++;
    expect(different).toBe(0, "pixels different after undo:");
  });

  test("replaying the clicks and drags gives the same result as doing them live", () => {
    const px = CC.background.readPixels(letters()), live = CC.background.autoRemove(px, 40);
    const strokes = [CC.background.removeAlongLine(px, live, [20, 80], [180, 80], 40), [[300, 80]]];
    CC.background.removeAt(px, live, 300, 80, 40);
    const replayed = CC.background.replay(px, 40, strokes);
    let different = 0;
    for (let i = 0; i < live.length; i++) if (live[i] !== replayed[i]) different++;
    expect(different).toBe(0, "pixels different:");
  });

  test("the saved edited picture loads back with the same shape", () => {
    const px = CC.background.readPixels(letters()), removed = CC.background.autoRemove(px, 40);
    CC.background.removeAlongLine(px, removed, [20, 80], [380, 80], 40);
    const mask = CC.background.shapeMask(px, removed, false);
    const saved = CC.preview.photo(document.createElement("canvas"), px, mask); // what Save edited picture writes
    const again = CC.background.readPixels(saved);
    expect(again.hasAlpha).toBe(true, "has a transparent background:");
    const reloaded = CC.background.shapeMask(again, new Uint8Array(again.W * again.H), true);
    let different = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i] !== reloaded[i]) different++;
    expect(different).toBe(0, "pixels different:");
  });
})();
