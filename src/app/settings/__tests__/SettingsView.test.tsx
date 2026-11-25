/**
 * @jest-environment jsdom
 */
/**
 * A link to /settings?section=<id> always opens that section (#1252). Picking
 * a section in the sidebar or the phone dropdown names it in the address bar,
 * so a link to another section changes the URL, which is what opens it. When
 * only the shown section changed, the URL could still name the link's target,
 * and the link did nothing.
 */
import * as React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// A stand-in for the Next router, with jsdom's window.location as the address
// bar. Next wires history.pushState and replaceState into useSearchParams, and
// the test wraps them the same way below: a change of URL re-renders whatever
// reads the search params, and a push to the URL already showing changes
// nothing, as in the app.
const mockListeners = new Set<() => void>();
const mockRouter = {
  push: (href: string) => window.history.pushState(null, '', href),
  replace: (href: string) => window.history.replaceState(null, '', href),
};

jest.mock('next/navigation', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  const subscribe = (listener: () => void) => {
    mockListeners.add(listener);
    return () => { mockListeners.delete(listener); };
  };
  return {
    useRouter: () => mockRouter,
    useSearchParams: () => {
      const search = R.useSyncExternalStore(subscribe, () => window.location.search);
      return R.useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

// next/link navigates on the client with a router push.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, onClick, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault();
        mockRouter.push(href);
      }}
    >
      {children}
    </a>
  ),
}));

jest.mock('@/components/layout', () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/lib/hooks/useLayouts', () => ({ useLayouts: () => ({ layouts: [] }) }));
jest.mock('../components/InsecurePageNotice', () => ({ InsecurePageNotice: () => null }));

// Each section is a heading, except Integrations, which carries the real
// Photo data sources card and its two links to Photos.
function mockSection(heading: string) {
  return function Section() {
    return <h2>{heading}</h2>;
  };
}
jest.mock('../sections/AccountSection', () => ({ AccountSection: mockSection('Account section') }));
jest.mock('../sections/FamilySection', () => ({ FamilySection: mockSection('Family section') }));
jest.mock('../sections/DisplaySection', () => ({ DisplaySection: mockSection('Appearance section') }));
jest.mock('../sections/GeneralSection', () => ({ GeneralSection: mockSection('General section') }));
jest.mock('../sections/SecuritySection', () => ({ SecuritySection: mockSection('Security section') }));
jest.mock('../sections/PhotosSettingsSection', () => ({ PhotosSettingsSection: mockSection('Photos section') }));
jest.mock('../sections/BabysitterInfoSection', () => ({ BabysitterInfoSection: mockSection('Babysitter section') }));
jest.mock('../sections/BackupSection', () => ({ BackupSection: mockSection('Backups section') }));
jest.mock('../sections/BusTrackingSection', () => ({ BusTrackingSection: mockSection('Bus section') }));
jest.mock('../sections/InputSection', () => ({ InputSection: mockSection('Input section') }));
jest.mock('../sections/FeaturesSection', () => ({ FeaturesSection: mockSection('Features section') }));
jest.mock('../sections/TelemetryCard', () => ({ TelemetryCard: () => null }));
jest.mock('../sections/ActivityLogSection', () => ({ ActivityLogSection: mockSection('Activity section') }));
jest.mock('../sections/DisplaysSection', () => ({ DisplaysSection: mockSection('Screens section') }));
jest.mock('../sections/integrations/IntegrationsSection', () => {
  const { PhotoSourcesCard } = jest.requireActual('../sections/integrations/cards/PhotoSourcesCard');
  return {
    IntegrationsSection: function IntegrationsSection() {
      return (
        <div>
          <h2>Integrations section</h2>
          <PhotoSourcesCard />
        </div>
      );
    },
  };
});

import { SettingsView } from '../SettingsView';

const realPushState = window.history.pushState.bind(window.history);
const realReplaceState = window.history.replaceState.bind(window.history);

beforeAll(() => {
  window.history.pushState = (...args: Parameters<History['pushState']>) => {
    realPushState(...args);
    mockListeners.forEach((listener) => listener());
  };
  window.history.replaceState = (...args: Parameters<History['replaceState']>) => {
    realReplaceState(...args);
    mockListeners.forEach((listener) => listener());
  };
});

afterAll(() => {
  window.history.pushState = realPushState;
  window.history.replaceState = realReplaceState;
});

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      sources: [{ id: 'source-a', type: 'local', name: 'Holiday Album', photoCount: 12, priority: 1 }],
    }),
  })) as unknown as typeof fetch;
});

function openSettingsAt(url: string) {
  realReplaceState(null, '', url);
  render(<SettingsView />);
}

const heading = (name: string) => screen.queryByRole('heading', { name });

describe('Settings sections and the address bar (#1252)', () => {
  it.each(['Manage', 'Photos settings'])(
    'the %s link opens Photos after Integrations was picked in the sidebar',
    async (linkName) => {
      openSettingsAt('/settings?section=photos');
      expect(heading('Photos section')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Integrations' }));
      expect(heading('Integrations section')).toBeTruthy();
      await screen.findByText(/^1 source\./);

      // The sources list holds the Photos settings link: open it if it is shut.
      const sourcesList = screen.getByRole('button', { name: /Current sources/ });
      if (sourcesList.getAttribute('aria-expanded') !== 'true') fireEvent.click(sourcesList);
      fireEvent.click(screen.getByRole('link', { name: linkName }));

      expect(heading('Photos section')).toBeTruthy();
      expect(heading('Integrations section')).toBeNull();
    },
  );

  it('the link opens Photos after Integrations was picked in the phone dropdown', async () => {
    openSettingsAt('/settings?section=photos');

    fireEvent.change(screen.getByLabelText('Settings section'), { target: { value: 'integrations' } });
    expect(heading('Integrations section')).toBeTruthy();
    await screen.findByText(/^1 source\./);

    fireEvent.click(screen.getByRole('link', { name: 'Manage' }));

    expect(heading('Photos section')).toBeTruthy();
  });

  it('picking a section names it in the URL, keeps the other params, and adds no Back step', async () => {
    openSettingsAt('/settings?section=integrations&from=kitchen#photo-sources');
    await screen.findByText(/^1 source\./);
    const historyLength = window.history.length;

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Photos' }));
    });

    expect(heading('Photos section')).toBeTruthy();
    expect(window.location.search).toBe('?section=photos&from=kitchen');
    expect(window.location.hash).toBe('');
    expect(window.history.length).toBe(historyLength);
  });
});
