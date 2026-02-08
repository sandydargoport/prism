'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  RefreshCw,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Link2,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useShoppingLists } from '@/lib/hooks/useShoppingLists';

interface ShoppingListSource {
  id: string;
  userId: string;
  userName: string | null;
  provider: string;
  externalListId: string;
  externalListName: string | null;
  shoppingListId: string;
  shoppingListName: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

const PROVIDER_INFO: Record<string, { name: string; icon: React.ReactNode; color: string }> = {
  microsoft_todo: {
    name: 'Microsoft To-Do',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#0078D4">
        <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
      </svg>
    ),
    color: '#0078D4',
  },
};

const ERROR_MESSAGES: Record<string, string> = {
  microsoft_auth_denied: 'Microsoft authorization was denied or cancelled.',
  microsoft_auth_failed: 'Microsoft authentication failed. Please try again.',
  missing_code: 'Authorization code was missing. Please try again.',
  missing_shopping_list: 'No shopping list was selected. Please try again.',
  shopping_list_not_found: 'The selected shopping list was not found.',
  no_ms_lists: 'No lists found in your Microsoft To-Do account.',
};

const SUCCESS_MESSAGES: Record<string, string> = {
  microsoft_shopping_connected: 'Microsoft To-Do connected successfully for shopping!',
};

