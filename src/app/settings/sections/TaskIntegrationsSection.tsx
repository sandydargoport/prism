'use client';

import { useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import {
  Plus,
  Trash2,
  ListTodo,
  Pencil,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { useIntegrationSources } from './integrations/useIntegrationSources';
import { TASK_CONFIG } from './integrations/constants';
import type { TaskSource, MsList } from './integrations/types';
import { GOOGLE_TASKS_ICON_SM, MS_TODO_ICON_SM } from './integrations/constants';
import {
  StatusBanner,
  ConnectedSourcesCard,
  ListSelectionModal,
  ProviderPickerModal,
  EntityListCard,
  ConfirmDialog,
} from './integrations/components';

export function TaskIntegrationsSection() {
  const { lists: taskLists, loading: listsLoading, createList, updateList, deleteList } = useTaskLists();
  const integration = useIntegrationSources<TaskSource>(TASK_CONFIG);

  // Task-specific: new connection flow (no pre-selected Prism list)
  const [selectedMsListForNew, setSelectedMsListForNew] = useState<{ id: string; name: string } | null>(null);
  const [showPrismListPickerModal, setShowPrismListPickerModal] = useState(false);
  const [newPrismListName, setNewPrismListName] = useState('');
  const [finalizingNewConnection, setFinalizingNewConnection] = useState(false);

  // Task-specific: list CRUD modals
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [showEditListModal, setShowEditListModal] = useState(false);
  const [editingList, setEditingList] = useState<{ id: string; name: string } | null>(null);
  const [editListName, setEditListName] = useState('');
  const [savingList, setSavingList] = useState(false);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);

  // Task-specific: change external list
  const [showChangeListModal, setShowChangeListModal] = useState(false);
  const [changingSourceId, setChangingSourceId] = useState<string | null>(null);
  const [changingSourceLists, setChangingSourceLists] = useState<MsList[]>([]);
  const [loadingSourceLists, setLoadingSourceLists] = useState(false);
  const [savingSourceList, setSavingSourceList] = useState(false);

  // Override MS list selection for new connection flow
  const handleSelectMsListOverride = async (externalListId: string, externalListName: string) => {
    if (integration.isNewConnection) {
      setSelectedMsListForNew({ id: externalListId, name: externalListName });
      integration.setShowMsListModal(false);
      setNewPrismListName(externalListName);
      setShowPrismListPickerModal(true);
      return;
    }
    await integration.handleSelectMsList(externalListId, externalListName);
  };

  const handleFinalizeNewConnection = async (taskListId: string | null, newListNameVal: string | null) => {
    if (!selectedMsListForNew) return;

    const providerName = integration.listSelectionProvider === 'google_tasks' ? 'Google Tasks' : 'Microsoft To-Do';

    setFinalizingNewConnection(true);
    try {
      const res = await fetch('/api/task-sources/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskListId: taskListId || undefined,
          newListName: newListNameVal || undefined,
          externalListId: selectedMsListForNew.id,
          externalListName: selectedMsListForNew.name,
          newConnection: true,
          provider: integration.listSelectionProvider,
        }),
      });

      if (res.ok) {
        setShowPrismListPickerModal(false);
        setSelectedMsListForNew(null);
        setNewPrismListName('');
        integration.setStatusMessage({
          type: 'success',
          text: `Connected "${selectedMsListForNew.name}" from ${providerName}!`,
        });
        await integration.fetchSources();
        window.history.replaceState({}, '', '/settings?section=tasks');
      } else {
        const data = await res.json();
        integration.setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to complete connection',
        });
      }
    } catch {
      integration.setStatusMessage({
        type: 'error',
        text: 'Failed to complete connection',
      });
    } finally {
      setFinalizingNewConnection(false);
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
        integration.setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to fetch lists. You may need to reconnect.',
        });
        setShowChangeListModal(false);
      }
    } catch {
      integration.setStatusMessage({
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
        integration.setStatusMessage({
          type: 'success',
          text: `Now syncing with "${externalListName}"`,
        });
        await integration.fetchSources();
      } else {
        const data = await res.json();
        integration.setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to update sync settings',
        });
      }
    } catch {
      integration.setStatusMessage({
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
      const message = error instanceof Error ? error.message : 'Failed to create list';
      if (message.includes('401') || message.includes('unauthorized')) {
        toast({ title: 'Please log in first to create a task list.', variant: 'warning' });
      } else {
        toast({ title: message, variant: 'destructive' });
      }
    } finally {
      setCreatingList(false);
    }
  };

  const handleSaveEditList = async () => {
    if (!editingList || !editListName.trim()) return;
    setSavingList(true);
    try {
      await updateList(editingList.id, { name: editListName.trim() });
      setShowEditListModal(false);
      setEditingList(null);
      setEditListName('');
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed to update list', variant: 'destructive' });
    } finally {
      setSavingList(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Task Sync</h2>
        <p className="text-muted-foreground">
          Manage task list sync with external apps
        </p>
      </div>

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
        config={TASK_CONFIG}
        emptyIcon={<ListTodo className="h-5 w-5" />}
        emptyText="No task sources connected yet"
        emptySubtext="Connect Microsoft To-Do or Google Tasks from your task list below"
        emptyExtra={
          <p className="text-sm mt-1">
            or set up your account in{' '}
            <button
              onClick={() => { window.location.href = '/settings?section=connections'; }}
              className="text-primary hover:underline font-medium"
            >
              Connected Accounts
            </button>
          </p>
        }
        onSyncAll={integration.handleSyncAll}
        onSyncNow={integration.handleSyncNow}
        onToggleSync={integration.handleToggleSync}
        onDelete={integration.handleDeleteSource}
        getBadge={(s) => ({ label: 'Syncs to', value: s.taskListName || 'Default List' })}
        getExtraActions={(source) => (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => handleChangeSourceList(source.id)}
          >
            Change external list
          </Button>
        )}
      />

      <EntityListCard
        title="Task Lists"
        description="Organize tasks into lists. External sources sync to a specific list."
        entities={taskLists}
        loading={listsLoading}
        emptyText="No task lists yet. Create one to organize your tasks."
        entityIcon={<div className="w-3 h-3 rounded-full shrink-0 bg-gray-500" />}
        renderEntityIcon={(list) => (
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: list.color || '#6B7280' }}
          />
        )}
        sources={integration.sources}
        config={TASK_CONFIG}
        getSourceForEntity={(list) =>
          integration.sources.find((s) => s.taskListId === list.id)
        }
        onConnect={integration.handleConnectProvider}
        headerActions={
          <Button size="sm" onClick={() => setShowNewListModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New List
          </Button>
        }
        renderEntityActions={(list, connectedSource) => (
          <>
            {connectedSource ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  integration.handleConnectProvider(list.id);
                }}
              >
                Change
              </Button>
            ) : (list as { linkedProvider?: string }).linkedProvider === 'caldav' ? (
              // CalDAV-backed lists are already sourced from the CalDAV
              // calendar_source — the "From Apple iCloud" badge under the
              // name says so. Hide the Connect button (it would just dump
              // the user into a provider picker that doesn't include
              // CalDAV / Apple as a target).
              null
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => integration.handleConnectProvider(list.id)}
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
                if (!await integration.confirm(`Delete "${list.name}"?`, 'Tasks in this list will be unassigned.')) return;
                setDeletingListId(list.id);
                try {
                  await deleteList(list.id);
                } catch (err) {
                  toast({ title: err instanceof Error ? err.message : 'Failed to delete list', variant: 'destructive' });
                } finally {
                  setDeletingListId(null);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      />

      {/* Provider Picker Modal */}
      <ProviderPickerModal
        open={integration.showProviderPickerModal}
        onClose={integration.closeProviderPickerModal}
        title="Connect Task Provider"
        description={
          <>
            Choose which task service to sync with{' '}
            <strong>{taskLists.find(l => l.id === integration.connectingEntityId)?.name}</strong>
          </>
        }
        onSelectMsTodo={() => {
          integration.setShowProviderPickerModal(false);
          if (integration.connectingEntityId) {
            window.location.href = `/api/auth/microsoft-tasks?taskListId=${integration.connectingEntityId}`;
          }
        }}
        onSelectGoogleTasks={() => {
          integration.setShowProviderPickerModal(false);
          if (integration.connectingEntityId) {
            window.location.href = `/api/auth/google-tasks?taskListId=${integration.connectingEntityId}`;
          }
        }}
        disabledProviders={[]}
      />

      {/* External List Selection Modal */}
      <ListSelectionModal
        open={integration.showMsListModal}
        onClose={integration.closeMsListModal}
        lists={integration.msLists}
        loading={integration.loadingMsLists}
        finalizingConnection={integration.finalizingConnection}
        onSelect={handleSelectMsListOverride}
        title={integration.listSelectionProvider === 'google_tasks' ? 'Select Google Tasks List' : 'Select Microsoft To-Do List'}
        description={integration.listSelectionProvider === 'google_tasks'
          ? 'Choose which Google Tasks list to sync with your Prism list'
          : 'Choose which Microsoft To-Do list to sync with your Prism list'}
        loadingText={integration.listSelectionProvider === 'google_tasks'
          ? 'Loading lists from Google Tasks...'
          : 'Loading lists from Microsoft To-Do...'}
        emptyText={integration.listSelectionProvider === 'google_tasks'
          ? 'No lists found in Google Tasks'
          : 'No lists found in Microsoft To-Do'}
        listIcon={integration.listSelectionProvider === 'google_tasks' ? GOOGLE_TASKS_ICON_SM : MS_TODO_ICON_SM}
      />

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
                  if (e.key === 'Enter' && newListName.trim()) handleCreateList();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewListModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateList} disabled={!newListName.trim() || creatingList}>
              {creatingList ? 'Creating...' : 'Create List'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit List Modal */}
      <Dialog open={showEditListModal} onOpenChange={(open) => {
        setShowEditListModal(open);
        if (!open) { setEditingList(null); setEditListName(''); }
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editListName.trim()) handleSaveEditList();
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
            <Button onClick={handleSaveEditList} disabled={!editListName.trim() || savingList}>
              {savingList ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change External List Modal */}
      <ListSelectionModal
        open={showChangeListModal}
        onClose={() => {
          setShowChangeListModal(false);
          setChangingSourceId(null);
          setChangingSourceLists([]);
        }}
        lists={changingSourceLists}
        loading={loadingSourceLists}
        finalizingConnection={savingSourceList}
        onSelect={handleSelectNewSourceList}
        title="Change External List"
        description="Select a different list to sync with"
      />

      {/* Prism List Picker Modal (for new connections) */}
      <Dialog open={showPrismListPickerModal} onOpenChange={(open) => {
        if (!open) {
          setShowPrismListPickerModal(false);
          setSelectedMsListForNew(null);
          setNewPrismListName('');
          // isNewConnection is managed by the shared hook
          window.history.replaceState({}, '', '/settings?section=tasks');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Prism List</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Syncing with <strong>{selectedMsListForNew?.name}</strong> from{' '}
              {integration.listSelectionProvider === 'google_tasks' ? 'Google Tasks' : 'Microsoft To-Do'}.
              Where should these tasks go in Prism?
            </p>

            <div className="space-y-4">
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
                    disabled={!newPrismListName.trim() || finalizingNewConnection}
                  >
                    {finalizingNewConnection ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>

              {taskLists.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Or connect to existing list:</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {taskLists.map((list) => (
                      <button
                        key={list.id}
                        onClick={() => handleFinalizeNewConnection(list.id, null)}
                        disabled={finalizingNewConnection}
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
                // isNewConnection is managed by the shared hook
                window.history.replaceState({}, '', '/settings?section=tasks');
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...integration.confirmDialogProps} />
    </div>
  );
}
