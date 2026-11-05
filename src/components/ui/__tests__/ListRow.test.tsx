/**
 * @jest-environment jsdom
 */
/**
 * One list row (#932): editing controls only while managing.
 */
import { render, screen } from '@testing-library/react';
import { ListRow } from '../ListRow';
import { PersonMark } from '../PersonMark';

describe('ListRow', () => {
  it('shows no editing control at rest', () => {
    render(<ListRow title="Feed the pets" meta="Sophie" actions={<button>Delete</button>} />);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.getByText('Feed the pets')).toBeTruthy();
  });
  it('shows them while the list is being managed', () => {
    render(<ListRow title="Feed the pets" editing actions={<button>Delete</button>} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });
  it('never puts a mark that is a button inside the row\'s own button', () => {
    const { container } = render(<ListRow title="Milk" mark={<button>tick</button>} onClick={() => {}} />);
    expect(container.querySelector('button button')).toBeNull();
  });
  it('is at least 56px tall', () => {
    const { container } = render(<ListRow title="Milk" />);
    expect((container.firstChild as HTMLElement).className).toContain('min-h-[56px]');
  });
});

describe('PersonMark', () => {
  it('draws a ring in the person colour at the photo strength', () => {
    const { container } = render(<PersonMark color="#3B82F6" kind="ring" ground="photo" />);
    const ring = container.querySelector('[data-person-mark="ring"]') as HTMLElement;
    expect(ring.style.borderColor).not.toBe('');
  });
});
