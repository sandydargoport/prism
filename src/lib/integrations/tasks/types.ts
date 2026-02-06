/**
 * Task Integration Types
 *
 * Provider-agnostic interfaces for syncing tasks with external services
 * like Microsoft To-Do, Todoist, Apple Reminders, etc.
 */

export interface ExternalTaskList {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface ExternalTask {
  id: string;
  listId: string;
  title: string;
  description?: string | null;
  dueDate?: Date | null;
  completed: boolean;
  completedAt?: Date | null;
  priority?: 'high' | 'medium' | 'low' | null;
  updatedAt: Date;
  createdAt?: Date;
}

export interface CreateTaskInput {
  listId: string;
  title: string;
  description?: string | null;
  dueDate?: Date | null;
  priority?: 'high' | 'medium' | 'low' | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  dueDate?: Date | null;
  completed?: boolean;
  priority?: 'high' | 'medium' | 'low' | null;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

export interface TaskProviderTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Task Provider Interface
 *
 * All task providers (MS To-Do, Todoist, etc.) must implement this interface.
 * This allows the sync logic to be provider-agnostic.
 */
export interface TaskProvider {
  /** Provider identifier (e.g., 'microsoft_todo', 'todoist') */
  readonly providerId: string;

  /** Human-readable provider name */
  readonly displayName: string;

  /**
   * Fetch all task lists from the provider.
   */
  fetchLists(tokens: TaskProviderTokens): Promise<ExternalTaskList[]>;

  /**
   * Fetch all tasks from a specific list.
   */
  fetchTasks(tokens: TaskProviderTokens, listId: string): Promise<ExternalTask[]>;

  /**
   * Create a new task in the provider.
   */
  createTask(tokens: TaskProviderTokens, task: CreateTaskInput): Promise<ExternalTask>;

  /**
   * Update an existing task in the provider.
   */
  updateTask(tokens: TaskProviderTokens, taskId: string, updates: UpdateTaskInput): Promise<ExternalTask>;

  /**
   * Delete a task from the provider.
   */
  deleteTask(tokens: TaskProviderTokens, taskId: string): Promise<void>;

  /**
   * Refresh OAuth tokens if expired.
   * Returns new tokens or null if refresh failed.
   */
  refreshTokens?(tokens: TaskProviderTokens): Promise<TaskProviderTokens | null>;
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
 * Task Source Configuration (stored in DB)
 */
export interface TaskSourceConfig {
  id: string;
  userId: string;
  provider: string;
  externalListId: string;
  externalListName?: string;
  taskListId: string;
  syncEnabled: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  lastSyncAt?: Date;
  lastSyncError?: string;
}
