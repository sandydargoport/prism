'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGlobalInput } from '@/lib/hooks/useGlobalInput';
import { useHydrated } from '@/lib/hooks/useStoredValue';

export function KeyboardToggleButton() {
  const { keyboardVisible, setKeyboardVisible, isInputFocused, isMobile, virtualKeyboardEnabled } =
    useGlobalInput();
  const pathname = usePathname();
  const mounted = useHydrated();
  const hasTouchScreen = mounted && navigator.maxTouchPoints > 0;

  // Hidden during the setup wizard — a first-run user has no context for
  // what this control is, and on devices that merely report touch support
  // (e.g. a touchscreen laptop with its own physical keyboard) it shows up
  // as an unexplained floating icon the moment any field is focused. The
  // underlying virtual keyboard still auto-shows on genuine touch input
  // (kiosk displays with no physical keyboard) regardless of this button.
  const isSetupWizard = pathname?.startsWith('/setup') ?? false;

  const show =
    mounted &&
    // Off for this device or the household (#525), or not known yet.
    virtualKeyboardEnabled &&
    hasTouchScreen &&
    !isMobile &&
    !keyboardVisible &&
    isInputFocused &&
    !isSetupWizard;

  if (!show) return null;

  return createPortal(
    <Button
      variant="secondary"
      size="icon"
      aria-label="Open keyboard"
      className={cn(
        'fixed z-8500 rounded-xl shadow-lg',
        'h-12 w-12',
        'transition-opacity duration-150',
        show ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      style={{ bottom: '1.5rem', right: '1.5rem' }}
      onPointerDown={e => {
        e.preventDefault(); // prevent focusout on the active input
        setKeyboardVisible(true);
      }}
    >
      <Keyboard className="h-5 w-5" />
    </Button>,
    document.body,
  );
}
