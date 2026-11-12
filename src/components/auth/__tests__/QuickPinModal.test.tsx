/**
 * @jest-environment jsdom
 */

/**
 * The sign-in box is a named dialog with a named close button, and Escape
 * closes it, before and after someone is picked (#834).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@/components/providers', () => ({
  useFamily: () => ({
    loading: false,
    members: [{ id: 'm1', loginIndex: 0, name: 'Alex', color: '#3b82f6', role: 'parent', pinLength: 4 }],
  }),
}));

import { QuickPinModal } from '../QuickPinModal';

function open(extra: Partial<React.ComponentProps<typeof QuickPinModal>> = {}) {
  const onOpenChange = jest.fn();
  render(
    <QuickPinModal open onOpenChange={onOpenChange} title="Sign in to make changes" description="Pick who you are" onAuthenticated={jest.fn()} {...extra} />,
  );
  return onOpenChange;
}

describe('QuickPinModal (#834)', () => {
  it('is a dialog named by its title, with a named close button', () => {
    const onOpenChange = open();
    expect(screen.getByRole('dialog', { name: 'Sign in to make changes' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on Escape while choosing who you are', () => {
    const onOpenChange = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes on Escape on the PIN pad, once', () => {
    const onOpenChange = open({ preSelectedMember: { id: 'm1', loginIndex: 0, name: 'Alex', color: '#3b82f6', role: 'parent', pinLength: 4 } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
