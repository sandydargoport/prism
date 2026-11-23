/**
 * @jest-environment jsdom
 *
 * Help describes the app as it is after the new look (#1308): Glance, the bar
 * at the bottom, screens and Through the day each have a topic, What's new
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
    expect(names.slice(at + 1, at + 4)).toEqual(['Glance', 'Getting Around', 'Screens & Through the Day']);
    // The scroll spec reaches for the last topic.
    expect(names.at(-1)).toBe('Troubleshooting');
  });

  it("What's new links to the full changelog in a new tab", () => {
    render(<HelpView />);
    fireEvent.click(screen.getByRole('button', { name: "What's new" }));
    const link = screen.getByRole('link', { name: 'See everything that changed' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toMatch(/\bnoopener\b/);
  });

  it('gives directions the way the app has them, and none to controls that are gone', () => {
    render(<HelpView />);
    const text = allTopicText();
    for (const direction of [
      'More > Edit layout > Through the day',
      'More > Edit layout > Screen',
      'Name of screen',
      'Dashboard it shows',
      'When nobody is using it',
      'More > Edit layout > Widgets',
      'More > This screen > Away mode',
      'Settings > Security > Require the PIN for every change',
      'Look > This screen',
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
      'Screen > Shows',
      'Other screens',
      'go to Through the day',
    ]) expect(text).not.toContain(gone);
  });

  it('on a phone, still has the topics a phone needs', () => {
    mobile = true;
    render(<HelpView />);
    expect(topics()).toEqual(expect.arrayContaining(['Glance', 'Getting Around', 'Screens & Through the Day', 'Mobile Dashboard']));
    expect(topics()).not.toContain('Dashboard Editor');
  });
});
