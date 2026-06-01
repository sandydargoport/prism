'use client';

import { Gift } from 'lucide-react';
import { useFamily } from '@/components/providers/FamilyProvider';
import { useIntegrationSources } from './integrations/useIntegrationSources';
import { WISH_CONFIG } from './integrations/constants';
import type { WishItemSource } from './integrations/types';
import {
  StatusBanner,
  ConnectedSourcesCard,
  MsListSelectionModal,
  ProviderPickerModal,
  EntityListCard,
  ConfirmDialog,
} from './integrations/components';

interface WishListIntegrationsSectionProps {
  /** Hide section header when rendered inside a Microsoft card sub-section. */
  embedded?: boolean;
}

export function WishListIntegrationsSection({
  embedded = false,
}: WishListIntegrationsSectionProps = {}) {
  const { members, loading: membersLoading } = useFamily();

  const integration = useIntegrationSources<WishItemSource>(WISH_CONFIG);

  const handleConnectEntity = (entityId: string) => {
    if (embedded) {
      window.location.href = `/api/auth/microsoft-tasks?wishMemberId=${entityId}&returnSection=integrations`;
    } else {
      integration.handleConnectProvider(entityId);
    }
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-2xl font-bold">Wish List Sync</h2>
          <p className="text-muted-foreground">
            Sync family members&apos; wish lists with Microsoft To-Do
          </p>
        </div>
      )}

      {integration.statusMessage && (
        <StatusBanner
          message={integration.statusMessage}
          onDismiss={() => integration.setStatusMessage(null)}
        />
      )}

      <ConnectedSourcesCard
        sources={integration.sources}
        loading={integration.loading}
        syncingAll={integration.syncingAll}
        syncing={integration.syncing}
        updatingSource={integration.updatingSource}
        config={WISH_CONFIG}
        emptyIcon={<Gift className="h-5 w-5" />}
        emptyText="No wish list sources connected yet"
        emptySubtext="Connect a family member's wish list to Microsoft To-Do to keep it in sync"
        onSyncAll={integration.handleSyncAll}
        onSyncNow={integration.handleSyncNow}
        onToggleSync={integration.handleToggleSync}
        onDelete={integration.handleDeleteSource}
        getBadge={(s) => ({ label: 'Member', value: s.memberName || 'Unknown' })}
      />

      <EntityListCard
        title="Family Members"
        description="Connect each member's wish list to a Microsoft To-Do list"
        entities={members}
        loading={membersLoading}
        emptyText="No family members found. Add members from the Family section."
        entityIcon={<Gift className="h-5 w-5 text-muted-foreground" />}
        sources={integration.sources}
        getSourceForEntity={(member) =>
          integration.sources.find((s) => s.memberId === member.id)
        }
        onConnect={handleConnectEntity}
      />

      <ProviderPickerModal
        open={integration.showProviderPickerModal}
        onClose={integration.closeProviderPickerModal}
        title="Connect Wish List"
        description={
          <>
            Choose which service to sync with{' '}
            <strong>{members.find(m => m.id === integration.connectingEntityId)?.name}&apos;s</strong> wish list
          </>
        }
        onSelectMsTodo={() => {
          integration.setShowProviderPickerModal(false);
          if (integration.connectingEntityId) {
            window.location.href = `/api/auth/microsoft-tasks?wishMemberId=${integration.connectingEntityId}&returnSection=wish`;
          }
        }}
      />

      <MsListSelectionModal
        open={integration.showMsListModal}
        onClose={integration.closeMsListModal}
        lists={integration.msLists}
        loading={integration.loadingMsLists}
        finalizingConnection={integration.finalizingConnection}
        onSelect={integration.handleSelectMsList}
        description="Choose which Microsoft To-Do list to sync with this member's wish list"
      />

      <ConfirmDialog {...integration.confirmDialogProps} />
    </div>
  );
}
