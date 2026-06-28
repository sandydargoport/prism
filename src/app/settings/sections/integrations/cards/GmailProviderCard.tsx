'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bus, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { ProviderCardShell } from '../shared/ProviderCardShell';
import { CollapsibleSubSection } from '../shared/CollapsibleSubSection';
import type { IntegrationStatus } from '../shared/useIntegrationStatus';
import type { ConnectionStatus } from '../shared/ConnectionStatusBadge';
import { connectedAsLabel } from '../shared/connectedAs';

interface Props {
  status: IntegrationStatus | null;
  onChange: () => void | Promise<void>;
  forceSubSectionOpen?: string;
}

const GmailIcon = () => (
  <Mail className="h-6 w-6 text-red-500" aria-hidden="true" />
);

const handleConnect = () => {
  window.location.href =
    '/api/auth/google-bus?returnSection=integrations';
};

/**
 * Gmail-for-bus-tracking is its own card, not a sub-section of Google,
 * because realistically only a small fraction of users wire bus tracking
 * at all — embedding it inside Google made the common-case Google card
 * noisier without making the bus-tracking case clearer. Even though it
 * uses Gmail OAuth under the hood, "Bus tracking" is what users came
 * here for, so that's the brand on the card.
 */
export function GmailProviderCard({
  status,
  onChange,
  forceSubSectionOpen,
}: Props) {
  const { confirm, dialogProps } = useConfirmDialog();
  const [disconnecting, setDisconnecting] = React.useState(false);

  const connected = !!status?.gmail.connected;
  const connectionStatus: ConnectionStatus = connected
    ? 'connected'
    : 'disconnected';
  const connectedAs = connectedAsLabel(status?.gmail.accountEmail ?? null);

  const handleDisconnect = async () => {
    const ok = await confirm(
      'Disconnect Gmail?',
      'Bus arrival data will no longer sync. You can reconnect any time.',
    );
    if (!ok) return;
    setDisconnecting(true);
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
      setDisconnecting(false);
    }
  };

  const primaryAction = connected ? (
    <Button variant="outline" size="sm" onClick={handleConnect}>
      <RefreshCw className="h-4 w-4 mr-2" />
      Re-authenticate
    </Button>
  ) : (
    <Button size="sm" onClick={handleConnect}>
      <Mail className="h-4 w-4 mr-2" />
      Connect
    </Button>
  );

  return (
    <>
      <ProviderCardShell
        id="gmail"
        name="Bus tracking (Gmail)"
        icon={<GmailIcon />}
        status={connectionStatus}
        description={
          connected
            ? connectedAs
              ? `${connectedAs} · Reading FirstView arrival emails`
              : 'Reading FirstView arrival emails from your inbox.'
            : 'Optional: parse school bus arrival emails from FirstView.'
        }
        primaryAction={primaryAction}
      >
        {connected && (
          <CollapsibleSubSection
            id="gmail-account"
            label="Account"
            summary={`${connectedAs ?? 'Connected Gmail account'} · Disconnect`}
            forceOpen={forceSubSectionOpen === 'gmail-account'}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect Gmail'}
            </Button>
          </CollapsibleSubSection>
        )}
        <CollapsibleSubSection
          id="gmail-bus"
          label="Bus tracking"
          icon={<Bus className="h-4 w-4" />}
          summary={
            connected
              ? 'Configure students & stops in Bus Tracking settings'
              : 'Connect Gmail to enable'
          }
          forceOpen={forceSubSectionOpen === 'gmail-bus'}
          defaultOpen={!connected}
        >
          <div className="text-sm text-muted-foreground">
            <p>
              Bus arrival times come from FirstView emails sent to your Gmail
              inbox.{' '}
              <Link
                href="/settings?section=bus"
                className="text-primary hover:underline"
              >
                Open Bus Tracking settings →
              </Link>
            </p>
          </div>
        </CollapsibleSubSection>
      </ProviderCardShell>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
