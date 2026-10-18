/**
 * @jest-environment jsdom
 */

/**
 * The member colour picker (#640): presets, a custom colour, and colours other
 * members already use marked but still selectable.
 */

import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemberColorPicker } from '../MemberColorPicker';
import { MEMBER_COLORS } from '@/lib/constants/memberColors';

describe('MemberColorPicker', () => {
  it('shows every preset and marks the selected one', () => {
    render(<MemberColorPicker value="#10B981" onChange={() => {}} />);
    // The presets plus the custom-colour button.
    expect(screen.getAllByRole('button')).toHaveLength(MEMBER_COLORS.length + 1);
    expect(screen.getByRole('button', { name: 'Emerald' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Blue' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('names who already has a colour, and still lets it be picked', () => {
    const onChange = jest.fn();
    render(
      <MemberColorPicker value="#3B82F6" onChange={onChange} taken={[{ color: '#ec4899', name: 'Robin' }]} />,
    );
    const pink = screen.getByRole('button', { name: 'Pink, used by Robin' });
    expect(pink.textContent).toBe('R');
    fireEvent.click(pink);
    expect(onChange).toHaveBeenCalledWith('#EC4899');
  });

  it('picks a custom colour in a panel with Done, not a browser popup', () => {
    const onChange = jest.fn();
    render(<MemberColorPicker value="#3B82F6" onChange={onChange} />);
    expect(document.querySelector('input[type="color"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Custom color' }));
    fireEvent.change(screen.getByLabelText('Color code'), { target: { value: '#12ab9f' } });
    expect(onChange).toHaveBeenLastCalledWith('#12AB9F');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByLabelText('Color code')).toBeNull();
  });

  it('Cancel puts back the colour the panel opened with', () => {
    const onChange = jest.fn();
    render(<MemberColorPicker value="#3B82F6" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom color' }));
    fireEvent.change(screen.getByLabelText('Hue'), { target: { value: '30' } });
    expect(onChange).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onChange).toHaveBeenLastCalledWith('#3B82F6');
  });

  it('ignores a colour code that is not a hex colour', () => {
    const onChange = jest.fn();
    render(<MemberColorPicker value="#3B82F6" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom color' }));
    fireEvent.change(screen.getByLabelText('Color code'), { target: { value: 'red;x' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("marks another member's custom colour with their initial, like a preset", () => {
    render(
      <MemberColorPicker value="#3B82F6" onChange={() => {}} taken={[{ color: '#123456', name: 'Jamie' }]} />,
    );
    const theirs = screen.getByRole('button', { name: 'Custom color #123456, used by Jamie' });
    expect(theirs.textContent).toBe('J');
  });

  it('shows every other member beside the colour being picked', () => {
    render(
      <MemberColorPicker
        value="#3B82F6"
        onChange={() => {}}
        taken={[{ color: '#123456', name: 'Jamie' }, { color: '#EC4899', name: 'Robin' }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Custom color' }));
    const panel = screen.getByRole('group', { name: 'Custom color' });
    expect(panel.textContent).toContain('Jamie');
    expect(panel.textContent).toContain('Robin');
  });

  it('shows a stored colour that is not a preset as the selected custom one', () => {
    render(<MemberColorPicker value="#123456" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Custom color #123456' })).not.toBeNull();
    // No preset claims it.
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
  });

  it('warns when a custom colour is too light for white text', () => {
    render(<MemberColorPicker value="#FFFFFF" onChange={() => {}} />);
    expect(screen.getByText(/very light/)).not.toBeNull();
  });

  it('says nothing about legibility for a preset', () => {
    render(<MemberColorPicker value="#84CC16" onChange={() => {}} />);
    expect(screen.queryByText(/very light|very dark/)).toBeNull();
  });
});
