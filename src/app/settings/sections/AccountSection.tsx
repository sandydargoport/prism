'use client';

import { useState, useEffect } from 'react';
import { LogOut, LogIn, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { useAuth } from '@/components/providers';

export function AccountSection() {
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    role: string;
    color: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const { requireAuth: triggerAuth, setActiveUser: setAuthUser } = useAuth();

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

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        setCurrentUser(null);
        window.location.reload();
      }
    } catch (error) {
      console.error('Logout failed:', error);
      alert('Failed to log out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleLogin = async () => {
    const user = await triggerAuth('Login', 'Select your profile and enter your PIN');
    if (user) {
      setAuthUser(user);
      setCurrentUser({ id: user.id, name: user.name, role: user.role || 'child', color: user.color || '#3B82F6' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Account</h2>
        <p className="text-muted-foreground">
          Manage your session and authentication
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    name={currentUser.name}
                    color={currentUser.color}
                    size="lg"
                    className="h-12 w-12"
                  />
                  <div>
                    <div className="font-medium">{currentUser.name}</div>
                    <div className="text-sm text-muted-foreground">
                      <Badge
                        variant={currentUser.role === 'parent' ? 'default' : 'secondary'}
                      >
                        {currentUser.role}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  variant="outline"
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOut ? 'Logging out...' : 'Logout'}
                </Button>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Session ID: {currentUser.id}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-4">
                <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">
                  You need to log in to access personalized features
                </p>
                <Button onClick={handleLogin} className="gap-2">
                  <LogIn className="h-4 w-4" />
                  Go to Login
                </Button>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  Login will take you to the home page where you can select your profile and enter your PIN
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
