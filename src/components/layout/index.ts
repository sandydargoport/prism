/**
 *
 * Re-exports all layout-related components from a single entry point.
 *
 * USAGE:
 *   import { DashboardGrid, DashboardLayout, DashboardHeader } from '@/components/layout';
 *
 */

export {
  DashboardGrid,
  DashboardLayout,
  DashboardHeader,
} from './DashboardGrid';

export type {
  DashboardGridProps,
  DashboardHeaderProps,
} from './DashboardGrid';

export { SideNav } from './SideNav';
export type { SideNavProps } from './SideNav';

export { AppShell } from './AppShell';
export type { AppShellProps } from './AppShell';

export { PageWrapper } from './PageWrapper';
export type { PageWrapperProps } from './PageWrapper';

export { MobileNav } from './MobileNav';
