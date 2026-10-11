// The goal across matches said before Respawn's end card
// (src/ui/royale_goal_lines.ts): the one line of the wash of a Respawn
// death, the note under the points' pop in play, the note under Play the
// next match, and the greeting of an account that has played before, each
// read off the line's points on the one curve the own panel reads.

import { describe, expect, it } from 'vitest';
import type { LandingOwn } from '../src/net/landing';
import { levelTile } from '../src/ui/own_panel';
import { levelText } from '../src/ui/points_text';
import {
  GOAL_HEAD_START,
  GOAL_MAX_POINTS,
  GoalTrack,
  goalModel,
  goalStep,
} from '../src/ui/royale_goal';
import {
  goalLine,
  goalPopNote,
  goalPopNoteOn,
  goalWelcome,
  nextMatchNote,
  pointsText,
  WELCOME_BACK,
} from '../src/ui/royale_goal_lines';

describe('the line', () => {
  it('says the level and the points to the next, the bar as full as the card would draw it', () => {
    expect(goalLine(0)).toEqual({
      level: 1,
      next: 2,
      left: 50,
      share: GOAL_HEAD_START,
      text: 'Level 1 · 50 points to Level 2',
    });
    // Level 3 runs from 125 to 225.
    const l = goalLine(155);
    expect(l).toMatchObject({ level: 3, next: 4, left: 70 });
    expect(l.share).toBeCloseTo(0.3);
    expect(l.text).toBe('Level 3 · 70 points to Level 4');
  });

  it('says one point in the singular', () => {
    expect(goalLine(49).text).toBe('Level 1 · 1 point to Level 2');
    expect(pointsText(1)).toBe('1 point');
    expect(pointsText(0)).toBe('0 points');
  });

  it('reads junk as nothing and caps a stored total', () => {
    expect(goalLine(Number.NaN)).toEqual(goalLine(0));
    expect(goalLine(-30)).toEqual(goalLine(0));
    expect(goalLine(12.9)).toEqual(goalLine(12));
    expect(goalLine(GOAL_MAX_POINTS * 3)).toEqual(goalLine(GOAL_MAX_POINTS));
  });
});

describe('the note under the pop in play', () => {
  it('says where the points leave the bar', () => {
    expect(goalPopNote(20, 30)).toBe('20 to Level 2');
    expect(goalPopNote(124, 125)).toBe('Level 3 reached');
  });

  it('says the level reached, the highest, when one award climbs past two', () => {
    expect(goalPopNote(40, 130)).toBe('Level 3 reached');
  });

  it('agrees with the line the wash shows after it', () => {
    const after = 87;
    const line = goalLine(after);
    expect(goalPopNote(82, after)).toBe(`${line.left} to Level ${line.next}`);
  });

  // A match's count whose browser read `cached` before the match.
  const counted = (cached: number) =>
    new GoalTrack(
      () => cached,
      () => {},
    );

  it("reads the line's total off the count, not the browser's copy", () => {
    const track = counted(900);
    track.earn(10, 40);
    expect(goalPopNoteOn(track, 10)).toBe('10 to Level 2');
    const climb = counted(0);
    climb.earn(10, 130);
    expect(goalPopNoteOn(climb, 10)).toBe('Level 3 reached');
  });

  it('counts from the copy until a message carries the total', () => {
    const track = counted(20);
    track.earn(10);
    expect(goalPopNoteOn(track, 10)).toBe('20 to Level 2');
    expect(goalPopNoteOn(track, 0)).toBe('20 to Level 2');
  });
});

describe('the level said before the card', () => {
  it("is the own panel's level for the same points", () => {
    for (const points of [0, 49, 50, 155, 300, 2000]) {
      const step = goalStep(points);
      const own: LandingOwn = {
        name: 'Wanderer 0421',
        named: false,
        account: false,
        rank: 3,
        points,
        level: step,
        best: 0,
        above: null,
        since: 0,
      };
      const tile = levelTile(own);
      const line = goalLine(points);
      expect(tile.value).toBe(String(line.level));
      expect(tile.line).toBe(`${pointsText(line.left)} to Level ${line.next}`);
      expect(tile.share).toBeCloseTo(line.share, 9);
    }
  });
});

