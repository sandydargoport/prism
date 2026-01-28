/**
 * ============================================================================
 * PRISM - User Type Definitions
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Defines TypeScript types for users, family members, and permissions.
 * These types ensure consistency across the entire application.
 *
 * WHY TYPES MATTER:
 * TypeScript types catch errors at compile time rather than runtime.
 * For example, if you try to access user.roll instead of user.role,
 * TypeScript will show an error immediately in your editor.
 *
 * HOW TO USE THESE TYPES:
 * Import and use them in your components and functions:
 *
 *   import { User, UserRole } from '@/types/user';
 *
 *   function greetUser(user: User) {
 *     console.log(`Hello, ${user.name}!`);
 *   }
 *
 * WHEN TO MODIFY:
 * - Adding new user properties
 * - Adding new permission types
 * - Changing the family structure
 *
 * ============================================================================
 */


/**
 * USER ROLE
 * ============================================================================
 * Defines the possible roles a user can have.
 * Each role has different permissions (defined in PERMISSIONS below).
 *
 * ROLES:
 * - parent: Full admin access, can modify all settings
 * - child: Limited access, can manage own tasks/chores
 * - guest: View-only access, for babysitters or visitors
 * ============================================================================
 */
export type UserRole = 'parent' | 'child' | 'guest';


/**
 * USER INTERFACE
 * ============================================================================
 * Represents a family member in the system.
 *
 * PROPERTIES EXPLAINED:
 * - id: Unique identifier (UUID format)
 * - name: Display name ("Alex", "Jordan", "Emma")
 * - role: Permission level (parent, child, guest)
 * - color: Hex color for calendar/task display ("#3B82F6")
 * - pin: Hashed PIN for authentication (never store plain text!)
 * - email: Optional email for notifications
 * - avatarUrl: Optional profile picture URL
 * - preferences: User-specific settings (JSON object)
 * - createdAt: When the user was created
 * - updatedAt: When the user was last modified
 *
 * EXAMPLE:
 * {
 *   id: "550e8400-e29b-41d4-a716-446655440000",
 *   name: "Alex",
 *   role: "parent",
 *   color: "#3B82F6",
 *   pin: "$2b$12$...", // bcrypt hash
 *   email: "alex@example.com",
 *   avatarUrl: "/avatars/alex.jpg",
 *   preferences: { theme: "dark" },
 *   createdAt: new Date("2024-01-01"),
 *   updatedAt: new Date("2024-01-15")
 * }
 * ============================================================================
 */
export interface User {
  /** Unique identifier (UUID) */
  id: string;

  /** Display name shown on dashboard */
  name: string;

  /** Permission level */
  role: UserRole;

  /** Hex color code for UI elements (e.g., "#3B82F6") */
  color: string;

  /** Hashed PIN (bcrypt) - undefined for users without PIN */
  pin?: string;

  /** Email address for notifications (optional) */
  email?: string;

  /** URL to profile picture (optional) */
  avatarUrl?: string;

  /** User-specific preferences (flexible JSON object) */
  preferences: UserPreferences;

  /** Timestamp when user was created */
  createdAt: Date;

  /** Timestamp when user was last updated */
  updatedAt: Date;
}


/**
 * USER PREFERENCES
 * ============================================================================
 * User-specific settings that can be customized per person.
 * All fields are optional - defaults are used if not specified.
 *
 * EXAMPLE PREFERENCES:
 * {
 *   theme: "dark",
 *   defaultCalendarView: "week",
 *   showCompletedTasks: false,
 *   reminderNotifications: true
 * }
 * ============================================================================
 */
export interface UserPreferences {
  /** Preferred theme: 'light', 'dark', or 'system' (use system preference) */
  theme?: 'light' | 'dark' | 'system';

  /** Default calendar view when opening calendar */
  defaultCalendarView?: 'day' | 'week' | 'twoWeek' | 'month';

  /** Whether to show completed tasks in task list */
  showCompletedTasks?: boolean;

  /** Whether to show completed chores */
  showCompletedChores?: boolean;

  /** Enable reminder notifications */
  reminderNotifications?: boolean;

  /** Enable sound effects */
  soundEnabled?: boolean;

  /**
   * Additional custom preferences
   * This allows for extensibility without changing the type
   */
  [key: string]: unknown;
}


/**
 * CREATE USER INPUT
 * ============================================================================
 * Type for creating a new user. Similar to User but without
 * system-generated fields (id, createdAt, updatedAt).
 *
 * Using Omit<User, ...> ensures this type stays in sync with User.
 * If we add a field to User, this type is automatically updated.
 *
 * USAGE:
 *   const newUser: CreateUserInput = {
 *     name: "New Family Member",
 *     role: "child",
 *     color: "#10B981",
 *     preferences: {}
 *   };
 * ============================================================================
 */
export type CreateUserInput = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;


/**
 * UPDATE USER INPUT
 * ============================================================================
 * Type for updating an existing user. All fields are optional except id.
 *
 * Partial<T> makes all properties of T optional.
 * Pick<T, K> selects only the specified properties from T.
 *
 * USAGE:
 *   const update: UpdateUserInput = {
 *     id: "existing-user-id",
 *     name: "New Name"  // Only updating the name
 *   };
 * ============================================================================
 */
export type UpdateUserInput = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> & Pick<User, 'id'>;


