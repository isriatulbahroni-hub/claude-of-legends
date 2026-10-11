// Keeps the mouse on the game in fullscreen (the maintainer: with two
// monitors a click past the edge landed on the other screen mid-fight).
// No browser confines a visible cursor to a window, so the cursor is
// locked instead (the browser hides it and reports movement only) and the
// game draws its own: a virtual position moved by the deltas and clamped
// to the window, the game's painted cursor at it (the dart and the sword,
// read off the CSS cursor under it), and every pointer event re-dispatched
// at that position to whatever stands there, so the ground, the HUD and
// the minimap keep their handlers unchanged. Native pointer events carry
// frozen coordinates while locked and are stopped before anyone reads
// them; the elements under the virtual cursor get a `vhover` class in
// place of the :hover the browser cannot give them. Esc leaves the lock at
// the browser's discretion; the next click inside re-locks while
// fullscreen holds. Touch devices and browsers without pointer lock are
// left alone.

import { wheelDeltas } from './wheel_step';

export interface Point {
  x: number;
  y: number;
}

// The virtual cursor never leaves the window: that is the whole point.
export function clampToViewport(x: number, y: number, width: number, height: number): Point {
  return {
    x: Math.min(Math.max(0, x), Math.max(0, width - 1)),
    y: Math.min(Math.max(0, y), Math.max(0, height - 1)),
  };
}

export interface CursorImage {
  url: string;
  hotX: number;
  hotY: number;
}

// A CSS cursor value's painted image and hotspot ("url(data:...) 3 1,
// auto"), null for a keyword cursor.
export function cursorImageOf(css: string): CursorImage | null {
  const m = /url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)\s*(-?\d+(?:\.\d+)?)?\s*(-?\d+(?:\.\d+)?)?/.exec(
    css,
  );
  if (!m) return null;
  const url = m[1] ?? m[2] ?? m[3] ?? '';
  if (!url) return null;
  return { url, hotX: Number(m[4] ?? 0), hotY: Number(m[5] ?? 0) };
}

// Which native event moves the virtual cursor. Firefox fires no mousemove
// under the lock while a button is held, the press having been cancelled
// (every press is, below, so the browser's own menu and focus stay put):
// the cursor froze through every held press, a right button held to steer,
// a drag on the minimap. Its pointermove comes through, movement and all.
// A pointermove with movement makes pointermove the source from then on;
// before one, mousemove moves the cursor, so a browser whose pointermove
// carries none still works, and one motion is never counted twice.
export class MotionSource {
  private pointer = false;

  // Whether a native move of `type` by (dx, dy) moves the cursor.
  takes(type: 'pointermove' | 'mousemove', dx: number, dy: number): boolean {
    if (type === 'mousemove') return !this.pointer;
    if (dx !== 0 || dy !== 0) this.pointer = true;
    return this.pointer;
  }
}

// The pointer id a synthetic event carries: the native one, else the
// mouse's last seen (Firefox numbers the mouse 0, Chrome 1), so a handler
// that captures the pointer names one the browser knows.
export function pointerIdOf(native: { pointerId?: number }, mouseId: number): number {
  return typeof native.pointerId === 'number' ? native.pointerId : mouseId;
}

// The events a locked pointer must not let through with frozen
// coordinates: movement, buttons, and the hover pairs the game makes
// itself.
const SWALLOWED: readonly string[] = [
  'pointermove',
  'mousemove',
  'pointerdown',
  'mousedown',
  'pointerup',
  'mouseup',
  'click',
  'dblclick',
  'auxclick',
  'contextmenu',
  'pointerover',
  'pointerout',
  'pointerenter',
  'pointerleave',
  'mouseover',
  'mouseout',
  'mouseenter',
  'mouseleave',
  'wheel',
];

const BUTTON_EVENTS: readonly string[] = [
  'pointerdown',
  'mousedown',
  'pointerup',
  'mouseup',
  'click',
  'dblclick',
  'auxclick',
  'contextmenu',
];

