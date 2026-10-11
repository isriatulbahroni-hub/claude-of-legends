// The own panel's words (CONTEXT.md: Own panel, ADR 0033): who the visitor
// is in the game from the first page, its name, its place and points on the
// ladder, its level and the bar to the next, its best, the next thing within
// reach, and the week's three. Pure, so a test reads every word without a
// browser; ui/own_panel_view.ts draws them. The wire shapes are
// src/net/landing.ts's.

import type { LandingOwn, LandingWeek } from '../net/landing';
import { CHAMPION_LIST } from '../sim/content/champions';
import { NAME_FIELD_MAX, nameSuggestion } from './points_text';
import { goalShare } from './royale_goal';

export const OWN_CHANGE = 'Change';
export const OWN_CHANGE_LABEL = 'Change your name';
export const OWN_SAVE = 'Save';
export const OWN_CANCEL = 'Cancel';
export const OWN_SAVED = 'Saved.';
export const OWN_FIELD_LABEL = 'Your name on the ladder';
export const OWN_FIELD_HINT = '3 to 16 letters, digits, _ or -. The ladder shows it.';
export const OWN_KEEP = 'Keep it on every device';
export const OWN_HOME = 'Open your home';

// A Guest holding something the server keeps for it: points, or a name of
// its own. An account is not a Guest, and a fresh Guest holds nothing yet.
export function kept(own: LandingOwn): boolean {
  return !own.account && (own.points > 0 || own.named);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A day as the month's short name and the day, in UTC: 'Oct 6'.
export function monthDay(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()] ?? ''} ${d.getUTCDate()}`;
}

// The line under the name: what the name is, and what keeps it.
export function ownSub(own: LandingOwn): string {
  if (own.account) return `Your account since ${monthDay(own.since)}.`;
  if (kept(own)) return `Guest since ${monthDay(own.since)}, saved for this browser.`;
  return 'Your Guest name. No sign-up: one match or a name of your own keeps it.';
}

export interface OwnTile {
  label: string;
  value: string;
  line: string;
}

export interface OwnLevelTile extends OwnTile {
  // How full the bar stands, 0 to 1, on the end card's curve.
  share: number;
}

function count(n: number): string {
  return n.toLocaleString('en-US');
}

function pointsCount(n: number): string {
  return n === 1 ? '1 point' : `${count(n)} points`;
}

export function ladderTile(own: LandingOwn): OwnTile {
  if (own.rank === null) {
    return { label: 'Ladder', value: 'Not yet', line: 'One match puts you on it' };
  }
  return { label: 'Ladder', value: `#${count(own.rank)}`, line: pointsCount(own.points) };
}

function left(own: LandingOwn): number {
  return Math.max(0, own.level.to - own.points);
}

export function levelTile(own: LandingOwn): OwnLevelTile {
  const next = own.level.level + 1;
  return {
    label: 'Level',
    value: String(own.level.level),
    line: `${pointsCount(left(own))} to Level ${next}`,
    share: goalShare(own.points, own.level),
  };
}

export function bestTile(own: LandingOwn): OwnTile {
  if (own.best === 0) return { label: 'Best', value: '0', line: 'Set one in Respawn' };
  return {
    label: 'Best',
    value: count(own.best),
    line: `${own.best === 1 ? 'takedown' : 'takedowns'} in one Respawn match`,
  };
}

// The nearest thing within reach, said in one line: the ladder for a line
// not on it yet; the next level, and the line above when there is one,
// whichever is nearer first and the level first on a tie.
export function nextLine(own: LandingOwn): string {
  if (own.rank === null) return `Next: one match puts ${own.name} on the ladder.`;
  const toLevel = left(own);
  const level = own.level.level + 1;
  if (own.rank === 1)
    return `Next: ${pointsCount(toLevel)} to Level ${level}. You lead the ladder.`;
  const above = own.above;
  if (above === null) return `Next: ${pointsCount(toLevel)} to Level ${level}.`;
  const pass = `pass ${above.name} at #${count(above.rank)}`;
  if (above.gap < toLevel) {
    return `Next: ${pointsCount(above.gap)} to ${pass}, ${count(toLevel)} to Level ${level}.`;
  }
  return `Next: ${pointsCount(toLevel)} to Level ${level}, ${count(above.gap)} to ${pass}.`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// A roster champion's short name, the part before the comma ('Korrath');
// an id the roster does not know, capitalized.
function championName(id: string): string {
  const def = CHAMPION_LIST.find((c) => c.id === id);
  if (def) return def.name.split(',')[0]?.trim() ?? def.name;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function listed(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const HOW_MANY = ['', 'one', 'two', 'three', 'four', 'five', 'six'];

// The week's rotation, the champions any player may pick this week, and how
// long it stays: '' when there is none.
export function weekLine(week: LandingWeek, now: number): string {
  if (week.rotation.length === 0) return '';
  const names = listed(week.rotation.map(championName));
  const days = Math.floor((week.turnsAt - now) / DAY_MS);
  const until =
    days >= 2 ? `for ${days} more days` : days === 1 ? 'for one more day' : 'for a few more hours';
  const many = HOW_MANY[week.rotation.length] ?? String(week.rotation.length);
  return `This week's ${many}: ${names}, ${until}.`;
}

// What the name field offers: a handed-out name without what the account
// name rules refuse ('Wanderer 0421' offers 'Wanderer0421'), a chosen one as
// it is (ui/points_text.ts nameSuggestion).
export function editValue(own: LandingOwn): string {
  return nameSuggestion({
    rank: own.rank,
    points: own.points,
    name: own.name,
    guest: !own.account,
    named: own.named,
  });
}

const NAME_MIN = 3;
const ALLOWED = /^[A-Za-z0-9_-]+$/;

// The account name rules' shape (server/account_name.ts validateName), in
// its own words, said before any request: null when the shape is right. The
// word filter and a name already taken stay the server's to say; the client
// never ships a word list.
export function nameShapeError(name: string): string | null {
  if (name.length > NAME_FIELD_MAX) return `A name is at most ${NAME_FIELD_MAX} characters.`;
  if (!ALLOWED.test(name)) return 'A name may use letters, digits, underscores and hyphens only.';
  if (name.length < NAME_MIN || name.replace(/[_-]/g, '').length < NAME_MIN) {
    return `A name needs at least ${NAME_MIN} letters or digits.`;
  }
  return null;
}
