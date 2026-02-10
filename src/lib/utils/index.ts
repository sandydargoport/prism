/**
 *
 * Re-exports all utility functions from a single entry point.
 * This makes imports cleaner throughout the application.
 *
 * INSTEAD OF:
 *   import { cn } from '@/lib/utils/cn';
 *   import { formatDate } from '@/lib/utils/date';
 *
 * YOU CAN WRITE:
 *   import { cn, formatDate } from '@/lib/utils';
 *
 */

// Class name utility (for Tailwind CSS)
export { cn } from './cn';

// API response formatters
export { formatTaskRow, formatMessageRow, formatMealRow } from './formatters';

// Re-export everything from constants for convenience
export * from '../constants';
