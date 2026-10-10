// Where the pause menu (the Escape menu, ui/pause_menu.ts) puts its boxes:
// a grid over the screen rather than one column to scroll through. The
// title across the top, then the actions (Resume, Toggle fullscreen, Leave
// match), the settings, and a stack of the ladder box over the feedback
// box, side by side. A narrower screen takes two columns (the actions over
// the settings, the stack beside them), and a narrow one a single column
// that scrolls, the actions first.
//
// Pure numbers, the grid's CSS made from them, and the boxes they make on
// a screen at interface size 1, so a test keeps the boxes apart, Resume
// and Leave match on the first screen and the grid across the width at
// every size played. A box's height here is its tallest (a ladder line
// that wraps, a refusal under the name field); the browser draws it at
// most that tall.

import type { ScreenBox } from './royale_layout';

export interface PauseMetrics {
  // The menu's padding on every side of the screen, and the gap between
  // the boxes.
  gutter: number;
  gap: number;
  // The grid's widest, and the actions' column.
  maxWidth: number;
  actionsWidth: number;
  // The width inside the gutters from which three columns stand side by
  // side, and two.
  wideFrom: number;
  twoFrom: number;
  // The title's row.
  headH: number;
  // A box's padding and border, and the settings box's label with its
  // margin.
  pad: number;
  border: number;
  labelH: number;
  // The actions' buttons, the gap between them, and the room Leave match
  // keeps from the two above it.
  buttonH: number;
  buttonGap: number;
  leaveGap: number;
  // A settings row, and the gap between two.
  rowH: number;
  rowGap: number;
  // The width of a settings row's label.
  rowLabelW: number;
  // The ladder box and the feedback box at their tallest, border included.
  ladderH: number;
  feedbackH: number;
}

// A mouse and a keyboard, from 960x540 to 1920x1080.
export const DESKTOP_PAUSE: PauseMetrics = {
  gutter: 24,
  gap: 14,
  maxWidth: 1360,
  actionsWidth: 236,
  wideFrom: 860,
  twoFrom: 520,
  headH: 40,
  pad: 16,
  border: 1,
  labelH: 25,
  buttonH: 42,
  buttonGap: 8,
  leaveGap: 16,
  rowH: 26,
  rowGap: 10,
  rowLabelW: 118,
  ladderH: 178,
  feedbackH: 140,
};

// A touchscreen (the compact HUD), a phone in landscape first: smaller
// words, buttons a finger wide (game/ui_scale.ts MIN_TAP_PX).
export const PHONE_PAUSE: PauseMetrics = {
  gutter: 10,
  gap: 8,
  maxWidth: 1360,
  actionsWidth: 156,
  wideFrom: 660,
  twoFrom: 440,
  headH: 26,
  pad: 10,
  border: 1,
  labelH: 18,
  buttonH: 44,
  buttonGap: 6,
  leaveGap: 10,
  rowH: 30,
  rowGap: 6,
  rowLabelW: 100,
  ladderH: 142,
  feedbackH: 112,
};

// The settings panel's rows (ui/settings_panel.ts): the volumes, the
// announcer, the interface size and the first steps, with the left click
// on a mouse, or the touch controls and the upright phone on a touchscreen.
export const SETTINGS_ROWS_MOUSE = 6;
export const SETTINGS_ROWS_TOUCH = 7;

export type PauseKind = 'wide' | 'two' | 'one';

// The layout for the width inside the gutters.
export function pauseKind(innerWidth: number, m: PauseMetrics): PauseKind {
  if (innerWidth >= m.wideFrom) return 'wide';
  if (innerWidth >= m.twoFrom) return 'two';
  return 'one';
}

// The boxes' heights as drawn with nothing squeezing them.
export function actionsHeight(m: PauseMetrics): number {
  return 2 * (m.pad + m.border) + 3 * m.buttonH + 2 * m.buttonGap + m.leaveGap;
}

export function settingsHeight(m: PauseMetrics, rows: number): number {
  return 2 * (m.pad + m.border) + m.labelH + rows * m.rowH + (rows - 1) * m.rowGap;
}

