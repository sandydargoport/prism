/**
 * PinPad — touch-friendly PIN entry for family member authentication.
 *
 * WHY PIN AUTHENTICATION?
 * Traditional password auth doesn't work well on shared displays.
 * A 4-digit PIN provides quick access, is easy to remember for all ages,
 * and works great with touch-friendly large buttons.
 *
 * USAGE:
 *   <PinPad onSuccess={(user) => setCurrentUser(user)} />
 *   <PinPad familyMembers={members} onSuccess={handleLogin} />
 *
 * ARCHITECTURE:
 *   usePinPad      — all state & handlers
 *   MemberSelection — avatar grid
 *   PinDisplay     — dot indicators
 *   NumberPad      — numeric keypad
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { useFamily } from '@/components/providers';

import { usePinPad } from './usePinPad';
import { usePinLength } from '@/lib/hooks/usePinLength';
import { MemberSelection, getDemoFamilyMembers } from './MemberSelection';
import { PinDisplay } from './PinDisplay';
import { NumberPad } from './NumberPad';

import type { FamilyMember } from '@/types';
export type { FamilyMember };

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

export function PinPad({
  familyMembers: providedMembers,
  selectedMember: controlledSelectedMember,
  onMemberSelect,
  onPinSubmit,
  onSuccess,
  onError,
  pinLength,
  showCancel = false,
  onCancel,
  className,
}: PinPadProps) {
  const { members: contextMembers, loading: contextLoading } = useFamily();
  const loadingMembers = !providedMembers && contextLoading;

  const familyMembers =
    providedMembers || (contextMembers.length > 0 ? contextMembers : getDemoFamilyMembers());

  // Family-wide PIN length; an explicit prop still wins (e.g. tests / demos).
  const { pinLength: configuredPinLength } = usePinLength();
  const effectivePinLength = pinLength ?? configuredPinLength;

  const {
    selectedMember,
    pin,
    error,
    isShaking,
    isVerifying,
    handleMemberSelect,
    handleKeyPress,
    handleBackspace,
    handleClear,
    clearSelectedMember,
  } = usePinPad({
    pinLength: effectivePinLength,
    controlledSelectedMember,
    onMemberSelect,
    onPinSubmit,
    onSuccess,
    onError,
  });

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        'p-6 bg-background rounded-2xl shadow-lg',
        'max-w-sm mx-auto',
        className
      )}
    >
      {!selectedMember ? (
        loadingMembers ? (
          <div className="flex flex-col items-center">
            <h2 className="text-xl font-semibold mb-6">Loading...</h2>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <MemberSelection members={familyMembers} onSelect={handleMemberSelect} />
        )
      ) : (
        <>
          {/* Selected member display */}
          <div className="flex flex-col items-center mb-6">
            <button onClick={clearSelectedMember} className="group flex flex-col items-center">
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

          <PinDisplay
            length={effectivePinLength}
            filled={pin.length}
            error={!!error}
            isShaking={isShaking}
          />

          {error && (
            <p className="text-sm text-destructive mt-2 text-center">{error}</p>
          )}

          <NumberPad
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            onClear={handleClear}
            disabled={isVerifying}
            className="mt-6"
          />

          {showCancel && onCancel && (
            <Button variant="ghost" onClick={onCancel} className="mt-4">
              Cancel
            </Button>
          )}

          {isVerifying && (
            <div className="mt-4 text-sm text-muted-foreground">Verifying...</div>
          )}
        </>
      )}
    </div>
  );
}
