'use client';

import {
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Link2,
  ExternalLink,
  Cloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { BaseSource, IntegrationConfig, MsList, ProviderInfoEntry } from './types';
import { MS_TODO_ICON_SM, GOOGLE_TASKS_ICON_SM } from './constants';

// ---- StatusBanner ----

export function StatusBanner({
  message,
  onDismiss,
}: {
  message: { type: 'error' | 'success'; text: string };
  onDismiss: () => void;
}) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg flex items-center gap-3',
        message.type === 'error'
          ? 'bg-destructive/10 text-destructive border border-destructive/20'
          : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
      )}
    >
      {message.type === 'error' ? (
        <AlertCircle className="h-5 w-5 shrink-0" />
      ) : (
        <CheckCircle2 className="h-5 w-5 shrink-0" />
      )}
      <span>{message.text}</span>
      <button
        onClick={onDismiss}
        className="ml-auto text-sm underline hover:no-underline"
      >
        Dismiss
      </button>
    </div>
  );
}

// ---- SourceRow ----

export function SourceRow<S extends BaseSource>({
  source,
  providerInfo,
  isSyncing,
  isUpdating,
  onSyncNow,
  onToggleSync,
  onDelete,
  badge,
  extraActions,
}: {
  source: S;
  providerInfo: ProviderInfoEntry;
  isSyncing: boolean;
  isUpdating: boolean;
  onSyncNow: () => void;
  onToggleSync: (enabled: boolean) => void;
  onDelete: () => void;
  badge: { label: string; value: string };
  extraActions?: React.ReactNode;
}) {
  return (
    <div
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
            onClick={onSyncNow}
            disabled={isSyncing || !source.syncEnabled}
          >
            <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
          </Button>

          <Switch
            checked={source.syncEnabled}
            onCheckedChange={onToggleSync}
            disabled={isUpdating}
          />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            disabled={isUpdating}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>{badge.label}:</span>
            <Badge variant="secondary" className="font-normal">
              {badge.value}
            </Badge>
          </div>
          {extraActions}
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
}

// ---- ConnectedSourcesCard ----

export function ConnectedSourcesCard<S extends BaseSource>({
  sources,
  loading,
  syncingAll,
  syncing,
  updatingSource,
  config,
  emptyIcon,
  emptyText,
  emptySubtext,
  onSyncAll,
  onSyncNow,
  onToggleSync,
  onDelete,
  getBadge,
  getExtraActions,
  emptyExtra,
}: {
  sources: S[];
  loading: boolean;
  syncingAll: boolean;
  syncing: string | null;
  updatingSource: string | null;
  config: IntegrationConfig;
  emptyIcon: React.ReactNode;
  emptyText: string;
  emptySubtext: string;
  onSyncAll: () => void;
  onSyncNow: (id: string) => void;
  onToggleSync: (id: string, enabled: boolean) => void;
  onDelete: (id: string, name: string) => void;
  getBadge: (source: S) => { label: string; value: string };
  getExtraActions?: (source: S) => React.ReactNode;
  emptyExtra?: React.ReactNode;
}) {
  const getProviderInfo = (provider: string): ProviderInfoEntry => {
    return config.providers[provider] || {
      name: provider,
      icon: emptyIcon,
      color: '#6B7280',
    };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Connected Sources</CardTitle>
            <CardDescription>
              External lists syncing with Prism
            </CardDescription>
          </div>
          {sources.filter(s => s.syncEnabled).length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncAll}
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
            <p>{emptyText}</p>
            <p className="text-sm mt-1">{emptySubtext}</p>
            {emptyExtra}
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                providerInfo={getProviderInfo(source.provider)}
                isSyncing={syncing === source.id}
                isUpdating={updatingSource === source.id}
                onSyncNow={() => onSyncNow(source.id)}
                onToggleSync={(enabled) => onToggleSync(source.id, enabled)}
                onDelete={() => onDelete(source.id, source.externalListName || 'this source')}
                badge={getBadge(source)}
                extraActions={getExtraActions?.(source)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---- ListSelectionModal ----

export function ListSelectionModal({
  open,
  onClose,
  lists,
  loading,
  finalizingConnection,
  onSelect,
  title,
  description,
  loadingText,
  emptyText,
  listIcon,
}: {
  open: boolean;
  onClose: () => void;
  lists: MsList[];
  loading: boolean;
  finalizingConnection: boolean;
  onSelect: (externalListId: string, externalListName: string) => void;
  title?: string;
  description?: string;
  loadingText?: string;
  emptyText?: string;
  listIcon?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title || 'Select List'}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            {description || 'Choose which list to sync'}
          </p>
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              {loadingText || 'Loading lists...'}
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {emptyText || 'No lists found'}
            </div>
          ) : (
            <div className="space-y-2">
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => onSelect(list.id, list.name)}
                  disabled={finalizingConnection}
                  className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent transition-colors text-left disabled:opacity-50"
                >
                  {listIcon || MS_TODO_ICON_SM}
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated Use ListSelectionModal instead */
export const MsListSelectionModal = ListSelectionModal;

// ---- ProviderPickerModal ----

export function ProviderPickerModal({
  open,
  onClose,
  title,
  description,
  onSelectMsTodo,
  onSelectGoogleTasks,
  disabledProviders,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: React.ReactNode;
  onSelectMsTodo: () => void;
  onSelectGoogleTasks?: () => void;
  disabledProviders?: Array<{
    icon: React.ReactNode;
    name: string;
    label: string;
  }>;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
          <div className="space-y-2">
            <button
              onClick={onSelectMsTodo}
              className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent transition-colors text-left"
            >
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="#0078D4">
                <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
              </svg>
              <div>
                <span className="font-medium">Microsoft To-Do</span>
                <p className="text-xs text-muted-foreground">
                  Sync items as tasks in a To-Do list
                </p>
              </div>
              <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
            </button>

            {onSelectGoogleTasks && (
              <button
                onClick={onSelectGoogleTasks}
                className="w-full flex items-center gap-3 p-3 rounded-md border border-border hover:bg-accent transition-colors text-left"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path d="M22 5.18L10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18z" fill="#4285F4" />
                  <path d="M19.79 20.79H4.21V5.21h8.79V3H4.21C2.99 3 2 3.99 2 5.21v15.58C2 22.01 2.99 23 4.21 23h15.58C21.01 23 22 22.01 22 20.79V12h-2.21v8.79z" fill="#4285F4" />
                </svg>
                <div>
                  <span className="font-medium">Google Tasks</span>
                  <p className="text-xs text-muted-foreground">
                    Sync items with Google Tasks
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
              </button>
            )}

            {disabledProviders?.map((p) => (
              <button
                key={p.name}
                disabled
                className="w-full flex items-center gap-3 p-3 rounded-md border border-border text-left opacity-50 cursor-not-allowed"
              >
                {p.icon}
                <div>
                  <span className="font-medium">{p.name}</span>
                  <p className="text-xs text-muted-foreground">{p.label}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- EntityListCard ----

export function EntityListCard<T extends { id: string; name: string }>({
  title,
  description,
  entities,
  loading: entitiesLoading,
  emptyText,
  entityIcon,
  renderEntityIcon,
  sources,
  getSourceForEntity,
  onConnect,
  headerActions,
  renderEntityActions,
  config,
}: {
  title: string;
  description: string;
  entities: T[];
  loading: boolean;
  emptyText: string;
  entityIcon: React.ReactNode;
  renderEntityIcon?: (entity: T) => React.ReactNode;
  sources: BaseSource[];
  getSourceForEntity: (entity: T) => BaseSource | undefined;
  onConnect: (entityId: string) => void;
  headerActions?: React.ReactNode;
  renderEntityActions?: (entity: T, connectedSource: BaseSource | undefined) => React.ReactNode;
  config?: IntegrationConfig;
}) {
  return (
    <Card>
      <CardHeader className={headerActions ? 'flex flex-row items-center justify-between' : undefined}>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {headerActions}
      </CardHeader>
      <CardContent>
        {entitiesLoading ? (
          <div className="text-center py-4 text-muted-foreground">
            Loading...
          </div>
        ) : entities.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          <div className="space-y-2">
            {entities.map((entity) => {
              const connectedSource = getSourceForEntity(entity);
              return (
                <div
                  key={entity.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border"
                >
                  <div className="flex items-center gap-3">
                    {renderEntityIcon ? renderEntityIcon(entity) : entityIcon}
                    <div>
                      <span className="font-medium">{entity.name}</span>
                      {connectedSource && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          {config?.providers[connectedSource.provider]?.icon || (
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="#0078D4">
                              <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
                            </svg>
                          )}
                          <span>Synced with: {connectedSource.externalListName || config?.providers[connectedSource.provider]?.name || 'External'}</span>
                        </div>
                      )}
                      {/* CalDAV-backed entities don't have a task_source row
                          (the CalDAV calendar_source owns the credentials),
                          so they wouldn't otherwise show a "synced with"
                          label. Fall back to entity.linkedProvider so the
                          user can see "this list is auto-populated from
                          Apple iCloud" without needing to wire CalDAV into
                          task_sources. */}
                      {!connectedSource && (entity as T & { linkedProvider?: string }).linkedProvider === 'caldav' && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Cloud className="h-3 w-3" />
                          <span>From Apple iCloud (read-only)</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {renderEntityActions
                      ? renderEntityActions(entity, connectedSource)
                      : !connectedSource && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onConnect(entity.id)}
                            className="gap-1"
                          >
                            <Link2 className="h-4 w-4" />
                            Connect
                          </Button>
                        )
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Re-export ConfirmDialog for convenience
export { ConfirmDialog };
