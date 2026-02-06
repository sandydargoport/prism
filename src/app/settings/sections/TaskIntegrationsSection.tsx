'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  RefreshCw,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Link2,
  ListTodo,
  Pencil,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTaskLists } from '@/lib/hooks/useTaskLists';

interface TaskSource {
  id: string;
  userId: string;
  userName: string | null;
  provider: string;
  externalListId: string;
  externalListName: string | null;
  taskListId: string;
  taskListName: string | null;
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
  todoist: {
    name: 'Todoist',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#E44332">
        <path d="M21 7.5L12 2 3 7.5v9l9 5.5 9-5.5v-9zM12 4l7 4.3v7.4l-7 4.3-7-4.3V8.3L12 4z" />
      </svg>
    ),
    color: '#E44332',
  },
};

const ERROR_MESSAGES: Record<string, string> = {
  microsoft_auth_denied: 'Microsoft authorization was denied or cancelled.',
  microsoft_auth_failed: 'Microsoft authentication failed. Please try again.',
  missing_code: 'Authorization code was missing. Please try again.',
  missing_task_list: 'No task list was selected. Please try again.',
  task_list_not_found: 'The selected task list was not found.',
  no_ms_lists: 'No task lists found in your Microsoft To-Do account.',
};

const SUCCESS_MESSAGES: Record<string, string> = {
  microsoft_tasks_connected: 'Microsoft To-Do connected successfully!',
};

