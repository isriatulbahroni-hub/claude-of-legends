// The touch bar: the handful of orders that only live on keys with no
// finger equivalent (B recall, P shop, Esc menu, Space recenter) as
// buttons on the right screen edge, clear of the minimap in the corner.
// Boot builds it on coarse-pointer devices only. Its buttons are a
// finger's size (MIN_TAP_PX; they were 38 px tall), and it keeps clear of
// a phone's notch and rounded corners (the safe area: index.html asks for
// the whole screen with viewport-fit=cover, so the page has to step in
// from the edges itself). The insets are the match stage's
// (game/match_stage.ts), which trade edges when the stage is turned.

import { MIN_TAP_PX } from '../game/ui_scale';
import { draughtSlot } from '../sim/content/items';
import { draughtLeft } from '../sim/draught';
import type { Unit } from '../sim/unit';
import type { ScreenBox } from './royale_layout';

// Where the bar stands, for what keeps clear of it (ui/royale_return.ts):
// its distance in from the screen's edge (past the safe area), the gap
// between its buttons, and on the left, where the thumb controls put it,
// its width and the height of its middle, in percent of the screen's. The
// left bar's buttons stretch to its width, which holds the widest label
// (Recall, Center) at 12 px bold with its padding, drawn 65 px wide.
export const TOUCH_BAR_EDGE_PX = 8;
export const TOUCH_BAR_GAP_PX = 8;
export const TOUCH_BAR_LEFT_W_PX = 68;
export const TOUCH_BAR_LEFT_MID_PCT = 38;

// The left bar's box on a screen `height` tall with `buttons` buttons, the
// safe area `safeLeft` wide: Menu and Center in a battle royale, Drink too
// while a Sapdraught is carried in a 5v5, Shop and Recall there besides.
export function touchBarLeftBox(height: number, buttons: number, safeLeft = 0): ScreenBox {
  const tall = buttons * MIN_TAP_PX + Math.max(0, buttons - 1) * TOUCH_BAR_GAP_PX;
  const mid = (TOUCH_BAR_LEFT_MID_PCT * height) / 100;
  const left = safeLeft + TOUCH_BAR_EDGE_PX;
  return { left, top: mid - tall / 2, right: left + TOUCH_BAR_LEFT_W_PX, bottom: mid + tall / 2 };
}

// The recall and the shop are absent in a battle royale (ADR 0031), and
// so are their buttons. Drink shows only while a Sapdraught is carried,
// greyed while one is being drunk.
export interface TouchBarActions {
  onRecall?(): void;
  onToggleShop?(): void;
  onDrink?(): void;
  onToggleMenu(): void;
  onRecenterCamera(): void;
}

export const TOUCH_BAR_CSS = `
.touchbar {
  /* Above the vertical middle: the minimap owns the bottom-right corner. */
  position: absolute;
  right: calc(${TOUCH_BAR_EDGE_PX}px + var(--safe-right, env(safe-area-inset-right, 0px)));
  top: 40%;
  transform: translateY(-50%);
  display: flex; flex-direction: column; gap: ${TOUCH_BAR_GAP_PX}px; z-index: 30;
}
.touchbar-btn {
  min-width: 56px; min-height: ${MIN_TAP_PX}px; padding: 0 8px;
  border-radius: 8px; border: 1px solid #466030;
  background: rgba(20, 30, 12, 0.72); color: #d8e6c0;
  font: 700 12px system-ui, sans-serif; letter-spacing: 0.04em;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.touchbar-btn:active { background: rgba(70, 96, 48, 0.9); }
/* With the thumb controls the right edge belongs to the casting thumb. Its
   width is set, so what keeps clear of it knows where it ends. */
.touchbar.left {
  right: auto; left: calc(${TOUCH_BAR_EDGE_PX}px + var(--safe-left, env(safe-area-inset-left, 0px)));
  top: ${TOUCH_BAR_LEFT_MID_PCT}%; width: ${TOUCH_BAR_LEFT_W_PX}px;
}
/* On the right, Drink sits beside the bottom button so the column keeps its
   height between the score box and the minimap; on the left the column has
   the room, and beside it is the stick's. */
.touchbar-btn.drink { position: absolute; bottom: 0; right: calc(100% + 8px); }
.touchbar.left .touchbar-btn.drink { position: static; }
.touchbar-btn.drink.busy { opacity: 0.45; filter: grayscale(1); }
`;

// The Drink button's look for the champion: hidden with no Sapdraught
// carried (or dead), greyed while a draught still runs, else ready.
export type DrinkButton = 'hidden' | 'busy' | 'ready';

export function drinkButton(me: Unit | undefined, time: number): DrinkButton {
  if (!me || me.dead || draughtSlot(me.items) === -1) return 'hidden';
  return draughtLeft(me, time) > 0 ? 'busy' : 'ready';
}

export interface TouchBar {
  // Shows the Drink button as `drinkButton` says; the match calls it every tick.
  setDrink(look: DrinkButton): void;
  // Removes the bar and its stylesheet, like the HUD's teardown.
  dispose(): void;
}

export function buildTouchBar(
  container: HTMLElement,
  actions: TouchBarActions,
  opts: { side?: 'left' | 'right' } = {},
): TouchBar {
  const style = document.createElement('style');
  style.textContent = TOUCH_BAR_CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = opts.side === 'left' ? 'touchbar left' : 'touchbar';
  const add = (label: string, onTap: () => void): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.className = 'touchbar-btn';
    btn.textContent = label;
    btn.addEventListener('click', onTap);
    root.appendChild(btn);
    return btn;
  };
  add('Menu', actions.onToggleMenu);
  if (actions.onToggleShop) add('Shop', actions.onToggleShop);
  if (actions.onRecall) add('Recall', actions.onRecall);
  add('Center', actions.onRecenterCamera);
  const drink = actions.onDrink ? add('Drink', actions.onDrink) : null;
  if (drink) {
    drink.classList.add('drink');
    drink.style.display = 'none';
  }
  let drinkLook: DrinkButton = 'hidden';
  container.appendChild(root);
  return {
    setDrink(look) {
      if (!drink || look === drinkLook) return;
      drinkLook = look;
      drink.style.display = look === 'hidden' ? 'none' : '';
      drink.classList.toggle('busy', look === 'busy');
    },
    dispose() {
      root.remove();
      style.remove();
    },
  };
}
