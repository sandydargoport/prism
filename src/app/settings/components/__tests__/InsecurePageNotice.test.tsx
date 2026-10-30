/**
 * @jest-environment jsdom
 */
/**
 * On a plain http:// page the browser turns off the mic, camera, clipboard and
 * app install, so Settings says so once, links to the https guide, and stays
 * dismissed on that device.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InsecurePageNotice, HTTPS_DOCS_URL } from '../InsecurePageNotice';

function setSecure(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true });
}

beforeEach(() => localStorage.clear());

describe('InsecurePageNotice', () => {
  it('lists what is turned off and links to the https guide on an http:// page', async () => {
    setSecure(false);
    render(<InsecurePageNotice />);
    expect(await screen.findByText(/need an https:\/\/ address/i)).toBeTruthy();
    expect(screen.getByText(/microphone, barcode scanning with the camera, copy buttons, and installing/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /over https at home/i }).getAttribute('href')).toBe(HTTPS_DOCS_URL);
  });

  it('shows nothing on a secure page', () => {
    setSecure(true);
    const { container } = render(<InsecurePageNotice />);
    expect(container.innerHTML).toBe('');
  });

  it('stays dismissed on this device once closed', async () => {
    setSecure(false);
    const first = render(<InsecurePageNotice />);
    fireEvent.click(await screen.findByRole('button', { name: /dismiss/i }));
    expect(first.container.innerHTML).toBe('');
    first.unmount();

    const again = render(<InsecurePageNotice />);
    expect(again.container.innerHTML).toBe('');
  });
});
