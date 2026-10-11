// The account offer at the end of a visitor's match: who sees it, and what
// it says, for a Guest whose match scored (ADR 0027) and for the practice
// match nobody saved.

import { describe, expect, it } from 'vitest';
import { accountOffer, OFFER_CALL } from '../src/ui/account_offer';

const base = {
  guest: true,
  scored: false,
  won: false,
  kills: 7,
  deaths: 2,
  assists: 5,
  champion: 'Sylra',
};

describe('account offer', () => {
  it('is made to a visitor at the end of a practice match, in their numbers', () => {
    const offer = accountOffer(base);
    expect(offer).not.toBeNull();
    expect(offer?.line).toBe('You went 7 / 2 / 5 with Sylra.');
    expect(offer?.call).toBe(OFFER_CALL);
    expect(offer?.reason).toContain('not saved');
  });

  it('is about keeping the points on every device when the match scored', () => {
    const offer = accountOffer({ ...base, scored: true });
    expect(offer?.reason).toMatch(/points/);
    expect(offer?.reason).toMatch(/every device/);
    expect(offer?.reason).not.toContain('not saved');
  });

  // ADR 0033: the same keep wording as the landing's own panel.
  it('names what the account carries when the match scored', () => {
    expect(accountOffer({ ...base, scored: true })?.reason).toBe(
      'Your points, your level and your best are saved for this browser. A free account ' +
        'carries them to every device behind a password, and opens ranked, bots and the Forge.',
    );
  });

  it('says the practice match was not saved, as before', () => {
    expect(accountOffer(base)?.reason).toBe(
      'This match was not saved. Online, every match scores on the ladder, and a free ' +
        'account keeps your points on every device.',
    );
  });

  it('writes no long dash', () => {
    for (const scored of [false, true]) {
      for (const won of [false, true]) {
        const offer = accountOffer({ ...base, scored, won });
        const words = `${offer?.line} ${offer?.reason} ${offer?.call}`;
        for (let i = 0; i < words.length; i++) {
          expect([8211, 8212]).not.toContain(words.charCodeAt(i));
        }
      }
    }
  });

  it('says so when they won', () => {
    expect(accountOffer({ ...base, won: true })?.line).toBe('You won 7 / 2 / 5 with Sylra.');
  });

  it('names the champion without the roster title', () => {
    expect(accountOffer({ ...base, champion: 'Sylra, Thornweaver' })?.line).toBe(
      'You went 7 / 2 / 5 with Sylra.',
    );
  });

  it('leaves the champion out when the unit is gone', () => {
    expect(accountOffer({ ...base, champion: null })?.line).toBe('You went 7 / 2 / 5.');
  });

  it('is never made to an account', () => {
    expect(accountOffer({ ...base, guest: false })).toBeNull();
    expect(accountOffer({ ...base, guest: false, scored: true })).toBeNull();
  });
});
