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

interface Props {
  status: IntegrationStatus | null;
  onChange: () => void | Promise<void>;
  /** True if the URL hash matches this card or any of its sub-sections. */
  forceSubSectionOpen?: string;
}

const GmailIcon = () => (
  <Mail className="h-6 w-6 text-red-500" aria-hidden="true" />
);

const handleConnect = () => {
  window.location.href = '/api/auth/google-bus';
};

export function GmailProviderCard({ status, onChange, forceSubSectionOpen }: Props) {
  const { confirm, dialogProps } = useConfirmDialog();
  const [disconnecting, setDisconnecting] = React.useState(false);

  const connected = !!status?.gmail.connected;
  const connectionStatus: ConnectionStatus = connected ? 'connected' : 'disconnected';

  const handleDisconnect = async () => {
    const ok = await confirm(
      'Disconnect Gmail?',
      'Bus arrival data will no longer sync. You can reconnect any time.',
    );
    if (!ok) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/bus-tracking/connection', { method: 'DELETE' });
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
        name="Gmail"
        icon={<GmailIcon />}
        status={connectionStatus}
        description="Used by Bus Tracking to read arrival emails from FirstView."
        primaryAction={primaryAction}
      >
        <CollapsibleSubSection
          id="gmail-bus"
          label="Bus tracking"
          icon={<Bus className="h-4 w-4" />}
          summary={
            connected
              ? 'Reading FirstView arrival emails'
              : 'Connect Gmail to enable'
          }
          forceOpen={forceSubSectionOpen === 'gmail-bus'}
          defaultOpen={!connected}
        >
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Bus arrival times are parsed from FirstView emails sent to your
              Gmail inbox.{' '}
              <Link
                href="/settings?section=bus"
                className="text-primary hover:underline"
              >
                Open Bus Tracking settings
              </Link>{' '}
              to configure students and stops.
            </p>
            {connected && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect Gmail'}
              </Button>
            )}
          </div>
        </CollapsibleSubSection>
      </ProviderCardShell>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
