'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCalendarSources } from '@/lib/hooks';
import { useFamily } from '@/components/providers';
import { CalendarColorPicker } from '../components/CalendarColorPicker';

export function CalendarsSection() {
  const { members: familyMembers } = useFamily();
  const { calendars, loading: calendarsLoading, refresh: refreshCalendars } = useCalendarSources();
  const [syncing, setSyncing] = useState(false);
  const [updatingCalendar, setUpdatingCalendar] = useState<string | null>(null);
  const [localCalendars, setLocalCalendars] = useState<typeof calendars>([]);

  const [calGroups, setCalGroups] = useState<Array<{ id: string; name: string; color: string; type: string; userId?: string | null; sourceCount?: number }>>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#3B82F6');

  // State for editing calendar display names
  const [editingCalendarId, setEditingCalendarId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const familyCalendarColor = typeof window !== 'undefined'
    ? localStorage.getItem('prism-family-calendar-color') || '#F59E0B'
    : '#F59E0B';

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await fetch('/api/calendar-groups');
        if (res.ok) {
          const data = await res.json();
          setCalGroups(data.groups || []);
        }
      } catch { /* ignore */ }
    }
    fetchGroups();
  }, [calendars]);

  useEffect(() => {
    if (calendars.length > 0 && localCalendars.length === 0) {
      setLocalCalendars(calendars);
    } else if (calendars.length > 0) {
      setLocalCalendars((prev) => {
        const positionMap = new Map(prev.map((cal, idx) => [cal.id, idx]));
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

        const currentIds = new Set(calendars.map((c) => c.id));
        const filtered = updated.filter((c) => currentIds.has(c.id));

        return [...filtered, ...newCalendars];
      });
    }
  }, [calendars]);

  const updateCalendar = async (calendarId: string, updates: { enabled?: boolean; userId?: string | null }) => {
    setUpdatingCalendar(calendarId);

    setLocalCalendars((prev) =>
      prev.map((cal) => {
        if (cal.id !== calendarId) return cal;

        let isFamily = (cal as { isFamily?: boolean }).isFamily ?? false;
        let user = cal.user;

        if (updates.userId === 'FAMILY') {
          isFamily = true;
          user = { id: 'FAMILY', name: 'Family', color: familyCalendarColor };
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
      const apiPayload: { enabled?: boolean; userId?: string | null; isFamily?: boolean } = {};

      if (updates.enabled !== undefined) {
        apiPayload.enabled = updates.enabled;
      }

      if (updates.userId !== undefined) {
        if (updates.userId === 'FAMILY') {
          apiPayload.isFamily = true;
          apiPayload.userId = null;
        } else if (updates.userId === null) {
          apiPayload.isFamily = false;
          apiPayload.userId = null;
        } else {
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
        refreshCalendars();
      } else {
        refreshCalendars();
      }
    } catch (error) {
      console.error('Failed to update calendar:', error);
      refreshCalendars();
    } finally {
      setUpdatingCalendar(null);
    }
  };

  const handleSyncCalendars = async () => {
    setSyncing(true);
    try {
      console.log('[Settings] Starting calendar sync...');
      const response = await fetch('/api/calendars/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json();
      console.log('[Settings] Sync response:', response.status, data);

      // Also sync birthdays from Google Calendar
      let birthdaysSynced = 0;
      try {
        const birthdayResponse = await fetch('/api/birthdays/sync', {
          method: 'POST',
          credentials: 'include',
        });
        if (birthdayResponse.ok) {
          const birthdayData = await birthdayResponse.json();
          birthdaysSynced = birthdayData.synced || 0;
          console.log('[Settings] Birthday sync response:', birthdayData);
        }
      } catch (birthdayError) {
        console.warn('Birthday sync failed:', birthdayError);
      }

      if (response.ok) {
        let message = `Sync complete: ${data.synced ?? data.total ?? 0} events synced`;
        if (birthdaysSynced > 0) {
          message += `, ${birthdaysSynced} birthdays synced`;
        }
        if (data.errors && data.errors.length > 0) {
          message += `\n\nWarnings (${data.errors.length}):\n${data.errors.slice(0, 5).join('\n')}`;
          if (data.errors.length > 5) {
            message += `\n...and ${data.errors.length - 5} more`;
          }
        }
        alert(message);
        refreshCalendars();
      } else {
        alert(`Sync failed: ${data.error || data.message || 'Unknown error'}\n${data.errors?.join('\n') || ''}`);
      }
    } catch (error) {
      console.error('Failed to sync calendars:', error);
      alert(`Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  const connectGoogleCalendar = () => {
    window.location.href = '/api/auth/google';
  };

  const addGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const res = await fetch('/api/calendar-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName.trim(), color: newGroupColor }),
      });
      if (res.ok) {
        const group = await res.json();
        setCalGroups((prev) => [...prev, group]);
        setNewGroupName('');
        setNewGroupColor('#3B82F6');
      }
    } catch { /* ignore */ }
  };

  return (
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
                      <CalendarColorPicker
                        color={cal.color || '#3B82F6'}
                        onChange={async (c) => {
                          try {
                            await fetch(`/api/calendars/${cal.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ color: c }),
                            });
                            setLocalCalendars((prev) =>
                              prev.map((lc) => lc.id === cal.id ? { ...lc, color: c } : lc)
                            );
                          } catch { /* ignore */ }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        {editingCalendarId === cal.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-7 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  // Save the new name
                                  (async () => {
                                    if (editingName.trim() && editingName.trim() !== cal.dashboardCalendarName) {
                                      setUpdatingCalendar(cal.id);
                                      try {
                                        await fetch(`/api/calendars/${cal.id}`, {
                                          method: 'PATCH',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ dashboardCalendarName: editingName.trim() }),
                                        });
                                        setLocalCalendars((prev) =>
                                          prev.map((lc) => lc.id === cal.id ? { ...lc, dashboardCalendarName: editingName.trim() } : lc)
                                        );
                                      } catch { /* ignore */ }
                                      setUpdatingCalendar(null);
                                    }
                                    setEditingCalendarId(null);
                                  })();
                                } else if (e.key === 'Escape') {
                                  setEditingCalendarId(null);
                                }
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={async () => {
                                if (editingName.trim() && editingName.trim() !== cal.dashboardCalendarName) {
                                  setUpdatingCalendar(cal.id);
                                  try {
                                    await fetch(`/api/calendars/${cal.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ dashboardCalendarName: editingName.trim() }),
                                    });
                                    setLocalCalendars((prev) =>
                                      prev.map((lc) => lc.id === cal.id ? { ...lc, dashboardCalendarName: editingName.trim() } : lc)
                                    );
                                  } catch { /* ignore */ }
                                  setUpdatingCalendar(null);
                                }
                                setEditingCalendarId(null);
                              }}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditingCalendarId(null)}
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <div className="font-medium">{cal.dashboardCalendarName}</div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-50 hover:opacity-100"
                              onClick={() => {
                                setEditingCalendarId(cal.id);
                                setEditingName(cal.dashboardCalendarName);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {cal.provider === 'google' ? 'Google Calendar' : cal.provider}
                          {cal.displayName && cal.displayName !== cal.dashboardCalendarName && (
                            <span className="ml-2 text-muted-foreground/60">
                              (Source: {cal.displayName})
                            </span>
                          )}
                          {cal.lastSynced && (
                            <span className="ml-2">
                              Synced: {new Date(cal.lastSynced).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
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
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground">Group:</span>
                    <select
                      value={(cal as { groupId?: string }).groupId || ''}
                      onChange={async (e) => {
                        const groupId = e.target.value || null;
                        setUpdatingCalendar(cal.id);
                        try {
                          await fetch(`/api/calendars/${cal.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ groupId }),
                          });
                          refreshCalendars();
                        } catch { /* ignore */ }
                        setUpdatingCalendar(null);
                      }}
                      disabled={updatingCalendar === cal.id}
                      className="flex-1 text-sm border border-border rounded px-2 py-1 bg-background"
                    >
                      <option value="">-- Unassigned --</option>
                      {calGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                      onClick={async () => {
                        if (!confirm(`Remove "${cal.dashboardCalendarName}" and all its events?`)) return;
                        setUpdatingCalendar(cal.id);
                        try {
                          await fetch(`/api/calendars/${cal.id}`, { method: 'DELETE' });
                          setLocalCalendars((prev) => prev.filter((c) => c.id !== cal.id));
                          refreshCalendars();
                        } catch { /* ignore */ }
                        setUpdatingCalendar(null);
                      }}
                      disabled={updatingCalendar === cal.id}
                      title="Remove calendar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {/* Show in Event Modal toggle - only for writable calendars */}
                  {(() => {
                    // Detect subscription/read-only calendars by common patterns
                    const name = cal.dashboardCalendarName.toLowerCase();
                    const isSubscription = cal.provider !== 'local' && (
                      name.includes('birthday') ||
                      name.includes('holiday') ||
                      name.includes('contacts') ||
                      name.startsWith('subscribe') ||
                      name.includes('phases of the moon') ||
                      name.includes('week numbers')
                    );
                    const isWritable = cal.provider === 'local' || (cal.provider === 'google' && !isSubscription);

                    return (
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs", isWritable ? "text-muted-foreground" : "text-muted-foreground/50")}>
                            Show in "Add Event" modal
                          </span>
                          {isSubscription && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 opacity-60">Read-only</Badge>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            if (!isWritable) return;
                            const newValue = !(cal as { showInEventModal?: boolean }).showInEventModal;
                            setUpdatingCalendar(cal.id);
                            try {
                              await fetch(`/api/calendars/${cal.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ showInEventModal: newValue }),
                              });
                              setLocalCalendars((prev) =>
                                prev.map((lc) => lc.id === cal.id ? { ...lc, showInEventModal: newValue } : lc)
                              );
                            } catch { /* ignore */ }
                            setUpdatingCalendar(null);
                          }}
                          disabled={updatingCalendar === cal.id || !isWritable}
                          className={cn(
                            "relative w-10 h-5 rounded-full transition-colors",
                            (cal as { showInEventModal?: boolean }).showInEventModal !== false && isWritable ? "bg-primary" : "bg-muted",
                            (updatingCalendar === cal.id || !isWritable) && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                              (cal as { showInEventModal?: boolean }).showInEventModal !== false && isWritable ? "translate-x-5" : "translate-x-0.5"
                            )}
                          />
                        </button>
                      </div>
                    );
                  })()}
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
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Connect Google Calendar
              <ExternalLink className="h-4 w-4 ml-auto" />
            </Button>

            <Button variant="outline" className="w-full justify-start" disabled>
              <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Connect Apple Calendar
              <span className="text-xs text-muted-foreground ml-2">(Coming soon)</span>
            </Button>

            <Button variant="outline" className="w-full justify-start" disabled>
              <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="#0078D4">
                <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
              </svg>
              Connect Microsoft Outlook
              <span className="text-xs text-muted-foreground ml-2">(Coming soon)</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Groups */}
      <Card>
        <CardHeader>
          <CardTitle>Calendar Groups</CardTitle>
          <CardDescription>
            Manage calendar groups used for filtering and display colors. User groups are auto-created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {calGroups.map((group) => (
              <div key={group.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                <div className="flex items-center gap-3">
                  <CalendarColorPicker
                    color={group.color}
                    onChange={async (c) => {
                      try {
                        await fetch(`/api/calendar-groups/${group.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ color: c }),
                        });
                        setCalGroups((prev) =>
                          prev.map((g) => g.id === group.id ? { ...g, color: c } : g)
                        );
                      } catch { /* ignore */ }
                    }}
                  />
                  <span className="font-medium text-sm">{group.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={group.type === 'user' ? 'default' : 'secondary'}>
                    {group.type === 'user' ? 'User' : 'Custom'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {group.sourceCount ?? 0} source{(group.sourceCount ?? 0) !== 1 ? 's' : ''}
                  </span>
                  {group.type === 'custom' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={async () => {
                        if (!confirm(`Delete group "${group.name}"? Sources will be unassigned.`)) return;
                        try {
                          await fetch(`/api/calendar-groups/${group.id}`, { method: 'DELETE' });
                          setCalGroups((prev) => prev.filter((g) => g.id !== group.id));
                          refreshCalendars();
                        } catch { /* ignore */ }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <CalendarColorPicker
                color={newGroupColor}
                onChange={setNewGroupColor}
              />
              <Input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="New group name..."
                className="flex-1 h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newGroupName.trim()) addGroup();
                }}
              />
              <Button
                size="sm"
                disabled={!newGroupName.trim()}
                onClick={addGroup}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
