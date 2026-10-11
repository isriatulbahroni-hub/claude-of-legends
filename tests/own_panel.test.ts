// The own panel's words (src/ui/own_panel.ts, CONTEXT.md: Own panel): who
// the visitor is, its place, level and best, the next thing within reach
// and the week's three, read for the four states the landing answers.

import { describe, expect, it } from 'vitest';
import { nameErrorMessage, validateName } from '../server/account_name';
import type { LandingOwn, LandingWeek } from '../src/net/landing';
import * as words from '../src/ui/own_panel';
import {
  bestTile,
  editValue,
  kept,
  ladderTile,
  levelTile,
  monthDay,
  nameShapeError,
  nextLine,
  ownSub,
  weekLine,
} from '../src/ui/own_panel';

const OCT_6 = Date.UTC(2026, 9, 6, 15, 30);
const SEP_12 = Date.UTC(2026, 8, 12, 2, 0);

// The four states server/landing_page.ts answers.
const FRESH: LandingOwn = {
  name: 'Wanderer 0421',
  named: false,
  account: false,
  rank: null,
  points: 0,
  level: { level: 1, from: 0, to: 50 },
  best: 0,
  above: null,
  since: OCT_6,
};
const HANDED: LandingOwn = {
  ...FRESH,
  rank: 31,
  points: 85,
  level: { level: 2, from: 50, to: 125 },
  best: 3,
  above: { rank: 30, name: 'Wanderer 7710', points: 90, gap: 6 },
};
const THORNWICK: LandingOwn = {
  name: 'Thornwick',
  named: true,
  account: false,
  rank: 12,
  points: 340,
  level: { level: 4, from: 225, to: 350 },
  best: 9,
  above: { rank: 11, name: 'Quillon', points: 352, gap: 13 },
  since: OCT_6,
};
const MARROW: LandingOwn = {
  name: 'Marrow',
  named: true,
  account: true,
  rank: 3,
  points: 1240,
  level: { level: 9, from: 1100, to: 1350 },
  best: 14,
  above: { rank: 2, name: 'Quillon', points: 1302, gap: 63 },
  since: SEP_12,
};

describe('who the visitor is', () => {
  it('says the day in UTC, the month short', () => {
    expect(monthDay(OCT_6)).toBe('Oct 6');
    expect(monthDay(SEP_12)).toBe('Sep 12');
    // Late on the 6th west of Greenwich is the 7th in UTC.
    expect(monthDay(Date.UTC(2026, 9, 7, 1, 0))).toBe('Oct 7');
    expect(monthDay(Date.UTC(2026, 0, 1))).toBe('Jan 1');
  });

  it('keeps a Guest that holds points or a name of its own, never an account', () => {
    expect(kept(FRESH)).toBe(false);
    expect(kept(HANDED)).toBe(true);
    expect(kept({ ...FRESH, named: true, name: 'Thornwick' })).toBe(true);
    expect(kept(THORNWICK)).toBe(true);
    expect(kept(MARROW)).toBe(false);
  });

  it('says what the name is and what keeps it', () => {
    expect(ownSub(FRESH)).toBe(
      'Your Guest name. No sign-up: one match or a name of your own keeps it.',
    );
    expect(ownSub(HANDED)).toBe('Guest since Oct 6, saved for this browser.');
    expect(ownSub(THORNWICK)).toBe('Guest since Oct 6, saved for this browser.');
    expect(ownSub(MARROW)).toBe('Your account since Sep 12.');
  });
});

describe('the three tiles', () => {
  it('the ladder: not yet, or the place and the points', () => {
    expect(ladderTile(FRESH)).toEqual({
      label: 'Ladder',
      value: 'Not yet',
      line: 'One match puts you on it',
    });
    expect(ladderTile(HANDED)).toEqual({ label: 'Ladder', value: '#31', line: '85 points' });
    expect(ladderTile(THORNWICK)).toEqual({ label: 'Ladder', value: '#12', line: '340 points' });
    expect(ladderTile(MARROW)).toEqual({ label: 'Ladder', value: '#3', line: '1,240 points' });
    expect(ladderTile({ ...HANDED, points: 1 }).line).toBe('1 point');
  });

  it('the level: its number, what the next asks, and the bar on the end card curve', () => {
    expect(levelTile(FRESH)).toEqual({
      label: 'Level',
      value: '1',
      line: '50 points to Level 2',
      share: 0.2,
    });
    expect(levelTile(HANDED).line).toBe('40 points to Level 3');
    const thorn = levelTile(THORNWICK);
    expect(thorn.value).toBe('4');
    expect(thorn.line).toBe('10 points to Level 5');
    expect(thorn.share).toBeCloseTo(0.92, 10);
    expect(levelTile(MARROW).line).toBe('110 points to Level 10');
    expect(levelTile({ ...THORNWICK, points: 349 }).line).toBe('1 point to Level 5');
  });

  it('the best: none yet, one takedown, or many', () => {
    expect(bestTile(FRESH)).toEqual({ label: 'Best', value: '0', line: 'Set one in Respawn' });
    expect(bestTile({ ...FRESH, best: 1 })).toEqual({
      label: 'Best',
      value: '1',
      line: 'takedown in one Respawn match',
    });
    expect(bestTile(HANDED)).toEqual({
      label: 'Best',
      value: '3',
      line: 'takedowns in one Respawn match',
    });
    expect(bestTile(THORNWICK).value).toBe('9');
    expect(bestTile(MARROW).value).toBe('14');
  });
});

