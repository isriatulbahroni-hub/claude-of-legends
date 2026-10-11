// The keys a match keeps from the browser (src/game/browser_keys.ts,
// src/game/input.ts): Alt, which opens Firefox's menu bar when let go
// alone, and ' and /, which open its Quick Find, have their default held
// back on the way down and up while the keyboard is the match's; a field
// being typed in keeps them, and the game's own keys are left alone.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { heldFromBrowser } from '../src/game/browser_keys';
import { type InputHandlers, setupInput } from '../src/game/input';
import type { Renderer } from '../src/render/renderer';

type Listener = (e: unknown) => void;
let listeners: Map<string, Listener[]>;

beforeEach(() => {
  listeners = new Map();
  vi.stubGlobal('window', {
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    removeEventListener: () => undefined,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// A key event as the window hands it, with whether its default was held.
function press(type: 'keydown' | 'keyup', key: string, altKey = false): boolean {
  let held = false;
  const event = {
    key,
    altKey,
    repeat: false,
    preventDefault: () => {
      held = true;
    },
  };
  for (const fn of listeners.get(type) ?? []) fn(event);
  return held;
}

function mount(typing = false): InputHandlers {
  const canvas = { addEventListener: () => undefined, removeEventListener: () => undefined };
  const renderer = { domElement: canvas, groundPointAt: () => null } as unknown as Renderer;
  const handlers = new Proxy({} as InputHandlers, {
    get: (_, name) =>
      name === 'isTyping' ? () => typing : name === 'isMenuOpen' ? () => false : () => undefined,
  });
  setupInput(renderer, handlers);
  return handlers;
}

describe('the keys a match keeps from the browser', () => {
  it('are Alt and the two Quick Find keys', () => {
    expect(heldFromBrowser('Alt')).toBe(true);
    expect(heldFromBrowser("'")).toBe(true);
    expect(heldFromBrowser('/')).toBe(true);
    for (const key of ['q', 'Q', 'Escape', 'Tab', 'Enter', ' ', '1', 'Control', 'Shift', 'F5']) {
      expect(heldFromBrowser(key)).toBe(false);
    }
  });

  it('hold back Alt down and up, so Firefox does not open its menu bar', () => {
    mount();
    expect(press('keydown', 'Alt', true)).toBe(true);
    expect(press('keyup', 'Alt')).toBe(true);
  });

  it("hold back ' and /, so Firefox does not open Quick Find", () => {
    mount();
    expect(press('keydown', "'")).toBe(true);
    expect(press('keydown', '/')).toBe(true);
  });

  it('leave the keys alone while a field is typed in', () => {
    mount(true);
    expect(press('keydown', 'Alt', true)).toBe(false);
    expect(press('keydown', '/')).toBe(false);
    expect(press('keyup', 'Alt')).toBe(false);
  });

  it("leave the browser's other keys alone", () => {
    mount();
    expect(press('keydown', 'F5')).toBe(false);
    expect(press('keydown', 'Control')).toBe(false);
  });
});