/**
 * PERMISSIONS
 * ============================================================================
 * Defines what actions each role can perform.
 * This is the single source of truth for access control.
 *
 * USAGE:
 *   import { PERMISSIONS } from '@/types/user';
 *
 *   if (PERMISSIONS[user.role].canEditAnyEvent) {
 *     // Allow editing
 *   }
 *
 * NOTE: All permission checks should use this object, not hard-coded values.
 * This makes it easy to adjust permissions in one place.
 * ============================================================================
 */
export const PERMISSIONS: Record<UserRole, RolePermissions> = {
  parent: {
    // Calendar permissions
    canViewAllCalendars: true,
    canViewOwnCalendar: true,
    canAddEvent: true,
    canEditOwnEvent: true,
    canDeleteOwnEvent: true,
    canEditAnyEvent: true,
    canDeleteAnyEvent: true,

    // Task permissions
    canManageTasks: true,
    canCompleteTasks: true,
    canDeleteTasks: true,

    // Chore permissions
    canManageChores: true,
    canCompleteChores: true,
    canApproveChores: true,
    canAssignChores: true,

    // Settings permissions
    canModifySettings: true,
    canManageUsers: true,

    // Feature permissions
    canAccessSmartHome: true,
    canViewLocationMap: true,
    canPostMessages: true,
    canDeleteAnyMessage: true,
    canToggleAwayMode: true,
  },

  child: {
    // Calendar permissions
    canViewAllCalendars: true,
    canViewOwnCalendar: true,
    canAddEvent: true,
    canEditOwnEvent: true,
    canDeleteOwnEvent: false,  // Children can't delete events
    canEditAnyEvent: false,
    canDeleteAnyEvent: false,

    // Task permissions
    canManageTasks: true,      // Can manage own tasks
    canCompleteTasks: true,
    canDeleteTasks: false,

    // Chore permissions
    canManageChores: true,     // Can manage own chores
    canCompleteChores: true,
    canApproveChores: false,   // Parents must approve
    canAssignChores: false,    // Can't assign to others

    // Settings permissions
    canModifySettings: false,
    canManageUsers: false,

    // Feature permissions
    canAccessSmartHome: false,
    canViewLocationMap: true,
    canPostMessages: true,
    canDeleteAnyMessage: false,  // Can only delete own messages
    canToggleAwayMode: false,
  },

  guest: {
    // Calendar permissions
    canViewAllCalendars: true,  // View-only
    canViewOwnCalendar: false,
    canAddEvent: false,
    canEditOwnEvent: false,
    canDeleteOwnEvent: false,
    canEditAnyEvent: false,
    canDeleteAnyEvent: false,

    // Task permissions
    canManageTasks: false,
    canCompleteTasks: false,
    canDeleteTasks: false,

    // Chore permissions
    canManageChores: false,
    canCompleteChores: false,
    canApproveChores: false,
    canAssignChores: false,

    // Settings permissions
    canModifySettings: false,
    canManageUsers: false,

    // Feature permissions
    canAccessSmartHome: false,
    canViewLocationMap: false,
    canPostMessages: false,
    canDeleteAnyMessage: false,
    canToggleAwayMode: false,
  },
};


/**
 * ROLE PERMISSIONS INTERFACE
 * ============================================================================
 * Defines the structure of permissions for a role.
 * Used by the PERMISSIONS object above.
 * ============================================================================
 */
export interface RolePermissions {
  // Calendar
  canViewAllCalendars: boolean;
  canViewOwnCalendar: boolean;
  canAddEvent: boolean;
  canEditOwnEvent: boolean;
  canDeleteOwnEvent: boolean;
  canEditAnyEvent: boolean;
  canDeleteAnyEvent: boolean;

  // Tasks
  canManageTasks: boolean;
  canCompleteTasks: boolean;
  canDeleteTasks: boolean;

  // Chores
  canManageChores: boolean;
  canCompleteChores: boolean;
  canApproveChores: boolean;
  canAssignChores: boolean;

  // Settings
  canModifySettings: boolean;
  canManageUsers: boolean;

  // Features
  canAccessSmartHome: boolean;
  canViewLocationMap: boolean;
  canPostMessages: boolean;
  canDeleteAnyMessage: boolean;
  canToggleAwayMode: boolean;
}


/**
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Check if a user has a specific permission
 *
 * @param user - The user to check
 * @param permission - The permission key to check
 * @returns true if the user has the permission
 *
 * @example
 * if (hasPermission(currentUser, 'canEditAnyEvent')) {
 *   // Show edit button
 * }
 */
export function hasPermission(
  user: User,
  permission: keyof RolePermissions
): boolean {
  return PERMISSIONS[user.role][permission];
}


/**
 * Check if a user is a parent (full admin)
 *
 * @param user - The user to check
 * @returns true if the user is a parent
 */
export function isParent(user: User): boolean {
  return user.role === 'parent';
}


/**
 * Check if a user is a child
 *
 * @param user - The user to check
 * @returns true if the user is a child
 */
export function isChild(user: User): boolean {
  return user.role === 'child';
}


/**
 * Check if a user is a guest
 *
 * @param user - The user to check
 * @returns true if the user is a guest
 */
export function isGuest(user: User): boolean {
  return user.role === 'guest';
}
