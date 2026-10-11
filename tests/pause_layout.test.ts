// The pause menu's boxes (src/ui/pause_layout.ts, drawn by
// src/ui/pause_menu.ts): laid over the screen in a grid instead of one
// column to scroll through, with no box over another, the whole menu on
// one screen, Resume and Leave match always on the first one, and the grid
// across the width, at the desktops played and on a phone in landscape.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  actionsHeight,
  bodyFloor,
  DESKTOP_PAUSE,
  type PauseBoxes,
  PHONE_PAUSE,
  pauseBoxes,
  pauseKind,
  pauseLayoutCss,
  SETTINGS_ROWS_MOUSE,
  SETTINGS_ROWS_TOUCH,
  settingsHeight,
  sheetFloor,
  stackHeight,
} from '../src/ui/pause_layout';
import {
  PAUSE_FULLSCREEN,
  PAUSE_LEAVE,
  PAUSE_MENU_CSS,
  PAUSE_RESUME,
  PAUSE_TITLE,
} from '../src/ui/pause_menu';
import { overlaps, type ScreenBox } from '../src/ui/royale_layout';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The desktops at interface size 1 (ui_scale: 1 up to 1080 rows) and a
// phone in landscape, which plays on the compact HUD.
const SCREENS: readonly { w: number; h: number; compact: boolean }[] = [
  { w: 960, h: 540, compact: false },
  { w: 1024, h: 768, compact: false },
  { w: 1280, h: 720, compact: false },
  { w: 1366, h: 768, compact: false },
  { w: 1536, h: 864, compact: false },
  { w: 1920, h: 1080, compact: false },
  { w: 844, h: 390, compact: true },
];

// What the menu has room for at a larger interface size (ui_scale: the
// HUD zoomed, its pixels the screen's over the size) or in a short
// window: the settings box squeezed to its least at most, then the menu
// scrolls; a phone's browser bars and the smallest phones in landscape.
const SQUEEZED: readonly { w: number; h: number; compact: boolean; at: string }[] = [
  { w: 1366 / 1.75, h: 768 / 1.75, compact: false, at: '1366x768 at 175%' },
  { w: 1366 / 2, h: 768 / 2, compact: false, at: '1366x768 at 200%' },
  { w: 1280 / 1.5, h: 720 / 1.5, compact: false, at: '1280x720 at 150%' },
  { w: 1280 / 2, h: 720 / 2, compact: false, at: '1280x720 at 200%' },
  { w: 960 / 1.25, h: 540 / 1.25, compact: false, at: '960x540 at 125%' },
  { w: 1024 / 1.5, h: 768 / 1.5, compact: false, at: '1024x768 at 150%' },
  { w: 1440, h: 400, compact: false, at: 'a window 1440x400' },
  { w: 844, h: 320, compact: true, at: 'a phone at 844x320' },
  { w: 667, h: 325, compact: true, at: 'a phone at 667x325' },
  { w: 568, h: 320, compact: true, at: 'a phone at 568x320' },
];

const inside = (outer: ScreenBox, inner: ScreenBox): boolean =>
  inner.left >= outer.left - 1e-6 &&
  inner.top >= outer.top - 1e-6 &&
  inner.right <= outer.right + 1e-6 &&
  inner.bottom <= outer.bottom + 1e-6;

const screen = (w: number, h: number): ScreenBox => ({ left: 0, top: 0, right: w, bottom: h });

const named = (b: PauseBoxes): [string, ScreenBox][] => [
  ['title', b.head],
  ['actions', b.actions],
  ['settings', b.settings],
  ['ladder', b.ladder],
  ['feedback', b.feedback],
];

// The sheet's selector under the HUD's class for one set of metrics.
const sheetOf = (m: typeof DESKTOP_PAUSE): string =>
  `.hud${m === DESKTOP_PAUSE ? ':not(.compact)' : '.compact'} .hud-overlay.modal.hud-pause .hud-pause-sheet`;

const label = (s: { w: number; h: number; compact: boolean }): string =>
  `${s.w}x${s.h}${s.compact ? ' (touch)' : ''}`;

