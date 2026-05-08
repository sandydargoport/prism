'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { RefreshCw, Plus, Trash2, Pencil, Check, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useCalendarSources } from '@/lib/hooks';
import { useFamily } from '@/components/providers';
import { CalendarColorPicker } from '../components/CalendarColorPicker';
import { useHiddenHours } from '@/lib/hooks/useHiddenHours';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';

export function CalendarsSection() {
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();
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
      const response = await fetch('/api/calendars/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await response.json();

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
        toast({ title: message, variant: 'success' });
        refreshCalendars();
      } else {
        const hasReauthError = data.errors?.some((e: string) => e.includes('Re-authentication required') || e.includes('Token expired'));
        if (hasReauthError) {
          toast({ title: 'Google token expired', description: 'Use the "Re-authenticate Google" button to refresh all calendars at once.', variant: 'warning' });
        } else {
          toast({ title: `Sync failed: ${data.error || data.message || 'Unknown error'}`, description: data.errors?.join('\n') || undefined, variant: 'destructive' });
        }
      }
    } catch (error) {
      console.error('Failed to sync calendars:', error);
      toast({ title: `Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
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

      <AddIcalSubscriptionCard onAdded={refreshCalendars} />

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
            <div className="text-center py-6 space-y-2">
              <p className="text-muted-foreground">No calendars connected yet</p>
              <p className="text-sm text-muted-foreground">
                Connect Google in{' '}
                <button
                  onClick={() => { window.location.href = '/settings?section=connections'; }}
                  className="text-primary hover:underline font-medium"
                >
                  Connected Accounts
                </button>
                {' '}to import calendars.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Single re-auth banner if any Google calendar needs it */}
              {localCalendars.some((c) => c.provider === 'google' && c.syncErrors?.needsReauth) && (
                <div className="flex items-center gap-3 p-3 rounded-md border border-orange-500/50 bg-orange-50 dark:bg-orange-950/30">
                  <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-400">Google token expired</p>
                    <p className="text-xs text-orange-600 dark:text-orange-400/80">
                      Re-authenticate once to refresh all Google calendars.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-orange-500/50 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-950"
                    onClick={() => {
                      const firstGoogle = localCalendars.find((c) => c.provider === 'google');
                      if (firstGoogle) window.location.href = `/api/auth/google?reauth=${firstGoogle.id}&returnSection=calendars`;
                    }}
                  >
                    Re-authenticate Google
                  </Button>
                </div>
              )}
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
                          {cal.provider === 'google'
                            ? 'Google Calendar'
                            : cal.provider === 'ical'
                              ? 'iCal Subscription'
                              : cal.provider}
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
                        {cal.syncErrors?.needsReauth && (
                          <div className="flex items-center gap-1 mt-1">
                            <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />
                            <span className="text-xs text-orange-600 dark:text-orange-400">
                              Token expired
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-muted-foreground">
                        {cal.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <Switch
                        checked={cal.enabled}
                        onCheckedChange={() => updateCalendar(cal.id, { enabled: !cal.enabled })}
                        disabled={updatingCalendar === cal.id}
                        className="data-[state=checked]:bg-blue-500"
                      />
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
                        if (!await confirm(`Remove "${cal.dashboardCalendarName}"?`, 'This will remove the calendar and all its events.')) return;
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
                            Show in &quot;Add Event&quot; modal
                          </span>
                          {isSubscription && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 opacity-60">Read-only</Badge>
                          )}
                        </div>
                        <Switch
                          checked={(cal as { showInEventModal?: boolean }).showInEventModal !== false && isWritable}
                          onCheckedChange={async () => {
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
                          className="data-[state=checked]:bg-blue-500"
                        />
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
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
                        if (!await confirm(`Delete group "${group.name}"?`, 'Sources will be unassigned.')) return;
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
      <ConfirmDialog {...confirmDialogProps} />

      <div className="flex items-center gap-3 pt-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
          Calendar Preferences
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <CalendarHoursCard />

      <WeekStartCard />
    </div>
  );
}

function CalendarHoursCard() {
  const { settings, loaded, setSettings } = useHiddenHours();

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const formatHour = (h: number) => {
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    if (h < 12) return `${h} AM`;
    return `${h - 12} PM`;
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar Hours</CardTitle>
        <CardDescription>
          Hide a time range from day and week calendar views. When hidden, the remaining hours
          auto-resize to fill the available space. Toggle visibility with the clock button in calendar views.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="text-sm text-muted-foreground">Mode</span>
          <select
            value={settings.mode}
            onChange={(e) => setSettings({ mode: e.target.value as 'manual' | 'auto-fit' })}
            className="border border-border rounded px-2 py-1 text-sm bg-background"
          >
            <option value="manual">Manual</option>
            <option value="auto-fit">Auto-fit</option>
          </select>
        </div>

        {settings.mode === 'manual' ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Hide hours from</span>
            <select
              value={settings.startHour}
              onChange={(e) => setSettings({ startHour: Number(e.target.value) })}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              {hours.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
            <span className="text-sm text-muted-foreground">to</span>
            <select
              value={settings.endHour}
              onChange={(e) => setSettings({ endHour: Number(e.target.value) })}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              {hours.map((h) => (
                <option key={h} value={h}>
                  {formatHour(h)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Buffer</span>
            <select
              value={settings.bufferHours}
              onChange={(e) => setSettings({ bufferHours: Number(e.target.value) })}
              className="border border-border rounded px-2 py-1 text-sm bg-background"
            >
              {[0, 1, 2, 3, 4].map((h) => (
                <option key={h} value={h}>
                  {h} {h === 1 ? 'hour' : 'hours'}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          {settings.mode === 'manual' ? (
            <>Hiding {formatHour(settings.startHour)} to {formatHour(settings.endHour)} ({
              settings.startHour <= settings.endHour
                ? settings.endHour - settings.startHour
                : 24 - settings.startHour + settings.endHour
            } hours)</>
          ) : (
            <>Auto-fit trims dead hours around your timed events in day/week views with a {settings.bufferHours}-hour buffer.</>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WeekStartCard() {
  const { weekStartsOn, setWeekStartsOn } = useWeekStartsOn();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Week Starts On</CardTitle>
        <CardDescription>
          Controls when weekly goals reset, calendar week boundaries, and meal planning weeks.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStartsOn(0)}
            className={cn(
              'px-4 py-2 rounded-l-md text-sm font-medium border transition-colors',
              weekStartsOn === 0
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            )}
          >
            Sunday
          </button>
          <button
            onClick={() => setWeekStartsOn(1)}
            className={cn(
              'px-4 py-2 rounded-r-md text-sm font-medium border border-l-0 transition-colors',
              weekStartsOn === 1
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            )}
          >
            Monday
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Add an iCal subscription (read-only feed).
 *
 * Anything published as an `.ics` URL works — Apple Calendar / iCloud
 * (Public-Calendar share gives a webcal://... URL), Microsoft Outlook web
 * calendars, Yahoo Calendar, school sports feeds, trash pickup, etc.
 * Two-way sync isn't possible for these — the feed is one-way by definition.
 */
function AddIcalSubscriptionCard({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!url.trim()) return;
    setSubmitting(true);
    try {
      const body: Record<string, string> = { url: url.trim(), type: 'ical' };
      if (name.trim()) body.name = name.trim();
      const res = await fetch('/api/calendar-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: data.error || 'Failed to add calendar', variant: 'destructive' });
        return;
      }
      toast({ title: 'Subscription added — first sync running in background', variant: 'success' });
      setUrl('');
      setName('');
      onAdded();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed to add calendar', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscribe to a calendar (read-only)</CardTitle>
        <CardDescription>
          Paste any public iCal URL — Apple Calendar / iCloud, Outlook.live.com, a school sports feed, etc.
          Apple users: in <em>Calendar.app → right-click your calendar → Share Calendar → Public Calendar</em>, then copy the <code>webcal://</code> URL. iCloud.com works the same way under <em>Calendar → ⓘ → Public Calendar</em>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
          <Input
            type="url"
            placeholder="webcal://p99-caldav.icloud.com/published/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={submitting}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
          <Input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          />
          <Button onClick={submit} disabled={submitting || !url.trim()}>
            <Plus className="h-4 w-4 mr-2" />
            {submitting ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
