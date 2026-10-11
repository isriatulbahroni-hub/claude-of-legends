// The win card and the win line on the battle royale's screen (CONTEXT.md:
// Win card), drawn in the mode's own layer (ui/royale_hud.ts): the card
// on the landing, at the left, closed by its button or its clock
// (ui/royale_win_card.ts), and the line under the top line, in a row of
// its own with the Dusk's pill (ui/royale_win_line.ts says it). This
// module only draws.

import type { SnapRoyale } from '../net/royale_wire';
import type { RoyaleVariant } from '../sim/royale/types';
import { setHidden } from './dom_write';
import {
  closeWinCard,
  holdsSteps,
  stepsLanding,
  stepWinCard,
  WIN_CARD_CLOSE,
  WIN_DESK_LEFT_PX,
  WIN_DESK_TOP_PX,
  WIN_DESK_TYPE,
  WIN_PHONE_TYPE,
  WIN_TAPS_LEFT_PX,
  WIN_TAPS_TOP_PX,
  WIN_THUMBS_LEFT_PX,
  WIN_THUMBS_TOP_PX,
  type WinCardState,
  type WinCardType,
  winCardStart,
  winCardUp,
  winCardWidthCss,
  winCardWords,
} from './royale_win_card';
import {
  WIN_COMPACT_LINE_PAD_PX,
  WIN_COMPACT_LINE_PX,
  WIN_LINE_PAD_PX,
  WIN_LINE_PX,
  WIN_ROW_GAP_PX,
  winLine,
} from './royale_win_line';

const SAFE_LEFT = 'var(--safe-left, env(safe-area-inset-left, 0px))';
const SAFE_TOP = 'var(--safe-top, env(safe-area-inset-top, 0px))';

const type = (scope: string, t: WinCardType): string => `
${scope} .br-win-card { padding: ${t.padY}px ${t.padX}px; }
${scope} .br-win-card h3 { font-size: ${t.titlePx}px; line-height: ${t.titleLh}px;
  padding-right: ${t.close}px; }
${scope} .br-win-card ul { margin-top: ${t.gap}px; }
${scope} .br-win-card li { font-size: ${t.linePx}px; line-height: ${t.lineLh}px; }
${scope} .br-win-close { width: ${t.close - 2}px; height: ${t.close - 2}px; }`;

const CSS = `
/* The win line: under the head of the top line, small and on a dark
   ground so it reads over the planet. On a desktop the Dusk's pill stands
   under it (beside it while the Graft cards are open, ui/
   royale_cards_room.ts); on a phone beside it, the row under the head's. */
.br-sub { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.hud.compact .br-sub { flex-direction: row; gap: ${WIN_ROW_GAP_PX}px; }
.br-win { padding: 1px ${WIN_LINE_PAD_PX}px; border-radius: 999px; background: rgba(6, 10, 20, 0.62);
  color: #e9dcae; font-size: ${WIN_LINE_PX}px; font-weight: 700; letter-spacing: 0.2px;
  line-height: 16px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.hud.compact .br-win { font-size: ${WIN_COMPACT_LINE_PX}px; line-height: 15px;
  padding: 1px ${WIN_COMPACT_LINE_PAD_PX}px; }
/* The win card, at the left: gold edged like the first steps' card it
   stands in for, and gone the same way. */
.br-win-card { position: absolute; box-sizing: border-box;
  left: calc(${WIN_DESK_LEFT_PX}px + ${SAFE_LEFT}); top: calc(${WIN_DESK_TOP_PX}px + ${SAFE_TOP});
  width: ${winCardWidthCss(false, false)};
  border-radius: 10px; border: 1px solid #8a7430; border-left: 4px solid #e8c46c;
  background: rgba(12, 16, 26, 0.93); color: #f2e6c0; text-shadow: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.55); pointer-events: none;
  opacity: 0; visibility: hidden; transform: translateY(-6px);
  transition: opacity 0.35s, visibility 0.35s, transform 0.35s; }
.br-win-card.on { opacity: 1; visibility: visible; transform: none; }
.br-win-card h3 { margin: 0; font-weight: 800; color: #ffe08a; letter-spacing: 0.2px; }
.br-win-card ul { margin-bottom: 0; padding: 0; list-style: none; }
.br-win-card li { position: relative; padding-left: 13px; font-weight: 600; }
.br-win-card li::before { content: ''; position: absolute; left: 1px; top: calc(50% - 3px);
  width: 6px; height: 6px; transform: rotate(45deg); background: #e8c46c; }
.br-win-close { position: absolute; top: 5px; right: 5px; padding: 0; border-radius: 50%;
  border: 1px solid #6e5a24; background: transparent; color: #c9bd93; font: inherit;
  font-size: 15px; line-height: 1; cursor: pointer; pointer-events: auto;
  touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
.br-win-close:hover { color: #fff3cf; border-color: #c9a84a; }
/* A finger's reach round the button on a phone. */
.br-win-close::after { content: ''; position: absolute; inset: -11px; }
${type('.hud:not(.compact)', WIN_DESK_TYPE)}
${type('.hud.compact', WIN_PHONE_TYPE)}
.hud.compact .br-win-card { left: calc(${WIN_TAPS_LEFT_PX}px + ${SAFE_LEFT});
  top: calc(${WIN_TAPS_TOP_PX}px + ${SAFE_TOP}); width: ${winCardWidthCss(true, false)}; }
.hud.compact.thumbs .br-win-card { left: calc(${WIN_THUMBS_LEFT_PX}px + ${SAFE_LEFT});
  top: calc(${WIN_THUMBS_TOP_PX}px + ${SAFE_TOP}); width: ${winCardWidthCss(true, true)}; }
/* It steps aside, as the first steps' card does, while the Graft cards are
   opened again or a spotlight's word shows, and under the pause menu. */
.hud.br-cards-open .br-win-card, .hud.br-spotting .br-win-card,
.hud.overlay-open .br-win-card { visibility: hidden; opacity: 0; transition: none; }
`;

