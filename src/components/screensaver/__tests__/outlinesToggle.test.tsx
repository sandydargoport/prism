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

describe('Hide widget outlines in Settings', () => {
  it('is offered in Settings → Appearance → Screensaver with no transition effect', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}) } as Response)) as unknown as typeof fetch;
    const { ScreensaverCard } = await import('@/app/settings/sections/DisplaySection');
    render(<ScreensaverCard />);
    const toggle = screen.getByRole('checkbox', { name: /hide widget outlines/i }) as HTMLInputElement;
    fireEvent.click(toggle);
    expect(localStorage.getItem('prism-screensaver-outlines')).toBe('off');
  });
});
