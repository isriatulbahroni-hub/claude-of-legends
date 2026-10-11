// The keyboard while the pause menu is up (ui/pause_menu.ts) is the
// menu's. Escape closes it, as it opened it. Every other key is left to
// the page, so Tab walks the menu's controls and Enter or Space presses
// the one in focus, and none reaches the match under the menu: the
// scoreboard, the chat, the shop and the casts would open or fire there
// unseen, with the HUD hidden behind the menu.
//
// An end screen (ui/end_screen.ts) takes the keyboard the same way, its
// HUD hidden behind it too: Tab walks its buttons and fields, Enter
// presses the one in focus, and Escape opens the pause menu over it, as
// it did before, and closes it again.

export type MenuKey = 'close' | 'page';

export function menuKey(key: string): MenuKey {
  return key === 'Escape' ? 'close' : 'page';
}
