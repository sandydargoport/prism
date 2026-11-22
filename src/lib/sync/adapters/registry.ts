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
import { testTandoorConnection, checkTandoorWriteAccess } from '@/lib/integrations/tandoor';
import { testMealieConnection, checkMealieWriteAccess } from '@/lib/integrations/mealie';

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

/**
 * Whether a source's token can write back to the provider (#1205). Never
 * throws: an unknown provider or a failed check reports false, and reading is
 * unaffected either way.
 */
export async function checkProviderWriteAccess(
  provider: string,
  serverUrl: string,
  token: string,
): Promise<boolean> {
  const check = provider === 'tandoor' ? checkTandoorWriteAccess(serverUrl, token)
    : provider === 'mealie' ? checkMealieWriteAccess(serverUrl, token)
      : Promise.resolve(false);
  // A server that never answers reads as "can't write", not a hung request.
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), WRITE_CHECK_TIMEOUT_MS).unref?.());
  return Promise.race([check, timeout]);
}

const WRITE_CHECK_TIMEOUT_MS = 6000;
