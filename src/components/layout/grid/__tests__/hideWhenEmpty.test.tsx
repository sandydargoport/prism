/**
 * @jest-environment jsdom
 */
/**
 * Hide when empty (#738): a widget showing its empty state is hidden when its
 * setting (or the default for where it is drawn) says so, keeps its place,
 * comes back when something arrives, and is never hidden while loading.
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { CssGridDisplay } from '../CssGridDisplay';
import { WidgetContainer, WidgetEmpty } from '@/components/widgets/WidgetContainer';
import { updateLayoutSchema } from '@/lib/validations';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

/** A tasks widget: loading, empty, or with one task. */
function Tasks({ state }: { state: 'loading' | 'empty' | 'full' }) {
  return (
    <WidgetContainer title="Tasks" loading={state === 'loading'}>
      {state === 'full' ? <p>Take out the bins</p> : <WidgetEmpty message="No tasks for today" />}
    </WidgetContainer>
  );
}

function grid(state: 'loading' | 'empty' | 'full', widget: Partial<WidgetConfig> = {}, hideEmptyByDefault = false) {
  const w = { i: 'tasks', x: 0, y: 0, w: 8, h: 8, ...widget } as WidgetConfig;
  return <CssGridDisplay layout={[w]} renderWidget={() => <Tasks state={state} />} hideEmptyByDefault={hideEmptyByDefault} />;
}

const cell = (c: HTMLElement) => c.querySelector('[data-widget="tasks"]') as HTMLElement;
const hidden = (c: HTMLElement) => cell(c).style.opacity === '0' && cell(c).dataset.hiddenEmpty !== undefined;

describe('Hide when empty', () => {
  it('hides an empty widget set to hide, keeping its place in the grid', () => {
    const { container } = render(grid('empty', { hideWhenEmpty: true }));
    expect(hidden(container)).toBe(true);
    expect(cell(container).style.gridColumn).toBe('1 / span 8');
  });

  it('leaves an empty widget alone when it is set to always show', () => {
    const { container } = render(grid('empty', { hideWhenEmpty: false }, true));
    expect(hidden(container)).toBe(false);
  });

  it('follows the default for where it is drawn when unset', () => {
    expect(hidden(render(grid('empty', {}, true)).container)).toBe(true);
    expect(hidden(render(grid('empty', {}, false)).container)).toBe(false);
  });

  it('is not hidden while loading, and comes back when something arrives', () => {
    const { container, rerender } = render(grid('loading', { hideWhenEmpty: true }));
    expect(hidden(container)).toBe(false);
    act(() => { rerender(grid('empty', { hideWhenEmpty: true })); });
    expect(hidden(container)).toBe(true);
    act(() => { rerender(grid('full', { hideWhenEmpty: true })); });
    expect(hidden(container)).toBe(false);
  });

  it('never hides a widget with no empty state, such as the clock', () => {
    const w = { i: 'clock', x: 0, y: 0, w: 8, h: 8, hideWhenEmpty: true } as WidgetConfig;
    const { container } = render(
      <CssGridDisplay layout={[w]} renderWidget={() => <WidgetEmpty message="nothing" />} hideEmptyByDefault />,
    );
    expect((container.querySelector('[data-widget="clock"]') as HTMLElement).style.opacity).toBe('');
  });

  it('is kept when a layout is saved', () => {
    const parsed = updateLayoutSchema.parse({ widgets: [{ i: 'tasks', x: 0, y: 0, w: 8, h: 8, hideWhenEmpty: false }] });
    expect(parsed.widgets?.[0]?.hideWhenEmpty).toBe(false);
  });
});
