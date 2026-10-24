/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { PhotoUpload } from '../PhotoUpload';

beforeEach(() => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: true } as Response)) as unknown as typeof fetch;
});
afterEach(() => {
  delete (global as { fetch?: unknown }).fetch;
});

describe('PhotoUpload', () => {
  it('calls the onUploadComplete from the latest render, not the first', async () => {
    // The photos page passes a fresh closure on every render. An upload has to
    // report to the current one, or it refreshes with whatever the page held
    // when the upload panel first opened.
    const first = jest.fn();
    const latest = jest.fn();
    const { container, rerender } = render(<PhotoUpload onUploadComplete={first} />);
    rerender(<PhotoUpload onUploadComplete={latest} />);

    const input = container.querySelector('#photo-file-input') as HTMLInputElement;
    const file = new File(['x'], 'beach.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(latest).toHaveBeenCalledTimes(1));
    expect(first).not.toHaveBeenCalled();
  });
});
