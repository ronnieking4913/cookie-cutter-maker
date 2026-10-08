# Cookie Cutter Maker

Turns a picture into a 3D-printable cookie cutter (STL), with an optional stamp that presses the picture's inside details into the dough.

## Use it
Double-click `index.html`. It runs in Edge or Chrome, works offline and needs no install.

1. Choose a picture. The background is removed automatically; click any leftovers to remove them.
2. Set the size, wall and flange.
3. Optionally add a stamp.
4. Download the STL. Print the cutter flange-down and the stamp plate-down.

## Code
| File | Step |
|---|---|
| `js/background.js` | Finds the shape and removes the background |
| `js/shape.js` | Cleans up the shape and puts it on a millimeter grid |
| `js/cutter.js` | Works out the cutting wall and flange |
| `js/stamp.js` | Builds the optional stamp plate and detail lines |
| `js/stl.js` | Writes the 3D file |
| `js/preview.js` | Draws the two previews |
| `js/app.js` | Connects the page's controls to the steps above |

## Tests
Double-click `tests/index.html`. Each `*.test.js` file tests one step.