describe('every place the level shows, for the same points', () => {
  // Totals at the first level, on a level's first point, mid-level, a
  // point short of the next, and far up the curve, where the points the
  // next level wants run past a thousand (Level 39 runs from 19,475 to
  // 20,475).
  const totals = [0, 49, 50, 155, 349, 19_475, 19_800];

  it('says the same level and the same points to the next', () => {
    for (const points of totals) {
      const step = goalStep(points);
      const own: LandingOwn = {
        name: 'Wanderer 0421',
        named: false,
        account: false,
        rank: 3,
        points,
        level: step,
        best: 0,
        above: null,
        since: 0,
      };
      // The own panel's tile, the words every other place repeats.
      const tile = levelTile(own);
      const wants = tile.line;
      const left = wants.replace(/ points? to Level \d+$/, '');
      // The wash of a Respawn death and the home's greeting.
      const line = goalLine(points);
      expect(line.text).toBe(`Level ${tile.value} · ${wants}`);
      expect(goalWelcome({ points, best: 0, picked: true })?.text).toBe(line.text);
      // The pause menu's and the end screen's ladder box.
      expect(levelText(points)).toBe(line.text);
      // The note under a pop that lands on this total without a new level.
      if (points > step.from)
        expect(goalPopNote(points - 1, points)).toBe(`${left} to Level ${line.next}`);
      // Respawn's end card, its bar and its Play the next match, for a
      // match that brought the line here without a new level.
      const card = goalModel(step.from, points - step.from);
      expect(card.level).toBe(line.level);
      expect(card.line.endsWith(` · ${left} more to Level ${line.next}`)).toBe(true);
      expect(nextMatchNote(card)).toBe(wants);
    }
  });

  it('writes a thousand and more as the panel does', () => {
    expect(goalLine(19_475).text).toBe('Level 39 · 1,000 points to Level 40');
    expect(goalPopNote(19_000, 19_475)).toBe('Level 39 reached');
    expect(goalPopNote(19_475, 19_476)).toBe('999 to Level 40');
    expect(goalPopNote(19_474, 19_475)).toBe('Level 39 reached');
    expect(goalModel(19_475, 0).line).toBe('No points this match · 1,000 more to Level 40');
    expect(goalModel(0, 1_200).line).toMatch(/^\+1,200 points this match · /);
  });
});

describe('the note under Play the next match', () => {
  it("says the points the card's next level still wants", () => {
    expect(nextMatchNote(goalModel(30, 34))).toBe('61 points to Level 3');
    expect(nextMatchNote(goalModel(40, 100))).toBe('85 points to Level 4');
    expect(nextMatchNote(null)).toBeNull();
  });
});

describe('the greeting', () => {
  const fresh = { points: 0, best: 0, picked: false };

  it('greets nobody who never played', () => {
    expect(goalWelcome(fresh)).toBeNull();
  });

  it("greets a line with points with its level and the next level's points", () => {
    const back = goalWelcome({ ...fresh, points: 155 });
    expect(back?.text).toBe('Level 3 · 70 points to Level 4');
    expect(back).toEqual(goalLine(155));
    expect(WELCOME_BACK).toBe('Welcome back');
  });

  it('greets one that played without points yet, from the first level', () => {
    expect(goalWelcome({ ...fresh, picked: true })?.text).toBe('Level 1 · 50 points to Level 2');
    expect(goalWelcome({ ...fresh, best: 2 })?.level).toBe(1);
  });

  it('reads junk as nothing', () => {
    expect(goalWelcome({ points: Number.NaN, best: -3, picked: false })).toBeNull();
  });
});

describe('the words', () => {
  it('names no ladder entry and no other player anywhere', () => {
    const words = [
      goalLine(300).text,
      goalPopNote(290, 300),
      nextMatchNote(goalModel(290, 10)),
      WELCOME_BACK,
    ].join(' ');
    expect(words).not.toMatch(/ladder|rank|place/i);
  });
});
