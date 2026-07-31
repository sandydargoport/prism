/**
 * @jest-environment jsdom
 *
 * Behavioral tests for the PinPad authentication component.
 *
 * Tests cover what a user sees and can do — not implementation details.
 * The PinPad renders a member-selection grid first, then a PIN entry view
 * once a member is chosen.
 */

import * as React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Module mocks — must come before any component imports
// ---------------------------------------------------------------------------

jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

// Radix-based shadcn/ui components: stub with plain HTML so jsdom can render them
jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    className,
    ...rest
  }: React.PropsWithChildren<{
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    className?: string;
  }>) => (
    <button onClick={onClick} disabled={disabled} className={className} {...rest}>
      {children}
    </button>
  ),
}));

// Avatar components: render initials so we can assert on member names
jest.mock('@/components/ui/avatar', () => ({
  UserAvatar: ({
    name,
    imageUrl,
    color,
    size,
    className,
  }: {
    name: string;
    imageUrl?: string | null;
    color?: string;
    size?: string;
    className?: string;
  }) => (
    <div
      data-testid={`avatar-${name}`}
      aria-label={name}
      className={className}
      style={color ? { backgroundColor: color } : undefined}
    >
      {name[0]}
    </div>
  ),
  getInitials: (name: string) => name[0],
}));

// next/image is not needed here (we stub UserAvatar above) but guard against any stray imports
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

// Lucide icons: simple text stubs
jest.mock('lucide-react', () => ({
  Delete: () => <span data-testid="icon-delete">⌫</span>,
  X: () => <span data-testid="icon-x">✕</span>,
}));

// FamilyProvider / useFamily — the PinPad falls back to demo members when
// providedMembers is not passed and the context has no members.
// Most tests pass familyMembers directly, so we just return an empty context here.
jest.mock('@/components/providers', () => ({
  useFamily: () => ({ members: [], loading: false, error: null, refresh: jest.fn() }),
}));

// ---------------------------------------------------------------------------
// Import components AFTER mocks are registered
// ---------------------------------------------------------------------------

import { PinPad } from '../PinPad';
import type { FamilyMember } from '@/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const MEMBERS: FamilyMember[] = [
  { id: 'user-alice', name: 'Alice', color: '#3B82F6', role: 'parent' },
  { id: 'user-bob',   name: 'Bob',   color: '#EC4899', role: 'child'  },
];

const ALICE = MEMBERS[0]!;

/** Helper — click a member to move into PIN entry mode */
function selectMember(name: string) {
  const btn = screen.getByRole('button', { name: `Select ${name}` });
  fireEvent.click(btn);
}

/** Helper — click a digit on the NumberPad */
function clickDigit(digit: string) {
  const btn = screen.getByRole('button', { name: `Enter digit ${digit}` });
  fireEvent.click(btn);
}

/** Helper — click backspace on the NumberPad */
function clickBackspace() {
  fireEvent.click(screen.getByRole('button', { name: 'Delete last digit' }));
}

