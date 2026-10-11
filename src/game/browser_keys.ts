// Keys a match keeps from the browser while the keyboard is the match's.
// Firefox on Windows and Linux opens its menu bar on an Alt pressed and let
// go alone, and the keys after it drive the menus instead of the champion
// until the page is clicked; it opens its Quick Find bar on ' and /, which
// takes every key typed after it. Alt is the match's own (with Q, W, E or
// R it spends a skill point), the other two mean nothing in a match: the
// default of all three is held back, on the way down and on the way up. A
// field being typed in keeps them (game/input.ts asks first).

const HELD: ReadonlySet<string> = new Set(['Alt', "'", '/']);

export function heldFromBrowser(key: string): boolean {
  return HELD.has(key);
}
