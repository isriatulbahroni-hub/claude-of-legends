// A wheel turn in pixels whatever unit the browser reported
// (src/game/wheel_step.ts): Firefox's notch of three lines zooms as far as
// Chrome's notch of a hundred pixels, a page is the view's height, and the
// mode is read before the deltas, since on Firefox that order decides the
// unit the deltas come in.

import { describe, expect, it } from 'vitest';
import {
  DOM_DELTA_LINE,
  DOM_DELTA_PAGE,
  type WheelDelta,
  wheelDeltas,
  wheelPixels,
} from '../src/game/wheel_step';

// A wheel event that records the order its fields are read in.
function recording(delta: WheelDelta): { event: WheelDelta; reads: string[] } {
  const reads: string[] = [];
  const event = {} as WheelDelta;
  for (const key of Object.keys(delta) as (keyof WheelDelta)[]) {
    Object.defineProperty(event, key, {
      get: () => {
        reads.push(key);
        return delta[key];
      },
    });
  }
  return { event, reads };
}

describe('a wheel turn in pixels', () => {
  it('takes a pixel wheel as it comes', () => {
    expect(wheelPixels({ deltaMode: 0, deltaY: 100 }, 720)).toBe(100);
    expect(wheelPixels({ deltaMode: 0, deltaY: -4.5 }, 720)).toBe(-4.5);
  });

  it("reads Firefox's notch of three lines as a notch of a hundred pixels", () => {
    expect(wheelPixels({ deltaMode: DOM_DELTA_LINE, deltaY: 3 }, 720)).toBeCloseTo(100, 9);
    expect(wheelPixels({ deltaMode: DOM_DELTA_LINE, deltaY: -1 }, 720)).toBeCloseTo(-100 / 3, 9);
  });

  it("reads a page as the view's height", () => {
    expect(wheelPixels({ deltaMode: DOM_DELTA_PAGE, deltaY: 1 }, 720)).toBe(720);
  });

  it('reads the mode before the delta', () => {
    const { event, reads } = recording({ deltaMode: 1, deltaX: 0, deltaY: 3, deltaZ: 0 });
    wheelPixels(event, 720);
    expect(reads).toEqual(['deltaMode', 'deltaY']);
  });
});

describe("a wheel event's copy", () => {
  it('carries the deltas and their mode, the mode read first', () => {
    const { event, reads } = recording({ deltaMode: 1, deltaX: 1, deltaY: 3, deltaZ: 0 });
    expect(wheelDeltas(event)).toEqual({ deltaMode: 1, deltaX: 1, deltaY: 3, deltaZ: 0 });
    expect(reads[0]).toBe('deltaMode');
  });
});
