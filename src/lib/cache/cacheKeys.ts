/**
 * Centralized cache key definitions and invalidation helpers.
 *
 * Use `invalidateEntity(entity)` instead of ad-hoc `invalidateCache('entity:*')` calls.
 * This ensures cross-entity dependencies are always invalidated together.
 *
 * Example:
 *   // Before:
 *   await invalidateCache('chores:*');
 *   await invalidateCache('points:*');
 *   await invalidateCache('goals:*');
 *
 *   // After:
 *   await invalidateEntity('chores');
 */

import { invalidateCache } from './redis';

// ---- Entity types ----

export type CacheEntity =
  | 'family'
  | 'chores'
  | 'tasks'
  | 'task-lists'
  | 'task-sources'
  | 'shopping-lists'
  | 'shopping-list-sources'
  | 'events'
  | 'calendar-groups'
  | 'calendar-notes'
  | 'meals'
  | 'recipes'
  | 'goals'
  | 'points'
  | 'wish-items'
  | 'wish-item-sources'
  | 'birthdays'
  | 'messages'
  | 'photos'
  | 'babysitter-info'
  | 'bus'
  | 'weather'
  | 'settings'
  | 'layouts'
  | 'maintenance'
  | 'gift-ideas'
  | 'audit-logs'
  | 'travel'
  | 'weekend';

/**
 * Cross-entity invalidation graph.
 *
 * When an entity changes, these additional entities must also be invalidated
 * because they contain derived or joined data.
 *
 * Example: completing a chore updates points and may affect goal progress.
 */
const CROSS_INVALIDATIONS: Partial<Record<CacheEntity, CacheEntity[]>> = {
  chores: ['points', 'goals'],
  tasks: ['points'],
  'wish-items': ['wish-item-sources'],
  'task-lists': ['tasks', 'task-sources'],
  'shopping-lists': ['shopping-list-sources'],
  // Events carry their calendar group's and member's colour and name;
  // messages carry the author's (#1226).
  'calendar-groups': ['events'],
  family: ['chores', 'tasks', 'events', 'messages'],
};

/**
 * Invalidate all cache keys for an entity, including cross-dependencies.
 *
 * Replaces: `await invalidateCache('entity:*')`
 * With:     `await invalidateEntity('entity')`
 */
export async function invalidateEntity(
  entity: CacheEntity,
  visited: Set<CacheEntity> = new Set()
): Promise<void> {
  if (visited.has(entity)) return;
  visited.add(entity);

  await invalidateCache(`${entity}:*`);

  const deps = CROSS_INVALIDATIONS[entity];
  if (deps) {
    await Promise.all(deps.map((dep) => invalidateEntity(dep, visited)));
  }
}

/**
 * Invalidate multiple entities at once.
 */
export async function invalidateEntities(...entities: CacheEntity[]): Promise<void> {
  const visited = new Set<CacheEntity>();
  await Promise.all(entities.map((e) => invalidateEntity(e, visited)));
}
