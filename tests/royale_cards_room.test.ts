// The battle royale HUD's lines while the Graft cards are open
// (src/ui/royale_cards_room.ts), at every size the playtest looked at: the
// kill feed stands under the cards' row, clear of the row, its Later
// button, the champion, the map in the corner and a phone's ability
// buttons (at 1280x720 the row ran 36 px into the feed's column, at
// 960x540 most of it, and on a phone the feed's first line reached the
// row's foot); the top line, an announcement, a spotlight's call, the
// drop's banner and a phone's notices keep off the cards too.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { thumbScale } from '../src/game/ui_scale';
import {
  COMPACT_FEED_OPEN_LINES,
  COMPACT_NOTES_OPEN_SHOWN,
  cardsRoomCss,
  dropChipBox,
  dropHeadBox,
  FEED_OPEN_LINES,
  openAnnounceBox,
  openAnnounceMaxWidth,
  openAnnounceWidth,
  openCall,
  openFeedBox,
  openTopLineBox,
} from '../src/ui/royale_cards_room';
import { cardsBox, cardsCoverBox, laterBox, titleBox } from '../src/ui/royale_grafts';
import {
  announceBox,
  BAR_HALF_PX,
  championBox,
  compactFeedBox,
  compactNotesBox,
  feedBox,
  overlaps,
  type ScreenBox,
  spotBox,
  TOP_LINE_TOP_PX,
  topLineBox,
} from '../src/ui/royale_layout';
import { LAST_LIGHT_CALLS, type MomentCall, seedfallCallText } from '../src/ui/royale_moments';
import { duskTurn } from '../src/ui/royale_text';
import { thumbCluster } from '../src/ui/thumb_cluster';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (file: string): string => readFileSync(path.join(ROOT, file), 'utf8');
// A template literal's placeholder as the source spells it.
const slot = (name: string): string => ['$', '{', name, '}'].join('');

// The desktops played at interface size 1, and a phone held sideways.
const DESKS: readonly [number, number][] = [
  [960, 540],
  [1280, 720],
  [1366, 768],
  [1920, 1080],
];
const [PW, PH] = [844, 390];

const inside = (b: ScreenBox, w: number, h: number): boolean =>
  b.left >= 0 && b.top >= 0 && b.right <= w && b.bottom <= h;

// The map in the corner (ui/minimap.ts): 168 px at the bottom right of a
// desktop; 112 px on a phone, at the top right under the corner with the
// thumb controls, else at the bottom right.
const deskMap = (w: number, h: number): ScreenBox => ({
  left: w - 12 - 168,
  top: h - 12 - 168,
  right: w - 12,
  bottom: h - 12,
});
const phoneMap = (thumbs: boolean): ScreenBox =>
  thumbs
    ? { left: PW - 12 - 112, top: 58, right: PW - 12, bottom: 58 + 112 }
    : { left: PW - 12 - 112, top: PH - 12 - 112, right: PW - 12, bottom: PH - 12 };
// The bar at the bottom center of a desktop.
const bar = (w: number, h: number): ScreenBox => ({
  left: w / 2 - BAR_HALF_PX,
  top: h - 175,
  right: w / 2 + BAR_HALF_PX,
  bottom: h,
});
// A phone's ability buttons and their level-up marks (ui/thumb_cluster.ts),
// scaled with the phone's height from the bottom right corner.
const clusterCircles = (): ScreenBox[] => {
  const c = thumbCluster();
  const s = thumbScale(PH);
  return [c.attack, ...c.slots, ...c.sigils, ...c.marks].map((k) => ({
    left: PW - (k.right + k.r) * s,
    top: PH - (k.bottom + k.r) * s,
    right: PW - (k.right - k.r) * s,
    bottom: PH - (k.bottom - k.r) * s,
  }));
};

