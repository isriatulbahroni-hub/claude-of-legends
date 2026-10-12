// The ladder box, on the end screen and in the pause menu of a match that
// scores (ADR 0027): where the player stands on the ladder of every human,
// "You are #N on the ladder with P points", the points this match banked
// and the level. A Guest's name is changed on the landing's own panel
// (ui/own_panel_view.ts), which writes /api/ladder/name with saveName
// below. Reads /api/public/ladder (the reader's own place rides on it).
// The words are pure (ui/points_text.ts); this is the drawing, built with
// the caller's element maker so the HUD's classes stay in the HUD.

import { earnedText, type LadderPlace, levelText, placeText } from './points_text';

export const LADDER_ROUTE = '/api/public/ladder';
export const NAME_ROUTE = '/api/ladder/name';

export type SaveOutcome = { ok: true; name: string } | { ok: false; error: string };

function asPlace(raw: unknown): LadderPlace | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.points !== 'number' || typeof r.name !== 'string') return null;
  return {
    rank: typeof r.rank === 'number' ? r.rank : null,
    points: r.points,
    name: r.name,
    guest: r.guest === true,
    named: r.named === true,
  };
}

// The reader's own place, or null when the server does not know them (or
// does not answer).
export async function fetchPlace(
  get: typeof fetch = (input, init) => fetch(input, init),
): Promise<LadderPlace | null> {
  try {
    const res = await get(LADDER_ROUTE, { credentials: 'same-origin' });
    if (!res.ok) return null;
    return asPlace(((await res.json()) as { me?: unknown }).me);
  } catch {
    return null;
  }
}

export async function saveName(
  name: string,
  post: typeof fetch = (input, init) => fetch(input, init),
): Promise<SaveOutcome> {
  try {
    const res = await post(NAME_ROUTE, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const body = (await res.json()) as { name?: unknown; error?: unknown };
    if (res.ok && typeof body.name === 'string') return { ok: true, name: body.name };
    return {
      ok: false,
      error: typeof body.error === 'string' ? body.error : 'The name could not be saved.',
    };
  } catch {
    return { ok: false, error: 'The server did not answer. Try again in a moment.' };
  }
}

export interface LadderBox {
  root: HTMLElement;
  // Asks for the place again: the end screen and the pause menu call it
  // each time they open, so the numbers are the ones banked by then.
  refresh(): void;
  // The points this match has banked so far, said after the place. The
  // HUD calls it as points land, so the victory's, which can arrive with
  // the end screen already open, join the count there.
  setEarned(earned: number): void;
}

export interface LadderBoxOptions {
  fetchPlace?: () => Promise<LadderPlace | null>;
}

export function buildLadderBox(
  el: <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    cls: string,
    text?: string,
  ) => HTMLElementTagNameMap[K],
  opts: LadderBoxOptions = {},
): LadderBox {
  const root = el('div', 'hud-ladder');
  root.hidden = true;
  const line = el('b', 'hud-ladder-line');
  const place = el('span', '');
  const earned = el('span', 'hud-ladder-earned');
  line.append(place, earned);
  const level = el('span', 'hud-ladder-level');
  root.append(line, level);

  const show = (at: LadderPlace): void => {
    place.textContent = placeText(at);
    level.textContent = levelText(at.points);
    root.hidden = false;
  };
  const refresh = (): void => {
    void (opts.fetchPlace ?? fetchPlace)().then((place) => {
      if (place) show(place);
    });
  };
  const setEarned = (points: number): void => {
    earned.textContent = earnedText(points);
  };
  return { root, refresh, setEarned };
}