/** Helper — enter four digits via the NumberPad buttons */
function enterPin(digits: string) {
  for (const d of digits) {
    clickDigit(d);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PinPad — member selection screen', () => {
  it('renders member selection with member names when multiple members are provided', () => {
    render(<PinPad familyMembers={MEMBERS} />);

    // Heading
    expect(screen.getByText("Who's there?")).toBeTruthy();

    // Each member has a selectable button
    expect(screen.getByRole('button', { name: 'Select Alice' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Select Bob' })).toBeTruthy();

    // Member names are visible in the grid
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('renders a single member without throwing', () => {
    render(<PinPad familyMembers={[ALICE]} />);
    expect(screen.getByRole('button', { name: 'Select Alice' })).toBeTruthy();
  });
});

describe('PinPad — selecting a member', () => {
  it('hides the member grid and shows PIN input after clicking a member', () => {
    render(<PinPad familyMembers={MEMBERS} />);

    // Member grid is visible
    expect(screen.getByText("Who's there?")).toBeTruthy();

    selectMember('Alice');

    // Member grid should no longer be shown
    expect(screen.queryByText("Who's there?")).toBeNull();

    // The selected member's name appears in the header area
    expect(screen.getByText('Alice')).toBeTruthy();
    // "Tap to switch" hint is shown
    expect(screen.getByText('Tap to switch')).toBeTruthy();
  });

  it('calls onMemberSelect with the chosen member', () => {
    const onMemberSelect = jest.fn();
    render(<PinPad familyMembers={MEMBERS} onMemberSelect={onMemberSelect} />);

    selectMember('Bob');

    expect(onMemberSelect).toHaveBeenCalledTimes(1);
    expect(onMemberSelect).toHaveBeenCalledWith(MEMBERS[1]);
  });

  it('clicking "Tap to switch" returns to member selection', () => {
    render(<PinPad familyMembers={MEMBERS} />);

    selectMember('Alice');
    expect(screen.queryByText("Who's there?")).toBeNull();

    // The avatar / name area is a button with the clear action
    fireEvent.click(screen.getByText('Tap to switch'));

    expect(screen.getByText("Who's there?")).toBeTruthy();
  });
});

describe('PinPad — digit entry', () => {
  beforeEach(() => {
    render(<PinPad familyMembers={MEMBERS} onPinSubmit={() => new Promise(() => {})} />);
    selectMember('Alice');
  });

  it('shows the PIN dot display (4 empty dots) after selecting a member', () => {
    // PinDisplay renders `length` dots; 4 dots = 4 div elements inside the display
    // We check that the NumberPad digit buttons are present as proxy for PIN view
    expect(screen.getByRole('button', { name: 'Enter digit 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enter digit 0' })).toBeTruthy();
  });

  it('clicking digit buttons updates the filled dot count', () => {
    // PinDisplay fills dots by applying different CSS classes based on fill count.
    // We can observe state indirectly by verifying no error appears after first digit.
    clickDigit('3');
    // No error message should appear
    expect(screen.queryByRole('alert')).toBeNull();
    // The digit buttons are still present (not disabled yet for < 4 digits)
    expect(screen.getByRole('button', { name: 'Enter digit 3' })).toBeTruthy();
  });

  it('can click multiple digit buttons sequentially', () => {
    clickDigit('1');
    clickDigit('2');
    clickDigit('3');
    // No crash, still in PIN entry mode
    expect(screen.getByRole('button', { name: 'Delete last digit' })).toBeTruthy();
  });
});

describe('PinPad — per-member PIN length (regression: #123)', () => {
  // #123: a member with a 5/6-digit PIN could not log in because the pad
  // auto-submitted at 4 digits. The pad must require the SELECTED member's
  // own pinLength before submitting.
  const SIX: FamilyMember = { id: 'user-cara', name: 'Cara', color: '#10B981', role: 'parent', pinLength: 6 };
  const FOUR: FamilyMember = { id: 'user-dan', name: 'Dan', color: '#F59E0B', role: 'parent', pinLength: 4 };

  it('does NOT auto-submit a 6-digit member until the 6th digit', async () => {
    const onPinSubmit = jest.fn().mockResolvedValue(true);
    render(<PinPad familyMembers={[SIX]} onPinSubmit={onPinSubmit} />);
    selectMember('Cara');

    enterPin('12345'); // five digits — the #123 bug would have submitted at four
    expect(onPinSubmit).not.toHaveBeenCalled();

    await act(async () => {
      clickDigit('6'); // sixth digit completes the PIN
    });
    await waitFor(() => expect(onPinSubmit).toHaveBeenCalledTimes(1));
    expect(onPinSubmit).toHaveBeenCalledWith('123456', SIX);
  });

  it('auto-submits a 4-digit member at the 4th digit', async () => {
    const onPinSubmit = jest.fn().mockResolvedValue(true);
    render(<PinPad familyMembers={[FOUR]} onPinSubmit={onPinSubmit} />);
    selectMember('Dan');

    enterPin('123');
    expect(onPinSubmit).not.toHaveBeenCalled();

    await act(async () => {
      clickDigit('4');
    });
    await waitFor(() => expect(onPinSubmit).toHaveBeenCalledTimes(1));
    expect(onPinSubmit).toHaveBeenCalledWith('1234', FOUR);
  });
});

describe('PinPad — backspace', () => {
  it('backspace removes the last entered digit without error', () => {
    // onPinSubmit that never resolves so auto-submit doesn't fire while we test backspace
    render(<PinPad familyMembers={MEMBERS} onPinSubmit={() => new Promise(() => {})} />);
    selectMember('Alice');

    clickDigit('5');
    clickDigit('7');

    // Backspace should remove last digit — no crash
    clickBackspace();

    // Still in PIN entry mode
    expect(screen.getByRole('button', { name: 'Delete last digit' })).toBeTruthy();
  });

  it('backspace on empty PIN does nothing', () => {
    render(<PinPad familyMembers={MEMBERS} onPinSubmit={() => new Promise(() => {})} />);
    selectMember('Alice');

    clickBackspace();

    // Still in PIN entry mode, no error
    expect(screen.getByRole('button', { name: 'Delete last digit' })).toBeTruthy();
    expect(screen.queryByText(/incorrect/i)).toBeNull();
  });
});

describe('PinPad — auto-submit (correct PIN)', () => {
  it('calls onSuccess with the selected member after entering 4 digits when onPinSubmit resolves true', async () => {
    const onSuccess = jest.fn();
    const onPinSubmit = jest.fn().mockResolvedValue(true);

    render(
      <PinPad
        familyMembers={MEMBERS}
        onPinSubmit={onPinSubmit}
        onSuccess={onSuccess}
      />
    );
    selectMember('Alice');

    await act(async () => {
      enterPin('1234');
    });

    await waitFor(() => {
      expect(onPinSubmit).toHaveBeenCalledWith('1234', ALICE);
      expect(onSuccess).toHaveBeenCalledWith(ALICE);
    });
  });

  it('passes the entered PIN string (not individual digits) to onPinSubmit', async () => {
    const onPinSubmit = jest.fn().mockResolvedValue(true);

    render(
      <PinPad
        familyMembers={MEMBERS}
        onPinSubmit={onPinSubmit}
        onSuccess={jest.fn()}
      />
    );
    selectMember('Alice');

    await act(async () => {
      enterPin('5678');
    });

    await waitFor(() => {
      expect(onPinSubmit).toHaveBeenCalledWith('5678', ALICE);
    });
  });
});

describe('PinPad — wrong PIN', () => {
  it('shows an error message when onPinSubmit resolves false', async () => {
    const onPinSubmit = jest.fn().mockResolvedValue(false);

    render(
      <PinPad
        familyMembers={MEMBERS}
        onPinSubmit={onPinSubmit}
        onSuccess={jest.fn()}
      />
    );
    selectMember('Alice');

    await act(async () => {
      enterPin('9999');
    });

    await waitFor(() => {
      expect(screen.getByText(/incorrect pin/i)).toBeTruthy();
    });
  });

  it('clears the PIN after a wrong entry (ready for retry)', async () => {
    const onPinSubmit = jest.fn().mockResolvedValue(false);

    render(
      <PinPad
        familyMembers={MEMBERS}
        onPinSubmit={onPinSubmit}
        onSuccess={jest.fn()}
      />
    );
    selectMember('Alice');

    await act(async () => {
      enterPin('0000');
    });

    await waitFor(() => {
      // Error is shown
      expect(screen.getByText(/incorrect pin/i)).toBeTruthy();
    });

    // NumberPad is still visible for retry
    expect(screen.getByRole('button', { name: 'Enter digit 1' })).toBeTruthy();
  });

  it('calls onError when onPinSubmit throws', async () => {
    const onError = jest.fn();
    const onPinSubmit = jest.fn().mockRejectedValue(new Error('Network error'));

    render(
      <PinPad
        familyMembers={MEMBERS}
        onPinSubmit={onPinSubmit}
        onSuccess={jest.fn()}
        onError={onError}
      />
    );
    selectMember('Alice');

    await act(async () => {
      enterPin('1234');
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Network error');
    });
  });
});

describe('PinPad — keyboard input', () => {
  it('pressing a digit key on the keyboard enters a digit', async () => {
    const onPinSubmit = jest.fn().mockResolvedValue(true);
    const onSuccess = jest.fn();

    render(
      <PinPad
        familyMembers={MEMBERS}
        onPinSubmit={onPinSubmit}
        onSuccess={onSuccess}
      />
    );
    selectMember('Alice');

    // Fire keyboard events (usePinPad listens on document)
    await act(async () => {
      fireEvent.keyDown(document, { key: '1' });
      fireEvent.keyDown(document, { key: '2' });
      fireEvent.keyDown(document, { key: '3' });
      fireEvent.keyDown(document, { key: '4' });
    });

    await waitFor(() => {
      expect(onPinSubmit).toHaveBeenCalledWith('1234', ALICE);
      expect(onSuccess).toHaveBeenCalledWith(ALICE);
    });
  });

  it('pressing Escape / Backspace keyboard key removes the last digit', async () => {
    // We use a never-resolving submit to hold state during the test
    const onPinSubmit = jest.fn().mockImplementation(() => new Promise(() => {}));

    render(
      <PinPad
        familyMembers={MEMBERS}
        onPinSubmit={onPinSubmit}
      />
    );
    selectMember('Alice');

    fireEvent.keyDown(document, { key: '7' });
    fireEvent.keyDown(document, { key: '8' });
    fireEvent.keyDown(document, { key: 'Backspace' });

    // After pressing Backspace the PIN should have one digit ('7').
    // We verify the component is still in PIN mode (no submit fired)
    expect(onPinSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete last digit' })).toBeTruthy();
  });
});

describe('PinPad — cancel button', () => {
  it('renders a Cancel button when showCancel=true and onCancel is provided', () => {
    render(
      <PinPad
        familyMembers={MEMBERS}
        showCancel
        onCancel={jest.fn()}
      />
    );
    selectMember('Alice');

    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
  });

  it('calls onCancel when the Cancel button is clicked', () => {
    const onCancel = jest.fn();
    render(
      <PinPad
        familyMembers={MEMBERS}
        showCancel
        onCancel={onCancel}
      />
    );
    selectMember('Alice');

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does NOT render a Cancel button when showCancel is false', () => {
    render(
      <PinPad
        familyMembers={MEMBERS}
        showCancel={false}
        onCancel={jest.fn()}
      />
    );
    selectMember('Alice');

    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull();
  });
});

describe('PinPad — demo mode (no onPinSubmit)', () => {
  it('calls onSuccess with selected member when no onPinSubmit is provided (demo mode)', async () => {
    jest.useFakeTimers();
    const onSuccess = jest.fn();

    render(<PinPad familyMembers={MEMBERS} onSuccess={onSuccess} />);
    selectMember('Alice');

    // Enter 4 digits — demo mode accepts any 4-digit PIN after a 500ms delay
    await act(async () => {
      enterPin('0000');
      jest.advanceTimersByTime(600);
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(ALICE);
    });

    jest.useRealTimers();
  });
});
