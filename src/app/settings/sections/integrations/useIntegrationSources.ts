'use client';

import { useState, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { useSearchParams } from 'next/navigation';
import type { BaseSource, IntegrationConfig, MsList } from './types';
import { useFetchOnMount } from '@/lib/hooks/useFetchOnMount';
import { useResetOn } from '@/lib/hooks/useResetOn';

type StatusMessage = { type: 'error' | 'success'; text: string };

const LISTS_FAILURE = 'Failed to fetch lists from provider';
const MS_LISTS_FAILURE = 'Failed to fetch Microsoft To-Do lists';

function msListsUrl(config: IntegrationConfig, entityId: string): string {
  return `/api/task-sources/microsoft-lists?${config.oauthEntityParam}=${entityId}`;
}

/** What an OAuth redirect back to Settings asks this hook to do. */
export type OAuthLanding = {
  status?: StatusMessage;
  provider?: 'microsoft_todo' | 'google_tasks';
  isNewConnection?: boolean;
  entityId?: string;
  lists?: { url: string; failure: string };
};

/**
 * Read an OAuth redirect's result from the URL, or null when the URL is not
 * one this hook answers.
 *
 * It answers when the URL targets either the legacy section this hook backs
 * (config.section) or the Integrations page it is now embedded in, so one
 * hook instance handles both standalone and embedded use.
 */
export function readOAuthLanding(
  params: Pick<URLSearchParams, 'get'>,
  config: IntegrationConfig,
): OAuthLanding | null {
  const section = params.get('section');
  if (section !== config.section && section !== 'integrations') return null;
  const error = params.get('error');
  const success = params.get('success');
  const entityId = params.get(config.oauthEntityParam);
  const newConnection = params.get('newConnection') === 'true';

  if (error) {
    return { status: { type: 'error', text: config.errorMessages[error] || `Error: ${error}` } };
  }
  if (success) {
    return { status: { type: 'success', text: config.successMessages[success] || 'Operation completed successfully!' } };
  }
  // Each list flow is skipped by an instance filtered to the other provider
  // (several instances are embedded under different cards).
  if (params.get('selectGoogleTasksList') === 'true') {
    if (config.respondsToProvider && config.respondsToProvider !== 'google_tasks') return null;
    if (newConnection) {
      return { provider: 'google_tasks', isNewConnection: true, lists: { url: '/api/task-sources/google-lists', failure: LISTS_FAILURE } };
    }
    if (entityId) {
      return {
        provider: 'google_tasks', isNewConnection: false, entityId,
        lists: { url: `/api/task-sources/google-lists?taskListId=${entityId}`, failure: LISTS_FAILURE },
      };
    }
    return { provider: 'google_tasks' };
  }
  if (params.get('selectMsList') === 'true') {
    if (config.respondsToProvider && config.respondsToProvider !== 'microsoft_todo') return null;
    if (newConnection) {
      return {
        provider: 'microsoft_todo', isNewConnection: true,
        lists: { url: '/api/task-sources/microsoft-lists?newConnection=true', failure: LISTS_FAILURE },
      };
    }
    if (entityId) {
      return { provider: 'microsoft_todo', isNewConnection: false, entityId, lists: { url: msListsUrl(config, entityId), failure: MS_LISTS_FAILURE } };
    }
    return { provider: 'microsoft_todo' };
  }
  return null;
}

export interface UseIntegrationSourcesResult<S extends BaseSource> {
  sources: S[];
  loading: boolean;
  syncing: string | null;
  syncingAll: boolean;
  updatingSource: string | null;
  statusMessage: { type: 'error' | 'success'; text: string } | null;
  setStatusMessage: (msg: { type: 'error' | 'success'; text: string } | null) => void;

  // MS List modal state
  showMsListModal: boolean;
  setShowMsListModal: (v: boolean) => void;
  msLists: MsList[];
  loadingMsLists: boolean;
  finalizingConnection: boolean;
  pendingEntityId: string | null;

  // New connection flag (for tasks OAuth without pre-selected entity)
  isNewConnection: boolean;

  // Which provider the list selection modal is for
  listSelectionProvider: 'microsoft_todo' | 'google_tasks';

  // Provider picker modal state
  showProviderPickerModal: boolean;
  setShowProviderPickerModal: (v: boolean) => void;
  connectingEntityId: string | null;

  // Actions
  fetchSources: () => Promise<void>;
  handleToggleSync: (sourceId: string, enabled: boolean) => Promise<void>;
  handleDeleteSource: (sourceId: string, sourceName: string) => Promise<void>;
  handleSyncNow: (sourceId: string) => Promise<void>;
  handleSyncAll: () => Promise<void>;
  fetchMsLists: (entityId: string) => Promise<void>;
  handleSelectMsList: (externalListId: string, externalListName: string) => Promise<void>;
  handleConnectProvider: (entityId: string) => void;
  closeMsListModal: () => void;
  closeProviderPickerModal: () => void;

  // Confirm dialog
  confirm: (title: string, description?: string) => Promise<boolean>;
  confirmDialogProps: ReturnType<typeof useConfirmDialog>['dialogProps'];
}

export function useIntegrationSources<S extends BaseSource>(
  config: IntegrationConfig
): UseIntegrationSourcesResult<S> {
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();
  const searchParams = useSearchParams();

  const [sources, setSources] = useState<S[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [updatingSource, setUpdatingSource] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // MS List modal
  const [showMsListModal, setShowMsListModal] = useState(false);
  const [msLists, setMsLists] = useState<MsList[]>([]);
  const [loadingMsLists, setLoadingMsLists] = useState(false);
  const [pendingEntityId, setPendingEntityId] = useState<string | null>(null);
  const [finalizingConnection, setFinalizingConnection] = useState(false);

  // Provider picker modal
  const [showProviderPickerModal, setShowProviderPickerModal] = useState(false);
  const [connectingEntityId, setConnectingEntityId] = useState<string | null>(null);

  // newConnection flag (tasks-specific: OAuth callback without a pre-selected entity)
  const [isNewConnection, setIsNewConnection] = useState(false);

  // Provider for current list selection flow
  const [listSelectionProvider, setListSelectionProvider] = useState<'microsoft_todo' | 'google_tasks'>('microsoft_todo');

  const loadLists = useCallback(async (url: string, failure: string) => {
    setLoadingMsLists(true);
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMsLists(data.lists || []);
        setShowMsListModal(true);
      } else {
        const data = await res.json();
        setStatusMessage({ type: 'error', text: data.error || failure });
      }
    } catch {
      setStatusMessage({ type: 'error', text: failure });
    } finally {
      setLoadingMsLists(false);
    }
  }, []);

  const fetchMsListsInternal = (entityId: string) =>
    loadLists(msListsUrl(config, entityId), MS_LISTS_FAILURE);

  // An OAuth redirect back to Settings carries its result in the URL. The
  // state it asks for is set during render, in the render that first sees the
  // new URL; the list fetch it may ask for runs as a request.
  const landing = readOAuthLanding(searchParams, config);
  useResetOn(searchParams.toString(), () => {
    if (!landing) return;
    if (landing.status) setStatusMessage(landing.status);
    if (landing.provider) setListSelectionProvider(landing.provider);
    if (landing.isNewConnection !== undefined) setIsNewConnection(landing.isNewConnection);
    if (landing.entityId) setPendingEntityId(landing.entityId);
  });
  const landingListsUrl = landing?.lists?.url ?? null;
  const landingListsFailure = landing?.lists?.failure ?? '';
  const fetchLandingLists = useCallback(async () => {
    if (landingListsUrl) await loadLists(landingListsUrl, landingListsFailure);
  }, [landingListsUrl, landingListsFailure, loadLists]);
  useFetchOnMount(fetchLandingLists);

  const fetchSources = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(config.apiBase);
      if (res.ok) {
        const data = await res.json();
        setSources(data);
      }
    } catch (error) {
      console.error(`Failed to fetch sources:`, error);
    } finally {
      setLoading(false);
    }
  }, [config.apiBase]);

  useFetchOnMount(fetchSources);

  const fetchMsLists = async (entityId: string) => {
    setPendingEntityId(entityId);
    await fetchMsListsInternal(entityId);
  };

  const handleSelectMsList = async (externalListId: string, externalListName: string) => {
    if (!pendingEntityId) return;

    const providerName = listSelectionProvider === 'google_tasks' ? 'Google Tasks' : 'Microsoft To-Do';

    setFinalizingConnection(true);
    try {
      const body: Record<string, string> = {
        externalListId,
        externalListName,
        provider: listSelectionProvider,
      };
      // Map the entity param to its finalize body key
      if (config.oauthEntityParam === 'taskListId') body.taskListId = pendingEntityId;
      else if (config.oauthEntityParam === 'shoppingListId') body.shoppingListId = pendingEntityId;
      else if (config.oauthEntityParam === 'wishMemberId') body.memberId = pendingEntityId;

      const res = await fetch(config.finalizeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowMsListModal(false);
        setMsLists([]);
        setPendingEntityId(null);
        setStatusMessage({
          type: 'success',
          text: `Connected to "${externalListName}" in ${providerName}!`,
        });
        await fetchSources();
        // Preserve whichever section the user is currently on (legacy task/shopping/wish
// vs the embedded-in-integrations case) instead of forcing back to config.section.
{
  const url = new URL(window.location.href);
  for (const k of ['selectMsList', 'selectGoogleTasksList', 'newConnection', 'taskListId', 'shoppingListId', 'wishMemberId']) {
    url.searchParams.delete(k);
  }
  window.history.replaceState({}, '', url.toString());
}
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

  const handleToggleSync = async (sourceId: string, enabled: boolean) => {
    setUpdatingSource(sourceId);
    try {
      const res = await fetch(`${config.apiBase}/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncEnabled: enabled }),
      });
      if (res.ok) {
        setSources((prev) =>
          prev.map((s) => (s.id === sourceId ? { ...s, syncEnabled: enabled } : s)) as S[]
        );
      }
    } catch (error) {
      console.error('Failed to update source:', error);
    } finally {
      setUpdatingSource(null);
    }
  };

  const handleDeleteSource = async (sourceId: string, sourceName: string) => {
    if (!await confirm(`Disconnect "${sourceName}"?`, config.deleteConfirmSuffix)) {
      return;
    }

    setUpdatingSource(sourceId);
    try {
      const res = await fetch(`${config.apiBase}/${sourceId}`, { method: 'DELETE' });
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
      const res = await fetch(`${config.apiBase}/${sourceId}/sync`, { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        await fetchSources();
        const msg = `Sync complete: ${data.created} created, ${data.updated} updated, ${data.deleted} deleted`;
        if (data.errors?.length > 0) {
          toast({ title: msg, description: data.errors.join('\n'), variant: 'warning' });
        }
      } else {
        toast({ title: `Sync failed: ${data.error || 'Unknown error'}`, variant: 'destructive' });
        await fetchSources();
      }
    } catch (error) {
      console.error('Failed to sync:', error);
      toast({ title: 'Sync failed: Network error', variant: 'destructive' });
    } finally {
      setSyncing(null);
    }
  };

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
          const res = await fetch(`${config.apiBase}/${source.id}/sync`, { method: 'POST' });
          const data = await res.json();
          if (res.ok) {
            return { success: true as const, data, sourceName: source.externalListName };
          } else {
            return { success: false as const, error: data.error, sourceName: source.externalListName };
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
        setStatusMessage({ type: 'error', text: `${msg} (with errors)` });
      } else {
        setStatusMessage({ type: 'success', text: msg });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Sync all failed' });
    } finally {
      setSyncingAll(false);
    }
  };

  const handleConnectProvider = (entityId: string) => {
    setConnectingEntityId(entityId);
    setShowProviderPickerModal(true);
  };

  const closeMsListModal = () => {
    setShowMsListModal(false);
    setMsLists([]);
    setPendingEntityId(null);
    // Preserve whichever section the user is currently on (legacy task/shopping/wish
// vs the embedded-in-integrations case) instead of forcing back to config.section.
{
  const url = new URL(window.location.href);
  for (const k of ['selectMsList', 'selectGoogleTasksList', 'newConnection', 'taskListId', 'shoppingListId', 'wishMemberId']) {
    url.searchParams.delete(k);
  }
  window.history.replaceState({}, '', url.toString());
}
  };

  const closeProviderPickerModal = () => {
    setShowProviderPickerModal(false);
    setConnectingEntityId(null);
  };

  return {
    sources,
    loading,
    syncing,
    syncingAll,
    updatingSource,
    statusMessage,
    setStatusMessage,
    isNewConnection,
    listSelectionProvider,
    showMsListModal,
    setShowMsListModal,
    msLists,
    loadingMsLists,
    finalizingConnection,
    pendingEntityId,
    showProviderPickerModal,
    setShowProviderPickerModal,
    connectingEntityId,
    fetchSources,
    handleToggleSync,
    handleDeleteSource,
    handleSyncNow,
    handleSyncAll,
    fetchMsLists,
    handleSelectMsList,
    handleConnectProvider,
    closeMsListModal,
    closeProviderPickerModal,
    confirm,
    confirmDialogProps,
  };
}
