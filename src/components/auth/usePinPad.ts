'use client';

import { useState, useCallback, useEffect } from 'react';
import type { FamilyMember } from '@/types';

export interface UsePinPadOptions {
  /** Fallback PIN length used before a member is selected (or if the selected
   *  member has no explicit `pinLength`, e.g. demo members). Once a member is
   *  selected, THEIR `pinLength` always wins — PIN pads are per-member. */
  pinLength?: number;
  controlledSelectedMember?: FamilyMember | null;
  onMemberSelect?: (member: FamilyMember) => void;
  onPinSubmit?: (pin: string, member: FamilyMember) => Promise<boolean>;
  onSuccess?: (member: FamilyMember) => void;
  onError?: (error: string) => void;
}

export function usePinPad({
  pinLength: fallbackPinLength = 4,
  controlledSelectedMember,
  onMemberSelect,
  onPinSubmit,
  onSuccess,
  onError,
}: UsePinPadOptions) {
  const [internalSelectedMember, setInternalSelectedMember] = useState<FamilyMember | null>(null);
  const selectedMember = controlledSelectedMember ?? internalSelectedMember;
  // The selected member's own PIN length always wins — every pad requires
  // exactly THEIR configured number of digits, not a family-wide constant.
  const pinLength = selectedMember?.pinLength ?? fallbackPinLength;

  const [pin, setPin] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleMemberSelect = useCallback((member: FamilyMember) => {
    setInternalSelectedMember(member);
    onMemberSelect?.(member);
    setPin([]);
    setError(null);
  }, [onMemberSelect]);

  const handleKeyPress = useCallback((digit: string) => {
    if (isVerifying) return;
    setError(null);
    setPin((prev) => {
      if (prev.length >= pinLength) return prev;
      return [...prev, digit];
    });
  }, [pinLength, isVerifying]);

  const handleBackspace = useCallback(() => {
    if (isVerifying) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  }, [isVerifying]);

  const handleClear = useCallback(() => {
    if (isVerifying) return;
    setPin([]);
    setError(null);
  }, [isVerifying]);

  const triggerShake = useCallback(() => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  }, []);

  const clearSelectedMember = useCallback(() => {
    setInternalSelectedMember(null);
    setPin([]);
    setError(null);
  }, []);

  // Keyboard support
  useEffect(() => {
    if (!selectedMember) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isVerifying) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter' && pin.length === pinLength) {
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedMember, isVerifying, handleKeyPress, handleBackspace, pin.length, pinLength]);

  // Auto-submit when PIN reaches full length
  useEffect(() => {
    if (pin.length !== pinLength || !selectedMember) return;

    const verifyPin = async () => {
      setIsVerifying(true);
      const enteredPin = pin.join('');

      try {
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
          await new Promise((resolve) => setTimeout(resolve, 500));
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

  return {
    selectedMember,
    pin,
    error,
    isShaking,
    isVerifying,
    /** Resolved PIN length in effect right now (selected member's own length, or the fallback). */
    pinLength,
    handleMemberSelect,
    handleKeyPress,
    handleBackspace,
    handleClear,
    clearSelectedMember,
  };
}
