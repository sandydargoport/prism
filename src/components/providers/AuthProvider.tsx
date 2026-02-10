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
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { QuickPinModal, type QuickPinMember } from '@/components/auth';

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

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("Who's there?");
  const [modalDescription, setModalDescription] = useState('Enter your PIN to continue');

  // Promise resolver for requireAuth
  const [authResolver, setAuthResolver] = useState<{
    resolve: (user: QuickPinMember | null) => void;
  } | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    async function checkSession(): Promise<QuickPinMember | null> {
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
      } catch (error) {
        console.error('Failed to check session:', error);
      }
      return null;
    }

    // Store the promise so requireAuth can wait for it
    sessionCheckPromiseRef.current = checkSession().finally(() => {
      setSessionChecked(true);
    });
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

      // No active session - show modal and wait for authentication
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
    setShowModal(false);
  }, [authResolver]);

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

  const value: AuthContextType = {
    activeUser,
    setActiveUser,
    requireAuth,
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
