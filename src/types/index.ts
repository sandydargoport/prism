/**
 *
 * Re-exports all TypeScript types from a single entry point.
 * This makes type imports cleaner throughout the application.
 *
 * USAGE:
 *   import { User, UserRole, hasPermission } from '@/types';
 *
 */

// User types and permissions
export * from './user';

// Shared domain model types
export * from './models';

// Calendar types
export * from './calendar';