export function TaskIntegrationsSection() {
  const searchParams = useSearchParams();
  const { lists: taskLists, loading: listsLoading, createList, updateList, deleteList } = useTaskLists();
  const [sources, setSources] = useState<TaskSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [updatingSource, setUpdatingSource] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // State for new connection flow (no pre-selected Prism list)
  const [isNewConnection, setIsNewConnection] = useState(false);
  const [selectedMsListForNew, setSelectedMsListForNew] = useState<{ id: string; name: string } | null>(null);
  const [showPrismListPickerModal, setShowPrismListPickerModal] = useState(false);
  const [newPrismListName, setNewPrismListName] = useState('');

  // Check URL params for OAuth results
  useEffect(() => {
    const error = searchParams.get('error');
    const success = searchParams.get('success');
    const section = searchParams.get('section');
    const selectMsList = searchParams.get('selectMsList');
    const taskListId = searchParams.get('taskListId');
    const newConnection = searchParams.get('newConnection');

    if (section === 'tasks') {
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
      } else if (selectMsList === 'true') {
        if (newConnection === 'true') {
          // New connection flow - no pre-selected Prism list
          setIsNewConnection(true);
          fetchMsLists(null, true);
        } else if (taskListId) {
          // Existing list flow
          setIsNewConnection(false);
          setPendingTaskListId(taskListId);
          fetchMsLists(taskListId, false);
        }
      }
    }
  }, [searchParams]);

  const fetchMsLists = async (taskListId: string | null, newConnection: boolean = false) => {
    setLoadingMsLists(true);
    try {
      const url = newConnection
        ? '/api/task-sources/microsoft-lists?newConnection=true'
        : `/api/task-sources/microsoft-lists?taskListId=${taskListId}`;
      const res = await fetch(url);
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
    // If this is a new connection, show the Prism list picker
    if (isNewConnection) {
      setSelectedMsListForNew({ id: externalListId, name: externalListName });
      setShowMsListModal(false);
      setNewPrismListName(externalListName); // Default to same name
      setShowPrismListPickerModal(true);
      return;
    }

    if (!pendingTaskListId) return;

    setFinalizingConnection(true);
    try {
      const res = await fetch('/api/task-sources/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskListId: pendingTaskListId,
          externalListId,
          externalListName,
        }),
      });

      if (res.ok) {
        setShowMsListModal(false);
        setMsLists([]);
        setPendingTaskListId(null);
        setStatusMessage({
          type: 'success',
          text: `Connected to "${externalListName}" in Microsoft To-Do!`,
        });
        await fetchSources();
        // Clear URL params
        window.history.replaceState({}, '', '/settings?section=tasks');
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

  const handleFinalizeNewConnection = async (taskListId: string | null, newListName: string | null) => {
    if (!selectedMsListForNew) return;

    setFinalizingConnection(true);
    try {
      const res = await fetch('/api/task-sources/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskListId: taskListId || undefined,
          newListName: newListName || undefined,
          externalListId: selectedMsListForNew.id,
          externalListName: selectedMsListForNew.name,
          newConnection: true,
        }),
      });

      if (res.ok) {
        setShowPrismListPickerModal(false);
        setSelectedMsListForNew(null);
        setNewPrismListName('');
        setIsNewConnection(false);
        setMsLists([]);
        setStatusMessage({
          type: 'success',
          text: `Connected "${selectedMsListForNew.name}" from Microsoft To-Do!`,
        });
        await fetchSources();
        window.history.replaceState({}, '', '/settings?section=tasks');
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

  // New list modal
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  // Edit list modal
  const [showEditListModal, setShowEditListModal] = useState(false);
  const [editingList, setEditingList] = useState<{ id: string; name: string } | null>(null);
  const [editListName, setEditListName] = useState('');
  const [savingList, setSavingList] = useState(false);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);

  // Connect provider modal
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  // Select list for provider modal
  const [showSelectListModal, setShowSelectListModal] = useState(false);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  // Connect provider to specific list modal
  const [showProviderPickerModal, setShowProviderPickerModal] = useState(false);
  const [connectingListId, setConnectingListId] = useState<string | null>(null);

  // MS To-Do list selection after OAuth
  const [showMsListModal, setShowMsListModal] = useState(false);
  const [msLists, setMsLists] = useState<Array<{ id: string; name: string; isDefault: boolean }>>([]);
  const [loadingMsLists, setLoadingMsLists] = useState(false);
  const [pendingTaskListId, setPendingTaskListId] = useState<string | null>(null);
  const [finalizingConnection, setFinalizingConnection] = useState(false);

  // Change external list for existing source
  const [showChangeListModal, setShowChangeListModal] = useState(false);
  const [changingSourceId, setChangingSourceId] = useState<string | null>(null);
  const [changingSourceLists, setChangingSourceLists] = useState<Array<{ id: string; name: string; isDefault: boolean }>>([]);
  const [loadingSourceLists, setLoadingSourceLists] = useState(false);
  const [savingSourceList, setSavingSourceList] = useState(false);

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/task-sources');
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch (error) {
      console.error('Failed to fetch task sources:', error);
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
      const res = await fetch(`/api/task-sources/${sourceId}`, {
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
    if (!confirm(`Disconnect "${sourceName}"? Tasks already synced will remain in Prism.`)) {
      return;
    }

    setUpdatingSource(sourceId);
    try {
      const res = await fetch(`/api/task-sources/${sourceId}`, {
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
      const res = await fetch(`/api/task-sources/${sourceId}/sync`, {
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
      // Sync all sources in parallel
      const results = await Promise.allSettled(
        enabledSources.map(async (source) => {
          const res = await fetch(`/api/task-sources/${source.id}/sync`, {
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

  const handleChangeSourceList = async (sourceId: string) => {
    setChangingSourceId(sourceId);
    setLoadingSourceLists(true);
    setShowChangeListModal(true);

    try {
      const res = await fetch(`/api/task-sources/${sourceId}/lists`);
      if (res.ok) {
        const data = await res.json();
        setChangingSourceLists(data.lists || []);
      } else {
        const data = await res.json();
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to fetch lists. You may need to reconnect.',
        });
        setShowChangeListModal(false);
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Failed to fetch lists from provider',
      });
      setShowChangeListModal(false);
    } finally {
      setLoadingSourceLists(false);
    }
  };

  const handleSelectNewSourceList = async (externalListId: string, externalListName: string) => {
    if (!changingSourceId) return;

    setSavingSourceList(true);
    try {
      const res = await fetch(`/api/task-sources/${changingSourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ externalListId, externalListName }),
      });

      if (res.ok) {
        setShowChangeListModal(false);
        setChangingSourceId(null);
        setChangingSourceLists([]);
        setStatusMessage({
          type: 'success',
          text: `Now syncing with "${externalListName}"`,
        });
        await fetchSources();
      } else {
        const data = await res.json();
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to update sync settings',
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Failed to update sync settings',
      });
    } finally {
      setSavingSourceList(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;

    setCreatingList(true);
    try {
      await createList({ name: newListName.trim() });
      setNewListName('');
      setShowNewListModal(false);
    } catch (error) {
      console.error('Failed to create list:', error);
      const message = error instanceof Error ? error.message : 'Failed to create list';
      if (message.includes('401') || message.includes('unauthorized')) {
        alert('Please log in first to create a task list.');
      } else {
        alert(message);
      }
    } finally {
      setCreatingList(false);
    }
  };

  const handleConnectProvider = (provider: string) => {
    setSelectedProvider(provider);

    if (provider === 'microsoft_todo') {
      // Go directly to OAuth - user will pick/create Prism list after selecting MS list
      window.location.href = '/api/auth/microsoft-tasks';
    } else {
      setShowConnectModal(true);
    }
  };

  const handleSelectListAndConnect = (listId: string) => {
    setShowSelectListModal(false);

    if (connectingProvider === 'microsoft_todo') {
      // Redirect to Microsoft Tasks OAuth with taskListId
      window.location.href = `/api/auth/microsoft-tasks?taskListId=${listId}`;
    }

    setConnectingProvider(null);
  };

  const handleChangeTaskList = async (sourceId: string, taskListId: string) => {
    setUpdatingSource(sourceId);
    try {
      // Note: Changing task list would require re-mapping tasks
      // For now, we'll just show a message
      alert('Changing the target list requires disconnecting and reconnecting. Tasks already synced will remain in the original list.');
    } finally {
      setUpdatingSource(null);
    }
  };

  const getProviderInfo = (provider: string) => {
    return PROVIDER_INFO[provider] || {
      name: provider,
      icon: <ListTodo className="h-5 w-5" />,
      color: '#6B7280',
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Task Integrations</h2>
        <p className="text-muted-foreground">
          Connect external task apps to sync with Prism
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
                External task lists syncing with Prism
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
              <p>No task sources connected yet</p>
              <p className="text-sm mt-1">
                Connect a provider below to start syncing tasks
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
                            {source.taskListName || 'Default List'}
                          </Badge>
                        </div>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => handleChangeSourceList(source.id)}
                        >
                          Change external list
                        </Button>
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

      {/* Connect Provider */}
      <Card>
        <CardHeader>
          <CardTitle>Connect Task Provider</CardTitle>
          <CardDescription>
            Link an external task app to sync tasks bidirectionally
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button
              onClick={() => handleConnectProvider('microsoft_todo')}
              variant="outline"
              className="w-full justify-start"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#0078D4">
                <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
              </svg>
              <span className="ml-3">Connect Microsoft To-Do</span>
              <ExternalLink className="h-4 w-4 ml-auto" />
            </Button>

            <Button variant="outline" className="w-full justify-start" disabled>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#E44332">
                <path d="M21 7.5L12 2 3 7.5v9l9 5.5 9-5.5v-9zM12 4l7 4.3v7.4l-7 4.3-7-4.3V8.3L12 4z" />
              </svg>
              <span className="ml-3">Connect Todoist</span>
              <span className="text-xs text-muted-foreground ml-2">(Coming soon)</span>
            </Button>

            <Button variant="outline" className="w-full justify-start" disabled>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <span className="ml-3">Connect Apple Reminders</span>
              <span className="text-xs text-muted-foreground ml-2">(Coming soon)</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Task Lists */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Task Lists</CardTitle>
            <CardDescription>
              Organize tasks into lists. External sources sync to a specific list.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowNewListModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New List
          </Button>
        </CardHeader>
        <CardContent>
          {listsLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading lists...
            </div>
          ) : taskLists.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No task lists yet. Create one to organize your tasks.
            </div>
          ) : (
            <div className="space-y-2">
              {taskLists.map((list) => {
                const connectedSource = sources.find(
                  (s) => s.taskListId === list.id && s.provider === 'microsoft_todo'
                );

                return (
                  <div
                    key={list.id}
                    className="flex items-center justify-between p-3 rounded-md border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: list.color || '#6B7280' }}
                      />
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
                      {connectedSource ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setConnectingListId(list.id);
                            setShowProviderPickerModal(true);
                          }}
                        >
                          Change
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setConnectingListId(list.id);
                            setShowProviderPickerModal(true);
                          }}
                          className="gap-1"
                        >
                          <Link2 className="h-4 w-4" />
                          Connect
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingList({ id: list.id, name: list.name });
                          setEditListName(list.name);
                          setShowEditListModal(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={deletingListId === list.id}
                        onClick={async () => {
                          if (!confirm(`Delete "${list.name}"? Tasks in this list will be unassigned.`)) return;
                          setDeletingListId(list.id);
                          try {
                            await deleteList(list.id);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Failed to delete list');
                          } finally {
                            setDeletingListId(null);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New List Modal */}
      <Dialog open={showNewListModal} onOpenChange={setShowNewListModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="listName">List Name</Label>
              <Input
                id="listName"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Work, Personal, Groceries"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newListName.trim()) {
                    handleCreateList();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewListModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateList}
              disabled={!newListName.trim() || creatingList}
            >
              {creatingList ? 'Creating...' : 'Create List'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit List Modal */}
      <Dialog open={showEditListModal} onOpenChange={(open) => {
        setShowEditListModal(open);
        if (!open) {
          setEditingList(null);
          setEditListName('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editListName">List Name</Label>
              <Input
                id="editListName"
                value={editListName}
                onChange={(e) => setEditListName(e.target.value)}
                placeholder="e.g., Work, Personal, Groceries"
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && editListName.trim() && editingList) {
                    setSavingList(true);
                    try {
                      await updateList(editingList.id, { name: editListName.trim() });
                      setShowEditListModal(false);
                      setEditingList(null);
                      setEditListName('');
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Failed to update list');
                    } finally {
                      setSavingList(false);
                    }
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditListModal(false);
              setEditingList(null);
              setEditListName('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!editingList || !editListName.trim()) return;
                setSavingList(true);
                try {
                  await updateList(editingList.id, { name: editListName.trim() });
                  setShowEditListModal(false);
                  setEditingList(null);
                  setEditListName('');
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Failed to update list');
                } finally {
                  setSavingList(false);
                }
              }}
              disabled={!editListName.trim() || savingList}
            >
              {savingList ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect Provider Info Modal */}
      <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {selectedProvider}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">
              This integration is coming soon. Check back later!
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowConnectModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select List Modal (before OAuth redirect) */}
      <Dialog open={showSelectListModal} onOpenChange={setShowSelectListModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Task List</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose which Prism task list to sync with{' '}
              {connectingProvider === 'microsoft_todo' ? 'Microsoft To-Do' : connectingProvider}
            </p>
            <div className="space-y-2">
              {taskLists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => handleSelectListAndConnect(list.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent transition-colors text-left"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: list.color || '#6B7280' }}
                  />
                  <span className="font-medium">{list.name}</span>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSelectListModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MS To-Do List Selection Modal (after OAuth) */}
      <Dialog open={showMsListModal} onOpenChange={(open) => {
        if (!open) {
          setShowMsListModal(false);
          setMsLists([]);
          setPendingTaskListId(null);
          window.history.replaceState({}, '', '/settings?section=tasks');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Microsoft To-Do List</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose which Microsoft To-Do list to sync with your Prism list
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
                setPendingTaskListId(null);
                window.history.replaceState({}, '', '/settings?section=tasks');
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provider Picker Modal (for connecting a specific list) */}
      <Dialog open={showProviderPickerModal} onOpenChange={setShowProviderPickerModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Task Provider</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose which task service to sync with{' '}
              <strong>{taskLists.find(l => l.id === connectingListId)?.name}</strong>
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowProviderPickerModal(false);
                  if (connectingListId) {
                    window.location.href = `/api/auth/microsoft-tasks?taskListId=${connectingListId}`;
                  }
                }}
                className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent transition-colors text-left"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="#0078D4">
                  <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
                </svg>
                <div>
                  <span className="font-medium">Microsoft To-Do</span>
                  <p className="text-xs text-muted-foreground">Sync tasks with Microsoft To-Do</p>
                </div>
              </button>

              <button
                disabled
                className="w-full flex items-center gap-3 p-3 rounded-md border border-border text-left opacity-50 cursor-not-allowed"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="#E44332">
                  <path d="M21 7.5L12 2 3 7.5v9l9 5.5 9-5.5v-9zM12 4l7 4.3v7.4l-7 4.3-7-4.3V8.3L12 4z" />
                </svg>
                <div>
                  <span className="font-medium">Todoist</span>
                  <p className="text-xs text-muted-foreground">Coming soon</p>
                </div>
              </button>

              <button
                disabled
                className="w-full flex items-center gap-3 p-3 rounded-md border border-border text-left opacity-50 cursor-not-allowed"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div>
                  <span className="font-medium">Apple Reminders</span>
                  <p className="text-xs text-muted-foreground">Coming soon</p>
                </div>
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

      {/* Change External List Modal */}
      <Dialog open={showChangeListModal} onOpenChange={(open) => {
        if (!open) {
          setShowChangeListModal(false);
          setChangingSourceId(null);
          setChangingSourceLists([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change External List</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select a different list to sync with
            </p>
            {loadingSourceLists ? (
              <div className="text-center py-4 text-muted-foreground">
                Loading lists from provider...
              </div>
            ) : changingSourceLists.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No lists found
              </div>
            ) : (
              <div className="space-y-2">
                {changingSourceLists.map((list) => (
                  <button
                    key={list.id}
                    onClick={() => handleSelectNewSourceList(list.id, list.name)}
                    disabled={savingSourceList}
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
                setShowChangeListModal(false);
                setChangingSourceId(null);
                setChangingSourceLists([]);
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prism List Picker Modal (for new connections) */}
      <Dialog open={showPrismListPickerModal} onOpenChange={(open) => {
        if (!open) {
          setShowPrismListPickerModal(false);
          setSelectedMsListForNew(null);
          setNewPrismListName('');
          setIsNewConnection(false);
          window.history.replaceState({}, '', '/settings?section=tasks');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Prism List</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Syncing with <strong>{selectedMsListForNew?.name}</strong> from Microsoft To-Do.
              Where should these tasks go in Prism?
            </p>

            <div className="space-y-4">
              {/* Create new list option */}
              <div className="p-3 rounded-md border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Plus className="h-4 w-4" />
                  <span className="font-medium">Create new list</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newPrismListName}
                    onChange={(e) => setNewPrismListName(e.target.value)}
                    placeholder="List name"
                    className="flex-1"
                  />
                  <Button
                    onClick={() => handleFinalizeNewConnection(null, newPrismListName)}
                    disabled={!newPrismListName.trim() || finalizingConnection}
                  >
                    {finalizingConnection ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>

              {/* Existing lists */}
              {taskLists.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Or connect to existing list:</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {taskLists.map((list) => (
                      <button
                        key={list.id}
                        onClick={() => handleFinalizeNewConnection(list.id, null)}
                        disabled={finalizingConnection}
                        className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent transition-colors text-left disabled:opacity-50"
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: list.color || '#6B7280' }}
                        />
                        <span className="font-medium">{list.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPrismListPickerModal(false);
                setSelectedMsListForNew(null);
                setNewPrismListName('');
                setIsNewConnection(false);
                window.history.replaceState({}, '', '/settings?section=tasks');
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
