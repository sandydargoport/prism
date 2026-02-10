/**
 *
 * Central export point for all components in the application.
 * This allows clean imports from a single location.
 *
 * USAGE:
 *   // Import specific components
 *   import { Button, ClockWidget, Dashboard } from '@/components';
 *
 *   // Or import from specific modules for better tree-shaking
 *   import { Button } from '@/components/ui';
 *   import { ClockWidget } from '@/components/widgets';
 *
 */

// UI Components (buttons, inputs, cards, etc.)
export * from './ui';

// Layout Components (grids, containers, headers)
export * from './layout';

// Widget Components (clock, weather, calendar, etc.)
export * from './widgets';

// Authentication Components (PIN pad, etc.)
export * from './auth';

// Dashboard (main dashboard assembly)
export * from './dashboard';
