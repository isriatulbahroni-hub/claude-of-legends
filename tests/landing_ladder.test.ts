// The ladder on the landing (src/ui/landing_ladder.ts): the ladder of every
// human (ADR 0027), the words a visitor reads over the rows, and the button
// under them. The reader's own place is the own panel's (ui/own_panel.ts).

import { describe, expect, it } from 'vitest';
import * as ladderModule from '../src/ui/landing_ladder';
import {
  CLIMB_CALL,
  JOIN_CALL,
  joinCall,
  ladderLead,
  pointsText,
  rowPoints,
} from '../src/ui/landing_ladder';

describe('the ladder on the landing', () => {
  it('writes points as a number people read, the word once over the rows', () => {
    expect(pointsText(1)).toBe('1 point');
    expect(pointsText(0)).toBe('0 points');
    expect(pointsText(1240)).toBe('1,240 points');
    expect(rowPoints(1240)).toBe('1,240');
    expect(ladderLead({ total: 37 })).toMatch(/points/);
  });

  it('speaks to a fresh server rather than counting to zero', () => {
    expect(ladderLead({ total: 0 })).toBe(
      'Nobody is on it yet. The first name here could be yours.',
    );
  });

  // The hero says that one match puts a name here, with no account; the
  // ladder says it no second time (the maintainer, 2026-10-02).
  it('counts everyone on it, and repeats nothing the hero says', () => {
    expect(ladderLead({ total: 1 })).toBe('1 player, ranked by the points their matches earned.');
    expect(ladderLead({ total: 37 })).toMatch(/^37 players, ranked/);
    expect(ladderLead({ total: 37 })).not.toMatch(/account|guest/i);
  });

  it('leaves the reader its place to the own panel', () => {
    expect('meLine' in ladderModule).toBe(false);
  });

  it('asks a line not on it yet to take its place, and one on it to climb', () => {
    expect(JOIN_CALL).toBe('Take your place');
    expect(CLIMB_CALL).toBe('Play to climb');
    expect(joinCall(null)).toBe(JOIN_CALL);
    expect(
      joinCall({ rank: null, points: 0, name: 'Wanderer 0042', guest: true, named: false }),
    ).toBe(JOIN_CALL);
    expect(joinCall({ rank: 12, points: 340, name: 'Starling', guest: true, named: true })).toBe(
      CLIMB_CALL,
    );
  });
});
