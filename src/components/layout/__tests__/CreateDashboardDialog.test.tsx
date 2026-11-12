/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';

import { CreateDashboardDialog } from '../LayoutEditorDashboardManager';

describe('CreateDashboardDialog: a new dashboard is the family\'s own (#1151)', () => {
  it('starts from a template, a copy or blank; Today and Calendar are not offered', () => {
    const { container } = render(<CreateDashboardDialog open onClose={() => {}} onCreate={() => {}} />);
    const starts = [...container.querySelectorAll('[data-start-from] button')].map((b) => b.textContent);
    expect(starts).toEqual(['Default Template', 'Copy Current', 'Blank']);
    expect(screen.queryByText('Simple')).toBeNull();
    expect(screen.queryByText('Custom')).toBeNull();
    expect(screen.queryByText('Calendar')).toBeNull();
  });

  it('creates from the chosen start', () => {
    const onCreate = jest.fn();
    render(<CreateDashboardDialog open onClose={() => {}} onCreate={onCreate} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Kitchen Display'), { target: { value: 'Hall' } });
    fireEvent.click(screen.getByText('Blank'));
    fireEvent.click(screen.getByText('Create'));
    expect(onCreate).toHaveBeenCalledWith('Hall', 'blank');
  });
});
