// Crews on the client (ADR 0034): the quick pick's crew size, remembered and
// sent; the joining card's words; the top line, the win line and card, the
// death wash and the end screen in Crews; the camera of a champion out for
// good on its crew; a crewmate's mark nobody's hunt.

import { describe, expect, it } from 'vitest';
import { crewWatchTarget } from '../src/game/crew_watch';
import { clampSettings } from '../src/game/settings';
import { royaleEnterMsg } from '../src/net/royale_client';
import type { RoyaleResult, SnapMark } from '../src/net/royale_wire';
import { LANDING_WAYS, PLAY_NOW } from '../src/ui/landing_modes';
import { huntedTargets } from '../src/ui/royale_hunted';
import { CREW_CHOICES, crewChoice } from '../src/ui/royale_modes';
import { joiningLine } from '../src/ui/royale_pick';
import { initialPick, withCrew } from '../src/ui/royale_pick_rules';
import { namesText, royaleEnd, royaleSting } from '../src/ui/royale_result';
import { countLine, crewCountLine, crewOutLine } from '../src/ui/royale_text';
import { winCardWords } from '../src/ui/royale_win_card';
import { winLine } from '../src/ui/royale_win_line';

describe('the crew size on the quick pick', () => {
  const pick = { championId: 'dain', skin: 0, sigils: ['riftstep', 'mend'] as [string, string] };

  it('offers Solo, Trios and Fives, Solo first', () => {
    expect(CREW_CHOICES.map((c) => [c.crew, c.title])).toEqual([
      [1, 'Solo'],
      [3, 'Trios'],
      [5, 'Fives'],
    ]);
    expect(crewChoice(undefined).title).toBe('Solo');
    expect(crewChoice(5).title).toBe('Fives');
  });

  it('keeps Solo off the pick, as on the wire, and sends the size it holds', () => {
    expect(withCrew(pick, 3)).toEqual({ ...pick, crew: 3 });
    expect(withCrew({ ...pick, crew: 3 }, 1)).toEqual(pick);
    expect(royaleEnterMsg('respawn', pick)).not.toHaveProperty('c');
    expect(royaleEnterMsg('one_life', { ...pick, crew: 5 }).c).toBe(5);
  });

  it('opens on the crew size last played, read back from storage', () => {
    const memory = clampSettings({ royalePick: { ...pick, crew: 3 } }).royalePick;
    expect(memory?.crew).toBe(3);
    expect(clampSettings({ royalePick: { ...pick, crew: 4 } }).royalePick).toEqual(pick);
    expect(initialPick(memory, ['dain'], () => 1, ['riftstep', 'mend'], 'dain').crew).toBe(3);
  });

  it("opens Play now's pick on Solo, the match the landing says is on", () => {
    expect(PLAY_NOW.play).toEqual({ to: 'royale', variant: 'respawn', solo: true });
    const oneLife = LANDING_WAYS.find((w) => w.id === 'one_life')!;
    expect(oneLife.door.play).toEqual({ to: 'royale', variant: 'one_life' });
  });

  it('says what the joining card waits on', () => {
    expect(joiningLine(1)).toMatch(/fifty seats/);
    expect(joiningLine(3)).toBe('Finding you a crew of three, bots in the empty seats.');
  });
});

describe('the top line and the win line in Crews', () => {
  const base = { v: 'respawn' as const, st: 'play' as const, alive: 48, people: 2, score: 1 };

  it("counts the crews: in the drop, One life's left, Respawn's rank", () => {
    expect(crewCountLine({ ...base, st: 'drop' }, { n: 16, s: 0 })).toBe(
      '48 in the match, 2 people · 16 crews',
    );
    expect(crewCountLine({ ...base, v: 'one_life' }, { n: 5, s: 7 })).toBe(
      '5 crews left · 7 takedowns',
    );
    expect(crewCountLine({ ...base, v: 'one_life' }, { n: 1, s: 7 }, true)).toBe('1 crew left');
    const ranked = { ...base, rk: 3, gap: 2 };
    expect(crewCountLine(ranked, { n: 16, s: 12 })).toBe(
      'Crew #3 of 16 · 12 takedowns · 2 behind #2',
    );
    expect(crewCountLine(ranked, { n: 16, s: 12 }, true)).toBe('Crew #3 of 16 · 2 behind #2');
    expect(countLine({ ...ranked, cw: { n: 16, s: 12 } })).toBe(
      'Crew #3 of 16 · 12 takedowns · 2 behind #2',
    );
    // Solo as before.
    expect(countLine({ ...base, v: 'one_life' })).toBe('48 left · 1 takedown');
  });

  it('says what wins in Crews', () => {
    const r = { ...base, end: 610, rk: 3, cw: { n: 16, s: 4 } };
    expect(winLine(r, 358)).toBe('Top crew wins · 4:12 left · your crew is 3rd');
    expect(winLine(r, 358, true)).toBe('Top crew wins · 4:12 left');
    const oneLife = { ...r, v: 'one_life' as const, cw: { n: 5, s: 0 } };
    expect(winLine(oneLife, 100)).toBe('Last crew standing wins · 5 left');
    // On a phone the count beside the Dusk line says the crews left.
    expect(winLine(oneLife, 100, true)).toBe('Last crew standing wins');
    expect(winCardWords('respawn', true).title).toBe('The crew with the most takedowns wins');
    expect(winCardWords('one_life', true).title).toBe('Last crew standing wins');
    expect(winCardWords('one_life').title).toBe('Last one standing wins');
  });

  it('tells a champion out for good where its crew placed, or that it watches it', () => {
    expect(crewOutLine(undefined)).toBe('Your crew fights on: watching them');
    expect(crewOutLine(3)).toBe('Your crew placed 3rd');
  });
});

