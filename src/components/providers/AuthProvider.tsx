/**
 *
 * Provides authentication state and utilities across the entire app.
 * Implements the "view freely, authenticate to act" model.
 *
 * AUTHENTICATION MODEL:
 * - Anyone can view the dashboard without logging in (family mode)
 * - When taking an action (post, complete, add), prompt for PIN
 * - After authentication, that user is the "active user"
 * - Active user is remembered for subsequent actions
 * - Session can timeout or be manually switched
 *
 * USAGE:
 *   // In a component that needs auth
 *   const { activeUser, requireAuth } = useAuth();
 *
 *   const handlePost = async () => {
 *     const user = await requireAuth("Who's posting?");
 *     if (!user) return; // User cancelled
 *     // ... proceed with action using user.id
 *   };
 *
 */

'use client';

import * as React from 'react';
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { QuickPinModal, type QuickPinMember } from '@/components/auth';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import { toast } from '@/components/ui/use-toast';

/**
 * AUTH CONTEXT TYPE
 */
interface AuthContextType {
  /** Currently authenticated user (null = family/guest mode) */
  activeUser: QuickPinMember | null;
  /** Set the active user directly (e.g., from session check) */
  setActiveUser: (user: QuickPinMember | null) => void;
  /** Require authentication before proceeding - returns user or null if cancelled */
  requireAuth: (title?: string, description?: string) => Promise<QuickPinMember | null>;
  /** Open a user-switching picker (no PIN needed — for reverse-proxy setups) */
  switchUser: () => Promise<QuickPinMember | null>;
  /** Clear the active user (logout) */
  clearActiveUser: () => void;
  /** Whether auth modal is currently showing */
  isAuthenticating: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * AUTH PROVIDER PROPS
 */
interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AUTH PROVIDER COMPONENT
 */
export function AuthProvider({ children }: AuthProviderProps) {
  // Active user state
  const [activeUser, setActiveUser] = useState<QuickPinMember | null>(null);

  // Session loading state - prevents race conditions
  const [sessionChecked, setSessionChecked] = useState(false);
  const sessionCheckPromiseRef = React.useRef<Promise<QuickPinMember | null> | null>(null);

  // Modal state (PIN-based requireAuth)
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("Who's there?");
  const [modalDescription, setModalDescription] = useState('Enter your PIN to continue');

  // Promise resolver for requireAuth
  const [authResolver, setAuthResolver] = useState<{
    resolve: (user: QuickPinMember | null) => void;
  } | null>(null);

  // Select-only picker state (for user switching behind auth proxy)
  const [showSelectOnlyPicker, setShowSelectOnlyPicker] = useState(false);
  const [selectOnlyResolver, setSelectOnlyResolver] = useState<{
    resolve: (user: QuickPinMember | null) => void;
  } | null>(null);

  // Reusable session check
  const checkSession = useCallback(async (): Promise<QuickPinMember | null> => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.user) {
          const user: QuickPinMember = {
            id: data.user.id,
            name: data.user.name,
            color: data.user.color,
            avatarUrl: data.user.avatarUrl,
            role: data.user.role,
          };
          setActiveUser(user);
          return user;
        }
      }
      // Session invalid — clear active user if one was set
      setActiveUser((prev) => {
        if (prev) console.log('Session expired, clearing active user');
        return prev ? null : prev;
      });
    } catch (error) {
      console.error('Failed to check session:', error);
    }
    return null;
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    sessionCheckPromiseRef.current = checkSession().finally(() => {
      setSessionChecked(true);
    });
  }, [checkSession]);

  // Periodic session validation (every 5 minutes)
  const periodicCheck = useCallback(() => {
    // Only check if we think we're logged in
    if (activeUser) {
      checkSession();
    }
  }, [activeUser, checkSession]);
  useVisibilityPolling(periodicCheck, 5 * 60 * 1000);

  // Listen for 401 auth-expired events from hooks
  useEffect(() => {
    const handleAuthExpired = () => {
      setActiveUser(null);
    };
    window.addEventListener('prism:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('prism:auth-expired', handleAuthExpired);
  }, []);

  /**
   * Require authentication before proceeding
   * Returns the authenticated user or null if cancelled
   */
  const requireAuth = useCallback(
    async (title?: string, description?: string): Promise<QuickPinMember | null> => {
      // If already authenticated, return current user
      if (activeUser) {
        return activeUser;
      }

      // Wait for session check to complete if still loading
      if (!sessionChecked && sessionCheckPromiseRef.current) {
        const sessionUser = await sessionCheckPromiseRef.current;
        if (sessionUser) {
          return sessionUser;
        }
      }

      // No active session — briefly remind the user why the sign-in modal is appearing,
      // then show it. The toast gives context before the modal takes focus.
      toast({
        title: 'Sign in required',
        description: 'Enter your PIN to make changes.',
        duration: 3000,
      });

      return new Promise((resolve) => {
        setModalTitle(title || "Who's there?");
        setModalDescription(description || 'Enter your PIN to continue');
        setAuthResolver({ resolve });
        setShowModal(true);
      });
    },
    [activeUser, sessionChecked]
  );

  /**
   * Handle successful authentication
   */
  const handleAuthenticated = useCallback((user: QuickPinMember) => {
    setActiveUser(user);
    if (authResolver) {
      authResolver.resolve(user);
      setAuthResolver(null);
    }
    if (selectOnlyResolver) {
      selectOnlyResolver.resolve(user);
      setSelectOnlyResolver(null);
    }
    setShowModal(false);
    setShowSelectOnlyPicker(false);
  }, [authResolver, selectOnlyResolver]);

  /**
   * Handle modal close (cancelled)
   */
  const handleModalClose = useCallback((open: boolean) => {
    if (!open) {
      if (authResolver) {
        authResolver.resolve(null);
        setAuthResolver(null);
      }
      setShowModal(false);
    }
  }, [authResolver]);

  /**
   * Handle select-only picker close (cancelled)
   */
  const handleSelectOnlyClose = useCallback((open: boolean) => {
    if (!open) {
      if (selectOnlyResolver) {
        selectOnlyResolver.resolve(null);
        setSelectOnlyResolver(null);
      }
      setShowSelectOnlyPicker(false);
    }
  }, [selectOnlyResolver]);

  /**
   * Clear active user (logout)
   */
  const clearActiveUser = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setActiveUser(null);
  }, []);

  /**
   * Open a select-only user picker for switching between family members
   * without needing a PIN. Useful behind Cloudflare Access or similar.
   */
  const switchUser = useCallback(async (): Promise<QuickPinMember | null> => {
    // Wait for session check to complete if still loading
    if (!sessionChecked && sessionCheckPromiseRef.current) {
      await sessionCheckPromiseRef.current;
    }

    return new Promise((resolve) => {
      setShowSelectOnlyPicker(true);
      setSelectOnlyResolver({ resolve });
    });
  }, [sessionChecked]);

  const value: AuthContextType = {
    activeUser,
    setActiveUser,
    requireAuth,
    switchUser,
    clearActiveUser,
    isAuthenticating: showModal,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <QuickPinModal
        open={showModal}
        onOpenChange={handleModalClose}
        title={modalTitle}
        description={modalDescription}
        onAuthenticated={handleAuthenticated}
        preSelectedMember={activeUser}
        lockToMember={!!activeUser}
      />
      <QuickPinModal
        open={showSelectOnlyPicker}
        onOpenChange={handleSelectOnlyClose}
        title="Switch user"
        description="Select a family member"
        onAuthenticated={handleAuthenticated}
        selectOnly
      />
    </AuthContext.Provider>
  );
}

/**
 * USE AUTH HOOK
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
