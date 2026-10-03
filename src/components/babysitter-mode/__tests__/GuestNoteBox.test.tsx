/**
 * @jest-environment jsdom
 */

/**
 * The sitter's note box (#497). On the Babysitter Mode overlay any click opens
 * the parent unlock dialog, so typing in the box must not reach it.
 */

import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuestNoteBox } from '../GuestNoteBox';

const mockFetch = jest.fn();

beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const noteValue = () => (screen.getByLabelText('Note for the family') as HTMLTextAreaElement).value;

describe('GuestNoteBox', () => {
  it('keeps clicks inside the box from reaching the overlay', () => {
    const onOverlayClick = jest.fn();
    render(
      <div onClick={onOverlayClick}>
        <GuestNoteBox />
      </div>
    );
    fireEvent.click(screen.getByLabelText('Note for the family'));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onOverlayClick).not.toHaveBeenCalled();
  });

  it('cannot send an empty note', () => {
    render(<GuestNoteBox />);
    type('Note for the family', '   ');
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('posts the note and name, then confirms', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    render(<GuestNoteBox />);
    type('Note for the family', ' Bedtime went fine. ');
    type('Your name (optional)', 'Sam');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect((await screen.findByRole('status')).textContent).toContain('Sent.');
    expect(mockFetch).toHaveBeenCalledWith('/api/guest-notes', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ message: 'Bedtime went fine.', name: 'Sam' });

    fireEvent.click(screen.getByRole('button', { name: 'Write another' }));
    expect(noteValue()).toBe('');
  });

  it('shows why the server refused, and keeps the text', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Babysitter Mode is off, so notes cannot be left right now.' }),
    });
    render(<GuestNoteBox />);
    type('Note for the family', 'Hello');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Babysitter Mode is off');
    await waitFor(() => expect(noteValue()).toBe('Hello'));
  });
});