describe('the end screen in Crews', () => {
  const result = (over: Partial<RoyaleResult> = {}): RoyaleResult => ({
    t: 'royale_result',
    v: 'one_life',
    place: 2,
    of: 10,
    score: 3,
    winner: 'Ash',
    top: [
      { name: 'Ash', championId: 'dain', score: 4, bot: true, cr: 1 },
      { name: 'Moss', championId: 'torv', score: 1, bot: true, cr: 1 },
      { name: 'You', championId: 'vesk', score: 3, bot: false, cr: 2 },
    ],
    crew: {
      size: 5,
      score: 6,
      mates: [{ name: 'Fern', championId: 'sylra', score: 3, bot: true }],
      winners: ['Ash', 'Moss'],
      winnerScore: 5,
    },
    ...over,
  });

  it("names the crew's place, what it scored and the crew that won", () => {
    const m = royaleEnd(result());
    expect(m.title).toBe('Your crew placed 2nd of 10');
    expect(m.won).toBe(false);
    expect(m.lines).toEqual([
      'You: 3 takedowns',
      'Your crew: 6 takedowns',
      'Ash and Moss are the last crew standing.',
    ]);
    expect(m.heading).toBe('The top crews');
    expect(m.rows.map((r) => [r.place, r.self])).toEqual([
      [1, false],
      [1, false],
      [2, true],
    ]);
    expect(royaleSting(result())).toBe('defeat');
  });

  it('crowns the winning crew', () => {
    const won = royaleEnd(result({ place: 1 }));
    expect(won.title).toBe('Last crew standing');
    expect(won.won).toBe(true);
    const respawn = royaleEnd(result({ v: 'respawn', place: 4, held: 125 }));
    expect(respawn.title).toBe('Your crew placed 4th of 10');
    expect(respawn.lines).toContain('You: 3 takedowns in 2:05');
    expect(respawn.lines).toContain('Ash and Moss won with 5 takedowns');
    expect(royaleEnd(result({ v: 'respawn', place: 1 })).title).toBe('Your crew wins');
  });

  it('lists a crew by name', () => {
    expect(namesText([])).toBe('');
    expect(namesText(['Ash'])).toBe('Ash');
    expect(namesText(['Ash', 'Moss', 'Fern'])).toBe('Ash, Moss and Fern');
  });
});

describe('a champion out for good watching its crew', () => {
  it('follows a crewmate standing, keeps to it while it stands, moves on when it falls', () => {
    const mates = [
      { id: 7, dead: false },
      { id: 4, dead: false },
    ];
    expect(crewWatchTarget(false, mates, null)).toBeNull();
    expect(crewWatchTarget(true, mates, null)).toBe(4);
    expect(crewWatchTarget(true, mates, 7)).toBe(7);
    expect(crewWatchTarget(true, [{ id: 7, dead: true }, mates[1]!], 7)).toBe(4);
    expect(crewWatchTarget(true, [{ id: 7, dead: true }], 7)).toBeNull();
    expect(crewWatchTarget(true, [], null)).toBeNull();
  });
});

describe("a crewmate's mark", () => {
  it('is no edge arrow to hunt', () => {
    const mk: SnapMark[] = [
      [2, 'lodestar', 80, 0, 0, 20],
      [9, 'ablaze', 0, 80, 0, 20],
    ];
    const r = { st: 'play' as const, mk };
    expect(huntedTargets(r, 21, 1).map((t) => t.key)).toEqual(['mk-2-lodestar', 'mk-9-ablaze']);
    expect(huntedTargets(r, 21, 1, (id) => id === 2).map((t) => t.key)).toEqual(['mk-9-ablaze']);
  });
});
