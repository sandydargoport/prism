/**
 * ============================================================================
 * PRISM - Combined Providers Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Wraps all application providers in a single client component.
 * This is needed because the root layout is a Server Component.
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { ThemeProvider } from './ThemeProvider';
import { AuthProvider } from './AuthProvider';

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * PROVIDERS COMPONENT
 * ============================================================================
 * Wraps the application with all necessary providers.
 * AuthProvider must be inside ThemeProvider since QuickPinModal uses styled components.
 * ============================================================================
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider defaultTheme="system">
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
