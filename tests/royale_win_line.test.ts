// The win line under the battle royale's top line (src/ui/royale_win_line.ts):
// what wins the match and where the viewer stands, all match long, small
// on a phone; nothing during the drop or once the match is over.

import { describe, expect, it } from 'vitest';
import type { SnapRoyale } from '../src/net/royale_wire';
import { ONE_LIFE_WINS, RESPAWN_WINS, winLine, winLineAside } from '../src/ui/royale_win_line';

const snap = (over: Partial<SnapRoyale> = {}): SnapRoyale => ({
  v: 'respawn',
  st: 'play',
  de: 10,
  end: 610,
  dusk: { p: 1, c: [0, 80, 0], r: 120, pe: 200, sh: 0, b: 0.02 },
  alive: 50,
  people: 2,
  ...over,
});

describe('the win line', () => {
  it('says Respawn: most takedowns wins, the time to the last light, the own rank', () => {
    expect(winLine(snap({ rk: 11 }), 358)).toBe('Most takedowns wins · 4:12 left · you are 11th');
    expect(winLine(snap({ rk: 1 }), 600)).toBe('Most takedowns wins · 0:10 left · you are 1st');
    expect(winLine(snap({ rk: 22 }), 0)).toBe('Most takedowns wins · 10:10 left · you are 22nd');
  });

  it('leaves the rank out before the server sends one', () => {
    // A drop-in's rank comes from its first takedown since landing.
    expect(winLine(snap(), 358)).toBe('Most takedowns wins · 4:12 left');
    expect(winLine(snap({ rk: 0 }), 358)).toBe('Most takedowns wins · 4:12 left');
  });

  it('reads 0:00 once the light is out, never a negative clock', () => {
    expect(winLine(snap({ rk: 3 }), 640)).toBe('Most takedowns wins · 0:00 left · you are 3rd');
  });

  it('says One life: last one standing wins, and how many are left', () => {
    expect(winLine(snap({ v: 'one_life', alive: 23, score: 2 }), 300)).toBe(
      'Last one standing wins · 23 left',
    );
    expect(winLine(snap({ v: 'one_life', alive: 23 }), 300, true)).toBe(
      'Last one standing wins · 23 left',
    );
  });

  it('leaves the rank to the count beside it on a phone', () => {
    expect(winLine(snap({ rk: 11 }), 358, true)).toBe('Most takedowns wins · 4:12 left');
  });

  it('says nothing during the drop or once the match is over', () => {
    expect(winLine(snap({ st: 'drop' }), 5)).toBeNull();
    expect(winLine(snap({ st: 'over', rk: 4 }), 610)).toBeNull();
    expect(winLine(snap({ v: 'one_life', st: 'over' }), 610)).toBeNull();
  });

  it("steps aside for the Dusk's pill on a desktop with the Graft cards shut", () => {
    // Stacked under the head and the mark's badge, the line and the pill
    // reached 138 px, into the announcements' band at 112.
    expect(winLineAside({ compact: false, cardsOpen: false, burning: true })).toBe(true);
    expect(winLineAside({ compact: false, cardsOpen: false, burning: false })).toBe(false);
    // A phone's row and the open cards' row hold the two side by side.
    expect(winLineAside({ compact: true, cardsOpen: false, burning: true })).toBe(false);
    expect(winLineAside({ compact: false, cardsOpen: true, burning: true })).toBe(false);
  });

  it('opens with the same words as the win card', () => {
    expect(winLine(snap(), 0)?.startsWith(RESPAWN_WINS)).toBe(true);
    expect(winLine(snap({ v: 'one_life' }), 0)?.startsWith(ONE_LIFE_WINS)).toBe(true);
  });
});