describe('the kill feed while the cards are open', () => {
  it('stood under the row at 960 and 1280 wide and at a phone row foot', () => {
    expect(overlaps(feedBox(960), cardsBox(960, false))).toBe(true);
    expect(overlaps(feedBox(1280), cardsBox(1280, false))).toBe(true);
    expect(overlaps(compactFeedBox(PW, PH, true), cardsBox(PW, true))).toBe(true);
  });

  for (const [w, h] of DESKS) {
    it(`stands under the row, clear of the cards, the map and the champion at ${w}x${h}`, () => {
      const feed = openFeedBox(w, h, false);
      const near: [string, ScreenBox][] = [
        ['row', cardsBox(w, false)],
        ['title', titleBox(w, false)],
        ['Later', laterBox(w, false)],
        ['champion', championBox(w, h)],
        ['map', deskMap(w, h)],
        ['bar', bar(w, h)],
      ];
      for (const [name, box] of near) expect(overlaps(feed, box), name).toBe(false);
      expect(feed.top).toBeGreaterThanOrEqual(cardsBox(w, false).bottom);
      expect(inside(feed, w, h)).toBe(true);
    });
  }

  for (const thumbs of [true, false]) {
    it(`stands under the row on a phone, clear of the buttons and the map (thumbs ${thumbs})`, () => {
      const feed = openFeedBox(PW, PH, true, thumbs);
      const near: [string, ScreenBox][] = [
        ['row', cardsBox(PW, true)],
        ['title', titleBox(PW, true)],
        ['Later', laterBox(PW, true)],
        ['map', phoneMap(thumbs)],
      ];
      if (thumbs) for (const [i, c] of clusterCircles().entries()) near.push([`button ${i}`, c]);
      for (const [name, box] of near) expect(overlaps(feed, box), name).toBe(false);
      expect(inside(feed, PW, PH)).toBe(true);
    });
  }

  it('keeps two lines and the fold on a desktop, its first line on a phone', () => {
    // On a phone the row's foot and the level-up marks over the ability
    // buttons leave room for one line.
    expect(FEED_OPEN_LINES).toBe(3);
    expect(COMPACT_FEED_OPEN_LINES).toBe(1);
    const css = cardsRoomCss();
    expect(css).toContain('.br-feed-line:not(.fold):nth-child(n + 3) { display: none; }');
    expect(css).toContain(
      '.hud.br-cards-open.compact .br-feed-line:nth-child(n + 2) { display: none; }',
    );
  });

  it('takes the tops the boxes count, from the stylesheet the cards mount', () => {
    const css = cardsRoomCss();
    const top = (scope: string): number =>
      Number(new RegExp(`${scope} \\.br-feed \\{ top: calc\\((\\d+)px`).exec(css)?.[1]);
    expect(top('\\.hud\\.br-cards-open:not\\(\\.compact\\)')).toBe(openFeedBox(PW, PH, false).top);
    expect(top('\\.hud\\.br-cards-open\\.compact\\.thumbs')).toBe(
      openFeedBox(PW, PH, true, true).top,
    );
    expect(source('src/ui/royale_hud_grafts.ts')).toContain(slot('cardsRoomCss()'));
    // The phone's feed stands where src/ui/royale_layout.ts counts it.
    const hud = source('src/ui/royale_hud.ts');
    expect(hud).toContain(
      `top: calc(${slot('COMPACT_FEED_TOP_PCT')}% + ${slot('COMPACT_FEED_TOP_PX')}px);`,
    );
    expect(hud).toContain(`top: calc(${slot('THUMBS_FEED_TOP_PX')}px`);
  });
});