export function stackHeight(m: PauseMetrics): number {
  return m.ladderH + m.gap + m.feedbackH;
}

export interface PauseBoxes {
  kind: PauseKind;
  sheet: ScreenBox;
  head: ScreenBox;
  actions: ScreenBox;
  resume: ScreenBox;
  fullscreen: ScreenBox;
  leave: ScreenBox;
  settings: ScreenBox;
  ladder: ScreenBox;
  feedback: ScreenBox;
  // The settings box is shorter than its rows and scrolls inside itself.
  settingsScrolls: boolean;
}

const box = (left: number, top: number, width: number, height: number): ScreenBox => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

// The actions' three buttons in their box: Resume and Toggle fullscreen at
// its top, Leave match at its foot.
function buttons(
  m: PauseMetrics,
  actions: ScreenBox,
): Pick<PauseBoxes, 'resume' | 'fullscreen' | 'leave'> {
  const inset = m.pad + m.border;
  const width = actions.right - actions.left - 2 * inset;
  const left = actions.left + inset;
  const resume = box(left, actions.top + inset, width, m.buttonH);
  const fullscreen = box(left, resume.bottom + m.buttonGap, width, m.buttonH);
  const leave = box(left, actions.bottom - inset - m.buttonH, width, m.buttonH);
  return { resume, fullscreen, leave };
}

// The boxes on a screen width x height at interface size 1, compact for a
// touchscreen, with the settings panel's rows.
export function pauseBoxes(
  width: number,
  height: number,
  compact: boolean,
  rows: number = compact ? SETTINGS_ROWS_TOUCH : SETTINGS_ROWS_MOUSE,
): PauseBoxes {
  const m = compact ? PHONE_PAUSE : DESKTOP_PAUSE;
  const innerW = width - 2 * m.gutter;
  const innerH = height - 2 * m.gutter;
  const kind = pauseKind(innerW, m);
  const sheetW = Math.min(m.maxWidth, innerW);
  const left = (width - sheetW) / 2;
  const actionsN = actionsHeight(m);
  const settingsN = settingsHeight(m, rows);
  const stackN = stackHeight(m);

  if (kind === 'one') {
    // One column at its natural heights, from the top; the menu scrolls.
    const head = box(left, m.gutter, sheetW, m.headH);
    const actions = box(left, head.bottom + m.gap, sheetW, actionsN);
    const settings = box(left, actions.bottom + m.gap, sheetW, settingsN);
    const ladder = box(left, settings.bottom + m.gap, sheetW, m.ladderH);
    const feedback = box(left, ladder.bottom + m.gap, sheetW, m.feedbackH);
    const sheet = box(left, head.top, sheetW, feedback.bottom - head.top);
    return {
      kind,
      sheet,
      head,
      actions,
      ...buttons(m, actions),
      settings,
      ladder,
      feedback,
      settingsScrolls: false,
    };
  }

  // The body under the title as tall as its tallest column, and never
  // taller than the screen: the settings box gives the height back.
  const bodyRoom = innerH - m.headH - m.gap;
  if (kind === 'two') {
    const colW = (sheetW - m.gap) / 2;
    const bodyH = Math.min(Math.max(actionsN + m.gap + settingsN, stackN), bodyRoom);
    const top = (height - (m.headH + m.gap + bodyH)) / 2;
    const head = box(left, top, sheetW, m.headH);
    const bodyTop = head.bottom + m.gap;
    const actions = box(left, bodyTop, colW, actionsN);
    const settingsH = bodyH - actionsN - m.gap;
    const settings = box(left, actions.bottom + m.gap, colW, settingsH);
    const right = left + colW + m.gap;
    const ladder = box(right, bodyTop, colW, m.ladderH);
    const feedback = box(right, ladder.bottom + m.gap, colW, bodyH - m.ladderH - m.gap);
    return {
      kind,
      sheet: box(left, top, sheetW, m.headH + m.gap + bodyH),
      head,
      actions,
      ...buttons(m, actions),
      settings,
      ladder,
      feedback,
      settingsScrolls: settingsH < settingsN,
    };
  }

  const colW = (sheetW - m.actionsWidth - 2 * m.gap) / 2;
  const bodyH = Math.min(Math.max(actionsN, settingsN, stackN), bodyRoom);
  const top = (height - (m.headH + m.gap + bodyH)) / 2;
  const head = box(left, top, sheetW, m.headH);
  const bodyTop = head.bottom + m.gap;
  // Every box in the row as tall as the row: the actions keep Leave match
  // at their foot, the feedback box's field takes what the ladder leaves.
  const actions = box(left, bodyTop, m.actionsWidth, bodyH);
  const settings = box(actions.right + m.gap, bodyTop, colW, bodyH);
  const ladder = box(settings.right + m.gap, bodyTop, colW, m.ladderH);
  const feedback = box(ladder.left, ladder.bottom + m.gap, colW, bodyH - m.ladderH - m.gap);
  return {
    kind,
    sheet: box(left, top, sheetW, m.headH + m.gap + bodyH),
    head,
    actions,
    ...buttons(m, actions),
    settings,
    ladder,
    feedback,
    settingsScrolls: bodyH < settingsN,
  };
}

