'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  ExternalLink,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Link2,
  ListTodo,
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

export function TaskIntegrationsSection() {
  const { lists: taskLists, loading: listsLoading, createList } = useTaskLists();
  const [sources, setSources] = useState<TaskSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [updatingSource, setUpdatingSource] = useState<string | null>(null);

  // New list modal
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  // Connect provider modal
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

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

  const handleCreateList = async () => {
    if (!newListName.trim()) return;

    setCreatingList(true);
    try {
      await createList({ name: newListName.trim() });
      setNewListName('');
      setShowNewListModal(false);
    } catch (error) {
      console.error('Failed to create list:', error);
      alert('Failed to create list');
    } finally {
      setCreatingList(false);
    }
  };

  const handleConnectProvider = (provider: string) => {
    setSelectedProvider(provider);

    if (provider === 'microsoft_todo') {
      // Redirect to Microsoft OAuth
      // The OAuth flow will need to include Tasks.ReadWrite scope
      window.location.href = '/api/auth/microsoft?scope=tasks';
    } else {
      setShowConnectModal(true);
    }
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

      {/* Connected Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Sources</CardTitle>
          <CardDescription>
            External task lists syncing with Prism
          </CardDescription>
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
                const sourceCount = sources.filter(
                  (s) => s.taskListId === list.id
                ).length;

                return (
                  <div
                    key={list.id}
                    className="flex items-center justify-between p-3 rounded-md border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: list.color || '#6B7280' }}
                      />
                      <span className="font-medium">{list.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {sourceCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {sourceCount} source{sourceCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
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
    </div>
  );
}
