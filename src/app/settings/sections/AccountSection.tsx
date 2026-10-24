'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { useFamily } from '@/components/providers/FamilyProvider';
import { useFetchOnMount } from '@/lib/hooks/useFetchOnMount';

export function AccountSection() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    role: string;
    color: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            setCurrentUser(data.user);
          }
        }
      } catch (error) {
        console.error('Failed to check auth:', error);
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Account &amp; Profile</h2>
        <p className="text-muted-foreground">
          Current session and dashboard defaults
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Session</CardTitle>
          <CardDescription>
            {authLoading ? 'Checking authentication...' :
             currentUser ? 'You are currently logged in' : 'You are not logged in'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : currentUser ? (
            <div className="flex items-center gap-3">
              <UserAvatar
                name={currentUser.name}
                color={currentUser.color}
                imageUrl={currentUser.avatarUrl}
                size="lg"
                className="h-12 w-12"
              />
              <div>
                <div className="font-medium">{currentUser.name}</div>
                <Badge
                  variant={currentUser.role === 'parent' ? 'default' : 'secondary'}
                >
                  {currentUser.role}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                Click your avatar in the side navigation to log in
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <DefaultDisplayUserCard />
    </div>
  );
}

function DefaultDisplayUserCard() {
  const { members } = useFamily();
  const [displayUserId, setDisplayUserId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const parentMembers = members.filter(m => m.role === 'parent');

  const fetchSetting = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setDisplayUserId((data.settings?.displayUserId as string) || '');
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useFetchOnMount(fetchSetting);

  const handleChange = async (value: string) => {
    setDisplayUserId(value);
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'displayUserId',
          value: value || null,
        }),
      });
    } catch { /* ignore */ }
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Display User</CardTitle>
        <CardDescription>
          When no one is logged in, the dashboard shows data as this user would see it (read-only).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <select
          value={displayUserId}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving}
          className="w-full border border-border rounded px-3 py-2 text-sm bg-background"
        >
          <option value="">None (empty dashboard when logged out)</option>
          {parentMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {saving && (
          <p className="text-xs text-muted-foreground">Saving...</p>
        )}
      </CardContent>
    </Card>
  );
}
