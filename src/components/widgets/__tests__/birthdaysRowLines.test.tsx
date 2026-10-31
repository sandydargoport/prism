/**
 * @jest-environment jsdom
 *
 * Birthdays widget: all text is one colour, and how soon each date is shows as
 * the colour of the line under its row.
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { BirthdaysWidget } from '../BirthdaysWidget';
import type { Birthday } from '@/lib/hooks/useBirthdays';

const row = (id: string, daysUntil: number): Birthday => ({
  id, name: `Person ${id}`, birthDate: '2000-01-01', eventType: 'birthday', age: 26, daysUntil, nextBirthday: '2026-11-15',
});

describe('BirthdaysWidget row lines', () => {
  const birthdays = [row('a', 0), row('b', 3), row('c', 12), row('d', 60)];

  it('colours the line under each row by how soon it is', () => {
    const { container } = render(<BirthdaysWidget birthdays={birthdays} />);
    const lines = [...container.querySelectorAll('tr[data-row-line]')].map((tr) =>
      tr.className.split(/\s+/).find((c) => c.startsWith('border-') && c !== 'border-b-2'));
    expect(lines).toEqual(['border-success', 'border-destructive', 'border-warning', 'border-border/50']);
  });

  it('keeps every cell in the plain text colour', () => {
    const { container } = render(<BirthdaysWidget birthdays={birthdays} />);
    const coloured = [...container.querySelectorAll('th, td')].filter((cell) =>
      /\btext-(success|destructive|warning|muted-foreground)\b/.test(cell.className));
    expect(coloured).toHaveLength(0);
    expect(container.querySelectorAll('[data-keep-color]')).toHaveLength(0);
  });
});

describe('BirthdaysWidget remove', () => {
  it('offers each row for removal when it can remove', () => {
    const onRemove = jest.fn();
    const { getByRole } = render(<BirthdaysWidget birthdays={[row('a', 3), row('b', 9)]} onRemove={onRemove} />);
    fireEvent.click(getByRole('button', { name: 'Remove Person b' }));
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  it('leaves rows inert without it', () => {
    const { queryAllByRole } = render(<BirthdaysWidget birthdays={[row('a', 3)]} />);
    expect(queryAllByRole('button')).toHaveLength(0);
  });
});
