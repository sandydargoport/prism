/**
 * @jest-environment jsdom
 */

/**
 * Backup times are formatted in the browser, in the display zone and the
 * household's 12/24-hour setting. The server used to format them on its own
 * clock, which is UTC on a default Docker install.
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';

const mockTimeFormat = { timeFormat: '12h', displayTimezone: 'America/Chicago' };

jest.mock('@/components/providers', () => ({ useTimeFormat: () => mockTimeFormat }));
jest.mock('@/lib/hooks/useBackups', () => ({
  useBackups: () => ({
    backups: [{
      filename: 'prism_2026-09-29T01-30-00.sql.gz',
      size: 1024,
      sizeFormatted: '1 KB',
      // 20:30 on Sep 28 in Chicago.
      createdAt: '2026-09-29T01:30:00.000Z',
    }],
    loading: false,
    error: null,
    creating: false,
    restoring: null,
    deleting: null,
    truncating: false,
    seeding: false,
    refresh: jest.fn(),
    createBackup: jest.fn(),
    restoreBackup: jest.fn(),
    deleteBackup: jest.fn(),
    downloadBackup: jest.fn(),
    truncateDatabase: jest.fn(),
    seedDatabase: jest.fn(),
  }),
}));

import { BackupSection } from '../BackupSection';

describe('BackupSection backup times', () => {
  it('shows the time in the display zone', () => {
    render(<BackupSection />);
    expect(screen.getByText('Sep 28, 2026, 8:30 PM')).toBeTruthy();
  });

  it('follows the 24-hour setting', () => {
    mockTimeFormat.timeFormat = '24h';
    mockTimeFormat.displayTimezone = 'Asia/Tokyo';
    render(<BackupSection />);
    expect(screen.getByText('Sep 29, 2026, 10:30')).toBeTruthy();
  });
});
