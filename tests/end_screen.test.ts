// The end screens' sheet (src/ui/end_screen.ts) beyond its boxes' places
// (tests/end_layout.test.ts): the order the keyboard walks it in and the
// keyboard it takes, as the pause menu does.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { END_ORDER } from '../src/ui/end_screen';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string): string => readFileSync(path.join(ROOT, file), 'utf8');

describe('the end screen', () => {
  it('is walked by Tab from the result and its buttons, the ladder next', () => {
    // The 5v5's ladder stands under the result: its name field is the
    // next stop after the buttons, not the last one on the screen.
    expect(END_ORDER[0]).toBe('lead');
    expect(END_ORDER[1]).toBe('ladder');
    expect([...END_ORDER].sort()).toEqual(['ladder', 'lead', 'offer', 'side', 'table']);
    expect(read('src/ui/end_screen.ts')).toContain('for (const key of END_ORDER)');
  });

  it('takes the keyboard while it is up, as the pause menu does', () => {
    // The chat and the scoreboard stand down behind it: Enter opened the
    // chat unseen, which took every key after it, Escape too.
    expect(read('src/game/boot.ts')).toContain(
      'isMenuOpen: () => hud.covers().pauseMenu || hud.endScreenUp(),',
    );
    const hud = read('src/ui/hud.ts');
    const up = hud.slice(hud.indexOf('endScreenUp(): boolean {'));
    expect(up.slice(0, up.indexOf('\n  }\n'))).toContain(
      "this.endOverlay.classList.contains('open') || this.royale?.resultShown() === true",
    );
    // And the class that hides the HUD reads the same.
    expect(hud).toContain("this.rootEl.classList.toggle('ended', this.endScreenUp());");
  });
});
