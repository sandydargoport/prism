/**
 * @jest-environment jsdom
 */
/**
 * Widgets on the screensaver have outlines whether or not a transition effect
 * is on, so "Hide widget outlines" must be offered with the effect set to None.
 * It used to sit with the effect-only controls and vanished with them.
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { ScreensaverSettingsPanel } from '../ScreensaverQuickSettings';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('prism-screensaver-motion', 'off');
  localStorage.setItem('prism-screensaver-motion-v2', '1');
});

describe('Hide widget outlines', () => {
  it('is offered in the screensaver panel with no transition effect, and hides outlines', () => {
    render(<ScreensaverSettingsPanel open onClose={() => {}} />);
    const toggle = screen.getByRole('checkbox', { name: /hide widget outlines/i }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(localStorage.getItem('prism-screensaver-outlines')).toBe('off');
    expect(toggle.checked).toBe(true);
  });
});

// Drift and the shortcut left Settings > Appearance for this panel (#1159).
describe('Drift and the settings shortcut', () => {
  it('are offered in the screensaver panel and kept for the screen', () => {
    render(<ScreensaverSettingsPanel open onClose={() => {}} />);
    const drift = screen.getByRole('checkbox', { name: /drift/i }) as HTMLInputElement;
    const shortcut = screen.getByRole('checkbox', { name: /settings shortcut/i }) as HTMLInputElement;
    expect(drift.checked).toBe(true);
    expect(shortcut.checked).toBe(false);
    fireEvent.click(drift);
    fireEvent.click(shortcut);
    expect(localStorage.getItem('prism-screensaver-drift')).toBe('off');
    expect(localStorage.getItem('prism-screensaver-shortcut')).toBe('on');
  });
});
