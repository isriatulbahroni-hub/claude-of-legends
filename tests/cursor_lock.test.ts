// The locked cursor's pure parts (src/game/cursor_lock.ts): the virtual
// position never leaves the window, the painted cursor is read off a CSS
// cursor value with its hotspot, the cursor keeps moving while a button is
// held on Firefox, and a synthetic event names the pointer the browser
// numbered.

import { describe, expect, it } from 'vitest';
import { clampToViewport, cursorImageOf, MotionSource, pointerIdOf } from '../src/game/cursor_lock';

describe('the locked cursor', () => {
  it('clamps the virtual position to the window', () => {
    expect(clampToViewport(10, 20, 800, 600)).toEqual({ x: 10, y: 20 });
    expect(clampToViewport(-5, 700, 800, 600)).toEqual({ x: 0, y: 599 });
    expect(clampToViewport(900, -1, 800, 600)).toEqual({ x: 799, y: 0 });
  });

  it('reads the painted cursor and its hotspot off a CSS cursor, none off a keyword', () => {
    expect(cursorImageOf('url("data:image/png;base64,AAAA") 3 1, auto')).toEqual({
      url: 'data:image/png;base64,AAAA',
      hotX: 3,
      hotY: 1,
    });
    expect(cursorImageOf("url('x.png'), pointer")).toEqual({ url: 'x.png', hotX: 0, hotY: 0 });
    expect(cursorImageOf('pointer')).toBeNull();
    expect(cursorImageOf('')).toBeNull();
  });

  it("moves on Firefox's pointermove while a button is held, its mousemove gone", () => {
    const motion = new MotionSource();
    // A motion with no button: the pointermove, then its mousemove twin.
    expect(motion.takes('pointermove', 200, 0)).toBe(true);
    expect(motion.takes('mousemove', 200, 0)).toBe(false);
    // A button held: Firefox fires the pointermove alone (2026-10-11,
    // Firefox 157 under the lock), and the cursor still follows it.
    expect(motion.takes('pointermove', 0, 150)).toBe(true);
    expect(motion.takes('pointermove', 0, 0)).toBe(true);
  });

  it('keeps mousemove where pointermove carries no movement, never both', () => {
    const motion = new MotionSource();
    expect(motion.takes('pointermove', 0, 0)).toBe(false);
    expect(motion.takes('mousemove', 12, -3)).toBe(true);
    expect(motion.takes('pointermove', 0, 0)).toBe(false);
    expect(motion.takes('mousemove', 4, 1)).toBe(true);
  });

  it("names the native pointer: Firefox's mouse is pointer 0", () => {
    expect(pointerIdOf({ pointerId: 0 }, 1)).toBe(0);
    expect(pointerIdOf({ pointerId: 1 }, 0)).toBe(1);
    // A mouse event has no id: the mouse's last seen one.
    expect(pointerIdOf({}, 0)).toBe(0);
    expect(pointerIdOf({}, 1)).toBe(1);
  });
});
