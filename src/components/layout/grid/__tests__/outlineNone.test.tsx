/**
 * @jest-environment jsdom
 */
/**
 * Outline "None" on a widget hides the card's own border, which is the faint
 * outline every widget shows by default. The hiding is done by the
 * `.prism-outline-none` rule in globals.css, so check the real card matches that
 * rule's selector, and that no border is added on top.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render } from '@testing-library/react';
import { CssGridDisplay } from '../CssGridDisplay';
import { Card } from '@/components/ui/card';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

const css = fs.readFileSync(path.join(__dirname, '../../../../styles/globals.css'), 'utf8');
const NO_OUTLINE_SELECTOR = css.match(/^\s*(\.prism-outline-none [^{]+?)\s*\{/m)?.[1] ?? '';

function renderWidget(outlineColor?: string) {
  const w: WidgetConfig = { i: 'clock', x: 0, y: 0, w: 4, h: 4, outlineColor } as WidgetConfig;
  const { container } = render(
    <CssGridDisplay layout={[w]} renderWidget={() => <Card>12:00</Card>} />,
  );
  const cell = container.querySelector('[data-widget="clock"]') as HTMLElement;
  const card = cell.querySelector('[class*="bg-card"]') as HTMLElement;
  return { cell, card };
}

describe('widget Outline: None', () => {
  it('hides the card border and adds none', () => {
    expect(NO_OUTLINE_SELECTOR).not.toBe('');
    const { cell, card } = renderWidget('transparent');
    expect(card.matches(NO_OUTLINE_SELECTOR)).toBe(true);
    expect(cell.style.border).toBe('');
  });

  it('leaves the card border alone by default', () => {
    const { card } = renderWidget(undefined);
    expect(card.matches(NO_OUTLINE_SELECTOR)).toBe(false);
  });

  it('still draws a chosen outline colour', () => {
    const { cell, card } = renderWidget('#ff0000');
    expect(card.matches(NO_OUTLINE_SELECTOR)).toBe(false);
    expect(cell.style.border).toContain('2px solid');
  });
});
