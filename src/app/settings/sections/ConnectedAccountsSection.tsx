'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { AlertTriangle, RefreshCw, Mail, HardDrive, Globe, Wand2, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { CalDAVConnectDialog } from '@/app/settings/components/CalDAVConnectDialog';

interface IntegrationStatus {
  google: {
    connected: boolean;
    expired: boolean;
    calendarCount: number;
    taskSourceCount: number;
    lastSynced: string | null;
  };
  microsoft: {
    connected: boolean;
    taskSourceCount: number;
    shoppingSourceCount: number;
  };
  onedrive: {
    connected: boolean;
    sourceCount: number;
  };
  gmail: {
    connected: boolean;
  };
}

const GoogleIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const MicrosoftIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#0078D4">
    <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
  </svg>
);

export function ConnectedAccountsSection() {
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [caldavDialogOpen, setCaldavDialogOpen] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/integrations/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch integration status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Handle OAuth success/error URL params
  useEffect(() => {
    const section = searchParams.get('section');
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (section !== 'connections') return;

    if (success === 'google_connected') {
      toast({ title: 'Google Calendar connected successfully!', variant: 'success' });
      fetchStatus();
      window.history.replaceState({}, '', '/settings?section=connections');
    } else if (success === 'google_reauth') {
      toast({ title: 'Google re-authenticated successfully!', variant: 'success' });
      fetchStatus();
      window.history.replaceState({}, '', '/settings?section=connections');
    } else if (error === 'google_auth_denied') {
      toast({ title: 'Google authorization was denied or cancelled.', variant: 'destructive' });
      window.history.replaceState({}, '', '/settings?section=connections');
    } else if (error === 'google_auth_failed') {
      toast({ title: 'Google authentication failed. Please try again.', variant: 'destructive' });
      window.history.replaceState({}, '', '/settings?section=connections');
    } else if (success === 'onedrive_connected') {
      toast({ title: 'OneDrive connected successfully!', variant: 'success' });
      fetchStatus();
      window.history.replaceState({}, '', '/settings?section=connections');
    } else if (error === 'microsoft_auth_denied') {
      toast({ title: 'OneDrive authorization was denied or cancelled.', variant: 'destructive' });
      window.history.replaceState({}, '', '/settings?section=connections');
    } else if (error === 'microsoft_auth_failed') {
      toast({ title: 'OneDrive authentication failed. Please try again.', variant: 'destructive' });
      window.history.replaceState({}, '', '/settings?section=connections');
    } else if (error === 'missing_code') {
      toast({ title: 'Authorization code was missing. Please try again.', variant: 'destructive' });
      window.history.replaceState({}, '', '/settings?section=connections');
    }
  }, [searchParams]);

  const handleDisconnectGoogle = async () => {
    if (!await confirm('Disconnect Google?', 'This will remove all Google calendars and their events from Prism.')) return;

    setDisconnecting('google');
    try {
      const res = await fetch('/api/integrations/google/disconnect', { method: 'POST' });
      if (res.ok) {
        toast({ title: 'Google disconnected successfully.', variant: 'success' });
        fetchStatus();
      } else {
        toast({ title: 'Failed to disconnect Google.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to disconnect Google.', variant: 'destructive' });
    } finally {
      setDisconnecting(null);
    }
  };

  const handleDisconnectMicrosoft = async () => {
    if (!await confirm('Disconnect Microsoft?', 'This will remove all Microsoft task and shopping list sources from Prism. Tasks and items already synced will remain.')) return;

    setDisconnecting('microsoft');
    try {
      const res = await fetch('/api/integrations/microsoft/disconnect', { method: 'POST' });
      if (res.ok) {
        toast({ title: 'Microsoft disconnected successfully.', variant: 'success' });
        fetchStatus();
      } else {
        toast({ title: 'Failed to disconnect Microsoft.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to disconnect Microsoft.', variant: 'destructive' });
    } finally {
      setDisconnecting(null);
    }
  };

  const handleConnectGoogle = () => {
    window.location.href = '/api/auth/google?returnSection=connections';
  };

  const handleReauthGoogle = () => {
    window.location.href = '/api/auth/google?reauth=all&returnSection=connections';
  };

  const handleConnectGmail = () => {
    window.location.href = '/api/auth/google-bus';
  };

  const handleDisconnectGmail = async () => {
    if (!await confirm('Disconnect Gmail?', 'This will remove your Gmail connection used for bus tracking. Bus arrival data will no longer sync.')) return;

    setDisconnecting('gmail');
    try {
      const res = await fetch('/api/bus-tracking/connection', { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Gmail disconnected successfully.', variant: 'success' });
        fetchStatus();
      } else {
        toast({ title: 'Failed to disconnect Gmail.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to disconnect Gmail.', variant: 'destructive' });
    } finally {
      setDisconnecting(null);
    }
  };

  const handleConnectOneDrive = () => {
    window.location.href = '/api/auth/microsoft';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Connected Accounts</h2>
          <p className="text-muted-foreground">Manage third-party service connections</p>
        </div>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Connected Accounts</h2>
          <p className="text-muted-foreground">Manage third-party service connections</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/setup/rerun">
            <Wand2 className="h-4 w-4 mr-2" />
            Setup Wizard
          </Link>
        </Button>
      </div>

      {/* Google Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GoogleIcon />
              <div>
                <CardTitle className="text-lg">Google</CardTitle>
                <CardDescription>
                  Used for: {[
                    status?.google.calendarCount ? 'Calendars' : null,
                    status?.google.taskSourceCount ? 'Tasks' : null,
                  ].filter(Boolean).join(', ') || 'Calendars'}
                </CardDescription>
              </div>
            </div>
            {status?.google.connected ? (
              status.google.expired ? (
                <Badge variant="outline" className="border-orange-500 text-orange-600">Expired</Badge>
              ) : (
                <Badge variant="outline" className="border-green-500 text-green-600">Connected</Badge>
              )
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {status?.google.connected ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {status.google.calendarCount} calendar{status.google.calendarCount !== 1 ? 's' : ''} imported
                {status.google.taskSourceCount > 0 && (
                  <>, {status.google.taskSourceCount} task source{status.google.taskSourceCount !== 1 ? 's' : ''}</>
                )}
                {status.google.lastSynced && (
                  <> &middot; Last synced: {new Date(status.google.lastSynced).toLocaleString()}</>
                )}
              </p>

              {status.google.expired && (
                <div className="flex items-center gap-3 p-3 rounded-md border border-orange-500/50 bg-orange-50 dark:bg-orange-950/30">
                  <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-400">Token expired</p>
                    <p className="text-xs text-orange-600 dark:text-orange-400/80">
                      Re-authenticate to refresh all Google calendars.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                {status.google.expired && (
                  <Button variant="outline" size="sm" onClick={handleReauthGoogle}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Re-authenticate
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnectGoogle}
                  disabled={disconnecting === 'google'}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {disconnecting === 'google' ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleConnectGoogle} variant="outline" className="w-full justify-start">
              <GoogleIcon />
              <span className="ml-3">Connect Google Calendar</span>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Microsoft Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MicrosoftIcon />
              <div>
                <CardTitle className="text-lg">Microsoft</CardTitle>
                <CardDescription>Used for: Tasks, Shopping</CardDescription>
              </div>
            </div>
            {status?.microsoft.connected ? (
              <Badge variant="outline" className="border-green-500 text-green-600">Connected</Badge>
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {status?.microsoft.connected ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {status.microsoft.taskSourceCount} task source{status.microsoft.taskSourceCount !== 1 ? 's' : ''}
                {status.microsoft.shoppingSourceCount > 0 && (
                  <>, {status.microsoft.shoppingSourceCount} shopping source{status.microsoft.shoppingSourceCount !== 1 ? 's' : ''}</>
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnectMicrosoft}
                disabled={disconnecting === 'microsoft'}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {disconnecting === 'microsoft' ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Connect Microsoft To-Do from{' '}
              <a href="/settings?section=tasks" className="text-primary hover:underline font-medium">
                Task Sync
              </a>
              {' '}or{' '}
              <a href="/settings?section=shopping" className="text-primary hover:underline font-medium">
                Shopping Sync
              </a>
              {' '}— you&apos;ll pick which lists to sync during setup.
            </p>
          )}
        </CardContent>
      </Card>

      {/* OneDrive Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MicrosoftIcon />
              <div>
                <CardTitle className="text-lg">OneDrive</CardTitle>
                <CardDescription>Used for: Photos</CardDescription>
              </div>
            </div>
            {status?.onedrive.connected ? (
              <Badge variant="outline" className="border-green-500 text-green-600">Connected</Badge>
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {status?.onedrive.connected ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {status.onedrive.sourceCount} photo source{status.onedrive.sourceCount !== 1 ? 's' : ''} connected
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleConnectOneDrive}>
                  + Add Another Source
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { window.location.href = '/settings?section=photos'; }}
                  className="text-muted-foreground"
                >
                  Manage in Photos
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleConnectOneDrive} variant="outline" className="w-full justify-start">
              <HardDrive className="h-4 w-4 mr-3" />
              Connect OneDrive
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Gmail Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg">Gmail</CardTitle>
                <CardDescription>Used for: Bus Tracking</CardDescription>
              </div>
            </div>
            {status?.gmail.connected ? (
              <Badge variant="outline" className="border-green-500 text-green-600">Connected</Badge>
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {status?.gmail.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleConnectGmail}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-authenticate
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnectGmail}
                  disabled={disconnecting === 'gmail'}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {disconnecting === 'gmail' ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleConnectGmail} variant="outline" className="w-full justify-start">
              <Mail className="h-4 w-4 mr-3" />
              Connect Gmail
            </Button>
          )}
        </CardContent>
      </Card>

      {/* CalDAV Card (Apple iCloud, Nextcloud, Radicale, Baikal, Synology) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg">CalDAV</CardTitle>
                <CardDescription>Apple iCloud, Nextcloud, Radicale, Baikal, Synology &middot; Calendars + Reminders</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-amber-500 text-amber-600">Alpha</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Connect via username + app-specific password. Read-only sync of events and tasks. Two-way write support is planned.
          </p>
          <Button onClick={() => setCaldavDialogOpen(true)} variant="outline" className="w-full justify-start">
            <Server className="h-4 w-4 mr-3" />
            Connect CalDAV server
          </Button>
        </CardContent>
      </Card>

      <CalDAVConnectDialog
        open={caldavDialogOpen}
        onOpenChange={setCaldavDialogOpen}
        onConnected={fetchStatus}
      />

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
}
