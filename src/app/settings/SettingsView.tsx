/**
 * ============================================================================
 * PRISM - Settings View Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * The main settings interface with sections for:
 * - Family member management
 * - Display preferences
 * - Security settings
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings,
  Users,
  Palette,
  Shield,
  Info,
  Home,
  Plus,
  Edit2,
  Trash2,
  X,
  Sun,
  Moon,
  Monitor,
  Calendar,
  RefreshCw,
  Check,
  ExternalLink,
  LogOut,
  LogIn,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { useTheme } from '@/components/providers';
import { useCalendarSources } from '@/lib/hooks';
import { PageWrapper } from '@/components/layout';


/**
 * TYPES
 */
interface FamilyMember {
  id: string;
  name: string;
  role: 'parent' | 'child' | 'guest';
  color: string;
  hasPin: boolean;
}


/**
 * DEMO DATA
 */
const demoFamilyMembers: FamilyMember[] = [
  { id: '1', name: 'Alex', role: 'parent', color: '#3B82F6', hasPin: true },
  { id: '2', name: 'Jordan', role: 'parent', color: '#EC4899', hasPin: true },
  { id: '3', name: 'Emma', role: 'child', color: '#10B981', hasPin: true },
  { id: '4', name: 'Sophie', role: 'child', color: '#F59E0B', hasPin: true },
];

const colorOptions = [
  '#3B82F6', // Blue
  '#EC4899', // Pink
  '#10B981', // Green
  '#F59E0B', // Orange
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#84CC16', // Lime
];


/**
 * SETTINGS VIEW COMPONENT
 */
