/**
 * The sizes the canvas editor offers a dashboard at (#1265). The screens
 * that show it, as their own or in a switch (#1282), come first. A screen as
 * narrow as a phone shows the phone layout of cards, never the dashboard's
 * grid, so editing at its size leaves nothing to arrange (#1280).
 */
import { sizeChoices } from '../CanvasEditor';

const home = { id: 'home', isDefault: true };
const bus = { id: 'bus', isDefault: false };

describe('sizeChoices', () => {
  it('offers the screens that show the dashboard first, but never one as narrow as a phone', () => {
    const choices = sizeChoices(home, [
      { id: 'pocket', name: 'Pocket', dashboardId: null, switches: [], width: 393, height: 852 },
      { id: 'hall', name: 'Hall', dashboardId: null, switches: [], width: 1280, height: 800 },
    ]);
    expect(choices[0]).toMatchObject({ key: 'screen:hall', group: 'shows' });
    expect(choices.some((c) => c.key === 'screen:pocket')).toBe(false);
  });

  it('with only a phone showing it, starts at a common screen size', () => {
    const choices = sizeChoices(home, [
      { id: 'pocket', name: 'Pocket', dashboardId: null, switches: [], width: 393, height: 852 },
    ]);
    expect(choices[0]).toMatchObject({ key: '1920x1080', group: 'size' });
  });

  it('a screen that switches to the dashboard at bus time shows it too; one that never does comes after', () => {
    const choices = sizeChoices(bus, [
      { id: 'hall', name: 'Hall', dashboardId: null, switches: [], width: 1280, height: 800 },
      { id: 'kitchen', name: 'Kitchen', dashboardId: null, switches: [{ when: 'bus', dashboardId: 'bus' }], width: 1920, height: 1080 },
    ]);
    expect(choices[0]).toMatchObject({ key: 'screen:kitchen', group: 'shows' });
    expect(choices.at(-1)).toMatchObject({ key: 'screen:hall', group: 'other' });
  });
});
