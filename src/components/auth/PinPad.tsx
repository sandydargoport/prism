/**
 *
 * Provides a touch-friendly PIN pad for family member authentication.
 * This is the primary way users identify themselves on the family dashboard.
 *
 * WHY PIN AUTHENTICATION?
 * Traditional password authentication doesn't work well on shared displays.
 * A 4-digit PIN provides:
 * - Quick access (no typing on virtual keyboard)
 * - Easy to remember for all ages
 * - Touch-friendly large buttons
 * - Visual feedback during entry
 *
 * SECURITY NOTES:
 * - PINs are hashed before storage (never stored in plain text)
 * - Rate limiting prevents brute force attacks
 * - Optional: Auto-lock after failed attempts
 * - This is designed for household use, not high-security applications
 *
 * FEATURES:
 * - Large touch targets (44px minimum, we use 64px for comfort)
 * - Visual PIN dots showing entry progress
 * - Haptic-style visual feedback on key press
 * - Clear and backspace functionality
 * - Error shake animation for wrong PIN
 * - Family member avatar selection
 *
 * USAGE:
 *   <PinPad onSuccess={(user) => setCurrentUser(user)} />
 *   <PinPad familyMembers={members} onSuccess={handleLogin} />
 *
 */

'use client';

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { Delete, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { useFamily } from '@/components/providers';

import type { FamilyMember } from '@/types';
export type { FamilyMember };


/**
 * PIN PAD PROPS
 */
export interface PinPadProps {
  /** Family members who can authenticate */
  familyMembers?: FamilyMember[];
  /** Currently selected member (controlled) */
  selectedMember?: FamilyMember | null;
  /** Callback when member is selected */
  onMemberSelect?: (member: FamilyMember) => void;
  /** Callback when PIN is submitted */
  onPinSubmit?: (pin: string, member: FamilyMember) => Promise<boolean>;
  /** Callback when authentication succeeds */
  onSuccess?: (member: FamilyMember) => void;
  /** Callback when authentication fails */
  onError?: (error: string) => void;
  /** Number of digits in PIN */
  pinLength?: number;
  /** Show cancel button */
  showCancel?: boolean;
  /** Callback when cancel is clicked */
  onCancel?: () => void;
  /** Additional CSS classes */
  className?: string;
}


/**
 * PIN PAD COMPONENT
 * A touch-friendly PIN entry interface for family authentication.
 *
 * COMPONENT ARCHITECTURE:
 * The PIN pad has three main sections:
 * 1. Member Selection - Grid of family member avatars
 * 2. PIN Display - Dots showing entered digits
 * 3. Number Pad - 0-9 keys plus backspace and clear
 *
 * STATE MANAGEMENT:
 * - selectedMember: Which family member is authenticating
 * - pin: Current PIN entry (array of digits)
 * - error: Error message to display
 * - isShaking: Triggers shake animation on error
 * - isVerifying: Shows loading state during verification
 *
 * @example Basic usage
 * <PinPad
 *   familyMembers={members}
 *   onSuccess={(member) => router.push('/dashboard')}
 * />
 *
 * @example With error handling
 * <PinPad
 *   onPinSubmit={async (pin, member) => {
 *     const valid = await verifyPin(member.id, pin);
 *     return valid;
 *   }}
 *   onError={(err) => toast.error(err)}
 * />
 */
export function PinPad({
  familyMembers: providedMembers,
  selectedMember: controlledSelectedMember,
  onMemberSelect,
  onPinSubmit,
  onSuccess,
  onError,
  pinLength = 4,
  showCancel = false,
  onCancel,
  className,
}: PinPadProps) {
  // STATE

  // Family members from context or provided
  const { members: contextMembers, loading: contextLoading } = useFamily();
  const loadingMembers = !providedMembers && contextLoading;

  // Use provided members or context members
  const familyMembers = providedMembers || (contextMembers.length > 0 ? contextMembers : getDemoFamilyMembers());

  // Selected family member (internal state if not controlled)
  const [internalSelectedMember, setInternalSelectedMember] = useState<FamilyMember | null>(null);
  const selectedMember = controlledSelectedMember ?? internalSelectedMember;

  // Current PIN entry (array of single digits)
  const [pin, setPin] = useState<string[]>([]);

  // Error state for displaying messages
  const [error, setError] = useState<string | null>(null);

  // Animation state for error shake
  const [isShaking, setIsShaking] = useState(false);

  // Loading state during PIN verification
  const [isVerifying, setIsVerifying] = useState(false);

  // HANDLERS

  /**
   * Handle family member selection
   */
  const handleMemberSelect = useCallback((member: FamilyMember) => {
    setInternalSelectedMember(member);
    onMemberSelect?.(member);
    setPin([]); // Reset PIN when switching members
    setError(null);
  }, [onMemberSelect]);

  /**
   * Handle number key press
   * Adds a digit to the PIN if not at max length
   */
  const handleKeyPress = useCallback((digit: string) => {
    if (isVerifying) return; // Prevent input during verification

    setError(null); // Clear any previous error

    setPin((prev) => {
      if (prev.length >= pinLength) return prev;
      return [...prev, digit];
    });
  }, [pinLength, isVerifying]);

  /**
   * Handle backspace - remove last digit
   */
  const handleBackspace = useCallback(() => {
    if (isVerifying) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, [isVerifying]);

  /**
   * Handle clear - remove all digits
   */
  const handleClear = useCallback(() => {
    if (isVerifying) return;
    setPin([]);
    setError(null);
  }, [isVerifying]);

  /**
   * Trigger error shake animation
   */
  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  }, []);


  // KEYBOARD SUPPORT

  /**
   * Handle keyboard input for PIN entry
   */
  useEffect(() => {
    // Only enable keyboard when a member is selected
    if (!selectedMember) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if verifying
      if (isVerifying) return;

      // Handle number keys (0-9)
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      }
      // Handle backspace
      else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      }
      // Handle enter (submit if PIN is complete)
      else if (e.key === 'Enter' && pin.length === pinLength) {
        e.preventDefault();
        // Auto-submit will handle it
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedMember, isVerifying, handleKeyPress, handleBackspace, pin.length, pinLength]);


  // PIN VERIFICATION

  /**
   * Auto-submit when PIN reaches full length
   *
   * WHY AUTO-SUBMIT?
   * For a touch interface, requiring an additional "submit" button tap
   * after entering 4 digits feels clunky. Auto-submit provides a smoother
   * experience - just tap 4 numbers and you're in.
   */
  useEffect(() => {
    if (pin.length !== pinLength || !selectedMember) return;

    const verifyPin = async () => {
      setIsVerifying(true);
      const enteredPin = pin.join('');

      try {
        // If custom verification function provided, use it
        if (onPinSubmit) {
          const isValid = await onPinSubmit(enteredPin, selectedMember);

          if (isValid) {
            onSuccess?.(selectedMember);
          } else {
            setError('Incorrect PIN. Please try again.');
            triggerShake();
            setPin([]);
          }
        } else {
          // Demo mode: accept any 4-digit PIN
          // In production, this would always use onPinSubmit
          await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay
          onSuccess?.(selectedMember);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        setError(errorMessage);
        onError?.(errorMessage);
        triggerShake();
        setPin([]);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyPin();
  }, [pin, pinLength, selectedMember, onPinSubmit, onSuccess, onError, triggerShake]);


  // RENDER

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        'p-6 bg-background rounded-2xl shadow-lg',
        'max-w-sm mx-auto',
        className
      )}
    >
      {/* ================================================================== */}
      {/* MEMBER SELECTION */}
      {/* Show avatar grid if no member selected */}
      {/* ================================================================== */}
      {!selectedMember ? (
        loadingMembers ? (
          <div className="flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-6">Loading...</h2>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <MemberSelection
            members={familyMembers}
            onSelect={handleMemberSelect}
          />
        )
      ) : (
        <>
          {/* ============================================================== */}
          {/* SELECTED MEMBER DISPLAY */}
          {/* ============================================================== */}
          <div className="flex flex-col items-center mb-6">
            <button
              onClick={() => {
                setInternalSelectedMember(null);
                setPin([]);
                setError(null);
              }}
              className="group flex flex-col items-center"
            >
              <UserAvatar
                name={selectedMember.name}
                color={selectedMember.color}
                imageUrl={selectedMember.avatarUrl}
                size="lg"
                className="h-20 w-20 text-2xl mb-2 group-hover:ring-2 ring-primary transition-all"
              />
              <span className="text-lg font-semibold">{selectedMember.name}</span>
              <span className="text-xs text-muted-foreground">Tap to switch</span>
            </button>
          </div>

          {/* ============================================================== */}
          {/* PIN DISPLAY */}
          {/* Shows dots for each digit position */}
          {/* ============================================================== */}
          <PinDisplay
            length={pinLength}
            filled={pin.length}
            error={!!error}
            isShaking={isShaking}
          />

          {/* Error message */}
          {error && (
            <p className="text-sm text-destructive mt-2 text-center">
              {error}
            </p>
          )}

          {/* ============================================================== */}
          {/* NUMBER PAD */}
          {/* ============================================================== */}
          <NumberPad
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            onClear={handleClear}
            disabled={isVerifying}
            className="mt-6"
          />

          {/* Cancel button */}
          {showCancel && onCancel && (
            <Button
              variant="ghost"
              onClick={onCancel}
              className="mt-4"
            >
              Cancel
            </Button>
          )}

          {/* Loading indicator */}
          {isVerifying && (
            <div className="mt-4 text-sm text-muted-foreground">
              Verifying...
            </div>
          )}
        </>
      )}
    </div>
  );
}


