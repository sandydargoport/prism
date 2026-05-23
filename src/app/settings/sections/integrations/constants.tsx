import type { IntegrationConfig } from './types';

const MS_TODO_ICON = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#0078D4">
    <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
  </svg>
);

const MS_TODO_ICON_SM = (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="#0078D4">
    <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
  </svg>
);

const MS_TODO_ICON_XS = (
  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="#0078D4">
    <path d="M0 0h11.377v11.377H0zm12.623 0H24v11.377H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z" />
  </svg>
);

const GOOGLE_TASKS_ICON = (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path d="M22 5.18L10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18z" fill="#4285F4" />
    <path d="M19.79 20.79H4.21V5.21h8.79V3H4.21C2.99 3 2 3.99 2 5.21v15.58C2 22.01 2.99 23 4.21 23h15.58C21.01 23 22 22.01 22 20.79V12h-2.21v8.79z" fill="#4285F4" />
  </svg>
);

const GOOGLE_TASKS_ICON_SM = (
  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
    <path d="M22 5.18L10.59 16.6l-4.24-4.24 1.41-1.41 2.83 2.83 10-10L22 5.18z" fill="#4285F4" />
    <path d="M19.79 20.79H4.21V5.21h8.79V3H4.21C2.99 3 2 3.99 2 5.21v15.58C2 22.01 2.99 23 4.21 23h15.58C21.01 23 22 22.01 22 20.79V12h-2.21v8.79z" fill="#4285F4" />
  </svg>
);

export { MS_TODO_ICON, MS_TODO_ICON_SM, MS_TODO_ICON_XS, GOOGLE_TASKS_ICON, GOOGLE_TASKS_ICON_SM };

const SHARED_ERROR_MESSAGES: Record<string, string> = {
  microsoft_auth_denied: 'Microsoft authorization was denied or cancelled.',
  microsoft_auth_failed: 'Microsoft authentication failed. Please try again.',
  google_tasks_auth_denied: 'Google authorization was denied or cancelled.',
  google_tasks_auth_failed: 'Google authentication failed. Please try again.',
  redis_unavailable: 'Cache service unavailable. Please try again.',
  missing_code: 'Authorization code was missing. Please try again.',
};

export const TASK_CONFIG: IntegrationConfig = {
  section: 'tasks',
  apiBase: '/api/task-sources',
  finalizeEndpoint: '/api/task-sources/finalize',
  oauthEntityParam: 'taskListId',
  returnSection: 'tasks',
  deleteConfirmSuffix: 'Tasks already synced will remain in Prism.',
  providers: {
    microsoft_todo: { name: 'Microsoft To-Do', icon: MS_TODO_ICON, color: '#0078D4' },
    google_tasks: { name: 'Google Tasks', icon: GOOGLE_TASKS_ICON, color: '#4285F4' },
  },
  errorMessages: {
    ...SHARED_ERROR_MESSAGES,
    missing_task_list: 'No task list was selected. Please try again.',
    task_list_not_found: 'The selected task list was not found.',
    no_ms_lists: 'No task lists found in your Microsoft To-Do account.',
    no_google_lists: 'No task lists found in your Google Tasks account.',
  },
  successMessages: {
    microsoft_tasks_connected: 'Microsoft To-Do connected successfully!',
    google_tasks_connected: 'Google Tasks connected successfully!',
  },
};

export const SHOPPING_CONFIG: IntegrationConfig = {
  section: 'shopping',
  apiBase: '/api/shopping-list-sources',
  finalizeEndpoint: '/api/shopping-list-sources/finalize',
  oauthEntityParam: 'shoppingListId',
  returnSection: 'shopping',
  deleteConfirmSuffix: 'Items already synced will remain in Prism.',
  providers: {
    microsoft_todo: { name: 'Microsoft To-Do', icon: MS_TODO_ICON, color: '#0078D4' },
  },
  errorMessages: {
    ...SHARED_ERROR_MESSAGES,
    missing_shopping_list: 'No shopping list was selected. Please try again.',
    shopping_list_not_found: 'The selected shopping list was not found.',
    no_ms_lists: 'No lists found in your Microsoft To-Do account.',
  },
  successMessages: {
    microsoft_shopping_connected: 'Microsoft To-Do connected successfully for shopping!',
  },
};

export const WISH_CONFIG: IntegrationConfig = {
  section: 'wish',
  apiBase: '/api/wish-item-sources',
  finalizeEndpoint: '/api/wish-item-sources/finalize',
  oauthEntityParam: 'wishMemberId',
  returnSection: 'wish',
  deleteConfirmSuffix: 'Items already synced will remain in Prism.',
  providers: {
    microsoft_todo: { name: 'Microsoft To-Do', icon: MS_TODO_ICON, color: '#0078D4' },
  },
  errorMessages: {
    ...SHARED_ERROR_MESSAGES,
  },
  successMessages: {},
};