describe('the next thing within reach', () => {
  it('puts a line not on the ladder yet on it, by its own name', () => {
    expect(nextLine(FRESH)).toBe('Next: one match puts Wanderer 0421 on the ladder.');
  });

  it('says the level alone to the line that leads the ladder', () => {
    expect(nextLine({ ...HANDED, rank: 1, above: null })).toBe(
      'Next: 40 points to Level 3. You lead the ladder.',
    );
  });

  it('says the nearer first', () => {
    // The line above is nearer than the level.
    expect(nextLine(HANDED)).toBe('Next: 6 points to pass Wanderer 7710 at #30, 40 to Level 3.');
    // The level is nearer than the line above.
    expect(nextLine(THORNWICK)).toBe('Next: 10 points to Level 5, 13 to pass Quillon at #11.');
    expect(nextLine(MARROW)).toBe('Next: 63 points to pass Quillon at #2, 110 to Level 10.');
  });

  it('says the level first on a tie', () => {
    const tie = { ...THORNWICK, above: { rank: 11, name: 'Quillon', points: 350, gap: 10 } };
    expect(nextLine(tie)).toBe('Next: 10 points to Level 5, 10 to pass Quillon at #11.');
  });

  it('says one point, singular, on the first number', () => {
    const one = { ...HANDED, above: { rank: 30, name: 'Wanderer 7710', points: 85, gap: 1 } };
    expect(nextLine(one)).toBe('Next: 1 point to pass Wanderer 7710 at #30, 40 to Level 3.');
    expect(nextLine({ ...THORNWICK, points: 349 })).toBe(
      'Next: 1 point to Level 5, 13 to pass Quillon at #11.',
    );
    expect(nextLine({ ...HANDED, rank: 1, above: null, points: 124 })).toBe(
      'Next: 1 point to Level 3. You lead the ladder.',
    );
  });
});

describe("the week's three", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 9, 9, 12);
  const week = (days: number, rotation = ['korrath', 'vesk', 'maera']): LandingWeek => ({
    rotation,
    starters: ['torv', 'fenn', 'ashvyn', 'sylra'],
    turnsAt: now + days,
  });

  it('names them short, with the days left', () => {
    expect(weekLine(week(5 * DAY + 3600_000), now)).toBe(
      "This week's three: Korrath, Vesk and Maera, for 5 more days.",
    );
    expect(weekLine(week(DAY + 60_000), now)).toBe(
      "This week's three: Korrath, Vesk and Maera, for one more day.",
    );
    expect(weekLine(week(DAY - 1), now)).toBe(
      "This week's three: Korrath, Vesk and Maera, for a few more hours.",
    );
  });

  it('shows an id the roster does not know capitalized, and nothing for no rotation', () => {
    expect(weekLine(week(3 * DAY, ['korrath', 'quillback', 'nisk']), now)).toBe(
      "This week's three: Korrath, Quillback and Nisk, for 3 more days.",
    );
    expect(weekLine(week(3 * DAY, []), now)).toBe('');
  });
});

describe('the name field', () => {
  it('offers a handed-out name without its space, and a chosen one as it is', () => {
    expect(editValue(FRESH)).toBe('Wanderer0421');
    expect(editValue(THORNWICK)).toBe('Thornwick');
    expect(editValue(MARROW)).toBe('Marrow');
  });

  it("says the server's own words for a name of the wrong shape, before any request", () => {
    const names = [
      '',
      'ab',
      '___',
      'abc',
      'a-b-c',
      'Wanderer 0421',
      'Wanderer0421',
      'x'.repeat(17),
      'Zoë',
      'Thornwick',
    ];
    for (const name of names) {
      const err = validateName(name);
      expect(nameShapeError(name), name).toBe(err === null ? null : nameErrorMessage(err));
    }
    expect(nameShapeError('ab')).toBe('A name needs at least 3 letters or digits.');
    expect(nameShapeError('Bad name')).toBe(
      'A name may use letters, digits, underscores and hyphens only.',
    );
    expect(nameShapeError('x'.repeat(17))).toBe('A name is at most 16 characters.');
  });
});

describe('every word on the panel', () => {
  it('has no en or em dash', () => {
    const said: string[] = [];
    for (const value of Object.values(words)) if (typeof value === 'string') said.push(value);
    for (const own of [FRESH, HANDED, THORNWICK, MARROW]) {
      said.push(ownSub(own), nextLine(own));
      for (const tile of [ladderTile(own), levelTile(own), bestTile(own)]) {
        said.push(tile.label, tile.value, tile.line);
      }
    }
    expect(said.length).toBeGreaterThan(20);
    for (const s of said) {
      for (const ch of s) {
        expect(ch.charCodeAt(0)).not.toBe(8211);
        expect(ch.charCodeAt(0)).not.toBe(8212);
      }
    }
  });

  it('names the controls', () => {
    expect(words.OWN_CHANGE).toBe('Change');
    expect(words.OWN_CHANGE_LABEL).toBe('Change your name');
    expect(words.OWN_SAVE).toBe('Save');
    expect(words.OWN_CANCEL).toBe('Cancel');
    expect(words.OWN_SAVED).toBe('Saved.');
    expect(words.OWN_FIELD_LABEL).toBe('Your name on the ladder');
    expect(words.OWN_FIELD_HINT).toBe('3 to 16 letters, digits, _ or -. The ladder shows it.');
    expect(words.OWN_KEEP).toBe('Keep it on every device');
    expect(words.OWN_HOME).toBe('Open your home');
  });
});
