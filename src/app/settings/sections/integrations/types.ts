import type React from 'react';

export interface BaseSource {
  id: string;
  userId: string;
  userName: string | null;
  provider: string;
  externalListId: string;
  externalListName: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

export interface TaskSource extends BaseSource {
  taskListId: string;
  taskListName: string | null;
}

export interface ShoppingListSource extends BaseSource {
  shoppingListId: string;
  shoppingListName: string | null;
}

export interface WishItemSource extends BaseSource {
  memberId: string;
  memberName: string | null;
}

export interface ProviderInfoEntry {
  name: string;
  icon: React.ReactNode;
  color: string;
}

export interface IntegrationConfig {
  /** Section key used in URL params (e.g. 'tasks', 'shopping', 'wish') */
  section: string;
  /** API base path for sources (e.g. '/api/task-sources') */
  apiBase: string;
  /** API path for finalizing a new connection */
  finalizeEndpoint: string;
  /** Query param name sent when starting OAuth (e.g. 'taskListId', 'shoppingListId', 'wishMemberId') */
  oauthEntityParam: string;
  /** Return section value used in OAuth redirect */
  returnSection: string;
  /** Label shown when confirming delete */
  deleteConfirmSuffix: string;
  /** Provider info map */
  providers: Record<string, ProviderInfoEntry>;
  /** Error message map */
  errorMessages: Record<string, string>;
  /** Success message map */
  successMessages: Record<string, string>;
  /**
   * Limit this hook instance to respond only to a specific provider's URL
   * triggers (`selectMsList=true` vs `selectGoogleTasksList=true`). Set
   * when the same legacy section is embedded inside multiple provider
   * cards — without this, every instance would pop its modal on any
   * trigger. Unset = legacy behavior, respond to both.
   */
  respondsToProvider?: 'microsoft_todo' | 'google_tasks';
}

export interface MsList {
  id: string;
  name: string;
  isDefault: boolean;
}
