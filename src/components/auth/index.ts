/**
 *
 * Re-exports all authentication-related components from a single entry point.
 *
 * USAGE:
 *   import { QuickPinModal, type QuickPinMember } from '@/components/auth';
 *
 */

// Quick PIN Modal — the app's login + action-authentication surface.
export { QuickPinModal } from './QuickPinModal';
export type { QuickPinModalProps, QuickPinMember } from './QuickPinModal';
