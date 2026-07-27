/**
 * Provider registry — maps a recipe source's `provider` onto its sync adapters
 * and connection test. The framework routes (connect, sync, meal-sync) resolve
 * adapters through here so adding a provider is one entry, not new routes.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EntitySyncAdapter } from '../types';
import { tandoorRecipeAdapter } from './tandoorRecipes';
import { tandoorMealPlanAdapter } from './tandoorMealPlan';
import { mealieRecipeAdapter } from './mealieRecipes';
import { mealieMealPlanAdapter } from './mealieMealPlan';
import { testTandoorConnection } from '@/lib/integrations/tandoor';
import { testMealieConnection } from '@/lib/integrations/mealie';

export const SUPPORTED_PROVIDERS = ['tandoor', 'mealie'] as const;
export type Provider = (typeof SUPPORTED_PROVIDERS)[number];

export function isSupportedProvider(p: string): p is Provider {
  return (SUPPORTED_PROVIDERS as readonly string[]).includes(p);
}

export function getRecipeAdapter(provider: string): EntitySyncAdapter<any> {
  if (provider === 'tandoor') return tandoorRecipeAdapter;
  if (provider === 'mealie') return mealieRecipeAdapter;
  throw new Error(`Recipe sync is not supported for "${provider}".`);
}

export function getMealPlanAdapter(provider: string): EntitySyncAdapter<any> {
  if (provider === 'tandoor') return tandoorMealPlanAdapter;
  if (provider === 'mealie') return mealieMealPlanAdapter;
  throw new Error(`Meal-plan sync is not supported for "${provider}".`);
}

/** Verify a connection for the given provider (throws on failure). */
export async function testProviderConnection(
  provider: string,
  serverUrl: string,
  token: string,
): Promise<void> {
  if (provider === 'tandoor') {
    await testTandoorConnection(serverUrl, token);
    return;
  }
  if (provider === 'mealie') {
    await testMealieConnection(serverUrl, token);
    return;
  }
  throw new Error(`Unsupported provider "${provider}".`);
}