// The stylesheet, for a test to read.
export function winViewCss(): string {
  return CSS;
}

export interface WinViewHost {
  // The battle royale's layer the card is drawn in.
  layer: HTMLElement;
  // The HUD's root, whose classes say what covers the card.
  root: HTMLElement;
  variant: RoyaleVariant;
  // A person plays the seat: the card is theirs.
  playing: boolean;
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export class RoyaleWinView {
  private readonly host: WinViewHost;
  private readonly style: HTMLStyleElement;
  private readonly card: HTMLElement;
  // The win line, for the top line's row under the head.
  readonly line: HTMLElement;
  private state: WinCardState;
  private time = 0;

  constructor(host: WinViewHost) {
    this.host = host;
    this.state = winCardStart(host.playing);
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);
    this.line = el('span', 'br-win');
    this.line.hidden = true;
    const words = winCardWords(host.variant);
    this.card = el('div', 'br-win-card');
    this.card.setAttribute('role', 'status');
    const list = el('ul', '');
    for (const line of words.lines) list.appendChild(el('li', '', line));
    const close = el('button', 'br-win-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', WIN_CARD_CLOSE);
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      this.state = closeWinCard(this.state, this.time);
      this.card.classList.remove('on');
    });
    this.card.append(el('h3', '', words.title), list, close);
    host.layer.appendChild(this.card);
  }

  // One update: the card's clock, from the landing (`since`, null before
  // it) while nothing covers it, and the line's words.
  update(r: SnapRoyale, time: number, since: number | null, covered: boolean): void {
    this.time = time;
    const root = this.host.root;
    const aside =
      covered ||
      root.classList.contains('br-cards-open') ||
      root.classList.contains('br-spotting') ||
      root.classList.contains('overlay-open');
    this.state = stepWinCard(this.state, { time, landed: since !== null, covered: aside });
    this.card.classList.toggle('on', winCardUp(this.state, aside));
    const text = winLine(r, time, root.classList.contains('compact'));
    setHidden(this.line, text === null);
    if (text !== null && this.line.textContent !== text) this.line.textContent = text;
  }

  // The first steps wait while the card is still to come or up.
  holdsSteps(): boolean {
    return holdsSteps(this.state);
  }

  // The steps' landing, counted from the card's going.
  stepsLanding(since: number | null, time: number): number | null {
    return stepsLanding(this.state, since, time);
  }

  dispose(): void {
    this.card.remove();
    this.line.remove();
    this.style.remove();
  }
}
