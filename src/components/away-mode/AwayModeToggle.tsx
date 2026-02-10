'use client';

import { useState } from 'react';
import { Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAwayMode } from '@/lib/hooks/useAwayMode';
import { QuickPinModal } from '@/components/auth/QuickPinModal';
import { PERMISSIONS } from '@/types/user';

interface AwayModeToggleProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
  className?: string;
}

export function AwayModeToggle({
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
  className,
}: AwayModeToggleProps) {
  const { isAway, toggle, loading } = useAwayMode();
  const [showPinModal, setShowPinModal] = useState(false);

  const handleClick = () => {
    if (isAway) {
      // Already in away mode - clicking won't do anything here
      // The overlay handles exit
      return;
    }
    // Show PIN modal to enable away mode
    setShowPinModal(true);
  };

  const handleAuthenticated = async (user: { role: 'parent' | 'child' | 'guest' }) => {
    // Check if user has permission
    if (!PERMISSIONS[user.role].canToggleAwayMode) {
      return;
    }
    await toggle(true);
    // Dispatch event to immediately update all listeners (including overlay)
    window.dispatchEvent(new Event('prism:away-mode-change'));
  };

  if (isAway || loading) {
    return null; // Hide toggle when in away mode or loading
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        className={className}
        title="Enable Away Mode"
      >
        <Moon className="h-4 w-4" />
        {showLabel && <span className="ml-2">Away Mode</span>}
      </Button>

      <QuickPinModal
        open={showPinModal}
        onOpenChange={setShowPinModal}
        title="Enable Away Mode"
        description="Select a parent to enable away mode"
        onAuthenticated={handleAuthenticated}
      />
    </>
  );
}
