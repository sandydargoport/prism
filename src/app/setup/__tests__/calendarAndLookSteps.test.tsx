/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { wizardSteps } from '../SetupWizard';
import { CalendarStep } from '../steps/CalendarStep';
import { LookStep } from '../steps/LookStep';
import { CompleteStep } from '../steps/CompleteStep';

// #808: the wizard brings calendars in and picks a look before Done.

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
});

describe('wizard steps', () => {
  it('a first run asks for calendars and a look, after the household and before Done', () => {
    expect(wizardSteps(true).map((s) => s.id))
      .toEqual(['welcome', 'family', 'household', 'calendar', 'look', 'complete']);
  });

  it('running setup again skips the look, which is only applied the first time', () => {
    expect(wizardSteps(false).map((s) => s.id))
      .toEqual(['welcome', 'family', 'household', 'calendar', 'complete']);
  });
});

describe('CalendarStep', () => {
  it('subscribes to a pasted link and lists it', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<CalendarStep onNext={jest.fn()} onBack={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Calendar link'), { target: { value: 'webcal://example.com/school.ics' } });
    fireEvent.change(screen.getByLabelText('Calendar name'), { target: { value: 'School' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => expect(screen.getByRole('list', { name: 'Calendars added' }).textContent).toContain('School'));
    expect(fetchMock).toHaveBeenCalledWith('/api/calendar-sources', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ url: 'webcal://example.com/school.ics', type: 'ical', name: 'School' });
    expect(screen.getByRole('button', { name: /continue/i })).toBeTruthy();
  });

  it("shows the server's reason when a link is refused, and can be skipped", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'A valid http, https, or webcal URL is required' }) });
    const onNext = jest.fn();
    render(<CalendarStep onNext={onNext} onBack={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Calendar link'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect((await screen.findByRole('alert')).textContent).toContain('valid http, https, or webcal URL');
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(onNext).toHaveBeenCalled();
  });
});

describe('LookStep', () => {
  it('offers Photo, Night and Paper with Photo picked, and saves the pick', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    const onNext = jest.fn();
    render(<LookStep onNext={onNext} onBack={jest.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.querySelector('span')?.textContent)).toEqual(['Photo', 'Night', 'Paper']);
    expect(radios[0]!.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(radios[2]!);
    expect(radios[2]!.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => expect(onNext).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ key: 'firstLook', value: 'paper' });
  });
});

// #930: the last step shows the two front pages a first run sets up.
describe('CompleteStep', () => {
  it('a first run shows Today and Calendar, and starts on Today', () => {
    render(<CompleteStep firstRun />);
    const pages = document.querySelectorAll('[data-setup-front-page]');
    expect([...pages].map((p) => p.getAttribute('data-setup-front-page'))).toEqual(['today', 'calendar']);
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Calendar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start on Today' })).toBeTruthy();
  });

  it('running setup again sets up no pages, so it shows none', () => {
    render(<CompleteStep firstRun={false} />);
    expect(document.querySelector('[data-setup-front-pages]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Go to dashboard' })).toBeTruthy();
  });
});
