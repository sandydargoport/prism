/**
 * @jest-environment jsdom
 */

/**
 * The Messages widget is memoized and only re-renders when its data changes,
 * so on a wall display "2 minutes ago" stayed "2 minutes ago" until the next
 * message arrived. It now ticks once a minute.
 */

import * as React from 'react';
import { render, screen, act } from '@testing-library/react';

jest.mock('@/lib/utils', () => ({ cn: (...c: unknown[]) => c.filter(Boolean).join(' ') }));
jest.mock('@/components/ui', () => ({
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => <button onClick={onClick}>{children}</button>,
  UserAvatar: ({ name }: { name: string }) => <span>{name}</span>,
}));
jest.mock('@/components/widgets/WidgetContainer', () => ({
  WidgetContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  WidgetEmpty: ({ message }: { message: string }) => <div>{message}</div>,
}));

import { MessagesWidget, type FamilyMessage } from '../MessagesWidget';

describe('MessagesWidget relative time', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-28T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('moves on without new data', () => {
    const message: FamilyMessage = {
      id: 'm1',
      message: 'Back by six',
      author: { id: 'u1', name: 'Sam', color: '#000' },
      createdAt: new Date('2026-09-28T11:58:00Z'),
      pinned: false,
      important: false,
    };
    render(<MessagesWidget messages={[message]} />);
    screen.getByText('2 minutes ago');

    act(() => { jest.advanceTimersByTime(10 * 60_000); });
    screen.getByText('12 minutes ago');
  });
});
