// The goal across battle royales in one line (ui/royale_goal_lines.ts
// decides it): the level, a small bar from it to the next, and the points
// the next still wants, after an optional lead ("Welcome back"). Whoever
// shows it sets the size; the line keeps the gold of the end card's bar
// (ui/royale_goal_bar.ts). The level, the bar and the points hold
// together: a host that lets the line wrap (.wraps) breaks it after the
// lead and nowhere else.

import type { GoalLine } from './royale_goal_lines';
import { pointsText } from './royale_goal_lines';

const CSS = `
.goal-line { display: inline-flex; align-items: center; column-gap: 0.6em; row-gap: 0.2em;
  max-width: 100%; font-variant-numeric: tabular-nums; white-space: nowrap; color: #e6dcb8; }
.goal-line.wraps { flex-wrap: wrap; }
.goal-line[hidden] { display: none; }
.goal-line-run { display: inline-flex; align-items: center; gap: 0.6em; min-width: 0; }
.goal-line small { font-size: 1em; font-weight: 700; color: #f2e6c0; }
.goal-line b { font-weight: 800; color: #ffe08a; letter-spacing: 0.3px; }
.goal-line-track { position: relative; flex: none; width: 5.2em; height: 0.5em; border-radius: 999px;
  overflow: hidden; background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 0 0 1px rgba(201, 168, 74, 0.5); }
.goal-line-track i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px;
  background: linear-gradient(90deg, #c9a84a, #fff1b8); box-shadow: 0 0 8px rgba(255, 220, 120, 0.6);
  transition: width 0.6s cubic-bezier(0.2, 0.7, 0.2, 1); }
.goal-line-run span { overflow: hidden; text-overflow: ellipsis; }
@media (prefers-reduced-motion: reduce) { .goal-line-track i { transition: none; } }
`;

let cssInstalled = false;
function ensureCss(): void {
  if (cssInstalled) return;
  cssInstalled = true;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
}

export interface GoalLineView {
  root: HTMLElement;
  // Shows a total's line; a repeat of the last one changes nothing.
  draw(line: GoalLine): void;
}

export function goalLineView(cls: string, lead: string | null = null): GoalLineView {
  ensureCss();
  const root = document.createElement('div');
  root.className = `goal-line ${cls}`;
  root.setAttribute('role', 'img');
  const level = document.createElement('b');
  const track = document.createElement('i');
  track.className = 'goal-line-track';
  const fill = document.createElement('i');
  track.appendChild(fill);
  const left = document.createElement('span');
  if (lead !== null) {
    const small = document.createElement('small');
    small.textContent = lead;
    root.appendChild(small);
  }
  const run = document.createElement('span');
  run.className = 'goal-line-run';
  run.append(level, track, left);
  root.appendChild(run);
  let shown = '';
  return {
    root,
    draw(line: GoalLine): void {
      const key = `${line.text}|${line.share}`;
      if (key === shown) return;
      shown = key;
      level.textContent = `Level ${line.level}`;
      left.textContent = `${pointsText(line.left)} to Level ${line.next}`;
      fill.style.width = `${(Math.max(0, Math.min(1, line.share)) * 100).toFixed(1)}%`;
      root.setAttribute('aria-label', lead !== null ? `${lead}. ${line.text}` : line.text);
    },
  };
}
