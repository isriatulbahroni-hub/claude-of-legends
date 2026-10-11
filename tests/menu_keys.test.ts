// The keyboard while the pause menu is up (src/game/menu_keys.ts): Escape
// closes it, and every other key is the page's, so Tab walks the menu's
// controls and Enter presses the one in focus instead of toggling the
// scoreboard or opening the chat unseen under the menu. The menu stands
// the keyboard on Resume as it opens and takes it out as it closes.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { menuKey } from '../src/game/menu_keys';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string): string => readFileSync(path.join(ROOT, file), 'utf8');

describe('the keyboard under the pause menu', () => {
  it('closes the menu on Escape and leaves every other key to the page', () => {
    expect(menuKey('Escape')).toBe('close');
    for (const key of ['Tab', 'Enter', ' ', 'q', 'w', 'b', 'p', 'a', 's', 'g', 'd', '1']) {
      expect(menuKey(key), key).toBe('page');
    }
  });

  it('is asked before any of the game keys', () => {
    const input = read('src/game/input.ts');
    const gate = input.indexOf('if (handlers.isMenuOpen()) {');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(input.indexOf("if (e.key === 'Tab') {"));
    expect(input).toContain("if (menuKey(e.key) === 'close') handlers.onToggleMenu();");
    expect(read('src/game/boot.ts')).toContain(
      'isMenuOpen: () => hud.covers().pauseMenu || hud.endScreenUp(),',
    );
  });

  it('stands on Resume as the menu opens and leaves the menu as it closes', () => {
    const hud = read('src/ui/hud.ts');
    const toggle = hud.slice(hud.indexOf('toggleEscapeMenu(): void {'));
    expect(toggle.slice(0, toggle.indexOf('\n  }\n'))).toContain(
      'settlePauseFocus(this.escapeOverlay, open);',
    );
    const menu = read('src/ui/pause_menu.ts');
    expect(menu).toContain("overlay.querySelector<HTMLElement>('.hud-pause-btn.resume')?.focus(");
    expect(menu).toContain(
      'if (active instanceof HTMLElement && overlay.contains(active)) active.blur();',
    );
  });
});
