import { cn } from '../cn';

describe('cn', () => {
  // --- Basic string combination ---
  it('combines multiple string arguments', () => {
    expect(cn('p-4', 'bg-white', 'rounded-lg')).toBe('p-4 bg-white rounded-lg');
  });

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  // --- Conditional classes ---
  it('ignores falsy values (false, null, undefined, 0, empty string)', () => {
    expect(cn('base', false, null, undefined, 0, '', 'end')).toBe('base end');
  });

  it('includes truthy conditional classes', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('btn', isActive && 'btn-active', isDisabled && 'btn-disabled')).toBe('btn btn-active');
  });

  it('handles ternary expressions', () => {
    expect(cn('text-base', true ? 'p-4' : 'p-2')).toBe('text-base p-4');
    expect(cn('text-base', false ? 'p-4' : 'p-2')).toBe('text-base p-2');
  });

  // --- Tailwind conflict resolution ---
  it('resolves padding conflicts (later wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('resolves text color conflicts', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('resolves background color conflicts', () => {
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('resolves directional padding with full override', () => {
    // p-6 overrides both px-2 and py-4
    expect(cn('px-2', 'py-4', 'p-6')).toBe('p-6');
  });

  // --- Object syntax ---
  it('handles object syntax for conditional classes', () => {
    expect(cn({ 'font-bold': true, 'text-xl': false, 'italic': true })).toBe('font-bold italic');
  });

  it('combines strings with object syntax', () => {
    const status: string = 'success';
    expect(cn('badge', {
      'text-green-500': status === 'success',
      'text-red-500': status === 'error',
    })).toBe('badge text-green-500');
  });

  // --- Array syntax ---
  it('handles array arguments', () => {
    expect(cn(['p-4', 'bg-white'], 'ring-2')).toBe('p-4 bg-white ring-2');
  });

  // --- Responsive/modifier conflict resolution ---
  it('resolves hover modifier conflicts', () => {
    expect(cn('hover:bg-red-500', 'hover:bg-blue-500')).toBe('hover:bg-blue-500');
  });

  it('keeps different modifier prefixes separate', () => {
    const result = cn('hover:bg-red-500', 'focus:bg-blue-500');
    expect(result).toContain('hover:bg-red-500');
    expect(result).toContain('focus:bg-blue-500');
  });

  it('resolves dark mode conflicts', () => {
    expect(cn('dark:bg-gray-800', 'dark:bg-gray-900')).toBe('dark:bg-gray-900');
  });

  // --- Real-world usage patterns ---
  it('handles typical component variant pattern', () => {
    const variant: string = 'destructive';
    const result = cn(
      'inline-flex items-center rounded-md px-3 py-1 text-sm',
      variant === 'default' && 'bg-primary text-primary-foreground',
      variant === 'destructive' && 'bg-destructive text-destructive-foreground',
    );
    expect(result).toContain('bg-destructive');
    expect(result).not.toContain('bg-primary');
  });

  it('handles className override pattern (component prop)', () => {
    const baseClasses = 'rounded-md p-2 text-sm';
    const overrideClasses = 'p-4 text-lg';
    const result = cn(baseClasses, overrideClasses);
    // p-4 should override p-2, text-lg should override text-sm
    expect(result).toContain('p-4');
    expect(result).not.toContain('p-2');
    expect(result).toContain('text-lg');
    expect(result).not.toContain('text-sm');
    expect(result).toContain('rounded-md');
  });

  it('keeps the floored text sizes next to a text colour (#798)', () => {
    for (const size of ['text-2xs', 'text-3xs', 'text-4xs', 'text-event', 'text-daynum', 'text-daynum-large']) {
      expect(cn(size, 'text-muted-foreground')).toBe(`${size} text-muted-foreground`);
      // and they are sizes: a later size replaces them
      expect(cn(size, 'text-sm')).toBe('text-sm');
    }
  });
});
