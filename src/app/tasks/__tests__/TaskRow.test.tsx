/**
 * @jest-environment jsdom
 */
/**
 * TaskRow's actions.
 *
 * The Tasks page renders TaskRow, which offered edit only — there was no way
 * to delete a task anywhere in the UI. The handler, the confirmation dialog
 * and the API route all existed; nothing rendered a control that reached them.
 *
 * The row itself toggles completion on click, so the risk with adding a
 * delete button is that tapping it also marks the task done on the way out.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskRow } from '../TaskRow';
import type { Task } from '@/types';

const task = {
  id: 't1',
  title: 'Take out the bins',
  completed: false,
  priority: 'normal',
  dueDate: null,
} as unknown as Task;

describe('TaskRow', () => {
  it('offers a delete action when a handler is given', () => {
    render(<TaskRow task={task} onToggle={jest.fn()} onEdit={jest.fn()} onDelete={jest.fn()} />);
    // jest-dom matchers are not set up in this repo; getBy* throws when absent.
    expect(screen.getByLabelText('Delete task')).toBeTruthy();
  });

  it('omits it entirely when no handler is given', () => {
    // Rows in read-only contexts must not show a control that does nothing.
    render(<TaskRow task={task} onToggle={jest.fn()} onEdit={jest.fn()} />);
    expect(screen.queryByLabelText('Delete task')).toBeNull();
  });

  it('deletes without also toggling the task complete', () => {
    const onDelete = jest.fn();
    const onToggle = jest.fn();
    render(<TaskRow task={task} onToggle={onToggle} onEdit={jest.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByLabelText('Delete task'));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('edits without also toggling', () => {
    const onEdit = jest.fn();
    const onToggle = jest.fn();
    render(<TaskRow task={task} onToggle={onToggle} onEdit={onEdit} onDelete={jest.fn()} />);

    fireEvent.click(screen.getByLabelText('Edit task'));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('still toggles when the row body is clicked', () => {
    const onToggle = jest.fn();
    render(<TaskRow task={task} onToggle={onToggle} onEdit={jest.fn()} onDelete={jest.fn()} />);

    fireEvent.click(screen.getByText('Take out the bins'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
