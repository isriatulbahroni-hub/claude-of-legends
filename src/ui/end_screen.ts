// The end screens' boxes and their look: the battle royale's end card
// (ui/royale_hud.ts) and the 5v5's (ui/hud.ts), laid over the screen
// (ui/end_layout.ts has the grid). Each card makes its own boxes and keeps
// their behavior: the result with its buttons, the ranking or the
// scoreboard, the level bar, and the HUD's ladder box, account offer and
// feedback box. This places them and gives them the HUD's dark green and
// gold. A box shows what it holds: a hidden ladder box or a closed offer
// takes no room, and the grid closes over it.

import { END_ROOT, type EndCard, endLayoutCss, ROOT_RULE } from './end_layout';

// The account offer's class (ui/hud.ts makes the block): the one box the
// end screen lays in its own place rather than in a column.
export const END_OFFER_CLASS = 'hud-end-offer';

export function isEndOffer(e: HTMLElement): boolean {
  return e.classList.contains(END_OFFER_CLASS);
}

// Every rule under the end screen's sheet, at a weight above the HUD's
// rules for the boxes it borrows (the ladder, the offer, the feedback box,
// the scoreboard's rows) and for a phone's modal overlay, whichever
// stylesheet the page added last.
const R = `.hud ${ROOT_RULE}`;
const RC = `.hud.compact ${ROOT_RULE}`;
const S = `.hud ${END_ROOT} .end-sheet`;
const C = `.hud.compact ${END_ROOT} .end-sheet`;
// The buttons' row: the 5v5's, and the battle royale's (ui/royale_hud.ts).
const BTNS = ':is(.end-btns, .br-end-btns)';

