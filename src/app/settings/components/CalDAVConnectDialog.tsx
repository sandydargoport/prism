'use client';

import { useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface DiscoveredCalendar {
  href: string;
  displayName: string;
  color: string | null;
  description: string | null;
  supportsEvents: boolean;
  supportsTasks: boolean;
}

export function CalDAVConnectDialog({
  open,
  onOpenChange,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}) {
  const [step, setStep] = useState<'credentials' | 'calendars' | 'done'>('credentials');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [calendars, setCalendars] = useState<DiscoveredCalendar[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState(false);
  const [connectedCount, setConnectedCount] = useState(0);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [syncContactBirthdays, setSyncContactBirthdays] = useState(false);

  const reset = () => {
    setStep('credentials');
    setServerUrl('');
    setUsername('');
    setPassword('');
    setTesting(false);
    setTestResult(null);
    setDiscovering(false);
    setCalendars([]);
    setSelected(new Set());
    setConnecting(false);
    setConnectedCount(0);
    setSyncContactBirthdays(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/caldav/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl, username, password }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: 'Request failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const res = await fetch('/api/caldav/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl, username, password }),
      });
      const data = await res.json();
      if (data.calendars) {
        setCalendars(data.calendars);
        setSelected(new Set(data.calendars.map((c: DiscoveredCalendar) => c.href)));
        setStep('calendars');
      }
    } catch {
      setTestResult({ success: false, error: 'Failed to discover calendars' });
    } finally {
      setDiscovering(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const selectedCalendars = calendars.filter(c => selected.has(c.href));
      const res = await fetch('/api/caldav/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl,
          username,
          password,
          calendars: selectedCalendars,
          syncContactBirthdays,
        }),
      });
      // Try to parse JSON either way — the API returns { error } on failure.
      let data: { success?: boolean; sourceIds?: string[]; error?: string } = {};
      try { data = await res.json(); } catch { /* non-JSON response */ }

      if (res.ok && data.success) {
        setConnectedCount(data.sourceIds?.length || selectedCalendars.length);
        setStep('done');
        onConnected?.();
      } else {
        setConnectError(data.error || `Connect failed (HTTP ${res.status})`);
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setConnecting(false);
    }
  };

  const toggleCalendar = (href: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {step === 'credentials' && 'Connect CalDAV Server'}
            {step === 'calendars' && 'Select Calendars'}
            {step === 'done' && 'Connected!'}
          </DialogTitle>
          <DialogDescription>
            {step === 'credentials' && 'Works with Apple iCloud, Nextcloud, Radicale, Baikal, Synology, and other CalDAV servers.'}
            {step === 'calendars' && 'Choose which calendars to sync with Prism.'}
            {step === 'done' && `${connectedCount} calendar(s) connected and syncing.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'credentials' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="caldav-url">Server URL</Label>
              <Input
                id="caldav-url"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                placeholder="https://caldav.icloud.com"
              />
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setServerUrl('https://caldav.icloud.com')}
                    className="text-primary hover:underline font-medium"
                  >
                    Use Apple iCloud
                  </button>
                </p>
                <p><strong>Apple iCloud:</strong> <code>https://caldav.icloud.com</code> — username is your Apple ID email; password is a 16-char app-specific password from <a href="https://appleid.apple.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">appleid.apple.com</a> (Sign-In and Security → App-Specific Passwords), <em>not</em> your real Apple ID password.</p>
                <p><strong>Nextcloud:</strong> <code>https://your-server/remote.php/dav</code></p>
                <p><strong>Radicale:</strong> <code>https://your-server/</code></p>
                <p><strong>Baikal:</strong> <code>https://your-server/dav.php</code></p>
                <p><strong>Synology:</strong> <code>https://your-nas:5001/caldav/</code></p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="caldav-user">Username</Label>
              <Input
                id="caldav-user"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="you@icloud.com"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="caldav-pass">Password</Label>
              <Input
                id="caldav-pass"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="xxxx-xxxx-xxxx-xxxx for iCloud"
                autoComplete="current-password"
              />
              <p className="text-xs text-muted-foreground">
                For Apple iCloud: paste the 16-character app-specific password including the hyphens. Other providers: your normal account password (or whatever app-token they require).
              </p>
            </div>

            {testResult && (
              <div className={cn(
                'flex items-center gap-2 p-3 rounded-lg text-sm',
                testResult.success
                  ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                  : 'bg-destructive/10 text-destructive'
              )}>
                {testResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                {testResult.success ? 'Connection successful!' : testResult.error}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleTest} disabled={!serverUrl || !username || !password || testing}>
                {testing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Testing...</> : 'Test Connection'}
              </Button>
              <Button
                onClick={handleDiscover}
                disabled={!testResult?.success || discovering}
              >
                {discovering ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Discovering...</> : 'Find Calendars'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'calendars' && (
          <div className="space-y-4">
            <div className="space-y-2 max-h-64 overflow-auto">
              {calendars.map(cal => (
                <label
                  key={cal.href}
                  className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-accent cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(cal.href)}
                    onChange={() => toggleCalendar(cal.href)}
                    className="rounded"
                  />
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cal.color || '#6366f1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{cal.displayName}</p>
                    {cal.description && <p className="text-xs text-muted-foreground truncate">{cal.description}</p>}
                  </div>
                </label>
              ))}
              {calendars.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No calendars found on this server.</p>
              )}
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent cursor-pointer">
              <input
                type="checkbox"
                checked={syncContactBirthdays}
                onChange={e => setSyncContactBirthdays(e.target.checked)}
                className="mt-0.5 rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Also import birthdays from contacts</p>
                <p className="text-xs text-muted-foreground">
                  Pulls BDAY fields from your address book via CardDAV (using the same login) and adds them to the birthdays widget. Reminders and notes are not supported by Apple over CalDAV — this is birthdays only.
                </p>
              </div>
            </label>

            {connectError && (
              <div className="flex items-start gap-2 p-3 rounded-lg text-sm bg-destructive/10 text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="flex-1">{connectError}</div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('credentials')}>Back</Button>
              <Button onClick={handleConnect} disabled={selected.size === 0 || connecting}>
                {connecting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Connecting...</> : `Connect ${selected.size} Calendar${selected.size !== 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && (
          <DialogFooter>
            <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
