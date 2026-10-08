// Undo / redo for the clicks and drags on the picture. Each click or drag is one "stroke"
// (a list of [x, y] spots). The background is rebuilt from the strokes that are in effect.
window.CC = window.CC || {};

CC.history = (() => {
  function create() {
    let done = [], undone = [];
    return {
      strokes: () => done,                 // strokes in effect, oldest first
      add(stroke) { done.push(stroke); undone = []; }, // a new edit makes redo impossible
      undo() { if (!done.length) return false; undone.push(done.pop()); return true; },
      redo() { if (!undone.length) return false; done.push(undone.pop()); return true; },
      clear() { done = []; undone = []; },
      canUndo: () => done.length > 0,
      canRedo: () => undone.length > 0,
    };
  }
  return { create };
})();
