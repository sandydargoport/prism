/**
 * @jest-environment jsdom
 */
import { WHATS_NEW, WHATS_NEW_SEEN_KEY, markWhatsNewSeen, whatsNewRuns, whatsNewUnseen } from '../whatsNew';

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

  it('says each thing in sentences', () => {
    for (const i of WHATS_NEW.items) expect(i).toMatch(/\.$/);
  });

  it('draws the words between ** bold, and leaves no marker in the text', () => {
    expect(whatsNewRuns('**Chores for pets**, and **subtasks** too.')).toEqual([
      { text: 'Chores for pets', bold: true },
      { text: ', and ', bold: false },
      { text: 'subtasks', bold: true },
      { text: ' too.', bold: false },
    ]);
    // Every item has its markers in pairs.
    for (const i of WHATS_NEW.items) expect(i.split('**').length % 2).toBe(1);
  });
});