export const END_SCREEN_CSS = `
/* While an end screen is up, the HUD's own blocks and what the match stage
   draws over the HUD (the minimap, the battle royale's edge arrows) stand
   down, as behind the pause menu: between the boxes and round the sheet
   only the dimmed match shows. The pause menu and the turn wall keep
   their places over it, and a replay its bar (ui/replay_bar.ts), so a
   replay played to its end still rewinds. */
.hud.ended > :not(${END_ROOT}):not(.hud-pause):not(.hud-turn), .hud.ended ~ :not(.replay-bar) {
  visibility: hidden; transition: none;
}
${R}, ${RC} {
  justify-content: flex-start; align-items: stretch; gap: 0; overflow-x: hidden; overflow-y: auto;
  pointer-events: auto; text-shadow: none;
  background: radial-gradient(ellipse at 50% 42%, rgba(6, 10, 4, 0.6), rgba(2, 4, 1, 0.84));
  scrollbar-width: thin; scrollbar-color: #6e5a24 transparent;
}
${S} {
  width: 100%; margin: auto; flex: none; min-height: 0; box-sizing: border-box;
  animation: end-in 0.45s ease-out;
}
@keyframes end-in { from { opacity: 0; transform: translateY(12px); } }
@media (prefers-reduced-motion: reduce) { ${S} { animation: none; } }
${S} .end-lead, ${S} .end-side {
  display: flex; flex-direction: column; min-width: 0; min-height: 0;
}
${S} .end-box {
  box-sizing: border-box; min-width: 0; margin: 0; width: auto; max-width: none;
  border-style: solid; border-color: #3c5228; border-radius: 12px; color: #d8e6c0;
  text-align: left; text-shadow: none; pointer-events: auto;
  background: linear-gradient(180deg, rgba(24, 35, 16, 0.97), rgba(13, 19, 9, 0.97));
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
/* The result: the first box, edged in gold, its words in the middle and
   the ways on at their foot. It takes the height its column leaves. */
${S} .end-head {
  flex: 1 1 auto; display: flex; flex-direction: column; justify-content: center;
  text-align: center; border-color: #6e5c26;
  background:
    radial-gradient(ellipse at 50% 0%, rgba(201, 168, 74, 0.16), rgba(201, 168, 74, 0) 70%),
    linear-gradient(180deg, rgba(30, 41, 19, 0.98), rgba(13, 19, 9, 0.98));
}
${S} .end-head.won { border-color: #b8963f;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 0 28px rgba(232, 196, 108, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.05); }
${S} .end-head > * { margin: 0; flex: none; }
${S} .br-end-kicker {
  font-size: 11px; font-weight: 800; letter-spacing: 1.6px; text-transform: uppercase;
  color: #c9a84a;
}
${S} .end-title, ${S} .br-end-card h2 {
  margin: 0; font-family: Cinzel, Georgia, serif; font-size: 30px; font-weight: 700;
  letter-spacing: 2px; line-height: 1.12; text-transform: uppercase; color: #f2e6c0;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.7); text-wrap: balance; overflow-wrap: anywhere;
}
${S} .end-head.won h2 { color: #ffe08a; text-shadow: 0 0 22px rgba(240, 206, 120, 0.5); }
${S} .end-lines { display: flex; flex-direction: column; gap: 2px; }
${S} .end-lines > * { margin: 0; font-size: 13.5px; line-height: 16px; color: #c9bd93;
  text-wrap: balance; }
${S} .end-lines > :first-child { font-size: 15px; font-weight: 700; color: #f2e6c0; }
${S} .hud-end-rating { min-height: 0; font-weight: 700; }
/* The ways on: the first in gold, the others dark; the battle royale's
   first across the box, the two others side by side under it. */
${S} ${BTNS} {
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); margin: 0;
}
${S}.royale ${BTNS} > .primary { grid-column: 1 / -1; }
${S} ${BTNS} button {
  margin: 0; min-width: 0; padding: 6px 12px; border-radius: 8px; cursor: pointer;
  font: inherit; font-size: 14px; font-weight: 700; line-height: 1.2; letter-spacing: 0.2px;
  border: 1px solid #55703a; color: #e4edd0; text-shadow: none;
  background: linear-gradient(180deg, #26361b, #172211);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
${S} ${BTNS} button:hover { border-color: #c9a84a; color: #fff3cf; transform: translateY(-1px); }
${S} ${BTNS} button.primary {
  font-weight: 800; letter-spacing: 0.6px; color: #241a08; border-color: #f0deae;
  background: linear-gradient(180deg, #e8cc74 0%, #c9a84a 55%, #a07830 100%);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.25);
}
${S} ${BTNS} button:focus-visible { outline: 2px solid #c9a84a; outline-offset: 2px; }
/* A box's own label, gold over a rule, like the pause menu's. */
${S} .end-label {
  display: flex; align-items: center; gap: 10px; margin: 0; font-size: 11px; font-weight: 800;
  letter-spacing: 1.6px; text-transform: uppercase; color: #c9a84a;
}
${S} .end-label::after { content: ''; flex: 1; height: 1px; background: rgba(201, 168, 74, 0.28); }
/* The battle royale's level bar and Grafts, under the result. */
${S} .end-progress { display: flex; flex-direction: column; }
/* Past the longest the column was measured for (a long match's Grafts),
   this box gives up its height and scrolls inside itself, never the
   result over it or the page. */
${S} .end-head { flex-shrink: 0; }
${S} .end-progress { flex: 0 1 auto; min-height: 0; overflow-y: auto;
  scrollbar-width: thin; scrollbar-color: #6e5a24 transparent; }
${S} .end-progress .br-goal { margin: 0; width: auto; }
${S} .end-progress .br-end-grafts { margin: 0; font-size: 13px; line-height: 17px; }
/* The tables: the ranking and the scoreboard. They give up their height
   first, and scroll inside their box. */
${S} .end-table { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
${S} .end-rows {
  flex: 1 1 auto; min-height: 0; overflow-y: auto; margin-top: 4px;
  scrollbar-width: thin; scrollbar-color: #6e5a24 transparent;
}
${S} .br-end-row { box-sizing: border-box; padding: 0 8px; gap: 10px; font-size: 13.5px; }
${S} .br-end-row img { border-color: #4a5c34; background: #10160c; }
${S} .hud-end-card.end-table {
  overflow-y: auto; scrollbar-width: thin; scrollbar-color: #6e5a24 transparent;
}
${S} .hud-score-team h4 { display: flex; align-items: center; margin: 0; box-sizing: border-box; }
${S} .hud-score-team + .hud-score-team .hud-score-row.head { display: none; }
${S} .hud-score-row { box-sizing: border-box; padding: 0 6px; gap: 6px; font-size: 13px; }
${S} .hud-score-row.head { padding-bottom: 0; align-items: end; }
/* The HUD's boxes in the grid: the ladder in gold, the offer in a
   brighter gold (the one box that asks for a decision), the feedback box
   in the column's green, its field taking the height the column leaves. */
${S} .hud-ladder {
  border-color: #6e5c26;
  background: linear-gradient(180deg, rgba(44, 37, 15, 0.97), rgba(26, 22, 10, 0.97));
}
${S} .hud-ladder-row .hud-menu-btn, ${S} .hud-feedback-row .hud-menu-btn,
${S} .hud-end-offer .hud-menu-btn { margin: 0; min-height: 36px; }
${S} .hud-ladder-row .hud-menu-btn { padding: 0 16px; }
${S} .${END_OFFER_CLASS} {
  display: none; align-items: center; flex-wrap: wrap; gap: 10px 16px; color: #e6dcb8;
  border-color: #8a7430; container: offer / inline-size;
  background: linear-gradient(180deg, rgba(52, 43, 17, 0.98), rgba(28, 23, 10, 0.98));
}
${S} .${END_OFFER_CLASS}.open { display: flex; }
${S} .hud-end-offer-words { flex: 1 1 260px; min-width: 0; }
${S} .hud-end-offer b { display: block; font-size: 15px; line-height: 19px; color: #f2e6c0; }
${S} .hud-end-offer span {
  display: block; margin-top: 2px; font-size: 12.5px; line-height: 1.35; color: #c9bd93;
}
${S} .hud-end-offer .hud-menu-btn {
  flex: none; padding: 8px 18px; border-color: #c9a84a; background: #3a3014; color: #f2e6c0;
  font-weight: 700; white-space: nowrap;
}
${S} .hud-end-offer .hud-menu-btn:hover { border-color: #f0deae; }
@container offer (width < 440px) {
  ${S} .hud-end-offer .hud-menu-btn { flex: 1 1 100%; min-width: 0; white-space: normal; }
}
${S} .hud-feedback { display: flex; flex-direction: column; container: feedback / inline-size; }
${S} .end-side > .hud-feedback { flex: 1 1 auto; }
${S} .hud-feedback-row { flex: 1 1 auto; min-height: 0; align-items: flex-end; }
${S} .hud-feedback-row .hud-menu-btn { align-self: flex-end; }
${S} .hud-feedback-field { align-self: stretch; min-height: 60px; }
/* A narrow column: the field keeps the room for its three lines of
   words, Send drawn tighter beside it. */
@container feedback (width < 300px) {
  ${S} .hud-feedback-field { font-size: 12px; line-height: 15px; min-height: 78px; }
  ${S} .hud-feedback-row .hud-menu-btn { padding: 0 10px; }
}
/* The 5v5's Discord line, under the feedback box. */
${S} .hud-end-join { margin: 0; flex: none; font-size: 12.5px; line-height: 16px;
  color: #9fb089; text-shadow: none; }
/* A phone: smaller words, the buttons still a finger wide. */
${C} .end-box { border-radius: 10px; }
${C} .br-end-kicker { font-size: 10px; letter-spacing: 1.3px; }
${C} .end-title, ${C} .br-end-card h2 { font-size: 20px; letter-spacing: 1.2px; }
${C} .end-lines > * { font-size: 11.5px; line-height: 13px; }
${C} .end-lines > :first-child { font-size: 12.5px; }
${C} ${BTNS} button { font-size: 13px; padding: 4px 8px; border-radius: 7px; }
${C} .end-label { font-size: 10px; letter-spacing: 1.3px; }
${C} .end-progress .br-goal-line { font-size: 11px; }
${C} .end-progress .br-end-grafts { font-size: 11.5px; line-height: 14px; }
${C} .br-end-row { font-size: 12px; padding: 0 6px; gap: 6px; }
${C} .hud-score-row { font-size: 11.5px; padding: 0 5px; gap: 5px; }
${C} .hud-end-offer { gap: 6px 10px; }
${C} .hud-end-offer b { font-size: 13px; line-height: 16px; }
${C} .hud-end-offer span { font-size: 11.5px; line-height: 1.3; }
${C} .hud-ladder-row .hud-menu-btn, ${C} .hud-feedback-row .hud-menu-btn,
${C} .hud-end-offer .hud-menu-btn { min-height: 44px; }
${C} .hud-end-offer .hud-menu-btn { padding: 4px 10px; }
${C} .hud-feedback-field { min-height: 44px; }
@container feedback (width < 300px) {
  ${C} .hud-feedback-words b { font-size: 11px; }
  ${C} .hud-feedback-field { font-size: 10.5px; line-height: 13px; padding: 4px 6px; min-height: 60px; }
}
${C} .hud-end-join { font-size: 11px; line-height: 14px; }
${endLayoutCss()}
`;

