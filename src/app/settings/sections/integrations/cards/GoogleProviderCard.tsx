'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calendar, ListTodo, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { ProviderCardShell } from '../shared/ProviderCardShell';
import { CollapsibleSubSection } from '../shared/CollapsibleSubSection';
import type { IntegrationStatus } from '../shared/useIntegrationStatus';
import type { ConnectionStatus } from '../shared/ConnectionStatusBadge';

interface Props {
  status: IntegrationStatus | null;
  onChange: () => void | Promise<void>;
  forceSubSectionOpen?: string;
}

const GoogleIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
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
);

const handleConnect = () => {
  window.location.href = '/api/auth/google?returnSection=integrations';
};

const handleReauth = () => {
  window.location.href =
    '/api/auth/google?reauth=all&returnSection=integrations';
};

export function GoogleProviderCard({
  status,
  onChange,
  forceSubSectionOpen,
}: Props) {
  const { confirm, dialogProps } = useConfirmDialog();
  const [disconnecting, setDisconnecting] = React.useState(false);

  const g = status?.google;
  const connected = !!g?.connected;
  const expired = !!g?.expired;
  const connectionStatus: ConnectionStatus = !connected
    ? 'disconnected'
    : expired
      ? 'expired'
      : 'connected';

  const handleDisconnect = async () => {
    const ok = await confirm(
      'Disconnect Google?',
      'This will remove all Google calendars and their events from Prism.',
    );
    if (!ok) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
      });
      if (res.ok) {
        toast({ title: 'Google disconnected', variant: 'success' });
        await onChange();
      } else {
        toast({ title: 'Failed to disconnect Google', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to disconnect Google', variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  let primaryAction: React.ReactNode;
  if (!connected) {
    primaryAction = (
      <Button size="sm" onClick={handleConnect}>
        Connect
      </Button>
    );
  } else if (expired) {
    primaryAction = (
      <Button size="sm" onClick={handleReauth}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Re-authenticate
      </Button>
    );
  } else {
    primaryAction = (
      <Button variant="outline" size="sm" onClick={handleReauth}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Re-authenticate
      </Button>
    );
  }

  const calendarCount = g?.calendarCount ?? 0;
  const taskCount = g?.taskSourceCount ?? 0;
  const lastSyncedLabel = g?.lastSynced
    ? `Last synced ${new Date(g.lastSynced).toLocaleString()}`
    : null;

  return (
    <>
      <ProviderCardShell
        id="google"
        name="Google"
        icon={<GoogleIcon />}
        status={connectionStatus}
        description={
          connected
            ? [
                `${calendarCount} calendar${calendarCount === 1 ? '' : 's'}`,
                taskCount > 0
                  ? `${taskCount} task source${taskCount === 1 ? '' : 's'}`
                  : null,
                lastSyncedLabel,
              ]
                .filter(Boolean)
                .join(' · ')
            : 'Calendars (read+write) and Google Tasks via OAuth.'
        }
        primaryAction={primaryAction}
      >
        <CollapsibleSubSection
          id="google-calendars"
          label="Calendars"
          icon={<Calendar className="h-4 w-4" />}
          summary={
            connected
              ? `${calendarCount} imported`
              : 'Connect Google to enable'
          }
          forceOpen={forceSubSectionOpen === 'google-calendars'}
          defaultOpen={!connected}
        >
          <div className="text-sm">
            <Link
              href="/settings?section=calendars"
              className="text-primary hover:underline"
            >
              Open Calendars settings →
            </Link>
          </div>
        </CollapsibleSubSection>
        <CollapsibleSubSection
          id="google-tasks"
          label="Tasks sync"
          icon={<ListTodo className="h-4 w-4" />}
          summary={
            connected
              ? taskCount > 0
                ? `${taskCount} list${taskCount === 1 ? '' : 's'} wired`
                : 'No task lists wired yet'
              : 'Connect Google to enable'
          }
          forceOpen={forceSubSectionOpen === 'google-tasks'}
        >
          <div className="text-sm space-y-2">
            <p className="text-muted-foreground">
              Wire Google Tasks lists into Prism Tasks per family member.
            </p>
            <Link
              href="/settings?section=tasks"
              className="text-primary hover:underline"
            >
              Open Task Sync settings →
            </Link>
          </div>
        </CollapsibleSubSection>
        {connected && (
          <CollapsibleSubSection
            id="google-account"
            label="Account"
            summary="Disconnect Google"
            forceOpen={forceSubSectionOpen === 'google-account'}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect Google'}
            </Button>
          </CollapsibleSubSection>
        )}
      </ProviderCardShell>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
