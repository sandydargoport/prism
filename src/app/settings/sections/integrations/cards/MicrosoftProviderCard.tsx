'use client';

import * as React from 'react';
import Link from 'next/link';
import { ListTodo, ShoppingCart, Gift, HardDrive, ImageIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { ProviderCardShell } from '../shared/ProviderCardShell';
import { CollapsibleSubSection } from '../shared/CollapsibleSubSection';
import type { IntegrationStatus } from '../shared/useIntegrationStatus';
import type { ConnectionStatus } from '../shared/ConnectionStatusBadge';
import { connectedAsLabel } from '../shared/connectedAs';
import { useOAuthConfigStatus } from '../shared/useOAuthConfigStatus';
import { TaskIntegrationsSection } from '../../TaskIntegrationsSection';
import { ShoppingIntegrationsSection } from '../../ShoppingIntegrationsSection';
import { WishListIntegrationsSection } from '../../WishListIntegrationsSection';

interface Props {
  status: IntegrationStatus | null;
  onChange: () => void | Promise<void>;
  forceSubSectionOpen?: string;
}

const MicrosoftIcon = () => (
  <svg
    className="h-6 w-6"
    viewBox="0 0 24 24"
    fill="#0078D4"
    aria-hidden="true"
  >
    <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
  </svg>
);

const handleConnect = () => {
  // Tells /api/auth/microsoft/callback to route back to the consolidated
  // Integrations page (with the OneDrive sub-section auto-expanded) instead
  // of the legacy ?section=photos default.
  window.location.href = '/api/auth/microsoft?returnSection=integrations';
};

// Re-auth re-uses the same init route — Microsoft's OAuth refreshes
// silently if already connected, returning the user without a consent
// step. Surfaced as a card primary action so connected users have a
// way to recover from expired/revoked tokens without disconnecting.
const handleReauth = handleConnect;

export function MicrosoftProviderCard({
  status,
  onChange,
  forceSubSectionOpen,
}: Props) {
  const { confirm, dialogProps } = useConfirmDialog();
  const [disconnecting, setDisconnecting] = React.useState(false);
  const oauthStatus = useOAuthConfigStatus();
  // Treat "still loading" as configured so the common case (already set up)
  // never flashes the gated state — only downgrade once we know for sure.
  const configured = oauthStatus === null ? true : oauthStatus.microsoft;

  // Microsoft and OneDrive share the same OAuth account. The card treats
  // them as one connection — connected if either To-Do OR OneDrive has any
  // wired source.
  const ms = status?.microsoft;
  const od = status?.onedrive;
  const connected = !!(ms?.connected || od?.connected);
  const connectionStatus: ConnectionStatus = !configured
    ? 'setup_required'
    : connected
      ? 'connected'
      : 'disconnected';

  const handleDisconnect = async () => {
    const ok = await confirm(
      'Disconnect Microsoft?',
      'This will remove all Microsoft task, shopping, and wish-list sources. OneDrive photo sources will also disconnect. Items already synced remain in Prism.',
    );
    if (!ok) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/microsoft/disconnect', {
        method: 'POST',
      });
      if (res.ok) {
        toast({ title: 'Microsoft disconnected', variant: 'success' });
        await onChange();
      } else {
        toast({
          title: 'Failed to disconnect Microsoft',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Failed to disconnect Microsoft',
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const taskCount = ms?.taskSourceCount ?? 0;
  const shoppingCount = ms?.shoppingSourceCount ?? 0;
  const oneDriveCount = od?.sourceCount ?? 0;

  // To-Do and OneDrive can be authorized with different Microsoft accounts;
  // merge both providers' emails into one label (#100).
  const allMsEmails = [
    ...(ms?.accountEmails ?? []),
    ...(od?.accountEmails ?? []),
  ];
  const connectedAs = connectedAsLabel(
    ms?.accountEmail ?? od?.accountEmail ?? null,
    allMsEmails,
  );

  const description = connected
    ? [
        connectedAs,
        taskCount > 0
          ? `${taskCount} task list${taskCount === 1 ? '' : 's'}`
          : null,
        shoppingCount > 0
          ? `${shoppingCount} shopping list${shoppingCount === 1 ? '' : 's'}`
          : null,
        oneDriveCount > 0
          ? `${oneDriveCount} OneDrive folder${oneDriveCount === 1 ? '' : 's'}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'No sources wired yet'
    : !configured
      ? 'Needs a one-time admin setup before Microsoft To-Do, shopping/wish lists, or OneDrive can connect.'
      : 'Microsoft To-Do (tasks, shopping, wish lists) and OneDrive (photos). One OAuth covers all.';

  const primaryAction =
    !configured && !connected ? (
      <Button
        size="sm"
        variant="secondary"
        disabled
        title="Needs a one-time admin setup (Microsoft OAuth credentials) before this can connect"
      >
        Connect
      </Button>
    ) : connected ? (
      <Button variant="outline" size="sm" onClick={handleReauth}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Re-authenticate
      </Button>
    ) : (
      <Button size="sm" onClick={handleConnect}>
        Connect
      </Button>
    );

  return (
    <>
      <ProviderCardShell
        id="microsoft"
        name="Microsoft"
        icon={<MicrosoftIcon />}
        status={connectionStatus}
        description={description}
        primaryAction={primaryAction}
      >
        {!configured && !connected && (
          <CollapsibleSubSection
            id="microsoft-setup"
            label="One-time admin setup"
            summary="Requires an Azure AD app registration"
            defaultOpen
          >
            <p className="text-sm text-muted-foreground">
              An admin needs to register an Azure AD app and set{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">MICROSOFT_CLIENT_ID</code>,{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">MICROSOFT_CLIENT_SECRET</code>, and{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">MICROSOFT_REDIRECT_URI</code> in{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> (see{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.example</code>).
            </p>
          </CollapsibleSubSection>
        )}
        {connected && (
          <CollapsibleSubSection
            id="microsoft-account"
            label="Account"
            summary={`${connectedAs ?? 'Connected Microsoft account'} · Disconnect`}
            forceOpen={forceSubSectionOpen === 'microsoft-account'}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect Microsoft'}
            </Button>
          </CollapsibleSubSection>
        )}
        <CollapsibleSubSection
          id="microsoft-tasks"
          label="Tasks"
          icon={<ListTodo className="h-4 w-4" />}
          summary={
            taskCount > 0
              ? `${taskCount} list${taskCount === 1 ? '' : 's'} via Microsoft To-Do`
              : connected
                ? 'No task lists wired yet'
                : configured
                  ? 'Connect Microsoft to enable'
                  : 'Needs admin setup'
          }
          forceOpen={forceSubSectionOpen === 'microsoft-tasks'}
        >
          <TaskIntegrationsSection embedded providerFilter="microsoft_todo" />
        </CollapsibleSubSection>
        <CollapsibleSubSection
          id="microsoft-shopping"
          label="Shopping lists"
          icon={<ShoppingCart className="h-4 w-4" />}
          summary={
            shoppingCount > 0
              ? `${shoppingCount} list${shoppingCount === 1 ? '' : 's'} via Microsoft To-Do`
              : connected
                ? 'No shopping lists wired yet'
                : configured
                  ? 'Connect Microsoft to enable'
                  : 'Needs admin setup'
          }
          forceOpen={forceSubSectionOpen === 'microsoft-shopping'}
        >
          <ShoppingIntegrationsSection embedded />
        </CollapsibleSubSection>
        <CollapsibleSubSection
          id="microsoft-wish"
          label="Wish lists"
          icon={<Gift className="h-4 w-4" />}
          summary={
            connected
              ? 'Per-member wish list wiring'
              : configured
                ? 'Connect Microsoft to enable'
                : 'Needs admin setup'
          }
          forceOpen={forceSubSectionOpen === 'microsoft-wish'}
        >
          <WishListIntegrationsSection embedded />
        </CollapsibleSubSection>
        <CollapsibleSubSection
          id="microsoft-onedrive"
          label="OneDrive photo folders"
          icon={<HardDrive className="h-4 w-4" />}
          summary={
            oneDriveCount > 0
              ? `${oneDriveCount} folder${oneDriveCount === 1 ? '' : 's'} syncing`
              : connected
                ? 'No OneDrive folders wired yet'
                : configured
                  ? 'Connect Microsoft to enable'
                  : 'Needs admin setup'
          }
          forceOpen={forceSubSectionOpen === 'microsoft-onedrive'}
        >
          <div className="text-sm space-y-2">
            <p className="text-muted-foreground">
              OneDrive shares the same Microsoft OAuth. Folders are configured
              alongside other photo sources so cross-source priority stays
              sensible.
            </p>
            <Link
              href="/settings?section=integrations#photo-sources"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Go to Photo data sources
            </Link>
          </div>
        </CollapsibleSubSection>
      </ProviderCardShell>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
