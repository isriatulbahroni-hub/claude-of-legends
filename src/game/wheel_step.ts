// A wheel turn in pixels, whatever unit the browser reported it in. Chrome
// and Safari report a mouse wheel's notch in pixels, about a hundred.
// Firefox reports it in lines, three a notch (deltaMode 1), when the page
// reads the event's deltaMode before its deltas, and otherwise turns the
// lines into pixels by a line height of its own. The camera's zoom read
// deltaY as pixels whatever the mode: a notch of three lines moved it a
// thirtieth of a notch of a hundred pixels. The mode is read first here,
// so Firefox keeps its lines whoever read the event before, and a line is
// a third of a pixel notch, so three of them are a notch on every
// browser. A trackpad reports pixels everywhere and is taken as it comes.

export const DOM_DELTA_LINE = 1;
export const DOM_DELTA_PAGE = 2;

// A pixel wheel's notch over the lines a line wheel turns for it.
export const LINE_PX = 100 / 3;

export interface WheelDelta {
  readonly deltaMode: number;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaZ: number;
}

// The vertical turn in pixels; a page is `pagePx` (the view's height).
export function wheelPixels(e: Pick<WheelDelta, 'deltaMode' | 'deltaY'>, pagePx: number): number {
  // The mode before the delta: on Firefox the order decides the unit.
  const mode = e.deltaMode;
  const dy = e.deltaY;
  if (mode === DOM_DELTA_LINE) return dy * LINE_PX;
  if (mode === DOM_DELTA_PAGE) return dy * pagePx;
  return dy;
}

// A wheel event's deltas to pass on as they came (the locked cursor's
// copy, game/cursor_lock.ts): the mode read first, so a Firefox wheel's
// copy carries its lines and the handler that reads it converts once.
export function wheelDeltas(e: WheelDelta): WheelDelta {
  const deltaMode = e.deltaMode;
  return { deltaMode, deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ };
}
