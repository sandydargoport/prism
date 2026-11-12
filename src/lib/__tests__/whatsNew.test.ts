/**
 * @jest-environment jsdom
 */
import { WHATS_NEW, WHATS_NEW_SEEN_KEY, markWhatsNewSeen, whatsNewUnseen } from '../whatsNew';

describe("What's new (#1032)", () => {
  beforeEach(() => localStorage.clear());

  it('is unseen until marked, then seen on this screen', () => {
    expect(whatsNewUnseen()).toBe(true);
    markWhatsNewSeen();
    expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBe(WHATS_NEW.id);
    expect(whatsNewUnseen()).toBe(false);
  });

  it('a list from an earlier release counts as unseen', () => {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, 'an-earlier-list');
    expect(whatsNewUnseen()).toBe(true);
  });

  it('says where each thing went, in a sentence', () => {
    for (const i of WHATS_NEW.items) expect(i.where).toMatch(/\.$/);
  });
});
