/**
 * Shopping List Integration Types
 *
 * Provider-agnostic interfaces for syncing shopping items with external services
 * like Microsoft To-Do, Todoist, etc.
 */

export interface ExternalShoppingList {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface ExternalShoppingItem {
  id: string;
  listId: string;
  name: string;
  notes?: string | null;
  checked: boolean;
  updatedAt: Date;
  createdAt?: Date;
}

export interface CreateShoppingItemInput {
  listId: string;
  name: string;
  notes?: string | null;
}

export interface UpdateShoppingItemInput {
  name?: string;
  notes?: string | null;
  checked?: boolean;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export interface ShoppingProviderTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Shopping Provider Interface
 *
 * All shopping providers (MS To-Do, Todoist, etc.) must implement this interface.
 * This allows the sync logic to be provider-agnostic.
 */
export interface ShoppingProvider {
  /** Provider identifier (e.g., 'microsoft_todo', 'todoist') */
  readonly providerId: string;

  /** Human-readable provider name */
  readonly displayName: string;

  /**
   * Fetch all lists from the provider (for selecting a shopping list).
   */
  fetchLists(tokens: ShoppingProviderTokens): Promise<ExternalShoppingList[]>;

  /**
   * Fetch all items from a specific list.
   */
  fetchItems(tokens: ShoppingProviderTokens, listId: string): Promise<ExternalShoppingItem[]>;

  /**
   * Create a new item in the provider.
   */
  createItem(tokens: ShoppingProviderTokens, item: CreateShoppingItemInput): Promise<ExternalShoppingItem>;

  /**
   * Update an existing item in the provider.
   */
  updateItem(
    tokens: ShoppingProviderTokens,
    itemId: string,
    listId: string,
    updates: UpdateShoppingItemInput
  ): Promise<ExternalShoppingItem>;

  /**
   * Delete an item from the provider.
   */
  deleteItem(tokens: ShoppingProviderTokens, itemId: string, listId: string): Promise<void>;

  /**
   * Refresh OAuth tokens if expired.
   * Returns new tokens or null if refresh failed.
   */
  refreshTokens?(tokens: ShoppingProviderTokens): Promise<ShoppingProviderTokens | null>;
}

/**
 * Conflict Resolution Strategy
 */
export type ConflictStrategy = 'local_wins' | 'remote_wins' | 'newest_wins';

/**
 * Sync Direction
 */
export type SyncDirection = 'bidirectional' | 'pull_only' | 'push_only';

/**
 * Shopping List Source Configuration (stored in DB)
 */
export interface ShoppingListSourceConfig {
  id: string;
  userId: string;
  provider: string;
  externalListId: string;
  externalListName?: string;
  shoppingListId: string;
  syncEnabled: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  lastSyncAt?: Date;
  lastSyncError?: string;
}
