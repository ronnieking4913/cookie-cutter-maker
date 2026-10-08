// Tests for the page's layout rules in styles.css. Each test builds a small piece of the page
// inside #sandbox, using the same classes as the app, and measures it.
(() => {
  const { test, expect } = T;

  function build(html) {
    const sandbox = document.getElementById("sandbox");
    sandbox.innerHTML = html;
    return sandbox;
  }

  test("a long file name doesn't push the controls wider or hide the switches", () => {
    const s = build(`
      <aside class="controls" style="width:360px;height:300px">
        <section class="step">
          <div class="drop"><div><strong>Choose a picture</strong> <span>or drag one here</span>
            <span class="fname">550846415_10202989297075523_8450966291086131039_n_with_an_even_longer_name.jpg</span></div></div>
          <label class="switch"><span>One outline around everything</span><input type="checkbox" role="switch" id="t-join" checked></label>
        </section>
      </aside>`);
    const controls = s.querySelector(".controls");
    expect(controls.scrollWidth <= controls.clientWidth).toBe(true, "controls fit their width:");
    expect(s.querySelector("#t-join").getBoundingClientRect().right <= controls.getBoundingClientRect().right).toBe(true, "switch visible:");
  });

  test("hidden settings stay hidden (the stamp settings when the stamp is off)", () => {
    const s = build(`<div class="stack" hidden>Stamp settings</div><div class="grid2" hidden></div>`);
    for (const el of s.children) expect(getComputedStyle(el).display).toBe("none", `${el.className}:`);
  });

  for (const [name, w, h] of [["tall", 942, 1400], ["wide", 1600, 500], ["small", 120, 120]]) {
    test(`a ${name} picture fits its preview panel without changing the layout`, () => {
      const s = build(`
        <section class="view" style="height:400px;width:300px">
          <header><h3>Picture</h3></header>
          <div class="canvas-box checker"><canvas width="${w}" height="${h}"></canvas></div>
          <footer><p class="hint">hint</p></footer>
        </section>`);
      const view = s.querySelector(".view"), box = s.querySelector(".canvas-box").getBoundingClientRect();
      const canvas = s.querySelector("canvas").getBoundingClientRect(), v = view.getBoundingClientRect();
      if (matchMedia("(max-width: 760px)").matches) {
        // Narrow window (phone): the page scrolls on purpose, so the picture only has to fit the width.
        expect(canvas.right <= box.right && view.scrollWidth <= view.clientWidth).toBe(true, "picture fits the width:");
        return;
      }
      expect(view.scrollHeight <= view.clientHeight).toBe(true, "panel doesn't overflow:");
      expect(box.bottom <= v.bottom && canvas.bottom <= box.bottom && canvas.right <= box.right).toBe(true, "picture inside its box:");
      expect(getComputedStyle(s.querySelector("canvas")).objectFit).toBe("contain", "picture keeps its shape (object-fit):");
    });
  }

  test("the picture's Undo / Redo / Reset / Save buttons fit the panel, even when it's narrow", () => {
    for (const width of [470, 300]) {
      const s = build(`
        <section class="view" style="height:400px;width:${width}px">
          <header>
            <h3>Picture</h3>
            <div class="toolbar">
              <button class="ghost small" type="button">↶ Undo</button>
              <button class="ghost small" type="button">↷ Redo</button>
              <button class="ghost small" type="button">Reset background</button>
              <button class="ghost small" type="button">Save picture</button>
            </div>
            <p class="hint full">Click or drag over anything that's still background to remove it. Right-click to undo.</p>
          </header>
          <div class="canvas-box checker"><canvas width="400" height="400"></canvas></div>
        </section>`);
      const view = s.querySelector(".view"), v = view.getBoundingClientRect();
      for (const b of s.querySelectorAll("button"))
        expect(b.getBoundingClientRect().right <= v.right).toBe(true, `"${b.textContent}" visible at ${width}px:`);
      expect(view.scrollWidth <= view.clientWidth).toBe(true, `no sideways overflow at ${width}px:`);
    }
  });

  test("on/off settings are drawn as toggle switches", () => {
    const s = build(`<label class="switch"><span>Rim to push on</span><input type="checkbox" role="switch" checked></label>`);
    const input = s.querySelector("input"), style = getComputedStyle(input);
    expect(input.type).toBe("checkbox", "still a real checkbox underneath:");
    expect(style.appearance).toBe("none", "checkbox look replaced:");
    expect(style.width).toBe("34px", "switch width:");
  });
})();
