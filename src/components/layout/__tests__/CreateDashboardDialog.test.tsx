/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/components/dashboard/useDashboardLayout', () => ({ editLink: (p: string) => p }));

import { CreateDashboardDialog } from '../LayoutEditorDashboardManager';

describe('CreateDashboardDialog: Start from, by kind (#991)', () => {
  it('groups Today and Calendar under Simple, the grid starts under Custom', () => {
    const { container } = render(<CreateDashboardDialog open onClose={() => {}} onCreate={() => {}} />);
    const group = (kind: string) => [...container.querySelectorAll(`[data-start-from-kind="${kind}"] button`)].map((b) => b.textContent);
    expect(group('simple')).toEqual(['Today', 'Calendar']);
    expect(group('custom')).toEqual(['Default Template', 'Copy Current', 'Blank']);
    expect(screen.getByText('Simple')).toBeTruthy();
    expect(screen.getByText('Custom')).toBeTruthy();
  });

  it('still creates from the chosen start', () => {
    const onCreate = jest.fn();
    render(<CreateDashboardDialog open onClose={() => {}} onCreate={onCreate} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Kitchen Display'), { target: { value: 'Hall' } });
    fireEvent.click(screen.getByText('Calendar'));
    fireEvent.click(screen.getByText('Create'));
    expect(onCreate).toHaveBeenCalledWith('Hall', 'calendar');
  });
});