// The arrow drawn when the element under the cursor names no image.
const FALLBACK_ARROW =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="24" viewBox="0 0 20 24">' +
      '<path d="M2 1 L2 19 L7 14.5 L10.5 22 L14 20.5 L10.5 13 L17 13 Z" fill="#dfe9f5" stroke="#1b2330" stroke-width="1.5" stroke-linejoin="round"/>' +
      '</svg>',
  );

export function installCursorLock(root: HTMLElement, doc: Document = document): () => void {
  const win = doc.defaultView;
  if (!win || typeof root.requestPointerLock !== 'function') return () => undefined;
  if (typeof win.matchMedia === 'function' && !win.matchMedia('(pointer: fine)').matches) {
    return () => undefined;
  }

  const synthetic = new WeakSet<Event>();
  let locked = false;
  let vx = win.innerWidth / 2;
  let vy = win.innerHeight / 2;
  let hovered: Element | null = null;
  const motion = new MotionSource();
  let mouseId = 1;

  const cursor = doc.createElement('div');
  cursor.className = 'cursor-lock';
  cursor.style.cssText =
    'position:fixed;left:0;top:0;width:32px;height:32px;pointer-events:none;' +
    'z-index:100000;display:none;background-repeat:no-repeat;background-size:contain;';
  doc.body.appendChild(cursor);

  const paintCursor = (): void => {
    const style = hovered ? win.getComputedStyle(hovered).cursor : '';
    const image = cursorImageOf(style);
    cursor.style.backgroundImage = `url("${image ? image.url : FALLBACK_ARROW}")`;
    const hotX = image ? image.hotX : 2;
    const hotY = image ? image.hotY : 1;
    cursor.style.transform = `translate(${vx - hotX}px, ${vy - hotY}px)`;
  };

  const init = (native: MouseEvent): PointerEventInit => ({
    bubbles: true,
    cancelable: true,
    composed: true,
    view: win,
    clientX: vx,
    clientY: vy,
    screenX: vx,
    screenY: vy,
    button: native.button,
    buttons: native.buttons,
    ctrlKey: native.ctrlKey,
    shiftKey: native.shiftKey,
    altKey: native.altKey,
    metaKey: native.metaKey,
    pointerId: pointerIdOf(native as { pointerId?: number }, mouseId),
    pointerType: 'mouse',
    isPrimary: true,
  });

  const forward = (type: string, native: MouseEvent, target: Element, bubbles = true): void => {
    const detail = { ...init(native), bubbles };
    const ev =
      typeof PointerEvent === 'function' && type.startsWith('pointer')
        ? new PointerEvent(type, detail)
        : new MouseEvent(type, detail);
    synthetic.add(ev);
    target.dispatchEvent(ev);
  };

  const setHoverClass = (from: Element | null, to: Element | null): void => {
    for (let n: Element | null = from; n && n !== doc.body; n = n.parentElement) {
      n.classList.remove('vhover');
    }
    for (let n: Element | null = to; n && n !== doc.body; n = n.parentElement) {
      n.classList.add('vhover');
    }
  };

  const moveTo = (native: MouseEvent): void => {
    const p = clampToViewport(
      vx + native.movementX,
      vy + native.movementY,
      win.innerWidth,
      win.innerHeight,
    );
    vx = p.x;
    vy = p.y;
    const under = doc.elementFromPoint(vx, vy);
    if (under !== hovered) {
      if (hovered) {
        forward('pointerout', native, hovered);
        forward('mouseout', native, hovered);
        forward('pointerleave', native, hovered, false);
        forward('mouseleave', native, hovered, false);
      }
      setHoverClass(hovered, under);
      hovered = under;
      if (under) {
        forward('pointerover', native, under);
        forward('mouseover', native, under);
        forward('pointerenter', native, under, false);
        forward('mouseenter', native, under, false);
      }
    }
    if (under) forward('pointermove', native, under);
    paintCursor();
  };

  const onNative = (e: Event): void => {
    if (!locked || synthetic.has(e)) return;
    e.stopImmediatePropagation();
    const pointer = e as Partial<PointerEvent>;
    if (pointer.pointerType === 'mouse' && typeof pointer.pointerId === 'number') {
      mouseId = pointer.pointerId;
    }
    if (e.type === 'pointermove' || e.type === 'mousemove') {
      const m = e as MouseEvent;
      if (pointer.pointerType === 'touch') return;
      if (motion.takes(e.type, m.movementX, m.movementY)) moveTo(m);
      return;
    }
    if (e.type === 'wheel') {
      const w = e as WheelEvent;
      const under = doc.elementFromPoint(vx, vy);
      if (!under) return;
      // The mode read before the deltas, so a Firefox wheel's copy keeps
      // its lines (wheel_step.ts).
      const ev = new WheelEvent('wheel', { ...init(w), ...wheelDeltas(w) });
      synthetic.add(ev);
      if (!under.dispatchEvent(ev)) e.preventDefault();
      return;
    }
    if (BUTTON_EVENTS.includes(e.type)) {
      // The browser's own menu and focus changes follow the frozen point;
      // the synthetic event carries the real one.
      e.preventDefault();
      const under = doc.elementFromPoint(vx, vy);
      if (!under) return;
      forward(e.type, e as MouseEvent, under);
      if (e.type === 'click' && under instanceof HTMLElement) {
        const tag = under.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') under.focus();
      }
    }
    // The hover pairs the browser fires at the frozen point are dropped;
    // moveTo makes the game's own.
  };

  const tryLock = (): void => {
    if (!doc.fullscreenElement || doc.pointerLockElement || locked) return;
    try {
      const r = root.requestPointerLock() as unknown as Promise<void> | undefined;
      if (r && typeof r.catch === 'function') r.catch(() => undefined);
    } catch {
      // A browser that refuses the lock leaves the cursor free.
    }
  };

  const onLockChange = (): void => {
    locked = doc.pointerLockElement === root;
    cursor.style.display = locked ? 'block' : 'none';
    if (locked) {
      const p = clampToViewport(vx, vy, win.innerWidth, win.innerHeight);
      vx = p.x;
      vy = p.y;
      hovered = doc.elementFromPoint(vx, vy);
      setHoverClass(null, hovered);
      paintCursor();
    } else {
      setHoverClass(hovered, null);
      hovered = null;
    }
  };

  const onFullscreenChange = (): void => {
    if (doc.fullscreenElement) tryLock();
    else if (doc.pointerLockElement === root) doc.exitPointerLock();
  };

  // The real cursor's last place while free, so the virtual one starts
  // where the hand left it.
  const onFreeMove = (e: PointerEvent): void => {
    if (locked || e.pointerType === 'touch') return;
    vx = e.clientX;
    vy = e.clientY;
  };
  // A click inside while fullscreen and unlocked (after an Esc) re-locks.
  const onFreeDown = (e: PointerEvent): void => {
    if (locked || e.pointerType === 'touch') return;
    tryLock();
  };

  for (const type of SWALLOWED) win.addEventListener(type, onNative, { capture: true });
  doc.addEventListener('pointerlockchange', onLockChange);
  doc.addEventListener('fullscreenchange', onFullscreenChange);
  win.addEventListener('pointermove', onFreeMove);
  root.addEventListener('pointerdown', onFreeDown);
  if (doc.fullscreenElement) tryLock();

  return () => {
    for (const type of SWALLOWED) win.removeEventListener(type, onNative, { capture: true });
    doc.removeEventListener('pointerlockchange', onLockChange);
    doc.removeEventListener('fullscreenchange', onFullscreenChange);
    win.removeEventListener('pointermove', onFreeMove);
    root.removeEventListener('pointerdown', onFreeDown);
    if (doc.pointerLockElement === root) doc.exitPointerLock();
    setHoverClass(hovered, null);
    cursor.remove();
  };
}