let cssInstalled = false;
function ensureCss(): void {
  if (cssInstalled) return;
  cssInstalled = true;
  const style = document.createElement('style');
  style.textContent = END_SCREEN_CSS;
  document.head.appendChild(style);
}

// What a card hands the screen: the result with its buttons, the boxes
// under it, its table, the boxes of the side column and the words under
// them, and the boxes with a place of their own. The battle royale's lead
// holds the level bar and the Grafts, its side the ladder over the
// feedback box, and its offer stands under the ranking; the 5v5's side
// holds the offer over the feedback box and the Discord line under them,
// and its ladder stands under the result (under the scoreboard on a
// phone).
export interface EndParts {
  head: HTMLElement;
  lead: readonly HTMLElement[];
  table: HTMLElement | null;
  side: readonly HTMLElement[];
  foot: HTMLElement | null;
  offer: HTMLElement | null;
  ladder: HTMLElement | null;
}

function div(cls: string): HTMLElement {
  const e = document.createElement('div');
  e.className = cls;
  return e;
}

// The sheet's parts in the document's order, which is the order Tab walks
// them in (the grid places them by name, whatever the order): the result
// and its buttons first, the 5v5's ladder next (it stands under the
// result), then the table, the side column and the battle royale's offer.
export const END_ORDER = ['lead', 'ladder', 'table', 'side', 'offer'] as const;

// Fills a card's root (the battle royale's screen, the HUD's overlay) with
// the sheet of boxes.
export function fillEndScreen(root: HTMLElement, card: EndCard, parts: EndParts): HTMLElement {
  ensureCss();
  root.classList.add(END_ROOT.slice(1));
  const sheet = div(`end-sheet ${card}`);
  const lead = div('end-lead');
  parts.head.classList.add('end-box', 'end-head');
  lead.appendChild(parts.head);
  for (const b of parts.lead) {
    b.classList.add('end-box');
    lead.appendChild(b);
  }
  parts.table?.classList.add('end-box', 'end-table');
  const side = div('end-side');
  for (const b of parts.side) {
    b.classList.add('end-box');
    side.appendChild(b);
  }
  if (parts.foot) side.appendChild(parts.foot);
  parts.offer?.classList.add('end-box', 'end-offer');
  parts.ladder?.classList.add('end-box');
  const placed: Record<(typeof END_ORDER)[number], HTMLElement | null> = {
    lead,
    ladder: parts.ladder,
    table: parts.table,
    side,
    offer: parts.offer,
  };
  for (const key of END_ORDER) {
    const part = placed[key];
    if (part) sheet.appendChild(part);
  }
  root.appendChild(sheet);
  return sheet;
}
