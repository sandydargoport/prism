'use client';

import { useState } from 'react';
import { Baby } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBabysitterMode } from '@/lib/hooks/useBabysitterMode';
import { QuickPinModal } from '@/components/auth/QuickPinModal';
import { PERMISSIONS } from '@/types/user';

interface BabysitterModeToggleProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  className?: string;
}

export function BabysitterModeToggle({
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
  className,
}: BabysitterModeToggleProps) {
  const { isActive, toggle, loading } = useBabysitterMode();
  const [showPinModal, setShowPinModal] = useState(false);

  const handleClick = () => {
    if (isActive) {
      // Already in babysitter mode - clicking won't do anything here
      // The overlay handles exit
      return;
    }
    // Show PIN modal to enable babysitter mode
    setShowPinModal(true);
  };

  const handleAuthenticated = async (user: { role: 'parent' | 'child' | 'guest' }) => {
    // Check if user has permission (reuse away mode permission)
    if (!PERMISSIONS[user.role].canToggleAwayMode) {
      return;
    }
    await toggle(true);
    // Dispatch event to immediately update all listeners (including overlay)
    window.dispatchEvent(new Event('prism:babysitter-mode-change'));
  };

  if (isActive || loading) {
    return null; // Hide toggle when in babysitter mode or loading
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={className}
        title="Enable Babysitter Mode"
      >
        <Baby className="h-4 w-4" />
        {showLabel && <span className="ml-2">Babysitter Mode</span>}
      </Button>

      <QuickPinModal
        open={showPinModal}
        onOpenChange={setShowPinModal}
        title="Enable Babysitter Mode"
        description="Select a parent to enable babysitter mode"
        onAuthenticated={handleAuthenticated}
      />
    </>
  );
}
