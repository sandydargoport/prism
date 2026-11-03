/**
 * @jest-environment jsdom
 *
 * The 2.0 glass (#799) applies only while a wallpaper photo is showing, keyed
 * on an attribute WallpaperBackground puts on <html>. It must be there while a
 * photo shows, and gone when none does, or cards turn to glass over a plain
 * background with nothing behind them.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { WallpaperBackground, WALLPAPER_ATTR } from '../WallpaperBackground';

let photos: { id: string; orientation: string }[] = [];
jest.mock('@/lib/hooks/usePhotos', () => ({
  usePhotos: () => ({ photos }),
}));
jest.mock('@/lib/hooks/useScreenOrientation', () => ({
  useScreenOrientation: () => 'landscape',
}));

const root = document.documentElement;

beforeEach(() => {
  localStorage.clear();
  root.removeAttribute(WALLPAPER_ATTR);
});

it('marks the page while a photo is showing, and clears it on unmount', () => {
  photos = [{ id: 'p1', orientation: 'landscape' }];
  const { unmount } = render(<WallpaperBackground />);
  expect(root.hasAttribute(WALLPAPER_ATTR)).toBe(true);
  unmount();
  expect(root.hasAttribute(WALLPAPER_ATTR)).toBe(false);
});

it('does not mark the page when there is no photo', () => {
  photos = [];
  render(<WallpaperBackground />);
  expect(root.hasAttribute(WALLPAPER_ATTR)).toBe(false);
});

it('does not mark the page when the wallpaper is switched off', () => {
  photos = [{ id: 'p1', orientation: 'landscape' }];
  localStorage.setItem('prism-wallpaper-enabled', 'false');
  render(<WallpaperBackground />);
  expect(root.hasAttribute(WALLPAPER_ATTR)).toBe(false);
});