export function SettingsView() {
  const [activeSection, setActiveSection] = useState<string>('account');
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);

  // Auth state
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    role: string;
    color: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Theme from context
  const { theme, setTheme } = useTheme();

  // Check authentication status
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

  // Fetch real family members from API
  useEffect(() => {
    async function fetchFamilyMembers() {
      try {
        const response = await fetch('/api/family');
        if (response.ok) {
          const data = await response.json();
          setFamilyMembers(data.members.map((m: { id: string; name: string; role: string; color: string; hasPin: boolean }) => ({
            id: m.id,
            name: m.name,
            role: m.role as 'parent' | 'child' | 'guest',
            color: m.color,
            hasPin: m.hasPin,
          })));
        }
      } catch (error) {
        console.error('Failed to fetch family members:', error);
      } finally {
        setFamilyLoading(false);
      }
    }
    fetchFamilyMembers();
  }, []);

  // Calendar sources
  const { calendars, loading: calendarsLoading, refresh: refreshCalendars } = useCalendarSources();
  const [syncing, setSyncing] = useState(false);
  const [updatingCalendar, setUpdatingCalendar] = useState<string | null>(null);

  // Local calendar state for optimistic updates (prevents resorting)
  const [localCalendars, setLocalCalendars] = useState<typeof calendars>([]);

  // Sync local calendars when API data changes (but maintain order on updates)
  useEffect(() => {
    if (calendars.length > 0 && localCalendars.length === 0) {
      // Initial load - use API order
      setLocalCalendars(calendars);
    } else if (calendars.length > 0) {
      // Subsequent updates - merge data but keep local order
      setLocalCalendars((prev) => {
        // Create a map of current positions
        const positionMap = new Map(prev.map((cal, idx) => [cal.id, idx]));
        // Update existing calendars in place, add new ones at the end
        const updated = [...prev];
        const newCalendars: typeof calendars = [];

        for (const cal of calendars) {
          const existingIdx = positionMap.get(cal.id);
          if (existingIdx !== undefined) {
            updated[existingIdx] = cal;
          } else {
            newCalendars.push(cal);
          }
        }

        // Remove deleted calendars
        const currentIds = new Set(calendars.map((c) => c.id));
        const filtered = updated.filter((c) => currentIds.has(c.id));

        return [...filtered, ...newCalendars];
      });
    }
  }, [calendars]);

  // Update a calendar's settings (enabled, user assignment)
  const updateCalendar = async (calendarId: string, updates: { enabled?: boolean; userId?: string | null }) => {
    setUpdatingCalendar(calendarId);

    // Optimistic update - apply changes locally first (prevents resorting)
    setLocalCalendars((prev) =>
      prev.map((cal) => {
        if (cal.id !== calendarId) return cal;

        // Determine isFamily and user based on the update
        let isFamily = (cal as { isFamily?: boolean }).isFamily ?? false;
        let user = cal.user;

        if (updates.userId === 'FAMILY') {
          isFamily = true;
          user = { id: 'FAMILY', name: 'Family', color: '#F59E0B' };
        } else if (updates.userId === null) {
          isFamily = false;
          user = null;
        } else if (updates.userId) {
          isFamily = false;
          const member = familyMembers.find((m) => m.id === updates.userId);
          if (member) {
            user = { id: updates.userId, name: member.name, color: member.color };
          }
        }

        return {
          ...cal,
          enabled: updates.enabled ?? cal.enabled,
          isFamily,
          user,
        };
      })
    );

    try {
      // Determine the API payload based on the userId value
      const apiPayload: { enabled?: boolean; userId?: string | null; isFamily?: boolean } = {};

      if (updates.enabled !== undefined) {
        apiPayload.enabled = updates.enabled;
      }

      if (updates.userId !== undefined) {
        if (updates.userId === 'FAMILY') {
          // Family calendar: set isFamily=true and userId=null
          apiPayload.isFamily = true;
          apiPayload.userId = null;
        } else if (updates.userId === null) {
          // Unassigned: set isFamily=false and userId=null
          apiPayload.isFamily = false;
          apiPayload.userId = null;
        } else {
          // Assigned to a specific user: set isFamily=false and userId to the user's ID
          apiPayload.isFamily = false;
          apiPayload.userId = updates.userId;
        }
      }

      const response = await fetch(`/api/calendars/${calendarId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });
      if (response.ok) {
        // Refresh in background to get any server-side changes
        refreshCalendars();
      } else {
        // Revert optimistic update on error
        refreshCalendars();
      }
    } catch (error) {
      console.error('Failed to update calendar:', error);
      // Revert optimistic update on error
      refreshCalendars();
    } finally {
      setUpdatingCalendar(null);
    }
  };

  // Handle calendar sync
  const handleSyncCalendars = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/calendars/sync', { method: 'POST' });
      if (response.ok) {
        refreshCalendars();
      }
    } catch (error) {
      console.error('Failed to sync calendars:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Handle Google Calendar connection
  const connectGoogleCalendar = () => {
    window.location.href = '/api/auth/google';
  };

  // Handle logout
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        // Clear user state and reload page
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

  // Navigate to login (using home page which has PIN pad)
  const handleLogin = () => {
    window.location.href = '/';
  };

  // Delete family member
  const deleteMember = (id: string) => {
    const member = familyMembers.find((m) => m.id === id);
    if (member?.role === 'parent') {
      const parentCount = familyMembers.filter((m) => m.role === 'parent').length;
      if (parentCount <= 1) {
        alert('Cannot delete the last parent');
        return;
      }
    }
    setFamilyMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const sections = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'family', label: 'Family Members', icon: Users },
    { id: 'calendars', label: 'Calendars', icon: Calendar },
    { id: 'display', label: 'Display', icon: Palette },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* ================================================================ */}
        {/* HEADER */}
      {/* ================================================================== */}
      <header className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/" aria-label="Back to dashboard">
              <Home className="h-5 w-5" />
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* CONTENT */}
      {/* ================================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <nav className="w-64 flex-shrink-0 border-r border-border bg-card/50 p-4">
          <div className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left',
                    'hover:bg-accent/50 transition-colors',
                    activeSection === section.id && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl">
            {/* ============================================================ */}
            {/* ACCOUNT SECTION */}
            {/* ============================================================ */}
            {activeSection === 'account' && (
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
            )}

            {/* ============================================================ */}
            {/* FAMILY MEMBERS SECTION */}
            {/* ============================================================ */}
            {activeSection === 'family' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Family Members</h2>
                    <p className="text-muted-foreground">
                      Manage who can access the dashboard
                    </p>
                  </div>
                  <Button onClick={() => setShowAddMember(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Member
                  </Button>
                </div>

                <div className="space-y-3">
                  {familyMembers.map((member) => (
                    <Card key={member.id}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={member.name}
                            color={member.color}
                            size="lg"
                            className="h-12 w-12"
                          />
                          <div>
                            <div className="font-medium">{member.name}</div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge
                                variant={member.role === 'parent' ? 'default' : 'secondary'}
                              >
                                {member.role}
                              </Badge>
                              {member.hasPin ? (
                                <span className="text-green-600">PIN set</span>
                              ) : (
                                <span className="text-orange-600">No PIN</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingMember(member)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMember(member.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* CALENDARS SECTION */}
            {/* ============================================================ */}
            {activeSection === 'calendars' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Calendar Integration</h2>
                    <p className="text-muted-foreground">
                      Connect external calendars to sync events
                    </p>
                  </div>
                  <Button
                    onClick={handleSyncCalendars}
                    disabled={syncing || calendars.length === 0}
                    variant="outline"
                  >
                    <RefreshCw className={cn('h-4 w-4 mr-2', syncing && 'animate-spin')} />
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                </div>

                {/* Connected Calendars */}
                <Card>
                  <CardHeader>
                    <CardTitle>Connected Calendars</CardTitle>
                    <CardDescription>
                      Manage your connected calendar accounts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {calendarsLoading ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Loading calendars...
                      </div>
                    ) : localCalendars.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        No calendars connected yet
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {localCalendars.map((cal) => (
                          <div
                            key={cal.id}
                            className={cn(
                              "p-3 rounded-md border border-border",
                              !cal.enabled && "opacity-60"
                            )}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: cal.color || '#3B82F6' }}
                                />
                                <div>
                                  <div className="font-medium">{cal.dashboardCalendarName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {cal.provider === 'google' ? 'Google Calendar' : cal.provider}
                                    {cal.lastSynced && (
                                      <span className="ml-2">
                                        Synced: {new Date(cal.lastSynced).toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {/* Enable/Disable Toggle */}
                              <label className="flex items-center gap-2 cursor-pointer">
                                <span className="text-xs text-muted-foreground">
                                  {cal.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                                <button
                                  onClick={() => updateCalendar(cal.id, { enabled: !cal.enabled })}
                                  disabled={updatingCalendar === cal.id}
                                  className={cn(
                                    "relative w-10 h-5 rounded-full transition-colors",
                                    cal.enabled ? "bg-primary" : "bg-muted",
                                    updatingCalendar === cal.id && "opacity-50"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                                      cal.enabled ? "translate-x-5" : "translate-x-0.5"
                                    )}
                                  />
                                </button>
                              </label>
                            </div>
                            {/* User Assignment */}
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                              <span className="text-xs text-muted-foreground">Assign to:</span>
                              <select
                                value={
                                  (cal as { isFamily?: boolean }).isFamily || cal.user?.id === 'FAMILY'
                                    ? 'FAMILY'
                                    : cal.user?.id || ''
                                }
                                onChange={(e) => {
                                  const value = e.target.value;
                                  if (value === 'FAMILY') {
                                    updateCalendar(cal.id, { userId: 'FAMILY' });
                                  } else if (value === '') {
                                    updateCalendar(cal.id, { userId: null });
                                  } else {
                                    updateCalendar(cal.id, { userId: value });
                                  }
                                }}
                                disabled={updatingCalendar === cal.id}
                                className="flex-1 text-sm border border-border rounded px-2 py-1 bg-background"
                              >
                                <option value="">-- Unassigned --</option>
                                <option value="FAMILY">Family (shared)</option>
                                {familyMembers.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Add Calendar Providers */}
                <Card>
                  <CardHeader>
                    <CardTitle>Add Calendar</CardTitle>
                    <CardDescription>
                      Connect a new calendar provider
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Button
                        onClick={connectGoogleCalendar}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Connect Google Calendar
                        <ExternalLink className="h-4 w-4 ml-auto" />
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        disabled
                      >
                        <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                        </svg>
                        Connect Apple Calendar
                        <span className="text-xs text-muted-foreground ml-2">(Coming soon)</span>
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        disabled
                      >
                        <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="#0078D4">
                          <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
                        </svg>
                        Connect Microsoft Outlook
                        <span className="text-xs text-muted-foreground ml-2">(Coming soon)</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ============================================================ */}
            {/* DISPLAY SECTION */}
            {/* ============================================================ */}
            {activeSection === 'display' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">Display Settings</h2>
                  <p className="text-muted-foreground">
                    Customize how the dashboard looks
                  </p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Theme</CardTitle>
                    <CardDescription>
                      Choose your preferred color scheme
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-3">
                      <Button
                        variant={theme === 'light' ? 'default' : 'outline'}
                        onClick={() => setTheme('light')}
                        className="flex-1"
                      >
                        <Sun className="h-4 w-4 mr-2" />
                        Light
                      </Button>
                      <Button
                        variant={theme === 'dark' ? 'default' : 'outline'}
                        onClick={() => setTheme('dark')}
                        className="flex-1"
                      >
                        <Moon className="h-4 w-4 mr-2" />
                        Dark
                      </Button>
                      <Button
                        variant={theme === 'system' ? 'default' : 'outline'}
                        onClick={() => setTheme('system')}
                        className="flex-1"
                      >
                        <Monitor className="h-4 w-4 mr-2" />
                        System
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Location</CardTitle>
                    <CardDescription>
                      Set your location for weather and time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Input
                      defaultValue="Northbrook, IL"
                      placeholder="City, State"
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ============================================================ */}
            {/* SECURITY SECTION */}
            {/* ============================================================ */}
            {activeSection === 'security' && (
              <SecuritySection familyMembers={familyMembers} setFamilyMembers={setFamilyMembers} />
            )}

            {/* ============================================================ */}
            {/* ABOUT SECTION */}
            {/* ============================================================ */}
            {activeSection === 'about' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold">About Prism</h2>
                  <p className="text-muted-foreground">
                    Your family&apos;s digital home
                  </p>
                </div>

                <Card>
                  <CardContent className="p-6 text-center">
                    <h3 className="text-3xl font-bold text-primary mb-2">Prism</h3>
                    <p className="text-muted-foreground mb-4">
                      Version 1.0.0
                    </p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Prism brings your family together with a shared calendar,
                      tasks, messages, and more. All on one beautiful dashboard.
                    </p>
                    <div className="mt-6 text-xs text-muted-foreground">
                      <p>Open Source under MIT License</p>
                      <a
                        href="https://github.com/yourusername/prism"
                        className="text-primary hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View on GitHub
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Member Modal */}
      {(showAddMember || editingMember) && (
        <MemberModal
          member={editingMember || undefined}
          onClose={() => {
            setShowAddMember(false);
            setEditingMember(null);
          }}
          onSave={(member) => {
            if (editingMember) {
              setFamilyMembers((prev) =>
                prev.map((m) => (m.id === editingMember.id ? { ...m, ...member } : m))
              );
            } else {
              setFamilyMembers((prev) => [
                ...prev,
                { ...member, id: Date.now().toString(), hasPin: false },
              ]);
            }
            setShowAddMember(false);
            setEditingMember(null);
          }}
        />
      )}
      </div>
    </PageWrapper>
  );
}


/**
 * SECURITY SECTION COMPONENT
 */
function SecuritySection({
  familyMembers,
  setFamilyMembers,
}: {
  familyMembers: FamilyMember[];
  setFamilyMembers: React.Dispatch<React.SetStateAction<FamilyMember[]>>;
}) {
  const [editingPinMember, setEditingPinMember] = useState<FamilyMember | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Security Settings</h2>
        <p className="text-muted-foreground">
          Manage authentication and access
        </p>
      </div>

      {/* PIN Management */}
      <Card>
        <CardHeader>
          <CardTitle>Member PINs</CardTitle>
          <CardDescription>
            Manage PIN codes for family members. PINs are required when taking actions like posting messages or completing tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {familyMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-md border border-border"
            >
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={member.name}
                  color={member.color}
                  size="md"
                  className="h-10 w-10"
                />
                <div>
                  <div className="font-medium">{member.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {member.hasPin ? (
                      <span className="text-green-600">PIN set</span>
                    ) : (
                      <span className="text-orange-600">No PIN set</span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingPinMember(member)}
              >
                {member.hasPin ? 'Change PIN' : 'Set PIN'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Authentication Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Authentication Mode</CardTitle>
          <CardDescription>
            How Prism handles user authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-md bg-accent/50">
            <div className="font-medium mb-1">View Freely, Authenticate to Act</div>
            <p className="text-sm text-muted-foreground">
              Anyone can view the dashboard. When taking an action (posting a message, completing a task, etc.), a PIN prompt appears to identify who is taking the action.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Session Timeout */}
      <Card>
        <CardHeader>
          <CardTitle>Session Timeout</CardTitle>
          <CardDescription>
            Auto-logout after inactivity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <select className="w-full border border-border rounded-md px-3 py-2 bg-background">
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="never">Never</option>
          </select>
        </CardContent>
      </Card>

      {/* PIN Edit Modal */}
      {editingPinMember && (
        <PinEditModal
          member={editingPinMember}
          onClose={() => setEditingPinMember(null)}
          onSaved={(hasPin) => {
            setFamilyMembers((prev) =>
              prev.map((m) =>
                m.id === editingPinMember.id ? { ...m, hasPin } : m
              )
            );
            setEditingPinMember(null);
          }}
        />
      )}
    </div>
  );
}


/**
 * PIN EDIT MODAL COMPONENT
 */
function PinEditModal({
  member,
  onClose,
  onSaved,
}: {
  member: FamilyMember;
  onClose: () => void;
  onSaved: (hasPin: boolean) => void;
}) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate new PIN
    if (newPin && !/^\d{4,6}$/.test(newPin)) {
      setError('PIN must be 4-6 digits');
      return;
    }

    // Confirm PIN match
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setSaving(true);

    try {
      const body: { pin: string | null; currentPin?: string } = {
        pin: newPin || null,
      };

      // Include current PIN if member has one
      if (member.hasPin) {
        body.currentPin = currentPin;
      }

      const response = await fetch(`/api/family/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update PIN');
      }

      onSaved(!!newPin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update PIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {member.hasPin ? 'Change PIN' : 'Set PIN'} for {member.name}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current PIN (only if user has one) */}
          {member.hasPin && (
            <div>
              <label className="text-sm font-medium">Current PIN</label>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter current PIN"
                autoFocus
              />
            </div>
          )}

          {/* New PIN */}
          <div>
            <label className="text-sm font-medium">New PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4-6 digits"
              autoFocus={!member.hasPin}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank to remove PIN (not recommended)
            </p>
          </div>

          {/* Confirm PIN */}
          <div>
            <label className="text-sm font-medium">Confirm New PIN</label>
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Re-enter new PIN"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="text-sm text-destructive p-2 bg-destructive/10 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save PIN'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


/**
 * MEMBER MODAL COMPONENT
 */
function MemberModal({
  member,
  onClose,
  onSave,
}: {
  member?: FamilyMember;
  onClose: () => void;
  onSave: (member: Omit<FamilyMember, 'id' | 'hasPin'>) => void;
}) {
  const [name, setName] = useState(member?.name || '');
  const [role, setRole] = useState<'parent' | 'child' | 'guest'>(member?.role || 'child');
  const [color, setColor] = useState(member?.color || colorOptions[0] || '#3B82F6');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), role, color });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {member ? 'Edit Member' : 'Add Family Member'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Family member name"
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">Role</label>
            <div className="flex gap-2 mt-1">
              {(['parent', 'child', 'guest'] as const).map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={role === r ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRole(r)}
                  className="capitalize flex-1"
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Color</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {colorOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-transform',
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {member ? 'Save Changes' : 'Add Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
