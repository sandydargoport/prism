/**
 * Shopping List Integrations
 *
 * Re-exports all shopping list providers and types.
 */

export * from './types';
export { microsoftTodoShoppingProvider } from './microsoft-todo';

import type { ShoppingProvider } from './types';
import { microsoftTodoShoppingProvider } from './microsoft-todo';

/**
 * Map of all available shopping providers by their ID.
 */
export const shoppingProviders: Record<string, ShoppingProvider> = {
  microsoft_todo: microsoftTodoShoppingProvider,
};

/**
 * Get a shopping provider by its ID.
 */
export function getShoppingProvider(providerId: string): ShoppingProvider | null {
  return shoppingProviders[providerId] || null;
}
