'use client';

import { ShoppingCart } from 'lucide-react';
import { useShoppingLists } from '@/lib/hooks/useShoppingLists';
import { useIntegrationSources } from './integrations/useIntegrationSources';
import { SHOPPING_CONFIG } from './integrations/constants';
import type { ShoppingListSource } from './integrations/types';
import {
  StatusBanner,
  ConnectedSourcesCard,
  MsListSelectionModal,
  ProviderPickerModal,
  EntityListCard,
  ConfirmDialog,
} from './integrations/components';
import { KrogerConnectionCard } from './KrogerConnectionCard';

interface ShoppingIntegrationsSectionProps {
  /** Hide section header + Kroger card when rendered inside a Microsoft card sub-section. */
  embedded?: boolean;
}

export function ShoppingIntegrationsSection({
  embedded = false,
}: ShoppingIntegrationsSectionProps = {}) {
  const { lists: shoppingLists, loading: listsLoading } = useShoppingLists({ refreshInterval: 0 });

  const integration = useIntegrationSources<ShoppingListSource>(SHOPPING_CONFIG);

  const handleConnectEntity = (entityId: string) => {
    if (embedded) {
      // Embedded in the Microsoft card — provider is implicit. Skip the
      // ProviderPickerModal and go straight to MS OAuth.
      window.location.href = `/api/auth/microsoft-tasks?shoppingListId=${entityId}&returnSection=integrations`;
    } else {
      integration.handleConnectProvider(entityId);
    }
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h2 className="text-2xl font-bold">Shopping Sync</h2>
          <p className="text-muted-foreground">
            Manage shopping list sync with external apps
          </p>
        </div>
      )}

      {integration.statusMessage && (
        <StatusBanner
          message={integration.statusMessage}
          onDismiss={() => integration.setStatusMessage(null)}
        />
      )}

      {/* Kroger has its own card in the new Integrations IA, so embedded
          shopping-sync only renders the Microsoft-To-Do shopping wiring. */}
      {!embedded && <KrogerConnectionCard />}

      <ConnectedSourcesCard
        sources={integration.sources}
        loading={integration.loading}
        syncingAll={integration.syncingAll}
        syncing={integration.syncing}
        updatingSource={integration.updatingSource}
        config={SHOPPING_CONFIG}
        emptyIcon={<ShoppingCart className="h-5 w-5" />}
        emptyText="No shopping list sources connected yet"
        emptySubtext="Connect a shopping list to Microsoft To-Do to keep your lists in sync"
        onSyncAll={integration.handleSyncAll}
        onSyncNow={integration.handleSyncNow}
        onToggleSync={integration.handleToggleSync}
        onDelete={integration.handleDeleteSource}
        getBadge={(s) => ({ label: 'Syncs to', value: s.shoppingListName || 'Unknown List' })}
      />

      <EntityListCard
        title="Shopping Lists"
        description="Connect your Prism shopping lists to Microsoft To-Do"
        entities={shoppingLists}
        loading={listsLoading}
        emptyText="No shopping lists yet. Create one from the Shopping page."
        entityIcon={<ShoppingCart className="h-5 w-5 text-muted-foreground" />}
        sources={integration.sources}
        getSourceForEntity={(list) =>
          integration.sources.find((s) => s.shoppingListId === list.id)
        }
        onConnect={handleConnectEntity}
      />

      <ProviderPickerModal
        open={integration.showProviderPickerModal}
        onClose={integration.closeProviderPickerModal}
        title="Connect Shopping List"
        description={
          <>
            Choose which service to sync with{' '}
            <strong>{shoppingLists.find(l => l.id === integration.connectingEntityId)?.name}</strong>
          </>
        }
        onSelectMsTodo={() => {
          integration.setShowProviderPickerModal(false);
          if (integration.connectingEntityId) {
            window.location.href = `/api/auth/microsoft-tasks?shoppingListId=${integration.connectingEntityId}&returnSection=shopping`;
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
        description="Choose which Microsoft To-Do list to sync with your shopping list"
      />

      <ConfirmDialog {...integration.confirmDialogProps} />
    </div>
  );
}