export function ShoppingIntegrationsSection() {
  const searchParams = useSearchParams();
  const { lists: shoppingLists, loading: listsLoading } = useShoppingLists({ refreshInterval: 0 });
  const [sources, setSources] = useState<ShoppingListSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [updatingSource, setUpdatingSource] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // MS To-Do list selection after OAuth
  const [showMsListModal, setShowMsListModal] = useState(false);
  const [msLists, setMsLists] = useState<Array<{ id: string; name: string; isDefault: boolean }>>([]);
  const [loadingMsLists, setLoadingMsLists] = useState(false);
  const [pendingShoppingListId, setPendingShoppingListId] = useState<string | null>(null);
  const [finalizingConnection, setFinalizingConnection] = useState(false);

  // Provider picker modal
  const [showProviderPickerModal, setShowProviderPickerModal] = useState(false);
  const [connectingListId, setConnectingListId] = useState<string | null>(null);

  // Check URL params for OAuth results
  useEffect(() => {
    const error = searchParams.get('error');
    const success = searchParams.get('success');
    const section = searchParams.get('section');
    const selectMsList = searchParams.get('selectMsList');
    const shoppingListId = searchParams.get('shoppingListId');

    if (section === 'shopping') {
      if (error) {
        setStatusMessage({
          type: 'error',
          text: ERROR_MESSAGES[error] || `Error: ${error}`,
        });
      } else if (success) {
        setStatusMessage({
          type: 'success',
          text: SUCCESS_MESSAGES[success] || 'Operation completed successfully!',
        });
      } else if (selectMsList === 'true' && shoppingListId) {
        setPendingShoppingListId(shoppingListId);
        fetchMsLists(shoppingListId);
      }
    }
  }, [searchParams]);

  const fetchMsLists = async (shoppingListId: string, tempTokenData?: string) => {
    setLoadingMsLists(true);
    try {
      const res = await fetch(`/api/task-sources/microsoft-lists?shoppingListId=${shoppingListId}`);
      if (res.ok) {
        const data = await res.json();
        setMsLists(data.lists || []);
        setShowMsListModal(true);
      } else {
        const data = await res.json();
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to fetch Microsoft To-Do lists',
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Failed to fetch Microsoft To-Do lists',
      });
    } finally {
      setLoadingMsLists(false);
    }
  };

  const handleSelectMsList = async (externalListId: string, externalListName: string) => {
    if (!pendingShoppingListId) return;

    setFinalizingConnection(true);
    try {
      const res = await fetch('/api/shopping-list-sources/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shoppingListId: pendingShoppingListId,
          externalListId,
          externalListName,
        }),
      });

      if (res.ok) {
        setShowMsListModal(false);
        setMsLists([]);
        setPendingShoppingListId(null);
        setStatusMessage({
          type: 'success',
          text: `Connected to "${externalListName}" in Microsoft To-Do!`,
        });
        await fetchSources();
        window.history.replaceState({}, '', '/settings?section=shopping');
      } else {
        const data = await res.json();
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to complete connection',
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Failed to complete connection',
      });
    } finally {
      setFinalizingConnection(false);
    }
  };

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/shopping-list-sources');
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch (error) {
      console.error('Failed to fetch shopping list sources:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleToggleSync = async (sourceId: string, enabled: boolean) => {
    setUpdatingSource(sourceId);
    try {
      const res = await fetch(`/api/shopping-list-sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncEnabled: enabled }),
      });
      if (res.ok) {
        setSources((prev) =>
          prev.map((s) => (s.id === sourceId ? { ...s, syncEnabled: enabled } : s))
        );
      }
    } catch (error) {
      console.error('Failed to update source:', error);
    } finally {
      setUpdatingSource(null);
    }
  };

  const handleDeleteSource = async (sourceId: string, sourceName: string) => {
    if (!confirm(`Disconnect "${sourceName}"? Items already synced will remain in Prism.`)) {
      return;
    }

    setUpdatingSource(sourceId);
    try {
      const res = await fetch(`/api/shopping-list-sources/${sourceId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== sourceId));
      }
    } catch (error) {
      console.error('Failed to delete source:', error);
    } finally {
      setUpdatingSource(null);
    }
  };

  const handleSyncNow = async (sourceId: string) => {
    setSyncing(sourceId);
    try {
      const res = await fetch(`/api/shopping-list-sources/${sourceId}/sync`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        await fetchSources();
        const msg = `Sync complete: ${data.created} created, ${data.updated} updated, ${data.deleted} deleted`;
        if (data.errors?.length > 0) {
          alert(`${msg}\n\nErrors:\n${data.errors.join('\n')}`);
        }
      } else {
        alert(`Sync failed: ${data.error || 'Unknown error'}`);
        await fetchSources();
      }
    } catch (error) {
      console.error('Failed to sync:', error);
      alert('Sync failed: Network error');
    } finally {
      setSyncing(null);
    }
  };

  const [syncingAll, setSyncingAll] = useState(false);

  const handleSyncAll = async () => {
    const enabledSources = sources.filter(s => s.syncEnabled);
    if (enabledSources.length === 0) return;

    setSyncingAll(true);
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalDeleted = 0;
    const allErrors: string[] = [];

    try {
      const results = await Promise.allSettled(
        enabledSources.map(async (source) => {
          const res = await fetch(`/api/shopping-list-sources/${source.id}/sync`, {
            method: 'POST',
          });
          const data = await res.json();
          if (res.ok) {
            return { success: true, data, sourceName: source.externalListName };
          } else {
            return { success: false, error: data.error, sourceName: source.externalListName };
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            totalCreated += result.value.data.created || 0;
            totalUpdated += result.value.data.updated || 0;
            totalDeleted += result.value.data.deleted || 0;
            if (result.value.data.errors?.length > 0) {
              allErrors.push(`${result.value.sourceName}: ${result.value.data.errors.join(', ')}`);
            }
          } else {
            allErrors.push(`${result.value.sourceName}: ${result.value.error || 'Unknown error'}`);
          }
        } else {
          allErrors.push(`Sync failed: ${result.reason}`);
        }
      }

      await fetchSources();

      const msg = `Sync complete: ${totalCreated} created, ${totalUpdated} updated, ${totalDeleted} deleted`;
      if (allErrors.length > 0) {
        setStatusMessage({
          type: 'error',
          text: `${msg} (with errors)`,
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: msg,
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Sync all failed',
      });
    } finally {
      setSyncingAll(false);
    }
  };

  const handleConnectProvider = (listId: string) => {
    setConnectingListId(listId);
    setShowProviderPickerModal(true);
  };

  const getProviderInfo = (provider: string) => {
    return PROVIDER_INFO[provider] || {
      name: provider,
      icon: <ShoppingCart className="h-5 w-5" />,
      color: '#6B7280',
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Shopping List Integrations</h2>
        <p className="text-muted-foreground">
          Sync shopping lists with external apps like Microsoft To-Do
        </p>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={cn(
            'p-4 rounded-lg flex items-center gap-3',
            statusMessage.type === 'error'
              ? 'bg-destructive/10 text-destructive border border-destructive/20'
              : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
          )}
        >
          {statusMessage.type === 'error' ? (
            <AlertCircle className="h-5 w-5 shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="ml-auto text-sm underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Connected Sources */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connected Sources</CardTitle>
              <CardDescription>
                External lists syncing with Prism shopping lists
              </CardDescription>
            </div>
            {sources.filter(s => s.syncEnabled).length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncAll}
                disabled={syncingAll}
                className="gap-2"
              >
                <RefreshCw className={cn('h-4 w-4', syncingAll && 'animate-spin')} />
                {syncingAll ? 'Syncing...' : 'Sync All'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading sources...
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Link2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No shopping list sources connected yet</p>
              <p className="text-sm mt-1">
                Connect a shopping list to Microsoft To-Do to keep your lists in sync
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => {
                const providerInfo = getProviderInfo(source.provider);
                const isSyncing = syncing === source.id;
                const isUpdating = updatingSource === source.id;

                return (
                  <div
                    key={source.id}
                    className={cn(
                      'p-4 rounded-lg border border-border',
                      !source.syncEnabled && 'opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {providerInfo.icon}
                        <div>
                          <div className="font-medium">
                            {source.externalListName || 'Unnamed List'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {providerInfo.name}
                            {source.userName && (
                              <span className="ml-2">• {source.userName}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSyncNow(source.id)}
                          disabled={isSyncing || !source.syncEnabled}
                        >
                          <RefreshCw
                            className={cn('h-4 w-4', isSyncing && 'animate-spin')}
                          />
                        </Button>

                        <button
                          onClick={() => handleToggleSync(source.id, !source.syncEnabled)}
                          disabled={isUpdating}
                          className={cn(
                            'relative w-10 h-5 rounded-full transition-colors',
                            source.syncEnabled ? 'bg-primary' : 'bg-muted',
                            isUpdating && 'opacity-50'
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                              source.syncEnabled ? 'translate-x-5' : 'translate-x-0.5'
                            )}
                          />
                        </button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            handleDeleteSource(
                              source.id,
                              source.externalListName || 'this source'
                            )
                          }
                          disabled={isUpdating}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <span>Syncs to:</span>
                          <Badge variant="secondary" className="font-normal">
                            {source.shoppingListName || 'Unknown List'}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        {source.lastSyncError ? (
                          <span className="flex items-center gap-1 text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            Sync error
                          </span>
                        ) : source.lastSyncAt ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            {new Date(source.lastSyncAt).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Never synced</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shopping Lists */}
      <Card>
        <CardHeader>
          <CardTitle>Shopping Lists</CardTitle>
          <CardDescription>
            Connect your Prism shopping lists to Microsoft To-Do
          </CardDescription>
        </CardHeader>
        <CardContent>
          {listsLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading lists...
            </div>
          ) : shoppingLists.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No shopping lists yet. Create one from the Shopping page.
            </div>
          ) : (
            <div className="space-y-2">
              {shoppingLists.map((list) => {
                const connectedSource = sources.find(
                  (s) => s.shoppingListId === list.id
                );

                return (
                  <div
                    key={list.id}
                    className="flex items-center justify-between p-3 rounded-md border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <span className="font-medium">{list.name}</span>
                        {connectedSource && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="#0078D4">
                              <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
                            </svg>
                            <span>Synced with: {connectedSource.externalListName || 'MS To-Do'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!connectedSource && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConnectProvider(list.id)}
                          className="gap-1"
                        >
                          <Link2 className="h-4 w-4" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provider Picker Modal */}
      <Dialog open={showProviderPickerModal} onOpenChange={setShowProviderPickerModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Shopping List</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose which service to sync with{' '}
              <strong>{shoppingLists.find(l => l.id === connectingListId)?.name}</strong>
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowProviderPickerModal(false);
                  if (connectingListId) {
                    window.location.href = `/api/auth/microsoft-tasks?shoppingListId=${connectingListId}&returnSection=shopping`;
                  }
                }}
                className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent transition-colors text-left"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="#0078D4">
                  <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
                </svg>
                <div>
                  <span className="font-medium">Microsoft To-Do</span>
                  <p className="text-xs text-muted-foreground">
                    Sync shopping items as tasks in a To-Do list
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowProviderPickerModal(false);
                setConnectingListId(null);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MS To-Do List Selection Modal */}
      <Dialog open={showMsListModal} onOpenChange={(open) => {
        if (!open) {
          setShowMsListModal(false);
          setMsLists([]);
          setPendingShoppingListId(null);
          window.history.replaceState({}, '', '/settings?section=shopping');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Microsoft To-Do List</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose which Microsoft To-Do list to sync with your shopping list
            </p>
            {loadingMsLists ? (
              <div className="text-center py-4 text-muted-foreground">
                Loading lists from Microsoft To-Do...
              </div>
            ) : msLists.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No lists found in Microsoft To-Do
              </div>
            ) : (
              <div className="space-y-2">
                {msLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => handleSelectMsList(list.id, list.name)}
                    disabled={finalizingConnection}
                    className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent transition-colors text-left disabled:opacity-50"
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="#0078D4">
                      <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
                    </svg>
                    <span className="font-medium">{list.name}</span>
                    {list.isDefault && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        Default
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMsListModal(false);
                setMsLists([]);
                setPendingShoppingListId(null);
                window.history.replaceState({}, '', '/settings?section=shopping');
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
