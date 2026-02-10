'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import type { FamilyMember } from '@/types';

interface FamilyContextValue {
  members: FamilyMember[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const FamilyContext = createContext<FamilyContextValue>({
  members: [],
  loading: true,
  error: null,
  refresh: async () => {},
});

export function useFamily(): FamilyContextValue {
  return useContext(FamilyContext);
}

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/family');
      if (response.ok) {
        const data = await response.json();
        setMembers(
          data.members.map((m: {
            id: string;
            name: string;
            role: string;
            color: string;
            avatarUrl?: string | null;
            hasPin: boolean;
          }) => ({
            id: m.id,
            name: m.name,
            role: m.role as 'parent' | 'child' | 'guest',
            color: m.color,
            avatarUrl: m.avatarUrl,
            hasPin: m.hasPin,
          }))
        );
      } else {
        setError('Failed to fetch family members');
      }
    } catch (err) {
      console.error('Failed to fetch family members:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch family members');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Refresh every 10 minutes with visibility-based pause
  useVisibilityPolling(fetchMembers, 10 * 60 * 1000);

  return (
    <FamilyContext.Provider value={{ members, loading, error, refresh: fetchMembers }}>
      {children}
    </FamilyContext.Provider>
  );
}
