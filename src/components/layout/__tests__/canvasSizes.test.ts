/**
 * The sizes the canvas editor offers a dashboard at (#1265). A screen as
 * narrow as a phone shows the phone layout of cards, never the dashboard's
 * grid, so editing at its size leaves nothing to arrange (#1280).
 */
import { sizeChoices } from '../CanvasEditor';
import type { Timeline } from '@/lib/timeline';

const main: Timeline = {
  id: 'main', name: 'Main', position: 0, dashboardId: null, placements: [],
  idleBackground: { source: 'photos' },
};
const home = { id: 'home', isDefault: true };

describe('sizeChoices', () => {
  it('offers the screens that show the dashboard first, but never one as narrow as a phone', () => {
    const choices = sizeChoices(home, [
      { id: 'pocket', name: 'Pocket', timelineId: null, width: 393, height: 852 },
      { id: 'hall', name: 'Hall', timelineId: null, width: 1280, height: 800 },
    ], [main]);
    expect(choices[0]).toMatchObject({ key: 'screen:hall', group: 'shows' });
    expect(choices.some((c) => c.key === 'screen:pocket')).toBe(false);
  });

  it('with only a phone showing it, starts at a common screen size', () => {
    const choices = sizeChoices(home, [
      { id: 'pocket', name: 'Pocket', timelineId: null, width: 393, height: 852 },
    ], [main]);
    expect(choices[0]).toMatchObject({ key: '1920x1080', group: 'size' });
  });
});
