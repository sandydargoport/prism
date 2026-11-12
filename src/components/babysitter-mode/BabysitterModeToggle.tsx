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
  'data-screen-job'?: string;
}

export function BabysitterModeToggle({
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
  className,
  'data-screen-job': job,
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
        data-screen-job={job}
        title="Enable Babysitter Mode"
        aria-label="Enable Babysitter Mode"
      >
        <Baby className={showLabel ? 'h-5 w-5' : 'h-4 w-4'} />
        {showLabel && <span>Babysitter mode</span>}
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
