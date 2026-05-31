'use client';

import * as React from 'react';
import Link from 'next/link';
import { Calendar, ListTodo, RefreshCw, Bus, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { ProviderCardShell } from '../shared/ProviderCardShell';
import { CollapsibleSubSection } from '../shared/CollapsibleSubSection';
import {
  ConnectionStatusBadge,
  type ConnectionStatus,
} from '../shared/ConnectionStatusBadge';
import type { IntegrationStatus } from '../shared/useIntegrationStatus';

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

export function GoogleProviderCard({
  status,
  onChange,
  forceSubSectionOpen,
}: Props) {
  const { confirm, dialogProps } = useConfirmDialog();
  const [disconnectingGoogle, setDisconnectingGoogle] = React.useState(false);
  const [disconnectingGmail, setDisconnectingGmail] = React.useState(false);

  // Google calendars/tasks (/api/auth/google) and Gmail bus tracking
  // (/api/auth/google-bus) are independent OAuth flows. Most users use the
  // same Google account for both — the card folds them under one "Google"
  // brand. Users with different accounts (one for personal calendars, one
  // for the school bus FirstView emails) still see the truth via per-
  // sub-section status badges.
  const g = status?.google;
  const gmail = status?.gmail;
  const calendarsConnected = !!g?.connected;
  const calendarsExpired = !!g?.expired;
  const gmailConnected = !!gmail?.connected;

  const calendarsStatus: ConnectionStatus = !calendarsConnected
    ? 'disconnected'
    : calendarsExpired
      ? 'expired'
      : 'connected';
  const gmailStatus: ConnectionStatus = gmailConnected
    ? 'connected'
    : 'disconnected';

  // Top-level: if any sub-service needs attention, surface it.
  const topStatus: ConnectionStatus = calendarsExpired
    ? 'expired'
    : calendarsConnected || gmailConnected
      ? 'connected'
      : 'disconnected';

  const handleConnectCalendars = () => {
    window.location.href = '/api/auth/google?returnSection=integrations';
  };
  const handleReauthCalendars = () => {
    window.location.href =
      '/api/auth/google?reauth=all&returnSection=integrations';
  };
  const handleConnectGmail = () => {
    window.location.href = '/api/auth/google-bus';
  };

  const handleDisconnectGoogle = async () => {
    const ok = await confirm(
      'Disconnect Google calendars + tasks?',
      'Removes all Google calendars and their events from Prism. Gmail bus tracking is a separate connection and stays.',
    );
    if (!ok) return;
    setDisconnectingGoogle(true);
    try {
      const res = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
      });
      if (res.ok) {
        toast({ title: 'Google calendars disconnected', variant: 'success' });
        await onChange();
      } else {
        toast({ title: 'Failed to disconnect Google', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to disconnect Google', variant: 'destructive' });
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  const handleDisconnectGmail = async () => {
    const ok = await confirm(
      'Disconnect Gmail?',
      'Bus arrival data will no longer sync. Google calendars stay connected.',
    );
    if (!ok) return;
    setDisconnectingGmail(true);
    try {
      const res = await fetch('/api/bus-tracking/connection', {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: 'Gmail disconnected', variant: 'success' });
        await onChange();
      } else {
        toast({ title: 'Failed to disconnect Gmail', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to disconnect Gmail', variant: 'destructive' });
    } finally {
      setDisconnectingGmail(false);
    }
  };

  // Primary action covers calendars+tasks — the common-case path. Bus
  // tracking has its own connect/disconnect inside the sub-section so
  // users with two accounts can wire them independently.
  let primaryAction: React.ReactNode;
  if (!calendarsConnected) {
    primaryAction = (
      <Button size="sm" onClick={handleConnectCalendars}>
        Connect
      </Button>
    );
  } else if (calendarsExpired) {
    primaryAction = (
      <Button size="sm" onClick={handleReauthCalendars}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Re-authenticate
      </Button>
    );
  } else {
    primaryAction = (
      <Button variant="outline" size="sm" onClick={handleReauthCalendars}>
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

  const description = (() => {
    const parts: string[] = [];
    if (calendarsConnected) {
      parts.push(
        `${calendarCount} calendar${calendarCount === 1 ? '' : 's'}`,
      );
      if (taskCount > 0) {
        parts.push(`${taskCount} task source${taskCount === 1 ? '' : 's'}`);
      }
    }
    if (gmailConnected) parts.push('Bus tracking');
    if (lastSyncedLabel) parts.push(lastSyncedLabel);
    if (parts.length > 0) return parts.join(' · ');
    return 'Calendars, Tasks, and Bus tracking via Gmail. One account or different accounts for each — Prism shows both.';
  })();

  return (
    <>
      <ProviderCardShell
        id="google"
        name="Google"
        icon={<GoogleIcon />}
        status={topStatus}
        description={description}
        primaryAction={primaryAction}
      >
        <CollapsibleSubSection
          id="google-calendars"
          label="Calendars"
          icon={<Calendar className="h-4 w-4" />}
          summary={
            <span className="inline-flex items-center gap-2">
              <ConnectionStatusBadge status={calendarsStatus} />
              {calendarsConnected
                ? `${calendarCount} imported`
                : 'Connect Google to enable'}
            </span>
          }
          forceOpen={forceSubSectionOpen === 'google-calendars'}
          defaultOpen={!calendarsConnected}
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
            <span className="inline-flex items-center gap-2">
              <ConnectionStatusBadge status={calendarsStatus} />
              {calendarsConnected
                ? taskCount > 0
                  ? `${taskCount} list${taskCount === 1 ? '' : 's'} wired`
                  : 'No task lists wired yet'
                : 'Connect Google to enable'}
            </span>
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
        <CollapsibleSubSection
          id="google-bus"
          label="Bus tracking (Gmail)"
          icon={<Bus className="h-4 w-4" />}
          summary={
            <span className="inline-flex items-center gap-2">
              <ConnectionStatusBadge status={gmailStatus} />
              {gmailConnected
                ? 'Reading FirstView arrival emails'
                : 'Connect a Gmail account to enable'}
            </span>
          }
          forceOpen={forceSubSectionOpen === 'google-bus'}
          defaultOpen={!gmailConnected && calendarsConnected}
        >
          <div className="text-sm space-y-3">
            <p className="text-muted-foreground">
              Bus arrival times are parsed from FirstView emails sent to a
              Gmail inbox. This is a separate OAuth flow from calendars —
              wire a different Google account if your school bus mail lands
              somewhere other than your personal Gmail.{' '}
              <Link
                href="/settings?section=bus"
                className="text-primary hover:underline"
              >
                Configure students & stops →
              </Link>
            </p>
            <div className="flex items-center gap-2">
              {!gmailConnected ? (
                <Button size="sm" onClick={handleConnectGmail}>
                  <Mail className="h-4 w-4 mr-2" />
                  Connect Gmail
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleConnectGmail}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Re-authenticate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectGmail}
                    disabled={disconnectingGmail}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {disconnectingGmail ? 'Disconnecting…' : 'Disconnect Gmail'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CollapsibleSubSection>
        {calendarsConnected && (
          <CollapsibleSubSection
            id="google-account"
            label="Calendars + Tasks account"
            summary="Disconnect the Google account used for calendars and tasks"
            forceOpen={forceSubSectionOpen === 'google-account'}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnectGoogle}
              disabled={disconnectingGoogle}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {disconnectingGoogle
                ? 'Disconnecting…'
                : 'Disconnect Google (calendars + tasks)'}
            </Button>
          </CollapsibleSubSection>
        )}
      </ProviderCardShell>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
