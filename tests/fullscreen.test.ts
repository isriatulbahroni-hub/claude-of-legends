// Fullscreen coming and going mid-match (src/game/fullscreen.ts): who is
// told, and when leaving it opens the pause menu, since the browser keeps
// the Esc that left it and the page never sees the key.

import { describe, expect, it } from 'vitest';
import { pauseOnFullscreenExit, watchFullscreen } from '../src/game/fullscreen';

function fakeDocument(fullscreen: boolean) {
  const target = new EventTarget();
  const doc = {
    fullscreenElement: (fullscreen ? {} : null) as Element | null,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };
  const set = (on: boolean): void => {
    doc.fullscreenElement = on ? ({} as Element) : null;
    target.dispatchEvent(new Event('fullscreenchange'));
  };
  return { doc: doc as unknown as Document, set };
}

describe('watching fullscreen', () => {
  it('tells each entry and each exit once, from the state the match started in', () => {
    const { doc, set } = fakeDocument(true);
    const told: boolean[] = [];
    const stop = watchFullscreen((on) => told.push(on), doc);
    set(false);
    // A second event for the same state (a nested element leaving) is no
    // change.
    set(false);
    set(true);
    expect(told).toEqual([false, true]);
    stop();
    set(false);
    expect(told).toEqual([false, true]);
  });
});

describe('the pause menu on leaving fullscreen', () => {
  it('opens when the browser took the Esc mid-match', () => {
    expect(pauseOnFullscreenExit({ pauseMenu: false, ended: false, typing: false })).toBe(true);
  });

  it('stays as it is when the menu is up (its own button), the match is over, or a line is typed', () => {
    expect(pauseOnFullscreenExit({ pauseMenu: true, ended: false, typing: false })).toBe(false);
    expect(pauseOnFullscreenExit({ pauseMenu: false, ended: true, typing: false })).toBe(false);
    expect(pauseOnFullscreenExit({ pauseMenu: false, ended: false, typing: true })).toBe(false);
  });
});