describe('the top line while the cards are open', () => {
  it('stacked, reached the title on a desktop; a phone title stands under the pill', () => {
    // The mark's badge and the Dusk's pill under the count.
    expect(overlaps(topLineBox(1280, false), titleBox(1280, false))).toBe(true);
    // At 54 px a phone's title touched the pill under the row.
    expect(topLineBox(PW, true).bottom).toBeGreaterThan(54);
    expect(overlaps(topLineBox(PW, true), titleBox(PW, true))).toBe(false);
  });

  for (const [w, h] of [...DESKS, [PW, PH] as const]) {
    const compact = w === PW;
    it(`keeps the badge and the pill off the title and the row at ${w}x${h}`, () => {
      const top = openTopLineBox(w, compact);
      const near: [string, ScreenBox][] = [
        ['title', titleBox(w, compact)],
        ['row', cardsBox(w, compact)],
        ['feed', openFeedBox(w, h, compact, true)],
      ];
      for (const [name, box] of near) expect(overlaps(top, box), name).toBe(false);
      expect(top.top).toBe(TOP_LINE_TOP_PX);
    });
  }

  it('sets the badge and the pill side by side on a desktop, the head as it was', () => {
    const css = cardsRoomCss();
    const desk = '.hud.br-cards-open:not(.compact)';
    expect(css).toContain(`${desk} .br-top { flex-flow: row wrap;`);
    expect(css).toContain(`${desk} .br-head { display: contents; }`);
    // The Dusk's line, a break, the count, a break, the badge and the pill.
    expect(css).toContain(`${desk} .br-top::before { order: 1; }`);
    expect(css).toContain(`${desk} .br-count { order: 2; }`);
    expect(css).toContain(`${desk} .br-top::after { order: 3; }`);
    expect(css).toContain(`${desk} .br-leader, ${desk} .br-burn { order: 4; }`);
  });
});

// The longest lines a battle royale announces.
const LINES: readonly string[] = [
  ...LAST_LIGHT_CALLS.map((c) => c.text),
  seedfallCallText(3, 30),
  'You took down Wanderer 0000',
  '+10 points. You are on the ladder',
  ...[1, 2, 3, 4, 5, 6].map((p) => duskTurn({ p: p - 1, sh: 0 }, { p, sh: 1 }) ?? ''),
  duskTurn({ p: 0, sh: 0 }, { p: 1, sh: 0 }) ?? '',
];

describe('an announcement while the cards are open', () => {
  it('passed over the title and the row, at 112 px on a desktop and 70 px on a phone', () => {
    for (const [w] of DESKS) expect(overlaps(announceBox(w), cardsCoverBox(w, false))).toBe(true);
    const phoneLine = { left: PW / 2 - 211, top: 70, right: PW / 2 + 211, bottom: 94 };
    expect(overlaps(phoneLine, titleBox(PW, true))).toBe(true);
  });

  for (const [w, h] of [...DESKS, [PW, PH] as const]) {
    const compact = w === PW;
    it(`takes the title's line, clear of the row, the top line and the feed at ${w}x${h}`, () => {
      const line = openAnnounceBox(w, compact);
      const title = titleBox(w, compact);
      expect(line.top).toBe(title.top);
      expect(line.bottom).toBe(title.bottom);
      const near: [string, ScreenBox][] = [
        ['row', cardsBox(w, compact)],
        ['Later', laterBox(w, compact)],
        ['top line', openTopLineBox(w, compact)],
        ['feed', openFeedBox(w, h, compact, true)],
      ];
      if (compact) near.push(['map', phoneMap(true)]);
      for (const [name, box] of near) expect(overlaps(line, box), name).toBe(false);
      for (const text of LINES) {
        expect(openAnnounceWidth(text, compact), text).toBeLessThanOrEqual(
          openAnnounceMaxWidth(w, compact),
        );
      }
    });
  }

  it('hides the title while it shows, back once it has faded', () => {
    const css = cardsRoomCss();
    expect(css).toContain(
      '.hud.br-cards-open.announcing .br-grafts .ttl { visibility: hidden; transition: none; }',
    );
    expect(css).toContain('.br-grafts .ttl { transition: visibility 0s linear 0.3s; }');
    // The announcement's own fade, and the root's class while it shows.
    const hud = source('src/ui/hud.ts');
    expect(hud).toMatch(/\.hud-announce \{[^}]*transition: opacity 0\.3s;/);
    expect(hud).toContain("this.rootEl.classList.add('announcing');");
    expect(hud).toContain("this.rootEl.classList.remove('announcing');");
    // On the title's line, at the widths the boxes count.
    expect(css).toContain(`max-width: ${openAnnounceMaxWidth(PW, false)}px;`);
    expect(css).toContain(`max-width: ${openAnnounceMaxWidth(PW, true)}px;`);
  });
});

