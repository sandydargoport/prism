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
import { createContext, useContext, useState, useCallback, useEffect, useEffectEvent } from 'react';
import { useFetchOnMount } from '@/lib/hooks/useFetchOnMount';
import { QuickPinModal, type QuickPinMember } from '@/components/auth';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';

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
  const checkInitialSession = useCallback(() => {
    const check = checkSession().finally(() => {
      setSessionChecked(true);
    });
    sessionCheckPromiseRef.current = check;
    return check;
  }, [checkSession]);
  useFetchOnMount(checkInitialSession);

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

  // Global sign-in prompt for mutation 401s.
  //
  // When a signed-out user edits a field, ticks a chore, adds a shopping
  // item, etc., the underlying /api/* mutation returns 401. Without an
  // interceptor, the UI just silently fails to update. We wrap window.fetch
  // once here so every mutation response gets checked, and a 401 opens the
  // PIN box: the way through, rather than a toast describing it.
  //
  // Constraints:
  // - Only /api/* paths (don't interfere with third-party fetches like
  //   Google Maps tiles, OneDrive image proxies, etc.).
  // - Only mutation methods (POST/PUT/PATCH/DELETE). GETs to /api/* can
  //   legitimately return 401 during the initial session check.
  // - Debounced: a save burst (e.g. 10 chore updates) prompts once.
  // - Skipped while the PIN box is already open, e.g. from requireAuth().
  const pinBoxOpen = useEffectEvent(() => showModal);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalFetch = window.fetch;
    let lastPromptAt = 0;
    const DEBOUNCE_MS = 2500;

    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      if (!response.ok && response.status === 401) {
        const method = (init?.method ?? 'GET').toUpperCase();
        const url = typeof input === 'string'
          ? input
          : input instanceof URL ? input.toString()
          : (input as Request).url;
        const isMutation = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
        const isApi = url.includes('/api/');
        const now = Date.now();
        if (isMutation && isApi && !pinBoxOpen() && now - lastPromptAt > DEBOUNCE_MS) {
          lastPromptAt = now;
          // Open the PIN box rather than describing it in a toast. The refused
          // change is not replayed: a write that failed once could apply twice,
          // so it is tapped again after signing in.
          setModalTitle('Sign in to make changes');
          setModalDescription('Enter your PIN, then try that again.');
          setShowModal(true);
        }
      }
      return response;
    };

    return () => { window.fetch = originalFetch; };
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
