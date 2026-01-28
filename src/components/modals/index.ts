/**
 * ============================================================================
 * PRISM - Modals Index
 * ============================================================================
 *
 * Re-exports all modal components from a single entry point.
 *
 * USAGE:
 *   import { AddTaskModal, AddMessageModal } from '@/components/modals';
 *
 * ============================================================================
 */

export { AddTaskModal } from './AddTaskModal';
export type { AddTaskModalProps, CreatedTask } from './AddTaskModal';

export { AddMessageModal } from './AddMessageModal';
export type { AddMessageModalProps, CreatedMessage } from './AddMessageModal';

export { AddChoreModal } from './AddChoreModal';
export type { AddChoreModalProps, CreatedChore, ChoreToEdit } from './AddChoreModal';

export { AddShoppingItemModal } from './AddShoppingItemModal';
export type { AddShoppingItemModalProps, CreatedShoppingItem, ShoppingItemToEdit } from './AddShoppingItemModal';

export { AddEventModal } from './AddEventModal';
export type { AddEventModalProps, CreatedEvent, EventToEdit } from './AddEventModal';
