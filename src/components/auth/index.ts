/**
 *
 * Re-exports all authentication-related components from a single entry point.
 *
 * USAGE:
 *   import { PinPad, FamilyMember } from '@/components/auth';
 *
 */

// PIN Pad Authentication
export { PinPad } from './PinPad';
export type { PinPadProps, FamilyMember } from './PinPad';

// Quick PIN Modal (for action authentication)
export { QuickPinModal } from './QuickPinModal';
export type { QuickPinModalProps, QuickPinMember } from './QuickPinModal';
