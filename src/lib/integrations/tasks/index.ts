export * from './types';
export { microsoftTodoProvider } from './microsoft-todo';

import { microsoftTodoProvider } from './microsoft-todo';
import type { TaskProvider } from './types';

/**
 * Registry of all available task providers.
 * Add new providers here as they are implemented.
 */
export const taskProviders: Record<string, TaskProvider> = {
  microsoft_todo: microsoftTodoProvider,
  // todoist: todoistProvider,  // TODO: Implement
  // apple_reminders: appleRemindersProvider,  // TODO: Implement
};

/**
 * Get a task provider by its ID.
 */
export function getTaskProvider(providerId: string): TaskProvider | undefined {
  return taskProviders[providerId];
}
