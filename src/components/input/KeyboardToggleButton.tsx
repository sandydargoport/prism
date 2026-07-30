'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGlobalInput } from '@/lib/hooks/useGlobalInput';

export function KeyboardToggleButton() {
  const { keyboardVisible, setKeyboardVisible, isInputFocused, isMobile } =
    useGlobalInput();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [hasTouchScreen, setHasTouchScreen] = useState(false);
  useEffect(() => {
    setMounted(true);
    setHasTouchScreen(navigator.maxTouchPoints > 0);
  }, []);

  // Hidden during the setup wizard — a first-run user has no context for
  // what this control is, and on devices that merely report touch support
  // (e.g. a touchscreen laptop with its own physical keyboard) it shows up
  // as an unexplained floating icon the moment any field is focused. The
  // underlying virtual keyboard still auto-shows on genuine touch input
  // (kiosk displays with no physical keyboard) regardless of this button.
  const isSetupWizard = pathname?.startsWith('/setup') ?? false;

  const show =
    mounted &&
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
        'fixed z-[8500] rounded-xl shadow-lg',
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
