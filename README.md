# Cookie Cutter Maker

Turns a picture into a 3D-printable cookie cutter (STL), with an optional stamp that presses the picture's inside details into the dough.

It replaces a manual workflow of tracing the outline in GIMP (alpha to selection, grow, fill, export) and then extruding and hollowing it in MatterControl. Everything runs in the browser on your own computer: nothing to install, works offline, and pictures never leave the machine.

## Using it

Double-click `Cookie Cutter Maker.html` to open it in Edge or Chrome.

1. **Picture.** Choose or drag in a picture (PNG, JPG, WEBP or AVIF). The background is removed automatically and the preview shows what was kept over a checkerboard. Click any leftover background to remove it, or use **Reset background** to start over.
2. **Size.** Set the longest side of the cookie and the cutter's height, wall and flange.
3. **Stamp** (optional). Adds a plate with raised lines that prints the picture's inside details into the dough.
4. **Save.** **Download STL** saves `<name>-cutter.stl`, or `<name>-cutter-and-stamp.stl` with the stamp as a second object beside the cutter.

### Printing

- Print the cutter **flange-down** and the stamp **plate-down** (lines facing up).
- Both objects are **mirrored** on purpose. You flip them over to use them, so the cookie comes out matching the picture.
- To move or print the two objects separately, use your slicer's **Split to objects** (Cura, PrusaSlicer, Bambu Studio).
- To use the stamp: cut the cookie, leave the cutter in place, press the stamp down inside it, then lift both off.

### Pictures that work best

- A character with a **dark outline all the way around** (most cartoon and coloring-page art).
- A background in a **different color from the character**, ideally plain white or one solid color.
- The **whole character in the frame**, not cut off by the edge.
- A downloaded picture or screenshot rather than a photo of a print, since photos add texture and shadows.

Background removal works by color, like GIMP's magic wand. Where part of the character matches the background with no outline between them, that part is removed too.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Background | Automatic | Uses the picture's transparency if it has any, otherwise removes the background by color |
| Color tolerance | 40 | How different a color can be and still count as background (5–120) |
| Fill gaps inside the shape | On | Treats anything enclosed by the outline as part of the cookie |
| Ignore small specks | On | Drops stray bits smaller than 1% of the main shape |
| Edge smoothing | 2 | Rounds off jagged edges (0–8) |
| Longest side | 80 mm | Size of the cookie itself, not including wall and flange |
| Height | 15 mm | Height of the cutting wall |
| Wall | 1.2 mm | Thickness of the cutting wall |
| Grow outline | 0 mm | Expands the shape before adding the wall; joins pieces that are close together |
| Grip flange | On, 4 mm wide, 1.6 mm thick | The wider rim you press on |
| Detail | Normal (0.25 mm) | Grid size: Fine 0.15 mm, Normal 0.25 mm, Draft 0.4 mm |
| Stamp: detail sensitivity | 50 | Higher picks up fainter lines (1–100) |
| Stamp: line width / height | 1.2 mm / 2 mm | Size of the raised lines on the stamp |

Fixed stamp values (in `js/stamp.js`): 3 mm plate, 0.6 mm gap to the cutter wall, lines kept 1 mm in from the plate edge. The two objects sit 5 mm apart in the STL (in `js/stl.js`).

## How it works

```
picture → background.js → shape.js → cutter.js ─┬→ stl.js → .stl file
                                     stamp.js ──┘
```

1. **Background** (`js/background.js`). Floods inward from the picture's edges, removing pixels close in color to the edge. While what's left is still a solid rectangle (for example a colored backdrop inside a white frame), it removes the next layer too. It stops if a layer would remove almost everything, which means that layer is the cookie itself.
2. **Shape** (`js/shape.js`). Removes thin halos and specks, crops to the shape, and scales it onto a millimeter grid.
3. **Cutter** (`js/cutter.js`). Measures every grid cell's distance from the shape (exact Euclidean distance transform). Cells within the wall distance become wall; cells within the flange distance become flange.
4. **Stamp** (`js/stamp.js`). Finds detail lines where the color changes sharply inside the shape (Sobel edge detection), thickens them to the line width, and raises them on a plate inset from the cutter wall.
5. **STL** (`js/stl.js`). Turns each raised cell into a block, keeps only the outside faces, mirrors left to right, and writes a binary STL. The mesh is closed, and every face points outwards.

## Project layout

| File | Purpose |
|---|---|
| `Cookie Cutter Maker.html` | The page and its controls (open this to use the app) |
| `styles.css` | The look, with light and dark themes |
| `js/background.js` | Reads the picture and removes the background |
| `js/shape.js` | Cleans up the shape and puts it on the millimeter grid |
| `js/cutter.js` | Works out the cutting wall and flange |
| `js/stamp.js` | Builds the optional stamp plate and detail lines |
| `js/stl.js` | Writes the 3D file |
| `js/preview.js` | Draws the picture and cutter previews |
| `js/app.js` | Connects the page's controls to the steps above |
| `tests/` | Test runner and tests |

The scripts are plain `<script>` files that share one global object, `CC`, and load in order in `Cookie Cutter Maker.html`. Browsers block JavaScript modules in a page opened by double-clicking, so this keeps the app working without a web server or build step.

## Tests

Double-click `tests/index.html`. Each test shows ✓ or ✗, with a total at the top.

| File | Covers |
|---|---|
| `tests/runner.js` | A small test runner (`test`, `expect(...).toBe`, `toBeCloseTo`, …) plus shared helpers |
| `tests/background.test.js` | Frame and backdrop removal, rectangular cookies kept, transparency, click to remove |
| `tests/cutter.test.js` | Size, wall and flange thickness and height, flange off, grow outline, closed mesh, mirroring, empty pictures |
| `tests/stamp.test.js` | Detail lines found, plate fits inside the cutter, plate and line heights, alignment after mirroring, both objects in one STL |

The tests draw their own pictures. Chrome and Edge won't let a page opened from disk read the pixels of image files beside it, so real photos are checked by hand in the app.

When fixing a bug, first add a test that shows the bug (it should fail), then fix the code until it passes.

## Known limitations

- **Stair-stepped edges.** The model is built from grid cells (0.25 mm by default), so edges have tiny steps. They're too small to show up in a print.
- **Large files.** A detailed cutter with a stamp can reach about 17 MB. Slicers handle that fine; Draft detail makes it about 2.5 times smaller.
- **Single-color backgrounds only.** Busy or photographed backgrounds may need clicking to clean up, or editing the picture first.

## Ideas for later

- Build the geometry from traced outlines instead of grid cells (marching squares, then Clipper2 offsets, then extrusion), for smooth edges, exact wall thickness and much smaller files.
- Define every setting in one `settings.js` that builds the controls, instead of in the page, `app.js` and the tests.
- Add JSDoc type comments so VS Code flags mistakes as you type.
- A brush to paint areas to keep or remove when color-based removal isn't enough.
- A "print nested" option that places the stamp inside the cutter in the STL.
- A 3D preview.