// The grid's own rules for one set of metrics, scoped under the HUD's
// class for it. The menu is a size container, so the columns follow the
// room it has inside its gutters (and the safe area): the turned stage's
// and the interface size's, not the page's.
function gridCss(scope: string, m: PauseMetrics): string {
  const sheet = `${scope} .hud-pause-sheet`;
  return `
${scope} {
  padding: calc(${m.gutter}px + var(--safe-top, 0px)) calc(${m.gutter}px + var(--safe-right, 0px))
    calc(${m.gutter}px + var(--safe-bottom, 0px)) calc(${m.gutter}px + var(--safe-left, 0px));
}
${sheet} { max-width: ${m.maxWidth}px; gap: ${m.gap}px; }
${sheet} .hud-pause-head { height: ${m.headH}px; }
${sheet} .hud-pause-stack { gap: ${m.gap}px; }
${sheet} .hud-pause-card { padding: ${m.pad}px; border-width: ${m.border}px; }
${sheet} .hud-pause-label { height: ${m.labelH}px; }
${sheet} .hud-pause-actions { gap: ${m.buttonGap}px; }
${sheet} .hud-pause-btn { height: ${m.buttonH}px; }
${sheet} .hud-pause-btn.fullscreen { margin-bottom: ${m.leaveGap}px; }
${sheet} .set-panel { gap: ${m.rowGap}px; }
${sheet} .set-row { min-height: ${m.rowH}px; }
${sheet} .set-row label { width: ${m.rowLabelW}px; }
@container pause (min-width: ${m.twoFrom}px) {
  ${sheet} {
    max-height: 100%; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas: 'head head' 'actions stack' 'settings stack';
  }
}
@container pause (min-width: ${m.wideFrom}px) {
  ${sheet} {
    grid-template-columns: ${m.actionsWidth}px minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: 'head head head' 'actions settings stack';
  }
}`;
}

// The menu is the container the columns are chosen by; one column is the
// layout until it has the room for two.
export function pauseLayoutCss(): string {
  const menu = '.hud .hud-overlay.modal.hud-pause';
  return `
${menu} { container: pause / size; }
${menu} .hud-pause-sheet {
  display: grid; grid-template-columns: minmax(0, 1fr);
  grid-template-areas: 'head' 'actions' 'settings' 'stack';
}
${menu} .hud-pause-head { grid-area: head; }
${menu} .hud-pause-actions { grid-area: actions; }
${menu} .hud-pause-settings { grid-area: settings; }
${menu} .hud-pause-stack { grid-area: stack; }
${gridCss('.hud:not(.compact) .hud-overlay.modal.hud-pause', DESKTOP_PAUSE)}
${gridCss('.hud.compact .hud-overlay.modal.hud-pause', PHONE_PAUSE)}`;
}
