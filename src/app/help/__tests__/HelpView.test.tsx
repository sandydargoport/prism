/**
 * @jest-environment jsdom
 *
 * Help describes the app as it is after the new look (#1308): Glance, the bar
 * at the bottom and screens each have a topic, What's new
 * links to the full changelog, and no topic still sends anyone to a control
 * that is gone.
 */
import { render, fireEvent, screen } from '@testing-library/react';

let mobile = false;
jest.mock('@/lib/hooks/useIsMobile', () => ({ useIsMobile: () => mobile }));
// The page frame pulls in the whole shell; here only the topics matter.
jest.mock('@/components/layout', () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SubpageHeader: ({ title, actions }: { title: React.ReactNode; actions?: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header>,
}));

// The Feedback card fetches its question; here only where it sits matters (#1311).
jest.mock('@/components/feedback/FeedbackCard', () => ({
  FeedbackCard: () => <section data-feedback-card>The open question</section>,
}));

import { HelpView } from '../HelpView';

const topics = () => screen.getAllByRole('button').map((b) => b.textContent ?? '');

/** Every topic's text, opened one by one. */
function allTopicText(): string {
  const names = topics();
  let text = '';
  for (const name of names) {
    fireEvent.click(screen.getByRole('button', { name }));
    text += `\n${document.body.textContent}`;
    fireEvent.click(screen.getByRole('button', { name: 'Back to Help' }));
  }
  return text;
}

beforeEach(() => { mobile = false; });

describe('Help after the new look (#1308)', () => {
  it('has topics for Glance, getting around, and screens, after Getting Started', () => {
    render(<HelpView />);
    const names = topics();
    const at = names.indexOf('Getting Started');
    expect(names.slice(at + 1, at + 4)).toEqual(['Glance', 'Getting Around', 'Screens']);
    // The scroll spec reaches for the last topic.
    expect(names.at(-1)).toBe('Troubleshooting');
    // Idle has its own topic, under its own name (#1352).
    expect(names).toContain('Idle and night');
    expect(names).not.toContain('Screensaver');
  });

  it("What's new links to the full changelog in a new tab", () => {
    render(<HelpView />);
    fireEvent.click(screen.getByRole('button', { name: "What's new" }));
    const link = screen.getByRole('link', { name: 'See everything that changed' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toMatch(/\bnoopener\b/);
  });

  it("What's new also asks the open question, as More does (#1311)", () => {
    const { container } = render(<HelpView />);
    expect(container.querySelector('[data-feedback-card]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: "What's new" }));
    expect(container.querySelector('[data-feedback-card]')).not.toBeNull();
  });

  it('gives directions the way the app has them, and none to controls that are gone', () => {
    render(<HelpView />);
    const text = allTopicText();
    for (const direction of [
      'More > Edit layout > Screen',
      // The Screen tab holds the screen's day (#1349).
      'More > Edit layout > Screen > Shows',
      'More > Edit layout > Screen > When idle',
      'Idle after',
      'Same as new screens',
      'Arrange the photo frame',
      'Someone using the screen sees the dashboard for that time.',
      'More > Edit layout > Widgets',
      'More > This screen > Away mode',
      // The editor's shell (#1350): the header, its menu, and Look.
      'Hallway screen · Editing Main dashboard',
      'the header menu > Export',
      // Settings > Screens holds new and unnamed screens, and Photos the captions (#1351).
      'Settings > Screens > New and unnamed screens show',
      'Settings > Photos > Captions and On this day',
      'More > Edit layout > Look > Text size',
      'More > Edit layout > Look > All widgets',
      'Stays when idle',
      'there is no Screen tab',
      'Settings > Security > Require the PIN for every change',
      // A phone's own cards (#1354).
      'More > This phone > Cards',
      'More > This phone > Reorder',
      'More > Screens > Away mode',
      // One model (#1352): the screen owns time, the dashboard owns content.
      'The screen owns time and the dashboard owns content',
      'In use',
      'More > This screen > Idle now',
      'More > Edit layout > Screen > When idle > Advanced',
      'Settings > Photos > Pinned Photos',
      'Settings > Bus Tracking',
    ]) expect(text).toContain(direction);
    for (const gone of [
      'Nothing was removed',
      'grid icon',
      'palm tree icon',
      'babysitter icon',
      'Timers & Auto-Activation',
      'navigation sidebar',
      'Edit button',
      'New repeating events stay in Prism',
      'Read-only for creates and edits',
      'read-only API token',
      '—',
      // A screen's name, dashboard and switches moved to the Screen tab (#1326).
      'Through the day > Name this device',
      'Through the day > Shows',
      'Other screens',
      'Name of screen',
      'Dashboard it shows',
      'go to Through the day',
      // Through the day is gone, and its words with it (#1349).
      'Through the day',
      'Through the Day',
      'Base dashboard',
      'When nobody is using it',
      'Rest after',
      'How dark',
      'Dim this dashboard',
      'Look > This screen',
      'editor\'s More',
      'Screensaver motion',
      // The round button is only a page's Add (#1354).
      'Dashboard options',
      // The Dashboard and More tabs, and Settings > Text Size, are gone (#1350).
      'Edit layout > Dashboard',
      'Dashboard > Make the default',
      'The Dashboard tab',
      'More > Export',
      'More > Import',
      'More > Share to the gallery',
      'Reset this layout',
      'More > Overview',
      'Screen shape',
      'See it at a screen size',
      'Settings > Text Size',
      'Stays when resting',
      // Settings > Screens holds it now, and a row has no dashboard picker (#1351).
      'Show on new and unnamed screens',
      'Settings > Appearance, the Background Wallpaper card has',
      'and the dashboard it shows',
      // One model (#1352): no screensaver, no resting, no old places.
      'Screensaver',
      'screensaver',
      'resting',
      'never rests',
      '(Settings > Bus)',
      'chosen for each dashboard',
    ]) expect(text).not.toContain(gone);
  });

  it('on a phone, still has the topics a phone needs', () => {
    mobile = true;
    render(<HelpView />);
    expect(topics()).toEqual(expect.arrayContaining(['Glance', 'Getting Around', 'Screens', 'Mobile Dashboard']));
    expect(topics()).not.toContain('Dashboard Editor');
  });
});
