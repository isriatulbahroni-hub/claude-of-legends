// The battle royale HUD's lines while the Graft cards are open
// (src/ui/royale_cards_room.ts): the kill feed stands under the cards'
// row, clear of the row, its Later button, the champion, the map in the
// corner and a phone's ability buttons, at every size the playtest looked
// at (at 1280x720 the row ran 36 px into the feed's column, at 960x540
// most of it, and on a phone the feed's first line reached the row's
// foot).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { thumbScale } from '../src/game/ui_scale';
import {
  COMPACT_FEED_OPEN_LINES,
  cardsRoomCss,
  FEED_OPEN_LINES,
  openFeedBox,
} from '../src/ui/royale_cards_room';
import { cardsBox, laterBox, titleBox } from '../src/ui/royale_grafts';
import {
  BAR_HALF_PX,
  championBox,
  compactFeedBox,
  feedBox,
  overlaps,
  type ScreenBox,
} from '../src/ui/royale_layout';
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

  it('keeps two lines and the fold on a desktop, its newest line and the fold on a phone', () => {
    expect(FEED_OPEN_LINES).toBe(3);
    expect(COMPACT_FEED_OPEN_LINES).toBe(2);
    const css = cardsRoomCss();
    expect(css).toContain('.br-feed-line:not(.fold):nth-child(n + 3) { display: none; }');
    expect(css).toContain(
      '.hud.br-cards-open.compact .br-feed-line:not(.fold):nth-child(n + 2) { display: none; }',
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