describe('the pause menu', () => {
  for (const s of SCREENS) {
    const b = pauseBoxes(s.w, s.h, s.compact);
    const m = s.compact ? PHONE_PAUSE : DESKTOP_PAUSE;

    it(`lays its boxes in three columns side by side at ${label(s)}`, () => {
      expect(b.kind).toBe('wide');
      expect(b.actions.right).toBeLessThanOrEqual(b.settings.left);
      expect(b.settings.right).toBeLessThanOrEqual(b.ladder.left);
      expect(b.feedback.left).toBe(b.ladder.left);
      // The three columns start together under the title.
      expect(b.settings.top).toBe(b.actions.top);
      expect(b.ladder.top).toBe(b.actions.top);
      expect(b.head.bottom).toBeLessThanOrEqual(b.actions.top);
    });

    it(`keeps every box clear of every other at ${label(s)}`, () => {
      const boxes = named(b);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const [an, a] = boxes[i]!;
          const [bn, bb] = boxes[j]!;
          expect(overlaps(a, bb), `${an} over ${bn}`).toBe(false);
        }
      }
    });

    it(`fits on one screen with no page scroll at ${label(s)}`, () => {
      expect(b.menuScrolls).toBe(false);
      expect(inside(screen(s.w, s.h), b.sheet)).toBe(true);
      for (const [name, x] of named(b)) expect(inside(b.sheet, x), name).toBe(true);
    });

    it(`keeps Resume and Leave match on the first screen at ${label(s)}`, () => {
      for (const button of [b.resume, b.fullscreen, b.leave]) {
        expect(inside(screen(s.w, s.h), button)).toBe(true);
        expect(inside(b.actions, button)).toBe(true);
      }
      expect(overlaps(b.resume, b.fullscreen)).toBe(false);
      expect(b.leave.top - b.fullscreen.bottom).toBeGreaterThanOrEqual(m.leaveGap);
      // A finger wide on a touchscreen.
      if (s.compact) expect(b.resume.bottom - b.resume.top).toBeGreaterThanOrEqual(44);
    });

    it(`spreads the grid across the width at ${label(s)}`, () => {
      const width = b.sheet.right - b.sheet.left;
      expect(width).toBe(Math.min(m.maxWidth, s.w - 2 * m.gutter));
      expect(width / s.w).toBeGreaterThanOrEqual(0.7);
      // The middle and the right columns share what the actions leave.
      expect(b.settings.right - b.settings.left).toBeCloseTo(b.ladder.right - b.ladder.left);
      expect(b.settings.right - b.settings.left).toBeGreaterThanOrEqual(280);
    });

    it(`shows the ladder and the feedback box whole at ${label(s)}`, () => {
      expect(b.ladder.bottom - b.ladder.top).toBe(m.ladderH);
      expect(b.feedback.bottom - b.feedback.top).toBeGreaterThanOrEqual(m.feedbackH);
      // Every settings row in view on a desktop; on a phone only a long
      // list may scroll, inside its own box.
      if (!s.compact) expect(b.settingsScrolls).toBe(false);
    });
  }

  for (const s of SQUEEZED) {
    it(`squeezes no box below its least on ${s.at}`, () => {
      const b = pauseBoxes(s.w, s.h, s.compact);
      const m = s.compact ? PHONE_PAUSE : DESKTOP_PAUSE;
      const boxes = named(b);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const [an, a] = boxes[i]!;
          const [bn, bb] = boxes[j]!;
          expect(overlaps(a, bb), `${an} over ${bn}`).toBe(false);
        }
      }
      expect(b.settings.bottom - b.settings.top).toBeGreaterThanOrEqual(m.settingsMinH);
      expect(b.ladder.bottom - b.ladder.top).toBe(m.ladderH);
      expect(b.feedback.bottom - b.feedback.top).toBeGreaterThanOrEqual(m.feedbackH);
      for (const [name, x] of named(b)) expect(inside(b.sheet, x), name).toBe(true);
      // The menu scrolls rather than squeeze further, Resume, Toggle
      // fullscreen and Leave match still on its first screen.
      if (!b.menuScrolls) expect(inside(screen(s.w, s.h), b.sheet)).toBe(true);
      else expect(b.sheet.top).toBe(m.gutter);
      for (const button of [b.resume, b.fullscreen, b.leave]) {
        expect(inside(screen(s.w, s.h), button)).toBe(true);
      }
    });
  }

  it('keeps the settings box at its least a label and two rows', () => {
    for (const m of [DESKTOP_PAUSE, PHONE_PAUSE]) {
      expect(m.settingsMinH).toBeGreaterThanOrEqual(settingsHeight(m, 2));
      expect(bodyFloor(m, 'two')).toBe(
        Math.max(actionsHeight(m) + m.gap + m.settingsMinH, stackHeight(m)),
      );
      expect(bodyFloor(m, 'wide')).toBe(stackHeight(m));
    }
    // A small phone in landscape still fits one screen at its floor.
    expect(pauseBoxes(667, 375, true).menuScrolls).toBe(false);
  });

  it("keeps the phone's settings in view at 844x390 too", () => {
    expect(pauseBoxes(844, 390, true, SETTINGS_ROWS_TOUCH).settingsScrolls).toBe(false);
  });

  it('falls back to two columns, then one, on a narrower screen', () => {
    // A small phone in landscape: the actions over the settings, the
    // ladder and the feedback beside them; the settings scroll in their box.
    const small = pauseBoxes(667, 375, true);
    expect(small.kind).toBe('two');
    expect(small.menuScrolls).toBe(false);
    expect(inside(screen(667, 375), small.sheet)).toBe(true);
    // A narrow window: one column that scrolls, the actions first.
    const narrow = pauseBoxes(480, 800, false);
    expect(narrow.kind).toBe('one');
    for (const b of [small, narrow]) {
      const boxes = named(b);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          expect(overlaps(boxes[i]![1], boxes[j]![1]), `${boxes[i]![0]} ${boxes[j]![0]}`).toBe(
            false,
          );
        }
      }
    }
    expect(inside(screen(667, 375), small.leave)).toBe(true);
    expect(inside(screen(480, 800), narrow.resume)).toBe(true);
    expect(inside(screen(480, 800), narrow.leave)).toBe(true);
  });

  it('chooses the columns from the width inside the gutters', () => {
    for (const m of [DESKTOP_PAUSE, PHONE_PAUSE]) {
      expect(pauseKind(m.wideFrom, m)).toBe('wide');
      expect(pauseKind(m.wideFrom - 1, m)).toBe('two');
      expect(pauseKind(m.twoFrom - 1, m)).toBe('one');
      // Three columns only where the middle one holds a settings row.
      const middle = (m.wideFrom - m.actionsWidth - 2 * m.gap) / 2;
      expect(middle - 2 * (m.pad + m.border)).toBeGreaterThanOrEqual(m.rowLabelW + 120);
    }
    expect(settingsHeight(DESKTOP_PAUSE, SETTINGS_ROWS_MOUSE)).toBeGreaterThan(
      actionsHeight(DESKTOP_PAUSE),
    );
    expect(stackHeight(DESKTOP_PAUSE)).toBe(
      DESKTOP_PAUSE.ladderH + DESKTOP_PAUSE.gap + DESKTOP_PAUSE.feedbackH,
    );
  });

  it('draws the grid from the same numbers', () => {
    const css = pauseLayoutCss();
    for (const m of [DESKTOP_PAUSE, PHONE_PAUSE]) {
      expect(css).toContain(`@container pause (min-width: ${m.wideFrom}px)`);
      expect(css).toContain(`@container pause (min-width: ${m.twoFrom}px)`);
      expect(css).toContain(
        `grid-template-columns: ${m.actionsWidth}px minmax(0, 1fr) minmax(0, 1fr)`,
      );
      expect(css).toContain(`max-width: ${m.maxWidth}px; gap: ${m.gap}px;`);
      expect(css).toContain(`.hud-pause-btn { height: ${m.buttonH}px; }`);
      // The floors, on a room shorter than them only: past them the menu
      // scrolls rather than squeeze, and with the room the sheet keeps its
      // own height.
      for (const kind of ['two', 'wide'] as const) {
        const floor = sheetFloor(m, kind);
        expect(floor).toBe(m.headH + m.gap + bodyFloor(m, kind));
        expect(css).toContain(
          `(height < ${floor}px) {\n  ${sheetOf(m)} { min-height: ${floor}px; }`,
        );
      }
      expect(css).toContain(
        `and (width < ${m.wideFrom}px) and (height < ${sheetFloor(m, 'two')}px)`,
      );
      // The actions never taller than the room under the title, so Leave
      // match stays on the first screen of a menu that scrolls.
      expect(css).toContain(
        `.hud-pause-actions { max-height: calc(100cqh - ${m.headH + m.gap}px); }`,
      );
    }
    expect(css).toContain('container: pause / size');
  });

  it('is what the HUD opens on Escape, with its words', () => {
    const hud = readFileSync(path.join(ROOT, 'src/ui/hud.ts'), 'utf8');
    expect(hud).toContain('fillPauseMenu(this.escapeOverlay, {');
    expect([PAUSE_TITLE, PAUSE_RESUME, PAUSE_FULLSCREEN, PAUSE_LEAVE]).toEqual([
      'Paused view',
      'Resume (Esc)',
      'Toggle fullscreen',
      'Leave match',
    ]);
  });

  it('stands the HUD down behind it, the battle royale layers included', () => {
    // Up, the HUD's root says so; its blocks and what the stage draws
    // after it (the edge arrows, the minimap) hide, so only the dimmed
    // match shows between the boxes and nothing stands over them. The turn
    // wall keeps its dark ground under the menu, as it did.
    const hud = readFileSync(path.join(ROOT, 'src/ui/hud.ts'), 'utf8');
    expect(hud).toContain(
      "this.rootEl.classList.toggle('paused', this.escapeOverlay.classList.contains('open'));",
    );
    expect(PAUSE_MENU_CSS).toContain(
      '.hud.paused > :not(.hud-pause):not(.hud-turn), .hud.paused ~ * { visibility: hidden; }',
    );
    expect(hud).toContain('.hud.overlay-open .hud-turn > * { visibility: hidden; }');
    expect(PAUSE_MENU_CSS).toContain(pauseLayoutCss());
  });
});
