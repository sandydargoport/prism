/**
 * @jest-environment jsdom
 */
/**
 * The household look, Classic or 2.0 (#799).
 */
import { APPEARANCE_SCRIPT, APPEARANCE_STORAGE_KEY, appearanceFromRow, applyAppearance } from '../appearance';

describe('appearanceFromRow', () => {
  it('gives a household with no row (a new install) 2.0', () => {
    expect(appearanceFromRow(undefined, false)).toBe('v2');
  });

  it('keeps the stored choice', () => {
    expect(appearanceFromRow('classic', true)).toBe('classic');
    expect(appearanceFromRow('v2', true)).toBe('v2');
  });

  it('reads an unknown stored value as Classic, the look installs already had', () => {
    expect(appearanceFromRow('glass', true)).toBe('classic');
    expect(appearanceFromRow(null, true)).toBe('classic');
  });
});

describe('APPEARANCE_SCRIPT (first paint)', () => {
  const root = document.documentElement;
  const run = () => new Function(APPEARANCE_SCRIPT)();

  beforeEach(() => {
    root.removeAttribute('data-appearance');
    localStorage.clear();
  });

  it('remembers what the server rendered', () => {
    root.setAttribute('data-appearance', 'v2');
    run();
    expect(root.getAttribute('data-appearance')).toBe('v2');
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('v2');
  });

  it('falls back to what this browser saw last when the server could not say', () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, 'v2');
    run();
    expect(root.getAttribute('data-appearance')).toBe('v2');
  });

  it('falls back to Classic with nothing remembered', () => {
    run();
    expect(root.getAttribute('data-appearance')).toBe('classic');
  });
});

describe('applyAppearance', () => {
  it('switches the page now and remembers it', () => {
    applyAppearance('v2');
    expect(document.documentElement.getAttribute('data-appearance')).toBe('v2');
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('v2');
  });
});
