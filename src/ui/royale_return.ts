// The Respawn wait's globe (CONTEXT.md: Respawn; src/sim/royale/
// return_pick.ts): a moment after the fall, the camera rises to the globe
// the drop is seen from, and a tap or a click on it picks where the
// champion comes back, inside the light it comes back to. What the stage
// (render/planet_stage.ts) and the death wash (ui/hud.ts) both decide off
// the world, pure: whether the globe shows, the light it faces, and the
// wash's line about it. The 5 s wait held nothing but a count: it now
// holds a choice.

import type { SnapDusk, SnapRoyale, WirePoint } from '../net/royale_wire';
import type { Vec3 } from '../sim/geo';
import { intoLight } from '../sim/royale/return_pick';
import { RESPAWN_S } from '../sim/royale/types';
import { burrTarget } from './royale_burr';
import type { ScreenBox } from './royale_layout';
import { TOUCH_BAR_EDGE_PX, TOUCH_BAR_LEFT_W_PX } from './touch_bar';

// Seconds after the fall the globe rises: the body is seen to fall first.
export const RETURN_GLOBE_AFTER_S = 1;

// The followed champion as the globe reads it.
export interface ReturnSeat {
  dead: boolean;
  respawnAt: number;
}

// The mode's block as the globe reads it.
export interface ReturnView {
  v: 'respawn' | 'one_life';
  st: 'drop' | 'play' | 'over';
}

// Whether the globe shows over a dead champion now: in Respawn's play,
// RETURN_GLOBE_AFTER_S after the fall, until the champion stands again
// (a slow snapshot keeps it up past the return's time, never down early).
export function returnGlobeOn(r: ReturnView, u: ReturnSeat, time: number): boolean {
  if (r.v !== 'respawn' || r.st !== 'play') return false;
  if (!u.dead || !Number.isFinite(u.respawnAt)) return false;
  return time >= u.respawnAt - RESPAWN_S + RETURN_GLOBE_AFTER_S;
}

// The light a return comes back in, as the wire tells the Dusk (src/sim/
// royale/score.ts returnCap): the cap it closes to while it closes, else
// the light now.
export function returnLight(d: SnapDusk): { c: WirePoint; r: number } {
  if (d.sh === 1 && d.nc && d.nr !== undefined) return { c: d.nc, r: d.nr };
  return { c: d.c, r: d.r };
}

// What the wait's globe marks (render/planet_marks.ts): the own pick of
// where to come back (the tap shown at once, else the one the server
// echoes), brought into the light the return comes back in as the sim
// brings it (return_pick.ts intoLight); where the champion fell; and while
// its Burr lasts, where the champion carrying it stands (the bu block's,
// what the owner's observation reads too, CONTEXT.md: Burr), so the pick
// can be made toward it or away from it.
export interface WaitMarks {
  pick: Vec3 | null;
  fell: Vec3 | null;
  burr: Vec3 | null;
}

export function waitMarks(
  r: Pick<SnapRoyale, 'st' | 'dusk' | 'bk' | 'bu'>,
  time: number,
  tapped: Vec3 | null,
  fell: Vec3 | null,
  radius: number,
): WaitMarks {
  const wire = r.bk ? { x: r.bk[0], y: r.bk[1], z: r.bk[2] } : null;
  const picked = tapped ?? wire;
  const light = returnLight(r.dusk);
  const cap = { center: { x: light.c[0], y: light.c[1], z: light.c[2] }, radius: light.r };
  return {
    pick: picked ? intoLight(picked, cap, radius) : null,
    fell,
    burr: burrTarget(r, time)?.at ?? null,
  };
}

// The wash while the globe shows (ui/hud.ts): its lines in a column left
// of the globe, which stands in the middle of the screen (render/
// planet_drop.ts RETURN_GLOBE_RIGHT). The globe at its farthest orbit
// spans RETURN_GLOBE_HALF_VH of the screen's height on each side of the
// middle, whatever the width; the column ends RETURN_WASH_GAP_VH before it
// and its lines are no wider than the column.
export const RETURN_GLOBE_HALF_VH = 27;
export const RETURN_WASH_GAP_VH = 3;

// The column's width in pixels on a screen of `width` by `height`.
export function returnWashColumnPx(width: number, height: number): number {
  return width / 2 - ((RETURN_GLOBE_HALF_VH + RETURN_WASH_GAP_VH) * height) / 100;
}

// On a phone the lines end RETURN_WASH_PHONE_BOTTOM_PX over the bottom,
// whatever the screen's height: above the notices' column and the bar
// (ui/royale_layout.ts compactNotesBox).
export const RETURN_WASH_PHONE_BOTTOM_PX = 164;

// And they start no higher than RETURN_WASH_PHONE_TOP_PX, under the top
// corner's chip (a Graft on offer) and the top line's first row: a column
// too tall for the room between starts there and runs on past its foot,
// where a dead champion's corner holds nothing, rather than off the top of
// the screen (ui/hud.ts, safe alignment).
export const RETURN_WASH_PHONE_TOP_PX = 44;

// With the thumb controls the touch bar stands at the left edge, Menu and
// Center over the middle of the screen's height (ui/touch_bar.ts), where
// the column's lines stand: the killer recap and the Burr's line ran under
// both at 844x390. So there the column starts RETURN_WASH_BAR_GAP_PX past
// the bar's right edge, the safe area included, and its lines wrap in what
// is left before the globe.
export const RETURN_WASH_BAR_GAP_PX = 8;

// Where the column's left edge stands from the screen's, past the safe
// area `safeLeft` wide: past the bar when it stands at the left.
export function returnWashLeftPx(barLeft: boolean, safeLeft = 0): number {
  if (!barLeft) return 0;
  return safeLeft + TOUCH_BAR_EDGE_PX + TOUCH_BAR_LEFT_W_PX + RETURN_WASH_BAR_GAP_PX;
}

// The same as CSS, the safe area as the stage gives it (game/match_stage.ts).
export function returnWashLeftCss(): string {
  const past = TOUCH_BAR_EDGE_PX + TOUCH_BAR_LEFT_W_PX + RETURN_WASH_BAR_GAP_PX;
  return `calc(${past}px + var(--safe-left, env(safe-area-inset-left, 0px)))`;
}

// The column's box on a phone `width` by `height`: from its left edge to
// the gap before the globe, from its top to its foot. Its lines stand
// anywhere between its edges, and lower only when they outgrow it.
export function returnWashPhoneBox(
  width: number,
  height: number,
  barLeft: boolean,
  safeLeft = 0,
): ScreenBox {
  return {
    left: returnWashLeftPx(barLeft, safeLeft),
    top: RETURN_WASH_PHONE_TOP_PX,
    right: returnWashColumnPx(width, height),
    bottom: height - RETURN_WASH_PHONE_BOTTOM_PX,
  };
}

// The wash's line under the recap while the globe shows: what to do with
// it, a phone's tap or a desktop's click, and once picked, that it holds.
export function returnHint(touch: boolean, picked: boolean): string {
  if (picked) return touch ? 'You come back where you tapped' : 'You come back where you clicked';
  return touch
    ? 'Tap the globe to choose where you come back'
    : 'Click the globe to choose where you come back';
}
