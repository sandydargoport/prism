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
    expect(screen.getAllByRole('button')).toHaveLength(MEMBER_COLORS.length);
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

  it('passes a custom colour through as upper-case hex', () => {
    const onChange = jest.fn();
    render(<MemberColorPicker value="#3B82F6" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Custom color'), { target: { value: '#12ab9f' } });
    expect(onChange).toHaveBeenCalledWith('#12AB9F');
  });

  it('shows a stored colour that is not a preset as the selected custom one', () => {
    render(<MemberColorPicker value="#123456" onChange={() => {}} />);
    const input = screen.getByLabelText('Custom color #123456') as HTMLInputElement;
    expect(input.value).toBe('#123456');
    for (const button of screen.getAllByRole('button')) {
      expect(button.getAttribute('aria-pressed')).toBe('false');
    }
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
