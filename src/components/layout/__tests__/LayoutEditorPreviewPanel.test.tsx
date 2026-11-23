/**
 * @jest-environment jsdom
 *
 * More > Overview in the editor (#1324): the canvas map that scrolls the
 * canvas, and no per-device thumbnails. The dashboard stretches to fill its
 * screen, so thumbnails of the same orientation all looked alike; Shown at,
 * above the canvas, shows another screen's size full size.
 */
import { render, screen } from '@testing-library/react';
import { LayoutEditorPreviewPanel } from '../LayoutEditorPreviewPanel';

const widgets = [
  { i: 'clock', x: 0, y: 0, w: 12, h: 6 },
  { i: 'calendar', x: 12, y: 0, w: 36, h: 24 },
];

function panel() {
  return render(
    <LayoutEditorPreviewPanel
      visibleWidgets={widgets}
      gridScrollY={0}
      gridVisibleRows={24}
      gridScrollX={0}
      gridVisibleCols={48}
      validation={{ errors: [], warnings: [] }}
    />,
  );
}

describe('More > Overview (#1324)', () => {
  it('keeps the canvas map', () => {
    panel();
    expect(screen.getByText('Canvas')).toBeTruthy();
    expect(screen.getByText('click to scroll')).toBeTruthy();
  });

  it('shows no per-device thumbnails', () => {
    const { container } = panel();
    expect(container.textContent).not.toMatch(/each screen/i);
    expect(container.textContent).not.toMatch(/reference/i);
  });
});
