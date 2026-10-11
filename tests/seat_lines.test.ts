// A seat changing hands as the kill feed says it (src/ui/seat_lines.ts):
// the message the server sends everyone else in the match turns into the
// name it carries and what happened, and the line keeps inside the battle
// royale's feed column at every size played (src/ui/royale_layout.ts), a
// Guest's whole name and the words in it.

import { describe, expect, it } from 'vitest';
import { seatChangeMsg } from '../server/seat_change';
import type { ServerMsg } from '../src/net/protocol';
import {
  announceBox,
  FEED_MAX_W_PX,
  feedBox,
  overlaps,
  seatLineWidth,
  topLineBox,
} from '../src/ui/royale_layout';
import {
  SEAT_LINES_MAX,
  SEAT_NAME_MAX,
  SEAT_WORDS,
  seatLine,
  seatLinesPast,
  seatLineText,
} from '../src/ui/seat_lines';

describe('the line a seat change makes', () => {
  it('names the person who joined, came back or left, and says what happened', () => {
    expect(seatLine({ t: 'player_joined', name: 'Wanderer 3433', team: 4 })).toEqual({
      kind: 'joined',
      name: 'Wanderer 3433',
      words: 'joined the match',
      team: 4,
    });
    const back = seatLine({ t: 'player_back', name: 'Thornwick', team: 1 })!;
    expect(seatLineText(back)).toBe('Thornwick is back in the match');
    const left = seatLine({ t: 'player_left', name: 'Thornwick', team: 1 })!;
    expect(seatLineText(left)).toBe('Thornwick left, a house bot plays on');
    const coach = seatLine({ t: 'player_left', name: 'Thornwick', team: 1, own: 1 })!;
    expect(seatLineText(coach)).toBe('Thornwick left, their bot plays on');
  });

  it('reads what the server sends, word for word', () => {
    for (const change of ['joined', 'back', 'left'] as const) {
      const line = seatLine(seatChangeMsg(change, { name: 'Marrow', team: 0 }));
      expect(line?.kind).toBe(change);
      expect(line?.name).toBe('Marrow');
    }
  });

  it('is no line for another message, or for a seat with no name to show', () => {
    expect(seatLine({ t: 'match_end' })).toBeNull();
    expect(seatLine({ t: 'chat', from: 'a', team: 0, text: 'hi' })).toBeNull();
    expect(seatLine({ t: 'player_joined', name: '  ', team: 0 })).toBeNull();
    // A message missing its name or team (an older or broken sender).
    expect(seatLine({ t: 'player_left' } as unknown as ServerMsg)).toBeNull();
    expect(seatLine({ t: 'player_back', name: 'Marrow' } as unknown as ServerMsg)?.team).toBe(0);
  });

  it('shows the name as the match shows it, never shortened here', () => {
    const name = 'abcdefghijklmnopqrst';
    expect(seatLine({ t: 'player_joined', name, team: 0 })?.name).toBe(name);
  });
});

describe('several seats changing hands at once', () => {
  it('keeps the newest SEAT_LINES_MAX lines in the 5v5 and the spectator feed', () => {
    // Oldest first, as those feeds append them.
    expect(seatLinesPast([])).toEqual([]);
    expect(seatLinesPast(['a', 'b'])).toEqual([]);
    expect(seatLinesPast(['a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c']);
    expect(seatLinesPast(['a', 'b', 'c']).length).toBe(3 - SEAT_LINES_MAX);
  });
});

describe('the line on the screen', () => {
  const GUEST = 'Wanderer 0000';
  const LONGEST = 'm'.repeat(SEAT_NAME_MAX);
  const words = Object.values(SEAT_WORDS);

  it("keeps a Guest's whole name and the words inside the feed's column", () => {
    for (const w of words) {
      for (const compact of [false, true]) {
        expect(seatLineWidth(GUEST, w, compact)).toBeLessThanOrEqual(FEED_MAX_W_PX);
      }
    }
  });

  it('cuts only the name of the longest one, and keeps most of it', () => {
    for (const w of words) {
      const over = seatLineWidth(LONGEST, w, false) - FEED_MAX_W_PX;
      const name = seatLineWidth(LONGEST, '', false) - seatLineWidth('', '', false);
      expect(over).toBeLessThan(name / 3);
      // A phone's column holds it whole.
      expect(seatLineWidth(LONGEST, w, true)).toBeLessThanOrEqual(FEED_MAX_W_PX);
    }
  });

  it("stands in the feed's column, clear of the top line and the announcement", () => {
    // 1280x720 and 960x540 on a desktop; a phone's is measured in the
    // browser (its feed stands under the top line's row).
    for (const width of [1280, 960]) {
      const feed = feedBox(width);
      expect(overlaps(feed, topLineBox(width, false))).toBe(false);
      expect(overlaps(feed, announceBox(width))).toBe(false);
    }
  });
});
