/**
 *
 * A lightweight modal for quick user authentication when taking actions.
 * Instead of requiring login upfront, this prompts for PIN when needed.
 *
 * USE CASES:
 * - Posting a message ("Who's posting?")
 * - Completing a chore ("Who completed this?")
 * - Adding a task ("Who's adding this?")
 *
 * FEATURES:
 * - Shows family member avatars
 * - PIN entry after selection
 * - Remembers last authenticated user for quick re-auth
 * - Can be dismissed (cancel action)
 *
 */

'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import { useFamily } from '@/components/providers';

/**
 * FAMILY MEMBER TYPE
 */
export interface QuickPinMember {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
  role: 'parent' | 'child' | 'guest';
}

/**
 * QUICK PIN MODAL PROPS
 */
export interface QuickPinModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal is closed */
  onOpenChange: (open: boolean) => void;
  /** Title shown at top of modal */
  title?: string;
  /** Description text */
  description?: string;
  /** Callback when authentication succeeds */
  onAuthenticated: (user: QuickPinMember) => void;
  /** Pre-selected member (skip member selection) */
  preSelectedMember?: QuickPinMember | null;
  /** Lock to pre-selected member (cannot switch users) */
  lockToMember?: boolean;
}

/**
 * QUICK PIN MODAL COMPONENT
 */
export function QuickPinModal({
  open,
  onOpenChange,
  title = "Who's there?",
  description = "Select your profile to continue",
  onAuthenticated,
  preSelectedMember,
  lockToMember = false,
}: QuickPinModalProps) {
  // Family members from context
  const { members: contextMembers, loading: loadingMembers } = useFamily();
  const members: QuickPinMember[] = contextMembers.filter(m => m.role).map(m => ({
    id: m.id,
    name: m.name,
    color: m.color,
    avatarUrl: m.avatarUrl ?? undefined,
    role: m.role as 'parent' | 'child' | 'guest',
  }));

  // Selected member
  const [selectedMember, setSelectedMember] = useState<QuickPinMember | null>(
    preSelectedMember || null
  );

  // PIN entry
  const [pin, setPin] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const pinLength = 4;

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedMember(preSelectedMember || null);
      setPin([]);
      setError(null);
    }
  }, [open, preSelectedMember]);

  // Handle key press
  const handleKeyPress = useCallback((digit: string) => {
    if (isVerifying) return;
    setError(null);
    setPin((prev) => {
      if (prev.length >= pinLength) return prev;
      return [...prev, digit];
    });
  }, [isVerifying]);

  // Handle backspace
  const handleBackspace = useCallback(() => {
    if (isVerifying) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, [isVerifying]);

  // Keyboard support
  useEffect(() => {
    if (!open || !selectedMember) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isVerifying) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedMember, isVerifying, handleKeyPress, handleBackspace, onOpenChange]);

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (pin.length !== pinLength || !selectedMember) return;

    const verifyPin = async () => {
      setIsVerifying(true);
      const enteredPin = pin.join('');

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: selectedMember.id,
            pin: enteredPin,
          }),
        });

        if (response.ok) {
          onAuthenticated(selectedMember);
          onOpenChange(false);
        } else {
          setError('Incorrect PIN');
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
          setPin([]);
        }
      } catch (err) {
        setError('Authentication failed');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
        setPin([]);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyPin();
  }, [pin, selectedMember, onAuthenticated, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="bg-card rounded-2xl p-6 max-w-sm w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        {!selectedMember ? (
          // Member selection
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-4">{description}</p>
            {loadingMembers ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {members.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedMember(member)}
                    className={cn(
                      'flex flex-col items-center p-3 rounded-xl',
                      'hover:bg-accent/50 active:bg-accent transition-colors',
                      'touch-action-manipulation'
                    )}
                  >
                    <UserAvatar
                      name={member.name}
                      color={member.color}
                      imageUrl={member.avatarUrl}
                      size="lg"
                      className="h-14 w-14 mb-2"
                    />
                    <span className="text-sm font-medium">{member.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          // PIN entry
          <div className="text-center">
            {/* Selected member */}
            {lockToMember ? (
              // Locked - show member but no switch option
              <div className="flex flex-col items-center mx-auto mb-4">
                <UserAvatar
                  name={selectedMember.name}
                  color={selectedMember.color}
                  imageUrl={selectedMember.avatarUrl}
                  size="lg"
                  className="h-16 w-16 mb-1 ring-2 ring-primary"
                />
                <span className="font-medium">{selectedMember.name}</span>
                <span className="text-xs text-muted-foreground">Enter your PIN</span>
              </div>
            ) : (
              // Not locked - allow switching
              <button
                onClick={() => {
                  setSelectedMember(null);
                  setPin([]);
                  setError(null);
                }}
                className="group flex flex-col items-center mx-auto mb-4"
              >
                <UserAvatar
                  name={selectedMember.name}
                  color={selectedMember.color}
                  imageUrl={selectedMember.avatarUrl}
                  size="lg"
                  className="h-16 w-16 mb-1 group-hover:ring-2 ring-primary transition-all"
                />
                <span className="font-medium">{selectedMember.name}</span>
                <span className="text-xs text-muted-foreground">Tap to switch</span>
              </button>
            )}

            {/* PIN dots */}
            <div
              className={cn(
                'flex gap-3 justify-center mb-4',
                isShaking && 'animate-shake'
              )}
            >
              {Array.from({ length: pinLength }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-3 h-3 rounded-full transition-all duration-150',
                    i < pin.length
                      ? error
                        ? 'bg-destructive scale-110'
                        : 'bg-primary scale-110'
                      : 'bg-muted border-2 border-border'
                  )}
                />
              ))}
            </div>

            {/* Error/Status message - fixed height to prevent layout shift */}
            <div className="h-6 mb-3 flex items-center justify-center">
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            {/* Number pad */}
            <div className="grid grid-cols-3 gap-2 max-w-[200px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(
                (key, idx) => {
                  if (key === '') return <div key={idx} />;
                  if (key === 'del') {
                    return (
                      <button
                        key={idx}
                        onClick={handleBackspace}
                        disabled={isVerifying}
                        className={cn(
                          'w-12 h-12 rounded-full mx-auto',
                          'flex items-center justify-center',
                          'bg-muted hover:bg-muted/80',
                          'active:bg-accent active:scale-95',
                          'transition-all duration-100',
                          'text-muted-foreground text-sm',
                          isVerifying && 'opacity-50'
                        )}
                      >
                        Del
                      </button>
                    );
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => handleKeyPress(key)}
                      disabled={isVerifying}
                      className={cn(
                        'w-12 h-12 rounded-full mx-auto',
                        'flex items-center justify-center',
                        'bg-secondary hover:bg-secondary/80',
                        'active:bg-primary active:text-primary-foreground active:scale-95',
                        'transition-all duration-100',
                        'text-lg font-semibold',
                        isVerifying && 'opacity-50'
                      )}
                    >
                      {key}
                    </button>
                  );
                }
              )}
            </div>

            {/* Loading - fixed height to prevent layout shift */}
            <div className="h-6 mt-3 flex items-center justify-center">
              {isVerifying && (
                <p className="text-sm text-muted-foreground">Verifying...</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
