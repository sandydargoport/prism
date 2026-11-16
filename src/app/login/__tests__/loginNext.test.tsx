/**
 * @jest-environment jsdom
 */
/**
 * After signing in, /login?next= returns only to a path on this instance
 * (#1221). A browser reads a backslash as a slash, so `/\evil.example` is
 * another site even though it starts with one slash.
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { safeNextPath } from '@/lib/auth/safeNextPath';

const mockReplace = jest.fn();
let mockNext: string | null = null;
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, refresh: jest.fn() }),
  useSearchParams: () => ({ get: (k: string) => (k === 'next' ? mockNext : null) }),
}));
let signIn: (() => void) | null = null;
jest.mock('@/components/auth', () => ({
  QuickPinModal: (p: { onAuthenticated: (u: unknown) => void }) => {
    signIn = () => p.onAuthenticated({ id: 'member-a' });
    return null;
  },
}));

import LoginPage from '../page';

const ORIGIN = 'https://prism.example';

describe('safeNextPath', () => {
  it.each([
    ['/calendar', '/calendar'],
    ['/settings?section=family#members', '/settings?section=family#members'],
    ['/a/../b', '/b'],
    [`${ORIGIN}/tasks`, '/tasks'],
  ])('keeps a path on this instance: %s', (next, want) => {
    expect(safeNextPath(next, ORIGIN)).toBe(want);
  });

  it.each([
    ['/\\evil.example'],
    ['/\\/evil.example/path'],
    ['//evil.example'],
    ['https://evil.example/'],
    ['javascript:alert(1)'],
    ['\\\\evil.example'],
    [''],
    [null],
  ])('sends anything else home: %s', (next) => {
    expect(safeNextPath(next, ORIGIN)).toBe('/');
  });
});

describe('/login after sign in', () => {
  beforeEach(() => mockReplace.mockClear());

  it('does not follow a backslash path off the site', () => {
    mockNext = '/\\evil.example';
    render(<LoginPage />);
    act(() => signIn!());
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('returns to the page that sent it here', () => {
    mockNext = '/tasks?view=week';
    render(<LoginPage />);
    act(() => signIn!());
    expect(mockReplace).toHaveBeenCalledWith('/tasks?view=week');
  });
});