describe("a spotlight's call while the cards are open", () => {
  it('stood over the row on a desktop up to 720 rows and on a phone', () => {
    for (const [w, h] of DESKS.filter(([, rows]) => rows <= 720)) {
      expect(overlaps(spotBox(w, h, false), cardsBox(w, false)), `${w}x${h}`).toBe(true);
    }
    expect(overlaps(spotBox(PW, PH, true), cardsBox(PW, true))).toBe(true);
  });

  it('is said on the announcement line, kept so the next waits, and only then', () => {
    const [light, double] = LAST_LIGHT_CALLS as readonly [MomentCall, MomentCall];
    expect(openCall(light, true)).toMatchObject({
      text: 'LAST LIGHT',
      spotlight: false,
      keep: true,
    });
    expect(openCall(light, false)).toBe(light);
    expect(openCall(double, true)).toBe(double);
    expect(source('src/ui/royale_hud_moments.ts')).toContain('openCall(call, cardsOpen)');
    // One on screen when the cards open goes.
    expect(cardsRoomCss()).toContain('.hud.br-cards-open .br-spot { visibility: hidden; }');
  });
});

describe("the drop's banner while the cards are open", () => {
  // The banner under the top line (ui/royale_hud.ts .br-drop), its words
  // and its seconds: 96 px down a desktop, 66 px on a phone.
  const banner = (w: number, compact: boolean): ScreenBox =>
    compact
      ? { left: w / 2 - 230, top: 66, right: w / 2 + 230, bottom: 103 }
      : { left: w / 2 - 340, top: 96, right: w / 2 + 340, bottom: 148 };

  for (const [w] of [...DESKS, [PW, PH] as const]) {
    const compact = w === PW;
    it(`folds to its seconds under the head, off the title, at ${w} wide`, () => {
      expect(overlaps(banner(w, compact), cardsCoverBox(w, compact))).toBe(true);
      const chip = dropChipBox(w, compact);
      const near: [string, ScreenBox][] = [
        ['head', dropHeadBox(w, compact)],
        ['title', titleBox(w, compact)],
        ['row', cardsBox(w, compact)],
      ];
      for (const [name, box] of near) expect(overlaps(chip, box), name).toBe(false);
    });
  }

  it('shows the seconds alone, where the box stands', () => {
    const css = cardsRoomCss();
    expect(css).toContain('.hud.br-cards-open .br-drop b { display: none; }');
    expect(css).toContain(
      `.hud.br-cards-open:not(.compact) .br-drop { top: calc(${dropChipBox(PW, false).top}px`,
    );
    expect(css).toContain(
      `.hud.br-cards-open.compact .br-drop { top: calc(${dropChipBox(PW, true).top}px`,
    );
  });
});

describe("a phone's notices while the cards are open", () => {
  it('show one at a time when played by taps, under Later', () => {
    expect(overlaps(compactNotesBox(PW, PH, false), laterBox(PW, true))).toBe(true);
    const one = compactNotesBox(PW, PH, false, COMPACT_NOTES_OPEN_SHOWN);
    expect(overlaps(one, laterBox(PW, true))).toBe(false);
    expect(cardsRoomCss()).toContain(
      '.hud.br-cards-open.compact:not(.thumbs) .br-note:nth-last-child(n + 2) { display: none; }',
    );
  });

  it('keep two with the thumb controls, their column under the cards', () => {
    expect(overlaps(compactNotesBox(PW, PH, true), cardsCoverBox(PW, true))).toBe(false);
  });
});