/**
 * MEMBER SELECTION COMPONENT
 * Displays a grid of family member avatars for selection.
 */
function MemberSelection({
  members,
  onSelect,
}: {
  members: FamilyMember[];
  onSelect: (member: FamilyMember) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-semibold mb-6">Who&apos;s there?</h2>
      <div className="grid grid-cols-2 gap-4">
        {members.map((member) => (
          <button
            key={member.id}
            onClick={() => onSelect(member)}
            className={cn(
              'flex flex-col items-center p-4 rounded-xl',
              'hover:bg-accent/50 active:bg-accent transition-colors',
              'touch-action-manipulation',
              // Minimum 44px touch target, we use larger for comfort
              'min-w-[100px] min-h-[100px]'
            )}
          >
            <UserAvatar
              name={member.name}
              color={member.color}
              imageUrl={member.avatarUrl}
              size="lg"
              className="h-16 w-16 text-xl mb-2"
            />
            <span className="text-sm font-medium">{member.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}


/**
 * PIN DISPLAY COMPONENT
 * Shows dots indicating PIN entry progress.
 * Filled dots = entered digits, empty dots = remaining positions.
 */
function PinDisplay({
  length,
  filled,
  error,
  isShaking,
}: {
  length: number;
  filled: number;
  error: boolean;
  isShaking: boolean;
}) {
  return (
    <div
      className={cn(
        'flex gap-3',
        // Shake animation on error
        isShaking && 'animate-shake'
      )}
    >
      {Array.from({ length }, (_, i) => (
        <div
          key={i}
          className={cn(
            'w-4 h-4 rounded-full transition-all duration-150',
            i < filled
              ? error
                ? 'bg-destructive scale-110'
                : 'bg-primary scale-110'
              : 'bg-muted border-2 border-border'
          )}
        />
      ))}
    </div>
  );
}


/**
 * NUMBER PAD COMPONENT
 * The actual numeric keypad with 0-9, backspace, and clear.
 *
 * LAYOUT:
 * | 1 | 2 | 3 |
 * | 4 | 5 | 6 |
 * | 7 | 8 | 9 |
 * | C | 0 | ⌫ |
 *
 * TOUCH OPTIMIZATION:
 * - 64x64px buttons (well above 44px minimum)
 * - Adequate spacing between buttons
 * - Visual feedback on press (active state)
 * - Large, clear text
 */
function NumberPad({
  onKeyPress,
  onBackspace,
  onClear,
  disabled = false,
  className,
}: {
  onKeyPress: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  disabled?: boolean;
  className?: string;
}) {
  // Number pad layout: rows of keys
  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['clear', '0', 'backspace'],
  ];

  return (
    <div className={cn('grid gap-3', className)}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-3 justify-center">
          {row.map((key) => {
            // Handle special keys
            if (key === 'clear') {
              return (
                <NumberKey
                  key={key}
                  onClick={onClear}
                  disabled={disabled}
                  variant="secondary"
                >
                  <X className="h-5 w-5" />
                </NumberKey>
              );
            }

            if (key === 'backspace') {
              return (
                <NumberKey
                  key={key}
                  onClick={onBackspace}
                  disabled={disabled}
                  variant="secondary"
                >
                  <Delete className="h-5 w-5" />
                </NumberKey>
              );
            }

            // Regular number key
            return (
              <NumberKey
                key={key}
                onClick={() => onKeyPress(key)}
                disabled={disabled}
              >
                {key}
              </NumberKey>
            );
          })}
        </div>
      ))}
    </div>
  );
}


/**
 * NUMBER KEY COMPONENT
 * A single key on the number pad.
 */
function NumberKey({
  children,
  onClick,
  disabled = false,
  variant = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'secondary';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // Size: 64x64px for comfortable touch targets
        'w-16 h-16 rounded-full',
        'flex items-center justify-center',
        'text-xl font-semibold',
        // Transitions for smooth feedback
        'transition-all duration-100',
        'touch-action-manipulation',
        // Disable text selection (prevents highlight on touch)
        'select-none',
        // Variants
        variant === 'default' && [
          'bg-secondary hover:bg-secondary/80',
          'active:bg-primary active:text-primary-foreground active:scale-95',
        ],
        variant === 'secondary' && [
          'bg-muted hover:bg-muted/80',
          'active:bg-accent active:scale-95',
          'text-muted-foreground',
        ],
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
}


/**
 * GET DEMO FAMILY MEMBERS
 * Returns demo family member data for development/testing.
 */
function getDemoFamilyMembers(): FamilyMember[] {
  return [
    {
      id: 'alex',
      name: 'Alex',
      color: '#3B82F6',
      role: 'parent',
    },
    {
      id: 'jordan',
      name: 'Jordan',
      color: '#EC4899',
      role: 'parent',
    },
    {
      id: 'emma',
      name: 'Emma',
      color: '#10B981',
      role: 'child',
    },
    {
      id: 'sophie',
      name: 'Sophie',
      color: '#F59E0B',
      role: 'child',
    },
  ];
}
