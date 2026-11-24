/**
 * @jest-environment jsdom
 *
 * Dim when idle (#691): how dark the idle screen is, and when. When is night
 * by the dashboard's rule (#1152), the one the veil and the backdrop use, not
 * the calendar's hidden hours any more.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { dimAt, dimLevel, IdleDim } from '../idleDim';

describe('dimLevel', () => {
  it('is off when nothing, or nothing it knows, is stored', () => {
    expect(dimLevel(null)).toBe(0);
    expect(dimLevel('1')).toBe(0);
    expect(dimLevel('0.7')).toBe(0);
    expect(dimLevel('0.5')).toBe(0.5);
  });
});

describe('dimAt', () => {
  it('is the level at night and nothing by day', () => {
    expect(dimAt('0.5', true)).toBe(0.5);
    expect(dimAt('0.5', false)).toBe(0);
    expect(dimAt('0', true)).toBe(0);
  });
});

describe('IdleDim', () => {
  // When and how dark is the scene's (screenStateAt, #1344); the layer draws it.
  const opacity = (c: HTMLElement) => (c.querySelector('[data-idle-dim]') as HTMLElement).style.opacity;

  it('draws the scene\'s dim', () => {
    expect(opacity(render(<IdleDim opacity={0.75} />).container)).toBe('0.75');
    expect(opacity(render(<IdleDim opacity={0} />).container)).toBe('0');
  });
});
